# grain

A photo sharing app built on the AT Protocol.

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

| Directory            | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `crates/grain-serve` | grain-serve: appview, web server side, push     |
| `crates/grain`       | Core library and the `grain` CLI                |
| `crates/grain-mcp`   | MCP server for moderation                       |
| `web/`               | SvelteKit frontend                              |
| `lexicons/`          | AT Protocol lexicon schemas                     |
| `harness/`           | Test harness: reference PDS, check scripts, e2e |
| `deploy/`            | Production deploy                               |

See `AGENTS.md` for detailed development docs.
