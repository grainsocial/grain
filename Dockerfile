# syntax=docker/dockerfile:1

# grain-serve and the web pages it serves beside, in one image, with the
# grain CLI, grain-mcp and grain-import (the cutover's one-shot import of
# the old server's database): deploy/docker-compose.yml runs it once as
# each of serve and the pages. Built from the repository's root:
#
#   docker build -t grain-serve:current .

FROM rust:1.98-bookworm AS serve
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY lexicons/ lexicons/
# The cache mounts keep the registry and the build between builds on the
# same machine, so a change rebuilds the crates it touches and not the rest.
# The deploy profile (Cargo.toml) is release's, built for the build's time.
# GRAIN_COMMIT, from deploy.sh, is the commit grain-serve logs and
# /_status says it runs: only what reads it rebuilds when it changes.
ARG GRAIN_COMMIT
ENV GRAIN_COMMIT=${GRAIN_COMMIT}
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --profile deploy --locked \
        -p grain-serve --bin grain-serve \
        -p grain --bin grain \
        -p grain-mcp --bin grain-mcp \
        -p grain-import --bin grain-import \
    && cp target/deploy/grain-serve target/deploy/grain target/deploy/grain-mcp \
        target/deploy/grain-import /

# The pages: the SvelteKit app in web/, built with adapter-node, from the
# root's package.json, beside the old server's packages, so its
# dependencies go into the image with it.
FROM node:25-bookworm-slim AS pages
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:25-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=serve /grain-serve /grain /grain-mcp /grain-import /usr/local/bin/
COPY --from=pages /web/build /app/build
COPY --from=pages /web/package.json /app/package.json
COPY --from=pages /web/node_modules /app/node_modules
USER node
ENTRYPOINT ["tini", "--"]
CMD ["grain-serve", "--listen", "0.0.0.0:2600"]
