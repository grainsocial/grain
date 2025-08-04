use crate::types::GalleryResponse;
use anyhow::{anyhow, Result};
use reqwest;
use tracing::info;

pub async fn fetch_gallery_data(gallery_uri: &str) -> Result<GalleryResponse> {
    let base_url = std::env::var("GRAIN_BASE_URL").unwrap_or_else(|_| "https://grain.social".to_string());
    let gallery_url = format!(
        "{}/xrpc/social.grain.gallery.getGallery?uri={}",
        base_url,
        urlencoding::encode(gallery_uri)
    );

    info!("Fetching gallery data from: {}", gallery_url);

    let response = reqwest::get(&gallery_url).await?;

    if !response.status().is_success() {
        return Err(anyhow!("Failed to fetch gallery: {}", response.status()));
    }

    let data: GalleryResponse = response.json().await?;

    if data.items.is_empty() {
        return Err(anyhow!("No items found in gallery"));
    }

    Ok(data)
}

