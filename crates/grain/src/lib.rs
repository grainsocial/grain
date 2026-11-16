//! grain's core: what `grain-serve`, the `grain` command line and MCP
//! share, so each write is one function that all of them call.
//!
//! Its modules start from knotless's (`crates/knotless/src` there), taken
//! over as grain needs them rather than all at once.

pub mod auth;
pub mod base32;
pub mod cli;
pub mod crypto;
pub mod drisl;
pub mod env;
pub mod guard;
pub mod identity;
pub mod jetstream;
pub mod keys;
pub mod labels;
pub mod lexicon;
pub mod moderation;
pub mod oauth;
pub mod repo;
pub mod session;
pub mod space;
pub mod store;
pub mod telemetry;
pub mod xrpc;
