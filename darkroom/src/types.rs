use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AspectRatio {
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GalleryItem {
    pub thumb: String,
    #[serde(rename = "aspectRatio")]
    pub aspect_ratio: AspectRatio,
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

