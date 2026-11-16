//! A minimal XRPC client over the shared HTTP connection pool.

use crate::crypto::P256Key;
use crate::oauth;
use crate::telemetry;
use anyhow::Result;
use bytes::Bytes;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;
use std::sync::Arc;

/// An XRPC call that reached the server and was refused.
#[derive(Debug, Clone, PartialEq)]
pub struct XrpcError {
    pub status: u16,
    pub error: String,
    pub message: String,
    /// When a rate limit that refused the call lets writes in again, in
    /// seconds since the epoch, from its `RateLimit-Reset` header.
    pub reset: Option<u64>,
}

impl fmt::Display for XrpcError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} ({}): {}", self.error, self.status, self.message)
    }
}

impl std::error::Error for XrpcError {}

impl XrpcError {
    /// The XRPC error inside `err`, if that is what it is.
    pub fn of(err: &anyhow::Error) -> Option<&XrpcError> {
        err.downcast_ref()
    }

    fn from_body(status: u16, body: &[u8], reset: Option<u64>) -> XrpcError {
        #[derive(Deserialize, Default)]
        struct Body {
            error: Option<String>,
            message: Option<String>,
        }
        let parsed: Body = serde_json::from_slice(body).unwrap_or_default();
        XrpcError {
            status,
            error: parsed.error.unwrap_or_else(|| format!("HTTP{status}")),
            message: parsed
                .message
                .unwrap_or_else(|| String::from_utf8_lossy(body).chars().take(200).collect()),
            reset,
        }
    }
}

/// What lets a request in.
#[derive(Clone)]
pub enum Auth {
    /// An app password session's access token, or a service token.
    Bearer(String),
    /// An OAuth access token, bound to the key that signs a DPoP proof for
    /// each request.
    Dpop { token: String, key: Arc<P256Key> },
    /// Headers made once, such as a space credential's.
    Headers(Vec<(String, String)>),
}

impl Auth {
    pub fn bearer(token: &str) -> Auth {
        Auth::Bearer(token.to_string())
    }

    /// The headers for a `method` request to `url`.
    pub fn headers(&self, method: &str, url: &str) -> Vec<(String, String)> {
        match self {
            Auth::Bearer(token) => vec![("authorization".into(), format!("Bearer {token}"))],
            Auth::Dpop { token, key } => vec![
                ("authorization".into(), format!("DPoP {token}")),
                ("dpop".into(), oauth::proof(key, method, url, Some(token))),
            ],
            Auth::Headers(headers) => headers.clone(),
        }
    }
}

/// A blob as a record references it, and as `uploadBlob` answers.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BlobRef {
    #[serde(rename = "$type")]
    pub kind: String,
    #[serde(rename = "ref")]
    pub link: Link,
    pub mime_type: String,
    pub size: u64,
}

/// A CID, as JSON carries one.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Link {
    #[serde(rename = "$link")]
    pub cid: String,
}

#[derive(Clone)]
pub struct Xrpc {
    http: reqwest::Client,
    pub base: String,
}

impl Xrpc {
    pub fn new(http: reqwest::Client, base: &str) -> Xrpc {
        Xrpc {
            http,
            base: base.trim_end_matches('/').to_string(),
        }
    }

    fn url(&self, nsid: &str) -> String {
        format!("{}/xrpc/{nsid}", self.base)
    }

    pub async fn query<T: DeserializeOwned>(
        &self,
        nsid: &str,
        params: &[(&str, &str)],
        auth: Option<&Auth>,
    ) -> Result<T> {
        let url = self.url(nsid);
        let res = self
            .send("GET", &url, auth, || self.http.get(&url).query(params))
            .await?;
        json(res).await
    }

    /// A query's answer as it came: its headers, and its body unparsed.
    pub async fn query_raw(
        &self,
        nsid: &str,
        params: &[(&str, &str)],
        auth: Option<&Auth>,
    ) -> Result<(reqwest::header::HeaderMap, Bytes)> {
        let url = self.url(nsid);
        let res = self
            .send("GET", &url, auth, || self.http.get(&url).query(params))
            .await?;
        let headers = res.headers().clone();
        Ok((headers, ok(res).await?))
    }

