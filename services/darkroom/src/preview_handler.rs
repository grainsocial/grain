use crate::html_generator::generate_grid_html;
use crate::types::CompositeOptions;
use anyhow::Result;
use std::collections::HashMap;

pub fn handle_composite_preview(params: HashMap<String, String>) -> Result<String> {
    let thumbs_param = params.get("thumbs").unwrap_or(&String::new()).clone();
    let thumbs: Vec<String> = if !thumbs_param.is_empty() {
        thumbs_param.split(',').map(|s| s.to_string()).collect()
    } else {
        Vec::new()
    };

    let title = params.get("title").unwrap_or(&String::new()).clone();
    let handle = params.get("handle").unwrap_or(&String::new()).clone();

    let options = CompositeOptions {
        thumbs,
        title,
        handle,
        width: 1500,
        padding: 20,
        gap: 5,
    };

    let html = generate_grid_html(options);
    Ok(html)
}
