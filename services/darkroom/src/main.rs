use axum::{
    body::Body,
    extract::Query,
    http::StatusCode,
    response::{Html, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::collections::HashMap;
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer, services::ServeDir};
use tracing::{info, warn};

mod composite_handler;
mod gallery_service;
mod html_generator;
mod preview_handler;
mod screenshot_service;
mod types;

use composite_handler::handle_adaptive_composite_api;
use preview_handler::handle_adaptive_preview;
use gallery_service::fetch_gallery_data;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/gallery-preview", get(adaptive_preview_route))
        .route("/api/gallery", get(gallery_proxy_route))
        .route("/xrpc/social.grain.darkroom.getGalleryComposite", get(adaptive_api_route))
        .nest_service("/static", ServeDir::new("static"))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .fallback(not_found);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("[::]:{}", port);
    let listener = TcpListener::bind(&bind_address).await?;
    info!("Darkroom service listening on http://localhost:{}", port);

    axum::serve(listener, app).await?;
    Ok(())
}

async fn adaptive_preview_route(Query(params): Query<HashMap<String, String>>) -> Result<Html<String>, StatusCode> {
    match handle_adaptive_preview(params) {
        Ok(html) => Ok(Html(html)),
        Err(e) => {
            warn!("Preview error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn adaptive_api_route(Query(params): Query<HashMap<String, String>>) -> Result<Response<Body>, StatusCode> {
    match handle_adaptive_composite_api(params).await {
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



async fn gallery_proxy_route(Query(params): Query<HashMap<String, String>>) -> Result<axum::Json<serde_json::Value>, StatusCode> {
    let gallery_uri = params
        .get("uri")
        .ok_or(StatusCode::BAD_REQUEST)?;

    match fetch_gallery_data(gallery_uri).await {
        Ok(gallery_data) => {
            let json_value = serde_json::to_value(gallery_data)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            Ok(axum::Json(json_value))
        },
        Err(e) => {
            warn!("Gallery proxy error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "darkroom",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
