use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct GalleryItem {
    pub thumb: String,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GalleryCreator {
    pub handle: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct GalleryResponse {
    pub items: Vec<GalleryItem>,
    pub title: Option<String>,
    pub creator: Option<GalleryCreator>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct CompositeOptions {
    pub thumbs: Vec<String>,
    pub title: String,
    pub handle: String,
    pub width: i32,
    pub padding: i32,
    pub gap: i32,
}

#[derive(Debug, Clone)]
pub struct GridDimensions {
    pub cols: i32,
    pub rows: i32,
    pub cell_width: i32,
    pub cell_height: i32,
}
