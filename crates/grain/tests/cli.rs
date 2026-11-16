//! The `grain` command line: its version, its usage, and what it says of
//! a command it does not know.

use std::process::Command;

fn grain(args: &[&str]) -> (Option<i32>, String, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_grain"))
        .args(args)
        .output()
        .unwrap();
    let text = |b: &[u8]| String::from_utf8_lossy(b).into_owned();
    (out.status.code(), text(&out.stdout), text(&out.stderr))
}

#[test]
fn names_its_version() {
    let (code, out, _) = grain(&["--version"]);
    assert_eq!(code, Some(0));
    assert_eq!(out.trim(), format!("grain {}", env!("CARGO_PKG_VERSION")));
}

#[test]
fn nothing_or_help_is_usage() {
    for args in [&[][..], &["help"], &["--help"]] {
        let (code, _, err) = grain(args);
        assert_eq!(code, Some(2), "{args:?}");
        assert!(err.starts_with("usage: grain"), "{err}");
    }
}

#[test]
fn a_command_it_does_not_know_fails() {
    let (code, _, err) = grain(&["nonsense"]);
    assert_eq!(code, Some(1));
    assert!(
        err.starts_with("grain: nonsense: no such command\nusage: grain"),
        "{err}"
    );
}
