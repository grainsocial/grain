//! Clef, Cloudflare's decision model on Workers AI: asked a set of narrow
//! typed questions about a state, and the images beside it, it answers
//! each with probabilities.
//!
//! A request is `{state, model, questions, images?}`, posted with the
//! account's Workers AI token; the answer comes wrapped as Workers AI
//! wraps every model's, `{result, success, errors}`. Each answer is made a
//! score from 0 to 1 ([`Signal`]), whatever its type, so that a classifier
//! may hold a mixed set of questions to one threshold.

use serde_json::{Value, json};
use std::time::Duration;

/// Where Clef is asked, and as whom.
#[derive(Clone, Default, PartialEq)]
pub struct Config {
    /// The model's URL: Workers AI's for `CLOUDFLARE_ACCOUNT_ID` and the
    /// model, unless `--clef-url` names another, as tests do.
    pub url: String,
    /// `clef`, unless `--clef-model` says `clef-flash`. The thresholds
    /// were tuned on `clef`, and do not carry to the other.
    pub model: String,
    /// `CLOUDFLARE_AI_TOKEN`: a token for Workers AI and nothing else.
    pub token: String,
}

/// Its token is never written out.
impl std::fmt::Debug for Config {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Config")
            .field("url", &self.url)
            .field("model", &self.model)
            .finish_non_exhaustive()
    }
}

impl Config {
    /// Clef as grain-serve's flags and environment name it, `get` reading
    /// each, if the environment names an account and a token.
    /// `CLOUDFLARE_API_TOKEN` is not read: on a host that also manages
    /// DNS, that is the token that writes zones.
    pub fn given(get: impl Fn(&str) -> Option<String>) -> Option<Config> {
        let set = |name: &str| get(name).filter(|v| !v.is_empty());
        let (account, token) = (set("CLOUDFLARE_ACCOUNT_ID")?, set("CLOUDFLARE_AI_TOKEN")?);
        let model = set("--clef-model").unwrap_or_else(|| "clef".into());
        let url = set("--clef-url").unwrap_or_else(|| {
            format!(
                "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/cloudflare/{model}"
            )
        });
        Some(Config { url, model, token })
    }
}

/// An answer, made a score from 0 to 1.
#[derive(Debug, Clone, PartialEq)]
pub struct Signal {
    pub score: f64,
    /// `noul`, `choice`, `score`, or `local` for one no model gave.
    pub kind: String,
    /// A choice's option, or a score's level.
    pub choice: Option<String>,
    pub confidence: Option<f64>,
}

impl Signal {
    /// A score of `score`, from no model.
    pub fn local(score: f64) -> Signal {
        Signal {
            score,
            kind: "local".into(),
            choice: None,
            confidence: None,
        }
    }

    /// As the classification keeps it.
    pub fn json(&self) -> Value {
        let mut out = json!({ "score": self.score, "type": self.kind });
        if let Some(choice) = &self.choice {
            out["choice"] = choice.as_str().into();
        }
        if let Some(confidence) = self.confidence {
            out["confidence"] = confidence.into();
        }
        out
    }

    /// `answer`, as Clef gives one: a Noul is already a probability; a
    /// Choice is the probability of the option it picked, and a Score its
    /// level across the levels, each kept beside the number, which alone
    /// loses which was picked.
    pub fn from_answer(answer: &Value) -> Signal {
        let kind = answer["type"].as_str().unwrap_or("unknown").to_string();
        let confidence = answer["confidence"].as_f64();
        match kind.as_str() {
            "noul" => Signal {
                score: answer["noul"].as_f64().unwrap_or(0.0),
                kind,
                choice: None,
                confidence: None,
            },
            "choice" => {
                let choice = answer["choice"].as_str().unwrap_or_default();
                Signal {
                    score: answer["probabilities"][choice].as_f64().unwrap_or(0.0),
                    choice: Some(choice.into()),
                    kind,
                    confidence,
                }
            }
            "score" => {
                let levels = answer["probabilities"].as_object().map_or(0, |p| p.len());
                let raw = answer["score"].as_f64().unwrap_or(0.0);
                Signal {
                    score: if levels > 1 {
                        raw / (levels - 1) as f64
                    } else {
                        raw
                    },
                    choice: Some(answer["score"].to_string()),
                    kind,
                    confidence,
                }
            }
            _ => Signal {
                score: 0.0,
                kind,
                choice: None,
                confidence: None,
            },
        }
    }
}

/// What Clef answered: each question's signal, by its key, the model that
/// answered, and the tokens the request took.
#[derive(Debug, Clone, PartialEq)]
pub struct Answers {
    pub signals: Vec<(String, Signal)>,
    pub model: String,
    pub input_tokens: i64,
}

/// How often, and how far apart, a request is tried.
#[derive(Debug, Clone, Copy)]
pub struct Tries {
    pub attempts: u32,
    /// The wait after the first failure, doubled after each one after.
    pub backoff: Duration,
}

impl Default for Tries {
    fn default() -> Tries {
        Tries {
            attempts: 4,
            backoff: Duration::from_millis(500),
        }
    }
}