    /// Calls a procedure. `body: None` sends none, which a procedure that
    /// takes no input requires: the reference PDS refuses even `{}`.
    pub async fn procedure<T: DeserializeOwned>(
        &self,
        nsid: &str,
        body: Option<&Value>,
        auth: Option<&Auth>,
    ) -> Result<T> {
        let url = self.url(nsid);
        let res = self
            .send("POST", &url, auth, || {
                let req = self.http.post(&url);
                match body {
                    Some(body) => req.json(body),
                    None => req,
                }
            })
            .await?;
        json(res).await
    }

    /// A procedure whose input is raw bytes of `mime`.
    pub async fn procedure_bytes<T: DeserializeOwned>(
        &self,
        nsid: &str,
        body: Vec<u8>,
        mime: &str,
        auth: Option<&Auth>,
    ) -> Result<T> {
        let url = self.url(nsid);
        let body = Bytes::from(body);
        let res = self
            .send("POST", &url, auth, || {
                self.http
                    .post(&url)
                    .header(reqwest::header::CONTENT_TYPE, mime)
                    .body(body.clone())
            })
            .await?;
        json(res).await
    }

    pub async fn upload_blob(&self, bytes: Vec<u8>, mime: &str, auth: &Auth) -> Result<BlobRef> {
        #[derive(Deserialize)]
        struct Out {
            blob: BlobRef,
        }
        let out: Out = self
            .procedure_bytes("com.atproto.repo.uploadBlob", bytes, mime, Some(auth))
            .await?;
        Ok(out.blob)
    }

    /// Sends the request `make` builds, with `auth`'s headers. A DPoP
    /// request the server refuses for want of a fresh nonce is sent again
    /// once, with the nonce it named.
    async fn send(
        &self,
        method: &str,
        url: &str,
        auth: Option<&Auth>,
        make: impl Fn() -> reqwest::RequestBuilder,
    ) -> Result<reqwest::Response> {
        let attempt = |resend| {
            let headers = auth.map(|a| a.headers(method, url)).unwrap_or_default();
            telemetry::send(with(make(), &headers), resend)
        };
        let res = attempt(0).await?;
        if matches!(auth, Some(Auth::Dpop { .. })) && oauth::nonce_refused(url, &res) {
            return Ok(attempt(1).await?);
        }
        Ok(res)
    }

    pub async fn get_blob(&self, did: &str, cid: &str) -> Result<Vec<u8>> {
        let req = self.http.get(self.url("com.atproto.sync.getBlob"));
        let res = telemetry::send(req.query(&[("did", did), ("cid", cid)]), 0).await?;
        Ok(ok(res).await?.to_vec())
    }

    /// A blob a record in `space` references. The repo is named `repo`,
    /// as every space read names it.
    pub async fn get_space_blob(
        &self,
        space: &str,
        did: &str,
        cid: &str,
        auth: &Auth,
    ) -> Result<Vec<u8>> {
        let url = self.url("com.atproto.space.getBlob");
        let res = self
            .send("GET", &url, Some(auth), || {
                self.http
                    .get(&url)
                    .query(&[("space", space), ("repo", did), ("cid", cid)])
            })
            .await?;
        Ok(ok(res).await?.to_vec())
    }
}

fn with(mut req: reqwest::RequestBuilder, headers: &[(String, String)]) -> reqwest::RequestBuilder {
    for (name, value) in headers {
        req = req.header(name, value);
    }
    req
}

async fn ok(res: reqwest::Response) -> Result<Bytes> {
    let status = res.status().as_u16();
    let server = res.url().origin().ascii_serialization();
    let reset = res
        .headers()
        .get("ratelimit-reset")
        .and_then(|v| v.to_str().ok()?.parse().ok());
    let body = res.bytes().await?;
    if (200..300).contains(&status) {
        Ok(body)
    } else {
        let refused = XrpcError::from_body(status, &body, reset);
        crate::identity::heard(&server, &refused);
        Err(refused.into())
    }
}

