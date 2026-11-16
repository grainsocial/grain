//! `/space-blob?space=&repo=&cid=`: a picture a record in a space
//! references, read from `repo`'s PDS with the caller's credential
//! ([`super::credential`]), as an `<img>` asks for it with the cookie, or
//! an app with a delegation token. A caller the space does not admit is
//! answered 404, as for a picture there is not.
//!
//! It is kept by no cache, as no answer of a space's is
//! ([`super::routes`]). Its type is read from its first bytes, and
//! only a picture's is said; the rest are `application/octet-stream`,
//! under a policy that runs nothing.

use super::credential;
use crate::App;
use crate::read::Params;
use crate::xrpc::Failure;
use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::Response;
use grain::space;
use grain::xrpc::XrpcError;
use std::sync::Arc;

pub const PATH: &str = "/space-blob";

/// What a service token calling for a picture names as its method.
const LXM: &str = super::pool::GET;

/// The type of an image whose bytes start `bytes`, if it is one served.
fn image_type(bytes: &[u8]) -> Option<&'static str> {
    let at = |from: usize, sig: &[u8]| bytes.get(from..from + sig.len()) == Some(sig);
    if at(0, b"\xFF\xD8\xFF") {
        Some("image/jpeg")
    } else if at(0, b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if at(0, b"RIFF") && at(8, b"WEBP") {
        Some("image/webp")
    } else if at(0, b"GIF8") {
        Some("image/gif")
    } else if at(4, b"ftypavif") {
        Some("image/avif")
    } else {
        None
    }
}

pub async fn space_blob(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Query(params): Query<Vec<(String, String)>>,
) -> Result<Response, Failure> {
    let params = Params(params);
    let (space, repo, cid) = (
        params.required("space")?,
        params.required("repo")?,
        params.required("cid")?,
    );
    let not_found = || Failure::new(StatusCode::NOT_FOUND, "NotFound", "No such picture.");
    if space::parse(space).is_none() || !repo.starts_with("did:") {
        return Err(not_found());
    }
    let read = async {
        let credential = credential(&app, &headers, LXM, space).await?;
        let read = space::blob_with(&app.ctx, &credential, repo, cid).await;
        read.map_err(|e| {
            // No such picture there reads as no such picture.
            let gone = XrpcError::of(&e).is_some_and(|x| x.error == "BlobNotFound");
            let failed = super::refused(&app, &credential, e);
            if gone { super::not_member() } else { failed }
        })
    };
    // Not theirs to read reads as no such picture.
    let bytes = match read.await {
        Err(e) if e.error == "NotAuthorized" => return Err(not_found()),
        read => read?,
    };
    let kind = image_type(&bytes).unwrap_or("application/octet-stream");
    let res = Response::builder()
        .header(header::CONTENT_TYPE, kind)
        .header(
            header::CONTENT_SECURITY_POLICY,
            "default-src 'none'; sandbox",
        )
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff")
        .body(Body::from(bytes));
    Ok(res.expect("a response of static parts"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pictures_are_told_by_their_first_bytes() {
        let mut webp = b"RIFF\0\0\0\0WEBPVP8 ".to_vec();
        webp.push(0);
        assert_eq!(image_type(b"\xFF\xD8\xFF\xE0"), Some("image/jpeg"));
        assert_eq!(image_type(b"\x89PNG\r\n\x1a\n\0"), Some("image/png"));
        assert_eq!(image_type(&webp), Some("image/webp"));
        assert_eq!(image_type(b"GIF89a"), Some("image/gif"));
        assert_eq!(image_type(b"\0\0\0\x1cftypavif"), Some("image/avif"));
        assert_eq!(image_type(b"<svg"), None);
        assert_eq!(image_type(b""), None);
    }
}
