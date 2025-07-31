use anyhow::{anyhow, Result};
use headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption;
use headless_chrome::{Browser, LaunchOptions};
use tracing::{info};
use std::time::{Duration};

pub async fn capture_screenshot(preview_url: &str) -> Result<Vec<u8>> {
    info!("Starting screenshot capture for: {}", preview_url);

    let chrome_path = std::env::var("CHROME_PATH")
        .unwrap_or_else(|_| "/usr/bin/google-chrome".to_string());

    info!("Using Chrome path: {}", chrome_path);

    // Run browser operations in a blocking task since headless_chrome is sync
    let preview_url = preview_url.to_string();
    let screenshot = tokio::task::spawn_blocking(move || -> Result<Vec<u8>> {
        info!("Launching browser...");
            let browser = Browser::new(LaunchOptions {
                window_size: Some((1500, 2350)),
                path: Some(std::path::PathBuf::from(&chrome_path)),
                headless: true,
                sandbox: false,
                idle_browser_timeout: Duration::MAX,
                ..Default::default()
            })
            .map_err(|e| anyhow!("Failed to launch browser: {}", e))?;

        info!("Creating new tab...");
        let tab = browser
            .new_tab()
            .map_err(|e| anyhow!("Failed to create new tab: {}", e))?;

        info!("Navigating to URL: {}", preview_url);
        tab.navigate_to(&preview_url)
            .map_err(|e| anyhow!("Failed to navigate to {}: {}", preview_url, e))?;

        info!("Waiting for navigation to complete...");
        tab.wait_until_navigated()
            .map_err(|e| anyhow!("Failed to wait for navigation: {}", e))?;

        info!("Taking screenshot...");
        let screenshot_data = tab
            .capture_screenshot(CaptureScreenshotFormatOption::Jpeg, Some(90), None, true)
            .map_err(|e| anyhow!("Failed to capture screenshot: {}", e))?;

        info!("Screenshot captured successfully, size: {} bytes", screenshot_data.len());
        Ok(screenshot_data)
    })
    .await
    .map_err(|e| anyhow!("Task join error: {}", e))??;

    Ok(screenshot)
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
