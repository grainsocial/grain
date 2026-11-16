//! The `grain-serve` binary: it serves where `--listen` says, keeps its
//! index where `--index` says, stops when told to, says why when it
//! cannot listen, and gives its usage for a flag it does not take.

use std::process::{Command, Stdio};
use std::time::Duration;

/// A port free a moment ago.
fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

#[tokio::test]
async fn serves_until_interrupted() {
    let addr = format!("127.0.0.1:{}", free_port());
    let dir = tempfile::tempdir().unwrap();
    let index = dir.path().join("index.db");
    let metrics = format!("127.0.0.1:{}", free_port());
    let child = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .args(["--listen", &addr, "--metrics", &metrics, "--index"])
        .arg(&index)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let url = format!("http://{addr}/xrpc/_health");
    let mut up = false;
    for _ in 0..100 {
        if reqwest::get(&url).await.is_ok_and(|r| r.status() == 200) {
            up = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(up, "grain-serve never answered at {addr}");
    assert!(index.exists(), "it keeps its index where --index says");
    // The request it answered, counted on the port of its own.
    let numbers = reqwest::get(format!("http://{metrics}/metrics"))
        .await
        .unwrap();
    let numbers = numbers.text().await.unwrap();
    assert!(
        numbers.contains("http_route=\"/xrpc/_health\""),
        "{numbers}"
    );
    let set = reqwest::Client::new()
        .put(format!("http://{metrics}/log"))
        .body("info,grain::request=debug")
        .send()
        .await
        .unwrap();
    assert_eq!(set.status(), 200);
    // A health check is logged at debug, which that let through.
    reqwest::get(&url).await.unwrap();
    // As ctrl-c stops it: gracefully, so it exits 0.
    let interrupted = Command::new("kill")
        .args(["-INT", &child.id().to_string()])
        .status()
        .unwrap();
    assert!(interrupted.success());
    let out = child.wait_with_output().unwrap();
    assert!(out.status.success());
    // What it logged, as JSON lines: one a request, in a trace.
    let lines: Vec<serde_json::Value> = String::from_utf8_lossy(&out.stderr)
        .lines()
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect();
    let said = |m: &str| lines.iter().any(|l| l["message"] == m);
    assert!(said("grain-serve starting") && said("listening") && said("stopped"));
    let request = lines.iter().find(|l| l["message"] == "request").unwrap();
    assert_eq!(request["http.route"], "/xrpc/_health");
    assert_eq!(request["trace_id"].as_str().unwrap().len(), 32);
}

#[tokio::test]
async fn stops_when_docker_stops_it() {
    let addr = format!("127.0.0.1:{}", free_port());
    let mut child = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .args(["--listen", &addr])
        .stdout(Stdio::null())
        .spawn()
        .unwrap();
    let url = format!("http://{addr}/healthz");
    let mut up = false;
    for _ in 0..100 {
        if reqwest::get(&url).await.is_ok_and(|r| r.status() == 200) {
            up = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(up, "grain-serve never answered at {addr}");
    let stopped = Command::new("kill")
        .args(["-TERM", &child.id().to_string()])
        .status()
        .unwrap();
    assert!(stopped.success());
    assert!(child.wait().unwrap().success());
}

#[test]
fn says_why_it_cannot_listen() {
    let taken = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = taken.local_addr().unwrap().to_string();
    let out = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .args(["--listen", &addr])
        .output()
        .unwrap();
    assert!(!out.status.success());
    let said = String::from_utf8_lossy(&out.stderr);
    assert!(said.contains(&format!("listening on {addr}")), "{said}");
}

#[test]
fn says_it_cannot_follow_jetstream_without_an_index() {
    let out = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .args(["--listen", &format!("127.0.0.1:{}", free_port())])
        .args(["--jetstream", "wss://jetstream.test", "--index", ""])
        .output()
        .unwrap();
    assert!(!out.status.success());
    let said = String::from_utf8_lossy(&out.stderr);
    assert!(said.contains("--jetstream needs --index"), "{said}");
}

#[test]
fn gives_its_usage_for_what_it_does_not_take() {
    let out = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .args(["--listen"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(2));
    let said = String::from_utf8_lossy(&out.stderr);
    assert!(said.contains("--listen takes a value"), "{said}");
    let out = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .args(["--private", "1"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(2));
    let said = String::from_utf8_lossy(&out.stderr);
    assert!(said.contains("usage: grain-serve"), "{said}");
}

#[test]
fn checks_the_index_and_serves_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let index = dir.path().join("index.db");
    let out = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .arg("--check-index")
        .arg(&index)
        .output()
        .unwrap();
    assert!(out.status.success());
    let said = String::from_utf8_lossy(&out.stdout);
    assert!(said.contains("this build keeps it"), "{said}");
    assert!(!index.exists(), "a check makes no index");
    std::fs::write(&index, "not an index, and long enough to be read as one").unwrap();
    let out = Command::new(env!("CARGO_BIN_EXE_grain-serve"))
        .arg("--check-index")
        .arg(&index)
        .output()
        .unwrap();
    assert!(!out.status.success());
}
