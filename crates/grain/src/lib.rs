//! grain's core: what `grain-serve`, the `grain` command line and MCP
//! share, so each write is one function that all of them call.
//!
//! Its modules start from knotless's (`crates/knotless/src` there), taken
//! over as grain needs them rather than all at once. atproto's primitives,
//! DRISL, CIDs, keys, JOSE, service auth, TIDs, identifier syntax and
//! lexicon validation, are the `atproto` crate's, as they are knotless's.

pub mod auth;
pub mod cli;
pub mod crypto;
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