/// The response as JSON. A procedure with no output answers with an empty
/// body, which reads as `null`.
async fn json<T: DeserializeOwned>(res: reqwest::Response) -> Result<T> {
    let body = ok(res).await?;
    let body: &[u8] = if body.is_empty() { b"null" } else { &body };
    Ok(serde_json::from_slice(body)?)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::{Arc, Mutex};

    /// A server that answers every request with `status`, `headers` and
    /// `body`, and keeps each request it was sent, head and body.
    pub(crate) fn serving(
        status: &'static str,
        headers: &'static str,
        body: &'static str,
    ) -> (String, Arc<Mutex<Vec<String>>>) {
        use std::io::Write;
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let asked = Arc::new(Mutex::new(Vec::new()));
        let kept = asked.clone();
        std::thread::spawn(move || {
            for stream in listener.incoming() {
                let mut stream = stream.unwrap();
                let request = read_request(&mut stream);
                kept.lock().unwrap().push(request);
                let answer = format!(
                    "HTTP/1.1 {status}\r\n{headers}content-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(answer.as_bytes());
            }
        });
        (url, asked)
    }

    /// One request from `stream`, its head and as much body as its
    /// `content-length` says, which may come in more than one read.
    pub(crate) fn read_request(stream: &mut impl std::io::Read) -> String {
        let mut got = Vec::new();
        let mut buf = [0u8; 16 * 1024];
        loop {
            let n = stream.read(&mut buf).unwrap();
            got.extend_from_slice(&buf[..n]);
            let text = String::from_utf8_lossy(&got).into_owned();
            let Some((head, body)) = text.split_once("\r\n\r\n") else {
                if n == 0 {
                    return text;
                }
                continue;
            };
            let length = head
                .lines()
                .find_map(|l| {
                    l.to_ascii_lowercase()
                        .strip_prefix("content-length: ")?
                        .parse()
                        .ok()
                })
                .unwrap_or(0);
            if n == 0 || body.len() >= length {
                return text;
            }
        }
    }

    #[test]
    fn refusals() {
        let said = XrpcError::from_body(
            400,
            br#"{"error":"InvalidRequest","message":"bad cursor"}"#,
            None,
        );
        assert_eq!(said.to_string(), "InvalidRequest (400): bad cursor");
        let bare = XrpcError::from_body(502, "x".repeat(300).as_bytes(), Some(9));
        assert_eq!(bare.error, "HTTP502");
        assert_eq!(bare.message.len(), 200);
        assert_eq!(bare.reset, Some(9));
        let err = anyhow::Error::new(said.clone()).context("listing");
        assert_eq!(XrpcError::of(&err), Some(&said));
        assert!(XrpcError::of(&anyhow::anyhow!("other")).is_none());
    }

    #[test]
    fn auth_headers() {
        let bearer = Auth::bearer("tok").headers("GET", "http://x");
        assert_eq!(
            bearer,
            [("authorization".to_string(), "Bearer tok".to_string())]
        );
        let fixed = vec![("x-credential".to_string(), "c".to_string())];
        assert_eq!(Auth::Headers(fixed.clone()).headers("POST", "u"), fixed);
        let key = Arc::new(P256Key::generate());
        let dpop = Auth::Dpop {
            token: "tok".into(),
            key: key.clone(),
        };
        let headers = dpop.headers("GET", "http://pds.test/xrpc/x.y.z?a=1");
        assert_eq!(headers[0], ("authorization".into(), "DPoP tok".into()));
        let (_, claims) = crate::crypto::jwt_parts(&headers[1].1).unwrap();
        assert_eq!(claims["htu"], "http://pds.test/xrpc/x.y.z");
        assert_eq!(claims["ath"], oauth::sha256("tok"));
    }

    #[tokio::test]
    async fn queries_and_procedures() {
        let (url, asked) = serving("200 OK", "content-type: application/json\r\n", r#"{"a":1}"#);
        let xrpc = Xrpc::new(reqwest::Client::new(), &format!("{url}/"));
        assert_eq!(xrpc.base, url);
        let got: Value = xrpc
            .query("x.y.z", &[("q", "1 2")], Some(&Auth::bearer("tok")))
            .await
            .unwrap();
        assert_eq!(got, json!({"a": 1}));
        let (headers, body) = xrpc.query_raw("x.y.z", &[], None).await.unwrap();
        assert_eq!(headers["content-type"], "application/json");
        assert_eq!(&body[..], br#"{"a":1}"#);
        let _: Value = xrpc
            .procedure("x.y.p", Some(&json!({"b": 2})), None)
            .await
            .unwrap();
        let _: Value = xrpc.procedure("x.y.p", None, None).await.unwrap();
        let _: Value = xrpc
            .procedure_bytes("x.y.b", b"raw".to_vec(), "image/jpeg", None)
            .await
            .unwrap();
        assert_eq!(
            xrpc.get_blob("did:plc:a", "bafy").await.unwrap(),
            br#"{"a":1}"#
        );
        let asked = asked.lock().unwrap();
        assert!(asked[0].starts_with("GET /xrpc/x.y.z?q=1+2 "));
        assert!(asked[0].contains("authorization: Bearer tok"));
        assert!(!asked[1].contains("authorization"));
        assert!(asked[2].starts_with("POST /xrpc/x.y.p "));
        assert!(asked[2].ends_with(r#"{"b":2}"#));
        assert!(!asked[3].contains("content-type"));
        assert!(asked[4].contains("content-type: image/jpeg"));
        assert!(asked[4].ends_with("raw"));
        assert!(
            asked[5].starts_with("GET /xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aa&cid=bafy ")
        );
    }

    #[tokio::test]
    async fn blobs() {
        let blob = r#"{"blob":{"$type":"blob","ref":{"$link":"bafkrei"},"mimeType":"image/jpeg","size":3}}"#;
        let (url, asked) = serving("200 OK", "", blob);
        let xrpc = Xrpc::new(reqwest::Client::new(), &url);
        let auth = Auth::bearer("tok");
        let got = xrpc
            .upload_blob(b"jpg".to_vec(), "image/jpeg", &auth)
            .await
            .unwrap();
        assert_eq!(got.link.cid, "bafkrei");
        assert_eq!((got.mime_type.as_str(), got.size), ("image/jpeg", 3));
        let text = serde_json::to_value(&got).unwrap();
        assert_eq!(text["ref"]["$link"], "bafkrei");
        assert_eq!(text["$type"], "blob");
        xrpc.get_space_blob("at://did:plc:o/space/x/y", "did:plc:m", "bafy", &auth)
            .await
            .unwrap();
        let asked = asked.lock().unwrap();
        assert!(asked[0].starts_with("POST /xrpc/com.atproto.repo.uploadBlob "));
        // A space read names the repo `repo`, never `did`.
        assert!(
            asked[1].contains("&repo=did%3Aplc%3Am&cid=bafy "),
            "{}",
            asked[1]
        );
    }

    #[tokio::test]
    async fn an_empty_answer_is_null_and_a_refusal_an_error() {
        let (empty, _) = serving("200 OK", "", "");
        let xrpc = Xrpc::new(reqwest::Client::new(), &empty);
        let got: Value = xrpc.procedure("x.y.p", None, None).await.unwrap();
        assert_eq!(got, Value::Null);

        let (limited, _) = serving(
            "429 Too Many Requests",
            "ratelimit-reset: 1700000000\r\n",
            r#"{"error":"RateLimitExceeded","message":"slow down"}"#,
        );
        let xrpc = Xrpc::new(reqwest::Client::new(), &limited);
        let err = xrpc.query::<Value>("x.y.z", &[], None).await.unwrap_err();
        let refused = XrpcError::of(&err).unwrap();
        assert_eq!(refused.status, 429);
        assert_eq!(refused.error, "RateLimitExceeded");
        assert_eq!(refused.reset, Some(1_700_000_000));
        assert!(xrpc.get_blob("did:plc:a", "c").await.is_err());

        let (garbled, _) = serving("200 OK", "", "not json");
        let xrpc = Xrpc::new(reqwest::Client::new(), &garbled);
        let err = xrpc.query::<Value>("x.y.z", &[], None).await.unwrap_err();
        assert!(XrpcError::of(&err).is_none());
    }
}
