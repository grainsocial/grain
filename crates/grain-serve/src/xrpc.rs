//! XRPC failures as grain-serve answers them: a status and atproto's
//! `{error, message}`.

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// A call refused, or one that failed on the way.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Failure {
    pub status: StatusCode,
    /// The error's name: one the method's lexicon declares, or one of
    /// XRPC's own, such as `InvalidRequest`.
    pub error: &'static str,
    pub message: String,
}

impl Failure {
    pub fn new(status: StatusCode, error: &'static str, message: impl Into<String>) -> Failure {
        Failure {
            status,
            error,
            message: message.into(),
        }
    }

    /// A method only an account may call, called by no one: 401
    /// `AuthenticationRequired`.
    pub fn authentication_required() -> Failure {
        let why = "a service token is required";
        Failure::new(StatusCode::UNAUTHORIZED, "AuthenticationRequired", why)
    }

    /// A request that does not say what it must: 400 `InvalidRequest`.
    pub fn invalid(message: impl Into<String>) -> Failure {
        Failure::new(StatusCode::BAD_REQUEST, "InvalidRequest", message)
    }
}

/// The index failing to answer: 500, its cause logged, not told.
impl From<rusqlite::Error> for Failure {
    fn from(e: rusqlite::Error) -> Failure {
        tracing::error!(error = %e, "reading the index");
        let why = "the index failed to answer";
        Failure::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "InternalServerError",
            why,
        )
    }
}

/// The answer, which for a failure of this server's own (5xx) carries
/// its message for the line logged of the request
/// ([`crate::telemetry::Cause`]).
impl IntoResponse for Failure {
    fn into_response(self) -> Response {
        let body = json!({ "error": self.error, "message": self.message });
        let mut res = (self.status, Json(body)).into_response();
        if self.status.is_server_error() {
            let cause = crate::telemetry::Cause(format!("{}: {}", self.error, self.message));
            res.extensions_mut().insert(cause);
        }
        res
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_index_failing_is_the_servers_fault() {
        let failure = Failure::from(rusqlite::Error::InvalidQuery);
        assert_eq!(failure.status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(failure.error, "InternalServerError");
    }
}
