use axum::{
    body::Body,
    extract::Query,
    http::{StatusCode, header},
    response::{Html, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::collections::HashMap;
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn};

mod composite_handler;
mod gallery_service;
mod html_generator;
mod preview_handler;
mod screenshot_service;
mod types;

use composite_handler::handle_composite_api;
use preview_handler::handle_composite_preview;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/composite-preview", get(preview_route))
        .route("/xrpc/social.grain.darkroom.getGalleryComposite", get(api_route))
        .route("/static/css/base.css", get(serve_css))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .fallback(not_found);

    let listener = TcpListener::bind("[::]:8080").await?;
    info!("Darkroom service listening on http://localhost:8080");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn preview_route(Query(params): Query<HashMap<String, String>>) -> Result<Html<String>, StatusCode> {
    match handle_composite_preview(params) {
        Ok(html) => Ok(Html(html)),
        Err(e) => {
            warn!("Preview error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn api_route(Query(params): Query<HashMap<String, String>>) -> Result<Response<Body>, StatusCode> {
    match handle_composite_api(params).await {
        Ok(response) => Ok(response),
        Err(e) => {
            warn!("API error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn not_found() -> (StatusCode, Html<&'static str>) {
    (
        StatusCode::NOT_FOUND,
        Html("<h1>404 - Page Not Found</h1>"),
    )
}

async fn serve_css() -> Response<Body> {
    let css_content = include_str!("../static/css/base.css");
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/css")
        .body(Body::from(css_content))
        .unwrap()
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "darkroom",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
