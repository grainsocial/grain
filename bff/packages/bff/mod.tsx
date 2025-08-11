import { DidResolver, MemoryCache } from "@atproto/identity";
import * as colors from "@std/fmt/colors";
import { createIndexService } from "./services/indexing.ts";
import { createLabelerSubscriptions } from "./services/labeler.ts";
import {
  createSubscription,
  handleWebSocketUpgrade,
} from "./services/subscription.ts";
import type { BffOptions } from "./types.d.ts";
import { configureBff } from "./utils/config.ts";
import { createDb } from "./utils/database.ts";
import { RateLimitError, UnauthorizedError } from "./utils/errors.ts";
import { createBffHandler } from "./utils/handler.ts";
import { generateFingerprints } from "./utils/static_files.ts";

export { aip, AIP_ROUTES } from "./aip/mod.ts";
export { JETSTREAM } from "./clients/jetstream.ts";
export { backfillCollections, backfillUris } from "./services/backfill.ts";
export type {
  ActorTable,
  BffContext,
  BffMiddleware,
  BffOptions,
  LabelerPolicies,
  onListenArgs,
  onSignedInArgs,
  QueryOptions,
  RecordTable,
  RootProps,
  RouteHandler,
  WithBffMeta,
} from "./types.d.ts";
export { RateLimitError, UnauthorizedError } from "./utils/errors.ts";
export { route } from "./utils/routing.ts";

export { CSS } from "./styles.ts";

export async function bff(opts: BffOptions) {
  const bffConfig = configureBff(opts);

  const didCache = new MemoryCache();
  const didResolver = new DidResolver({
    plcUrl: bffConfig.plcDirectoryUrl,
    didCache,
  });

  const fileFingerprints = await generateFingerprints(bffConfig);

  const db = createDb(bffConfig);
  const indexService = createIndexService(db, bffConfig);
  const handler = createBffHandler({
    db,
    cfg: bffConfig,
    didResolver,
    fileFingerprints,
    indexService,
  });
  const jetstream = createSubscription(indexService, bffConfig);
  const labelerMap = await createLabelerSubscriptions(
    didResolver,
    indexService,
    bffConfig,
  );

  if (
    bffConfig.jetstreamUrl &&
    (bffConfig.collections?.length || bffConfig.externalCollections?.length)
  ) {
    jetstream.connect().catch((err: unknown) => {
      console.error("Jetstream connection failed:", err);
    });
  }

  if (labelerMap.size > 0) {
    for (const labeler of labelerMap.values()) {
      labeler.connect().catch((err: unknown) => {
        console.error("Labeler connection failed:", err);
      });
    }
  }

  // TODO: maybe should be onBeforeListen
  await bffConfig.onListen?.({
    indexService,
    cfg: bffConfig,
  });

  Deno.serve({
    port: bffConfig.port,
    onListen({ port, hostname }) {
      if (hostname === "0.0.0.0") {
        hostname = "localhost";
      }
      console.log();
      console.log(
        colors.bgRgb8(colors.rgb8(" ✨ BFF ready ", 0), 75),
      );
      const localLabel = colors.bold("Local:");
      const address = colors.cyan(
        `http://${hostname}:${port}`,
      );
      console.log(`    ${localLabel}  ${address}`);
    },
    onError: (err) => {
      if (bffConfig.onError) {
        return bffConfig.onError(err);
      }
      if (err instanceof UnauthorizedError) {
        return new Response("Unauthorized", {
          status: 401,
        });
      }
      if (err instanceof RateLimitError) {
        return new Response(err.message, {
          status: 429,
          headers: {
            ...err.retryAfter && { "Retry-After": err.retryAfter.toString() },
            "Content-Type": "text/plain",
          },
        });
      }
      console.error("Internal server error:", err);
      return new Response("Internal Server Error", {
        status: 500,
      });
    },
  }, (req, info) => {
    if (bffConfig.notificationsOnly) {
      const wsResponse = handleWebSocketUpgrade(req, bffConfig);
      if (wsResponse) return wsResponse;
    }
    return handler(req, info);
  });

  Deno.addSignalListener("SIGINT", () => {
    console.log("Shutting down server...");
    jetstream.disconnect();
    for (const labeler of labelerMap.values()) {
      labeler.disconnect();
    }
    db.close();
    Deno.exit(0);
  });
}
