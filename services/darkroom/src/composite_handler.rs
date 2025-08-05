use crate::gallery_service::fetch_gallery_data;
use crate::screenshot_service::capture_screenshot;
use anyhow::{Result, anyhow};
use axum::body::Body;
use axum::http::{HeaderMap, HeaderValue};
use axum::response::Response;
use std::collections::HashMap;
use tracing::info;

pub async fn handle_adaptive_composite_api(
    params: HashMap<String, String>,
) -> Result<Response<Body>> {
    let gallery_uri = params
        .get("uri")
        .ok_or_else(|| anyhow!("Missing uri parameter"))?;

    // Fetch gallery data (this already includes aspect ratios)
    let gallery_data = fetch_gallery_data(gallery_uri).await?;

    info!(
        "Adaptive composite API with {} items from URI",
        gallery_data.items.len()
    );

    // Build preview URL with just the gallery URI (client-side fetching)
    let base_url = std::env::var("BASE_URL").unwrap_or_else(|_| "http://[::]:8080".to_string());

    let preview_url = format!(
        "{}/gallery-preview?uri={}&title={}&handle={}",
        base_url,
        urlencoding::encode(gallery_uri),
        urlencoding::encode(gallery_data.title.as_deref().unwrap_or("")),
        urlencoding::encode(
            &gallery_data
                .creator
                .as_ref()
                .and_then(|c| c.handle.as_deref())
                .unwrap_or("")
        )
    );

    info!(
        "Capturing screenshot for adaptive preview URL: {}",
        preview_url
    );

    // Capture screenshot
    let screenshot = capture_screenshot(&preview_url).await?;

    info!("Screenshot captured successfully");

    let mut headers = HeaderMap::new();
    headers.insert("Content-Type", HeaderValue::from_static("image/jpeg"));
    headers.insert(
        "Cache-Control",
        HeaderValue::from_static("no-cache, must-revalidate"),
    );

    let mut response = Response::new(Body::from(screenshot));
    *response.headers_mut() = headers;

    Ok(response)
}
