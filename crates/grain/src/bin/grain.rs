//! The `grain` command line ([`grain::cli`]).

use std::process::ExitCode;

fn main() -> ExitCode {
    let code = grain::cli::main(std::env::args().skip(1).collect());
    ExitCode::from(code as u8)
}
