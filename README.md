# grain

A photo sharing app built on the AT Protocol with [hatk](https://github.com/hatk-dev/hatk).

Users create galleries of photos, browse feeds, leave comments, and follow other photographers.

## Quickstart

```bash
npm install
npm run dev
```

Opens at `http://127.0.0.1:3000` with a local PDS, firehose relay, and SvelteKit frontend.

## Project structure

| Directory   | Purpose                                    |
| ----------- | ------------------------------------------ |
| `lexicons/` | AT Protocol lexicon schemas                |
| `server/`   | Feeds, XRPC handlers, hooks, setup scripts |
| `app/`      | SvelteKit frontend                         |
| `seeds/`    | Test data for local dev                    |

See `AGENTS.md` for detailed development docs.
