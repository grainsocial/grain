# Build stage
FROM rust:1.88-alpine AS builder

# Install build dependencies including OpenSSL static libraries
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    openssl-libs-static \
    pkgconfig

WORKDIR /app

# Set environment variables for static OpenSSL linking
ENV RUSTFLAGS="-C target-feature=-crt-static"
ENV OPENSSL_STATIC=1
ENV OPENSSL_DIR=/usr
ENV OPENSSL_LIB_DIR=/usr/lib
ENV OPENSSL_INCLUDE_DIR=/usr/include

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create a dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (native target, no cross-compilation)
RUN cargo build --release
RUN rm src/*.rs

# Copy source code
COPY src ./src

# Build the application (native target)
RUN cargo build --release

# Runtime stage
FROM alpine:3.18

# Install runtime dependencies for Chrome and the app
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    dbus \
    freetype \
    harfbuzz \
    nss \
    ttf-freefont \
    && addgroup -g 1001 -S app \
    && adduser -S -D -H -u 1001 -s /sbin/nologin -G app app

WORKDIR /app

# Copy the native binary from builder stage
COPY --from=builder /app/target/release/darkroom .
RUN chown app:app darkroom \
    && mkdir -p /tmp/.chrome \
    && chown app:app /tmp/.chrome

USER app

EXPOSE 8080

# Set Chrome environment variables
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV RUST_LOG=info

CMD ["./darkroom"]
