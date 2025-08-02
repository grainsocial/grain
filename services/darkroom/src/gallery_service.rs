use crate::types::GalleryResponse;
use anyhow::{anyhow, Result};
use reqwest;
use tracing::info;

pub async fn fetch_gallery_data(gallery_uri: &str) -> Result<GalleryResponse> {
    let gallery_url = format!(
        "https://grain.social/xrpc/social.grain.gallery.getGallery?uri={}",
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

pub fn extract_thumbnails(gallery_data: &GalleryResponse, max_count: usize) -> Result<Vec<String>> {
    let thumb_urls: Vec<String> = gallery_data
        .items
        .iter()
        .filter_map(|item| {
            if !item.thumb.is_empty() {
                Some(item.thumb.clone())
            } else {
                None
            }
        })
        .take(max_count)
        .collect();

    if thumb_urls.is_empty() {
        return Err(anyhow!("No thumbnail images found"));
    }

    Ok(thumb_urls)
}
