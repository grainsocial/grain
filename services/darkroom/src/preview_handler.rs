use crate::html_generator::generate_grid_html;
use crate::types::{AspectRatio, CompositeOptions, GalleryItem};
use anyhow::Result;
use std::collections::HashMap;

pub fn handle_composite_preview(params: HashMap<String, String>) -> Result<String> {
    let thumbs_param = params.get("thumbs").unwrap_or(&String::new()).clone();
    let thumb_urls: Vec<String> = if !thumbs_param.is_empty() {
        thumbs_param.split(',').map(|s| s.to_string()).collect()
    } else {
        Vec::new()
    };

    // Convert URLs to GalleryItem objects with default aspect ratios
    // Since we don't have actual aspect ratio data from URL params, use a default square ratio
    let items: Vec<GalleryItem> = thumb_urls
        .into_iter()
        .map(|thumb| GalleryItem {
            thumb,
            aspect_ratio: AspectRatio {
                width: 1.0,
                height: 1.0,
            },
            extra: serde_json::Value::Null,
        })
        .collect();

    let title = params.get("title").unwrap_or(&String::new()).clone();
    let handle = params.get("handle").unwrap_or(&String::new()).clone();

    let options = CompositeOptions {
        items,
        title,
        handle,
    };

    let html = generate_grid_html(options);
    Ok(html)
}
