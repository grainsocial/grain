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

### Development

```bash
# Run in development mode
cargo run

# Build release version
cargo build --release
```

The service will start on port 8080.
