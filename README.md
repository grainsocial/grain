# Grain Social

A social photo-sharing platform built on the [AT Protocol](https://atproto.com),
allowing users to create and share photo galleries.

## Overview

Grain Social is a photo-sharing platform designed specifically for the AT
Protocol ecosystem. It enables users to:

- Upload and organize photos into galleries
- Share galleries with other users
- Favorite galleries from other users
- View photos in a customizable interface with both masonry and justified
  layouts

## Features

- **Photo Management**: Upload, organize, and add alt text to photos
- **Gallery Creation**: Create themed collections of your photos
- **Custom Layouts**: View galleries in either masonry or justified grid layouts
- **Social Features**: Follow users and favorite galleries
- **Profile Management**: Create and customize your profile

## Technology Stack

- Built with [BFF](https://github.com/bigmoves/bff) (An AT Protocol Backend for
  Frontend Framework)
- Uses AT Protocol for identity and data persistence
- Deno runtime
- Written in TypeScript with JSX templating
- HTMX for dynamic interactions
- Hyperscript for enhanced client-side functionality
- Tailwind CSS for styling

## Development

### Prerequisites

- [Deno](https://deno.land/manual/getting_started/installation) Version 2.2.6 or
  above
- An AT Protocol account ([Bluesky](https://bsky.app))

### Environment Variables

```
BFF_PUBLIC_URL=http://localhost:8080  # Your public-facing URL
GOATCOUNTER_URL=                      # Optional analytics
```

### Running Locally

```bash
# Start the development server
deno run dev
```

## License

[MIT License](LICENSE)

## Credits

Developed by Chad Miller
