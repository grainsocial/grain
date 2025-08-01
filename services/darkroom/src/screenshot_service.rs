use anyhow::{Result, anyhow};
use fantoccini::ClientBuilder;
use tracing::info;

pub async fn capture_screenshot(preview_url: &str) -> Result<Vec<u8>> {
    info!("Starting screenshot capture for: {}", preview_url);

    let mut caps = serde_json::map::Map::new();
    let opts = serde_json::json!({
        "binary": std::env::var("CHROME_PATH")
            .unwrap_or_else(|_| "/usr/bin/chromium".to_string()),
        "args": [
            "--headless",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--window-size=1500,2350"
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
