//! `grain-mcp`: grain's moderation over MCP on stdin and stdout
//! ([`grain_mcp`]).

fn main() -> std::process::ExitCode {
    if std::env::args().len() > 1 {
        eprintln!("usage: grain-mcp");
        return std::process::ExitCode::from(2);
    }
    let ctx = grain::env::Ctx::new(grain::env::Env::from_process());
    let rt = tokio::runtime::Runtime::new().expect("a runtime builds");
    match rt.block_on(grain_mcp::serve_stdio(ctx)) {
        Ok(()) => std::process::ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("grain-mcp: {err:#}");
            std::process::ExitCode::FAILURE
        }
    }
}
