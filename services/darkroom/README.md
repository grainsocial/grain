# Grain Darkroom

A Rust-based service for generating composite images from photo galleries.

### API Endpoints

#### `GET /composite-preview`

Generates an HTML preview of a photo grid layout.

**Query Parameters:**

- `thumbs` - Comma-separated list of thumbnail URLs
- `title` - Gallery title (optional)
- `handle` - Creator handle (optional)

#### `GET /xrpc/social.grain.darkroom.getGalleryComposite`

Creates a composite image from a gallery URI.

**Query Parameters:**

- `uri` - URI of the gallery to process

**Returns:** JPEG image

### Dependencies

- Rust 1.88+
- Chrome/Chromium for screenshot capture
- Alpine Linux (for container deployment)

### Development

```bash
# Run in development mode
cargo run

# Build release version
cargo build --release

# Run with Docker
docker build -t darkroom .
docker run -p 8080:8080 darkroom
```

The service will start on port 8080.

### Architecture

The service is built using:

- **Axum** - Web framework
- **Tokio** - Async runtime
- **headless_chrome** - Browser automation for screenshots
- **Reqwest** - HTTP client for API calls
- **Serde** - JSON serialization/deserialization
