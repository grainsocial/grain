# AT Protocol Backend for Frontend Framework (BFF)

A framework for building web applications on the
[AT Protocol](https://atproto.com/) / [Bluesky](https://bsky.app) ecosystem.

## Overview

BFF is a web application framework designed to make it easy to build AT
Protocol-powered applications. It handles authentication, data synchronization,
and many other common tasks needed for AT Protocol apps.

> [!WARNING]
> This project is under active development. APIs may change without notice and
> documentation may not be fully up-to-date.

## Features

- **AT Protocol OAuth**: Authentication with AT Protocol
- **Jetstream Integration**: Data synchronization with the AT Protocol
- **SQLite Database**: Local storage and indexing of records
- **Record Management**: CRUD operations for AT Protocol records
- **Component Library**: UI components built with Tailwind CSS
- **Server-Side Rendering**: HTML delivery with JSX
- **Routing**: URL-based navigation system
- **HTMX Integration**: Interactive UI with minimal JavaScript
- **CLI Tools**: Project scaffolding and development utilities

## Installation

```bash
# Create a new project
deno run -A jsr:@bigmoves/bff-cli init my-app

# Navigate to your new project
cd my-app

# Start the dev server
deno task dev
```

NOTE: If you want the latest changes currently on main use
`jsr:@bigmoves/bff@0.3.0-beta.29` or check `packages/bff/deno.json` for the
latest version. Trying to move fast with some changes on a different project but
will hopefully land a new minor soon.

You can specify the latest beta in cli as well:

```bash
deno run -A jsr:@bigmoves/bff-cli@0.3.0-beta.29 init my-app
```

## Working with Lexicons

Lexicons define the schema of data in the AT Protocol. BFF allows you to work
with both standard protocol lexicons and your own custom lexicons.

### Adding Custom Lexicons

Create lexicon definitions in the `lexicons/` directory:

```json
// lexicons/app.myapp.profile.json
{
  "lexicon": 1,
  "id": "app.myapp.profile",
  "defs": {
    "main": {
      "type": "record",
      "key": "self",
      "record": {
        "type": "object",
        "properties": {
          "displayName": { "type": "string" },
          "bio": { "type": "string", "maxLength": 300 }
        }
      }
    }
  }
}
```

### Generating TypeScript Types

After defining your lexicons, generate TypeScript types using the BFF CLI:

```bash
# Generate types from all lexicons
deno run -A jsr:@bigmoves/bff-cli lexgen
```

This will create typed interfaces in the `__generated__/` directory that match
your lexicon definitions.

### Using Generated Types

Import the generated types in your application:

```tsx
// Import generated types
import { Main as Profile } from "$lexicon/app/myapp/profile.ts";

await ctx.createRecord<Profile>("app.myapp.profile", profile);
```

## Project Structure

A typical BFF project structure looks like:

```
my-app/
├── deno.json         # Deno configuration
├── input.css         # Tailwind input CSS
├── lexicons/         # AT Protocol lexicon definitions
├── main.tsx          # Application entry point
├── __generated__/    # Generated TypeScript types from lexicons
├── src/              # Application source code
│   ├── app.tsx       # Root component
│   ├── routes.tsx    # Route definitions
│   ├── components/   # UI components
│   └── routes/       # Route handlers
└── static/           # Static assets
    └── styles.css    # Compiled CSS
```

## Basic Usage

Here's a simple example of a BFF application:

```tsx
// main.tsx
import { lexicons } from "$lexicon/lexicons.ts";
import { bff, JETSTREAM, oauth } from "@bigmoves/bff";
import { Login } from "@bigmoves/bff/components";
import { Root } from "./app.tsx";
import { routes } from "./routes.tsx";
import { onSignedIn } from "./utils.ts";

bff({
  appName: "My AT Protocol App",
  collections: ["dev.myapp.profile"],
  jetstreamUrl: JETSTREAM.WEST_1,
  lexicons,
  rootElement: Root,
  middlewares: [
    oauth({
      onSignedIn,
      LoginComponent: ({ error }) => (
        <div class="flex justify-center items-center w-full h-full">
          <Login error={error} />
        </div>
      ),
    }),
    ...routes,
  ],
});
```

## Components

BFF provides several reusable UI components to help you build applications
quickly:

- `Button`: Customizable button component with different variants
- `Dialog`: Modal dialog component with close button
- `Input`: Text input field
- `Textarea`: Multi-line text input field
- `Layout`: Page layout components with navigation and content areas
- `Login`: Login form for AT Protocol authentication

## Authentication

BFF includes built-in AT Protocol OAuth authentication:

```tsx
// routes.tsx
import { route } from "@bigmoves/bff";

export const routes = [
  route("/", (_req, _params, ctx) => {
    const { handle } = ctx.requireAuth();
    return ctx.render(
      <div>Welcome, {handle}!</div>,
    );
  }),
];
```

## Data Management

BFF makes it easy to work with AT Protocol data:

```tsx
// Create a record
const uri = await ctx.createRecord(
  "dev.myapp.post",
  {
    text: "Hello world!",
    createdAt: new Date().toISOString(),
  },
);

// Query records
const posts = ctx.indexService.getRecords("dev.myapp.post", {
  where: [{ field: "text", contains: "hello" }],
  limit: 10,
});

// Update a record
await ctx.updateRecord(
  "dev.myapp.profile",
  "self",
  {
    displayName: "Sup sup",
  },
);

// Delete a record
await ctx.deleteRecord(uri);
```

## Deployment

BFF applications can be deployed to any container-based platform as a service
like Fly.io.

For Fly.io deployment:

```bash
# Create a Dockerfile in your project
cat > Dockerfile << 'EOF'
FROM denoland/deno:2.2.3

WORKDIR /app
COPY . .
RUN deno cache main.tsx

CMD ["run", "--allow-all", "main.tsx"]
EOF

# Deploy to Fly.io
fly launch
```

## Examples

`/examples` contains several example applications:

- **basic**: Starter app with a simple profile lexicon
- **statusphere**: Bsky's statusphere app re-implemented for BFF
- **search_likes**: Search your liked bsky posts
- **blog**: Simple blog site for WhiteWind posts
