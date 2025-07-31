use crate::gallery_service::{extract_thumbnails, fetch_gallery_data};
use crate::screenshot_service::{build_preview_url, capture_screenshot};
use anyhow::{anyhow, Result};
use axum::body::Body;
use axum::http::{HeaderMap, HeaderValue};
use axum::response::Response;
use std::collections::HashMap;
use tracing::info;

pub async fn handle_composite_api(params: HashMap<String, String>) -> Result<Response<Body>> {
    let gallery_uri = params
        .get("uri")
        .ok_or_else(|| anyhow!("Missing uri parameter"))?;

    // Fetch gallery data
    let gallery_data = fetch_gallery_data(gallery_uri).await?;

    // Extract thumbnail URLs
    let thumb_urls = extract_thumbnails(&gallery_data, 9)?;

    info!("Extracted thumbnails: {:?}", thumb_urls);
    info!(
        "Building preview URL with title: {:?}",
        gallery_data.title.as_deref().unwrap_or("")
    );

    // Build preview URL for screenshot
    let base_url = std::env::var("BASE_URL")
        .unwrap_or_else(|_| "http://[::]:8080".to_string());

    let preview_url = build_preview_url(
        &base_url,
        &thumb_urls,
        gallery_data.title.as_deref().unwrap_or(""),
        gallery_data
            .creator
            .as_ref()
            .and_then(|c| c.handle.as_deref())
            .unwrap_or(""),
    );

    info!("Capturing screenshot for preview URL: {}", preview_url);

    // Capture screenshot
    let screenshot = capture_screenshot(&preview_url).await?;

    info!("Screenshot captured successfully");

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("image/jpeg"));
    headers.insert(
        "Cache-Control",
        HeaderValue::from_static("public, max-age=3600"),
    );

    let mut response = Response::new(Body::from(screenshot));
    *response.headers_mut() = headers;

    Ok(response)
}
