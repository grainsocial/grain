# grain

A photo sharing app built on the AT Protocol with [hatk](https://github.com/hatk-dev/hatk).

Users create galleries of photos, browse feeds, leave comments, and follow other photographers.

## Quickstart

```bash
npm install
npx svelte-kit sync
just dev
```

Opens at `http://127.0.0.1:3000`: the SvelteKit frontend in front of
grain-serve, the Rust server, which follows Jetstream into an index in
`target/dev`.

## Project structure

| Directory   | Purpose                                    |
| ----------- | ------------------------------------------ |
| `lexicons/` | AT Protocol lexicon schemas                |
| `server/`   | Feeds, XRPC handlers, hooks, setup scripts |
| `web/`      | SvelteKit frontend                         |
| `seeds/`    | Test data for local dev                    |

See `AGENTS.md` for detailed development docs.
