FROM denoland/deno:2.3.3 AS builder

WORKDIR /app

COPY . .

# Give ownership to deno user and cache dependencies
RUN chown -R deno:deno /app && \
	deno cache ./src/main.tsx

RUN deno task build

FROM denoland/deno:alpine-2.3.3

COPY --from=flyio/litefs:0.5 /usr/local/bin/litefs /usr/local/bin/litefs
COPY litefs.yml /etc/litefs.yml

RUN apk add --no-cache ca-certificates fuse3 sqlite

WORKDIR /app

COPY --from=builder $DENO_DIR $DENO_DIR
COPY --from=builder /app .

# Run LiteFS as the entrypoint. After it has connected and sync'd with the
# cluster, it will run the commands listed in the "exec" field of the config.
ENTRYPOINT ["litefs", "mount"]
