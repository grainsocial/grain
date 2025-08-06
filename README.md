# Grain Social Monorepo

A photo-sharing social platform built on the [AT Protocol](https://atproto.com)
ecosystem, enabling users to create and share photo galleries in a decentralized
manner.

## Overview

Grain Social is a photo-sharing platform that leverages the AT Protocol for
decentralized identity and data persistence. The platform allows users to upload
photos, organize them into galleries, and share them with the AT Proto
community.

## Architecture

This monorepo contains multiple services that work together to provide the
complete Grain Social experience:

### 📱 [AppView](/appview)

The main frontend application built with Deno, TypeScript, and HTMX. Provides
the user interface for photo management, gallery creation, and social
interactions.

- **Tech Stack**: Deno, TypeScript, HTMX, Tailwind CSS, Preact
- **Features**: Photo uploads, gallery management, social features, custom
  layouts

### 🖼️ [Darkroom](/darkroom)

A Rust-based service for generating composite images and gallery previews.
Handles image processing and screenshot generation for gallery sharing.

- **Tech Stack**: Rust, Axum, Tokio, Fantoccini
- **Features**: Composite image generation, HTML previews, screenshot capture

### 🔔 [Notifications](/notifications)

Notification service for handling real-time updates and user notifications
within the Grain Social ecosystem.

- **Tech Stack**: Deno, TypeScript
- **Features**: Real-time notifications, event processing

### 🏷️ [Labeler](/labeler)

Content labeling and moderation service implementing AT Protocol's labeling
standards for content moderation.

- **Tech Stack**: Deno, TypeScript
- **Features**: Content labeling, moderation tools

### 🌐 [Infrastructure](/nginx)

Nginx reverse proxy configuration for routing requests between services.

### 🗂️ [Local Infrastructure](/local-infra)

Docker Compose setup for local development including PDS, PLC directory, and
Jetstream services.

### 📝 [Lexicons](/lexicons)

AT Protocol lexicon definitions that define the data schemas and API contracts
used across the platform.

## Quick Start

### Prerequisites

- [Deno](https://deno.land/) 2.2.6+
- [Rust](https://rustup.rs/) 1.88+ (for Darkroom service)
- [Docker](https://docker.com/) (for local infrastructure)
- AT Protocol account ([Bluesky](https://bsky.app))

### Local Development

> **Note**: Local development documentation is work in progress and may be out
> of date. Please file an issue if you encounter problems.

1. **Clone the repository**
   ```bash
   git clone https://github.com/grainsocial/grain.git
   cd grain
   ```

2. **Set up local infrastructure** (optional)
   ```bash
   # Add to /etc/hosts
   echo "127.0.0.1 pds.dev.grain.social" | sudo tee -a /etc/hosts
   echo "127.0.0.1 plc.dev.grain.social" | sudo tee -a /etc/hosts
   echo "127.0.0.1 jetstream.dev.grain.social" | sudo tee -a /etc/hosts

   # Start services
   cd local-infra
   docker compose up -d
   ```

3. **Start the AppView**
   ```bash
   cd appview
   cp .env.example .env  # Configure your environment
   deno task sync        # Backfill network data
   deno task dev         # Start development server
   ```

4. **Start additional services** (in separate terminals)
   ```bash
   # Darkroom service
   cd darkroom
   set -a; source .env; set +a; cargo run

   # Notifications service
   cd notifications
   deno run -A main.ts
   ```

### Environment Configuration

Each service requires specific environment variables. Check the individual
service .env.example files for detailed configuration:

- [AppView](/appview/.env.example)
- [Darkroom](/darkroom/.env.example)
- [Labeler](/labeler/.env.example)
- [Notifications](/notifications/.env.example)

## Key Features

- **🖼️ Photo Management**: Upload, organize, and add metadata to photos
- **📚 Gallery Creation**: Create themed collections
- **👥 Social Features**: Follow users, favorite galleries, comment and interact
- **🎨 Custom Layouts**: Masonry and justified grid layout options
- **🔍 Discovery**: Explore galleries and users across the network
- **📱 Responsive Design**: Works across desktop and mobile devices
- **🌐 Decentralized**: Built on AT Protocol for user data ownership

## Development Workflow

1. **Code Generation**: Lexicon changes require running codegen in relevant
   services
2. **Database Sync**: Use `deno task sync` to backfill AT Protocol data
3. **Deployment**: Services are containerized and ready for deployment

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing code conventions
4. Test your changes across relevant services
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

Developed by Chad Miller
