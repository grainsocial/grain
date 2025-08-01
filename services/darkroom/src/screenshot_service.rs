use anyhow::{Result, anyhow};
use fantoccini::ClientBuilder;
use std::net::TcpStream;
use std::process::{Child, Command};
use std::{thread, time};
use tracing::info;

pub async fn capture_screenshot(preview_url: &str) -> Result<Vec<u8>> {
    info!("Starting screenshot capture for: {}", preview_url);

    // Check if ChromeDriver is running on port 9515
    let chromedriver_addr = "127.0.0.1:9515";
    let mut chromedriver_child: Option<Child> = None;
    let chromedriver_running = TcpStream::connect(chromedriver_addr).is_ok();
    if !chromedriver_running {
        let chromedriver_path = std::env::var("CHROMEDRIVER_PATH")
            .unwrap_or_else(|_| "/usr/bin/chromedriver".to_string());
        info!("Starting ChromeDriver at {}...", chromedriver_path);
        let child = Command::new(chromedriver_path)
            .arg("--port=9515")
            .spawn()
            .map_err(|e| anyhow!("Failed to start ChromeDriver: {}", e))?;
        chromedriver_child = Some(child);
        // Wait for ChromeDriver to become available
        let max_tries = 10;
        let delay = time::Duration::from_millis(300);
        let mut started = false;
        for _ in 0..max_tries {
            if TcpStream::connect(chromedriver_addr).is_ok() {
                started = true;
                break;
            }
            thread::sleep(delay);
        }
        if !started {
            return Err(anyhow!("ChromeDriver did not start on port 9515"));
        }
    }

    let mut caps = serde_json::map::Map::new();
    let opts = serde_json::json!({
        "binary": std::env::var("CHROME_PATH")
            .unwrap_or_else(|_| "/usr/bin/chromium".to_string()),
        "args": [
            "--headless",
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--window-size=1500,2350",
            "--font-render-hinting=medium",
            "--enable-font-antialiasing"
        ],
    });
    caps.insert("goog:chromeOptions".to_string(), opts);

    // Create WebDriver client
    let client = ClientBuilder::native()
        .capabilities(caps)
        .connect("http://localhost:9515")
        .await
        .map_err(|e| anyhow!("Failed to connect to ChromeDriver: {}", e))?;

    let result = async {
        info!("Navigating to URL: {}", preview_url);
        client
            .goto(preview_url)
            .await
            .map_err(|e| anyhow!("Failed to navigate to {}: {}", preview_url, e))?;

        // Wait for body to be present
        use fantoccini::wd::Locator;
        client.wait().for_element(Locator::Css("body")).await?;

        // Wait for all web fonts to be loaded
        client
            .execute(
                "return document.fonts.status === 'loaded' ? true : await document.fonts.ready.then(() => true);",
                vec![],
            )
            .await
            .map_err(|e| anyhow!("Failed to wait for fonts: {}", e))?;

        // Add a small delay to ensure rendering
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;

        info!("Taking screenshot...");
        let screenshot_data = client
            .screenshot()
            .await
            .map_err(|e| anyhow!("Failed to capture screenshot: {}", e))?;

        info!(
            "Screenshot captured successfully, size: {} bytes",
            screenshot_data.len()
        );
        Ok(screenshot_data)
    }
    .await;

    // Clean up
    client.close().await.ok();

    // If we started ChromeDriver, kill it
    if let Some(mut child) = chromedriver_child {
        let _ = child.kill();
    }

    result
}

pub fn build_preview_url(
    base_url: &str,
    thumb_urls: &[String],
    title: &str,
    handle: &str,
) -> String {
    let thumbs_param = thumb_urls.join(",");
    format!(
        "{}/composite-preview?thumbs={}&title={}&handle={}",
        base_url,
        urlencoding::encode(&thumbs_param),
        urlencoding::encode(title),
        urlencoding::encode(handle)
    )
}
