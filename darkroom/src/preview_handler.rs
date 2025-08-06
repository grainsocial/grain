use crate::html_generator::generate_grid_html_with_uri;
use anyhow::Result;
use std::collections::HashMap;

pub fn handle_adaptive_preview(params: HashMap<String, String>) -> Result<String> {
    let gallery_uri = params.get("uri")
        .ok_or_else(|| anyhow::anyhow!("Missing uri parameter"))?;

    let title = params.get("title").cloned().unwrap_or_default();
    let handle = params.get("handle").cloned().unwrap_or_default();
    let variant = params.get("variant").map(|s| s.as_str()).unwrap_or("adaptive");

    let html = generate_grid_html_with_uri(gallery_uri, title, handle, variant)?;
    Ok(html)
}
