FROM denoland/deno:2.2.3 AS builder

WORKDIR /app

COPY . .

# Give ownership to deno user and cache dependencies
RUN chown -R deno:deno /app && \
	deno cache ./src/main.tsx

FROM denoland/deno:alpine-2.2.3

COPY --from=flyio/litefs:0.5 /usr/local/bin/litefs /usr/local/bin/litefs
COPY litefs.yml /etc/litefs.yml

# libstdc++ is needed for @gfx/canvas
RUN apk add --no-cache ca-certificates fuse3 libstdc++ sqlite

WORKDIR /app

# Needed for @gfx/canvas
RUN mkdir -p /usr/share/fonts

COPY --from=builder $DENO_DIR $DENO_DIR
COPY --from=builder /app .

# Run LiteFS as the entrypoint. After it has connected and sync'd with the
# cluster, it will run the commands listed in the "exec" field of the config.
ENTRYPOINT ["litefs", "mount"]
