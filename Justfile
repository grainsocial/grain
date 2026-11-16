# grain task runner. `just` on its own lists what is here.

# The stable toolchain's own binaries first: cargo finds its clippy and
# rustfmt on the PATH, where another install's (Homebrew's) can come first
# and lint with an older clippy than CI's check. As knotless's.
toolchain := `dirname "$(rustup which --toolchain stable cargo)"`
cargo := "env PATH='" + toolchain + ":" + env_var('PATH') + "' rustup run stable cargo"

# Appview the live-data dev server reads from.
appview := "https://grain.social"

default:
    @just --list

# The web against grain-serve here: grain-serve on 2600, keeping its index
# in target/dev and fed from Jetstream, and the pages, redrawn as their
# source changes, at http://127.0.0.1:3000, which hands grain-serve its
# paths (vite.config.ts). Logging in takes a public URL a PDS can fetch the
# client metadata from: `just dev https://<a tunnel to :3000>`.
dev public="http://127.0.0.1:3000":
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p target/dev
    {{cargo}} build -p grain-serve
    target/debug/grain-serve --index target/dev/index.db --public-url '{{public}}' \
      --jetstream wss://jetstream.us-west.bsky.network &
    trap 'kill $!' EXIT
    npm run dev

# The pages against a deployed grain-serve, for looking at UI changes
# against real data: read as anyone there, so what needs a session (logging
# in, notifications, writes) takes `just dev` (vite.config.ts).
dev-live target=appview:
    GRAIN_SERVE_URL={{ target }} npm run dev

# grain-serve, with the flags given: `just serve --index target/dev/index.db`.
serve *args:
    {{cargo}} run --release -p grain-serve -- {{args}}

# The web pages, built into build/: the SvelteKit app in web/, under
# adapter-node.
web:
    npm run build

# The pages, from build/, reading from a `just serve` on its default port,
# as the image runs them (deploy/docker-compose.yml).
pages: web
    HOST=127.0.0.1 PORT=2601 GRAIN_SERVE_URL=http://127.0.0.1:2600 HOST_HEADER=x-forwarded-host PROTOCOL_HEADER=x-forwarded-proto node build

# The Rust tests, against a reference PDS each test binary starts. CI
# runs these under the coverage gate (`cov`): here, `t` for a loop.
test:
    {{cargo}} test --workspace

# Formatting and clippy over the Rust workspace, as CI's check runs them.
lint:
    {{cargo}} fmt --all --check
    {{cargo}} clippy --workspace --all-targets -- -D warnings

# What the coverage report leaves out: tests, the harness, examples and the
# standard library.
ignore := "(tests/|harness/|examples/|rustlib/)"

# The harness's packages (the reference PDS) and the coverage tools.
setup:
    cd harness && npm install --no-audit --no-fund
    rustup component add llvm-tools-preview --toolchain stable
    command -v cargo-llvm-cov >/dev/null || {{cargo}} install cargo-llvm-cov

# Rust tests; arguments go to `cargo test`, against the PDS `just pds` left
# running if there is one. CI runs these: here, only for a loop the runner
# is too slow for, with CARGO_BUILD_JOBS=2.
t *args:
    GRAIN_TEST_NET={{justfile_directory()}}/target/test-net.json {{cargo}} test --workspace {{args}}

# A reference PDS left running for tests to share, so each test binary
# need not start its own. Stop it with ctrl-c.
pds:
    mkdir -p target
    tail -f /dev/null | node harness/pds.mjs > target/test-net.json

# The tests under the coverage gate, harness/cov.json's, as CI's test
# check runs them. CI runs it: never here.
cov:
    node harness/cov.mjs '{{ignore}}'

# That the XRPC answers the last `cov` gathered are as their lexicons say,
# and that the check names wrong ones.
answers:
    harness/answers-test.sh
    node harness/answers.mjs target/llvm-cov-target/cov-report/answers

# That no query the last `cov` ran scans a table growing with the network,
# as SQLite would plan it at prod's size.
plans:
    node harness/plans.mjs target/llvm-cov-target/cov-report/plans

# The pages end to end, as CI's e2e check runs them (harness/e2e): grain-serve
# and the web's build, driven in Chromium over the stock PDS, then over the
# spaces alpha at GRAIN_DEV_ENV when it is set. CI runs it: here, only for
# a loop the runner is too slow for.
e2e:
    {{cargo}} build -p grain-serve --bin grain-serve
    npm run build
    cd harness && env -u GRAIN_DEV_ENV npx playwright test -c e2e/playwright.config.mjs
    [ -z "${GRAIN_DEV_ENV:-}" ] || (cd harness && npx playwright test -c e2e/playwright.config.mjs)

# Builds grain-serve's image on a host and restarts it there
# (deploy/README.md).
deploy *args:
    deploy/deploy.sh {{args}}

# What grain-serve logs on the host: `just logs serve 'select(.duration_ms > 1000)'`
# (deploy/logs.sh, deploy/README.md).
[positional-arguments]
logs *args:
    deploy/logs.sh "$@"

# The lexicons: goat's lint (github.com/bluesky-social/goat), less the
# warnings kept on purpose; what that lint does not see; and that they only
# grow from main's (harness/lexicons.mjs), as CI's lexicons check runs it.
lex:
    node harness/lexicons.mjs
