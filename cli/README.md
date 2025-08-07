# Grain CLI

⚠️ **Work in Progress**: This CLI is currently under development and is not
ready for use yet.

A command-line interface for [grain.social](https://grain.social) - a platform
for sharing photo galleries.

## Features

- **Authentication**: OAuth login flow with grain.social
- **Gallery Management**: List and create photo galleries
- **Image Upload**: Bulk upload images from local folders with automatic
  resizing

## Requirements

- [Rust](https://rustup.rs/) installed
- AT Protocol account ([Bluesky](https://bsky.app))

## Installation

Build from source:

```bash
cargo build --release
```

The binary will be available at `target/release/grain`.

## Usage

### Authentication

First, authenticate with your grain.social account:

```bash
grain login
```

This will open your browser for OAuth authentication.

### Gallery Commands

List your existing galleries:

```bash
grain gallery list
```

Create a new gallery from a folder of images:

```bash
grain gallery create
```

You'll be prompted for:

- Gallery title
- Gallery description (optional)
- Path to folder containing images

The CLI will automatically resize images and upload them to your new gallery.

### Verbose Output

Add `--verbose` to any command for detailed output:

```bash
grain login --verbose
grain gallery create --verbose
```