/// Statuses a later try may get past.
fn retryable(status: u16) -> bool {
    matches!(status, 408 | 429 | 500 | 502 | 503 | 504)
}

/// Asks Clef `questions` of `state`, with `images`, each a `data:` URL,
/// as Clef takes them inline. A 408, 429 or 5xx, or no answer at all, is
/// tried again, after `retry-after` where the answer says, up to
/// `tries.attempts` in all; anything else Clef refuses is final.
pub async fn ask(
    http: &reqwest::Client,
    config: &Config,
    state: &Value,
    questions: &Value,
    images: &[String],
    tries: Tries,
) -> anyhow::Result<Answers> {
    let mut body = json!({ "state": state, "model": config.model, "questions": questions });
    if !images.is_empty() {
        body["images"] = images.into();
    }
    let mut last = anyhow::anyhow!("Clef was not asked");
    for attempt in 0..tries.attempts {
        let wait = tries.backoff * 2u32.pow(attempt);
        let sent = http
            .post(&config.url)
            .bearer_auth(&config.token)
            .json(&body)
            .send()
            .await;
        let res = match sent {
            Ok(res) => res,
            Err(e) => {
                last = anyhow::anyhow!("Clef: {e}");
                tokio::time::sleep(wait).await;
                continue;
            }
        };
        let status = res.status().as_u16();
        if !res.status().is_success() {
            let after = res.headers().get("retry-after");
            let after = after.and_then(|v| v.to_str().ok()?.parse::<u64>().ok());
            let text: String = res
                .text()
                .await
                .unwrap_or_default()
                .chars()
                .take(200)
                .collect();
            last = anyhow::anyhow!("Clef {status}: {text}");
            if !retryable(status) {
                return Err(last);
            }
            let after = after.filter(|s| *s > 0).map(Duration::from_secs);
            tokio::time::sleep(after.unwrap_or(wait)).await;
            continue;
        }
        let answer: Value = res.json().await?;
        if answer["success"] == false {
            anyhow::bail!("Clef: {}", answer["errors"]);
        }
        let out = answer.get("result").unwrap_or(&answer);
        let signals = out["answers"].as_object().into_iter().flatten();
        let signals = signals
            .map(|(key, a)| (key.clone(), Signal::from_answer(a)))
            .collect();
        return Ok(Answers {
            signals,
            model: out["model"].as_str().unwrap_or(&config.model).to_string(),
            input_tokens: out["usage"]["input_tokens"].as_i64().unwrap_or(0),
        });
    }
    Err(last)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clef_is_named_by_flags_and_the_environment() {
        let vars = |pairs: &'static [(&str, &str)]| {
            move |name: &str| {
                let found = pairs.iter().find(|(k, _)| *k == name);
                found.map(|(_, v)| v.to_string())
            }
        };
        assert_eq!(Config::given(vars(&[])), None);
        assert_eq!(
            Config::given(vars(&[("CLOUDFLARE_ACCOUNT_ID", "acct")])),
            None
        );
        let config = Config::given(vars(&[
            ("CLOUDFLARE_ACCOUNT_ID", "acct"),
            ("CLOUDFLARE_AI_TOKEN", "secret-token"),
        ]))
        .unwrap();
        assert_eq!(
            config.url,
            "https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/cloudflare/clef"
        );
        assert_eq!(config.model, "clef");
        assert!(!format!("{config:?}").contains("secret-token"));
        let named = Config::given(vars(&[
            ("CLOUDFLARE_ACCOUNT_ID", "acct"),
            ("CLOUDFLARE_AI_TOKEN", "t"),
            ("--clef-model", "clef-flash"),
            ("--clef-url", "http://127.0.0.1:1/clef"),
        ]))
        .unwrap();
        assert_eq!(
            (named.url.as_str(), named.model.as_str()),
            ("http://127.0.0.1:1/clef", "clef-flash")
        );
    }

    #[test]
    fn every_answer_is_a_score() {
        let noul = Signal::from_answer(&json!({"type": "noul", "noul": 0.8}));
        assert_eq!((noul.score, noul.kind.as_str()), (0.8, "noul"));
        let choice = Signal::from_answer(&json!({
            "type": "choice", "choice": "b", "confidence": 0.9,
            "probabilities": {"a": 0.1, "b": 0.7}
        }));
        assert_eq!(choice.score, 0.7);
        assert_eq!(choice.choice.as_deref(), Some("b"));
        let score = Signal::from_answer(&json!({
            "type": "score", "score": 2, "probabilities": {"0": 0.1, "1": 0.2, "2": 0.3, "3": 0.4}
        }));
        assert!((score.score - 2.0 / 3.0).abs() < 1e-9);
        let flat = Signal::from_answer(&json!({"type": "score", "score": 1}));
        assert_eq!(flat.score, 1.0);
        let odd = Signal::from_answer(&json!({"oops": true}));
        assert_eq!((odd.score, odd.kind.as_str()), (0.0, "unknown"));
        assert_eq!(
            choice.json(),
            json!({"score": 0.7, "type": "choice", "choice": "b", "confidence": 0.9})
        );
        assert_eq!(
            Signal::local(1.0).json(),
            json!({"score": 1.0, "type": "local"})
        );
    }
}
