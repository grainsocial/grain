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

```bash
# .env
BFF_DATABASE_URL=grain.db             # SQLite db file
BFF_JETSTREAM_URL=wss://jetstream1.us-west.bsky.network
PDS_HOST_URL=https://ansel.grainsocial.network
USE_CDN=true                          # Use bsky cdn
```

### Running Locally

```bash
# Backfill all network data
deno run sync

# Start the development server
deno run dev
```

### Running the whole infra locally PDS + PLC + Jetstream

You must ensure that pds.dev.grain.social resolves to your local machine
(typically 127.0.0.1 or your Docker host).

#### Add to /etc/hosts (macOS/Linux)

```bash
sudo nano /etc/hosts
```

```bash
127.0.0.1 pds.dev.grain.social
127.0.0.1 plc.dev.grain.social
127.0.0.1 jetstream.dev.grain.social
```

#### Start services

```bash
cd local-infra
docker compose up -d
```

#### Install the root certificate on your machine

Copy the cert out:

```bash
docker cp caddy:/data/pki/authorities/grain/root.crt ./grain-root.crt
```

Once you have grain-root.crt, install it:

macOS:

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain grain-root.crt
```

Ubuntu/Linux:

```bash
sudo cp grain-root.crt /usr/local/share/ca-certificates/grain.crt
sudo update-ca-certificates
```

#### Update ENV Variables

Make sure the following env vars are in your .env

```bash
# for running local infra only
BFF_DATABASE_URL=grain.db
BFF_PLC_DIRECTORY_URL=https://plc.dev.grain.social
BFF_JETSTREAM_URL=https://jetstream.dev.grain.social
PDS_HOST_URL=https://pds.dev.grain.social
DENO_TLS_CA_STORE=system
USE_CDN=false
```

#### Run the app

Start the app:

```bash
deno run dev
```

You can then create an account via the "Create Account" button in the navbar.

After clicking the link, verify you are redirected to
`https://pds.dev.grain.social/...`

Create an account with your desired handle.

If all goes well you will be redirectly to the app at
`http://localhost:8080/onboard` and prompted to edit your profile details.

From then on, you can login by typing `https://pds.dev.grain.social` into the
login input and follow the PDS prompts to login.

NOTE: When running with local-infra, only blobs on the local PDS will get
resolved because of the PLC directory. All of the other images will appear
broken. We could do some more work to support both but seems fine for now to
test new features. Just switch back to non local-infra mode and you'll see them
all.

#### Explore records

You can use [PDSls](https://pdsls.dev/) to explore records when running
local-infra. Click the settings icon and change the PLC directory to
`https://plc.dev.grain.social`.

## License

[MIT License](LICENSE)

## Credits

Developed by Chad Miller
