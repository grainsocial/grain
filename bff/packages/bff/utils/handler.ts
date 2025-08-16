import type { DidResolver } from "@atproto/identity";
import { composeMiddlewares } from "../middleware/compose.ts";
import type { IndexService } from "../services/indexing.ts";
import type { BffConfig, Database } from "../types.d.ts";
import { handler } from "./routing.ts";

export function createBffHandler({
  db,
  cfg,
  didResolver,
  fileFingerprints,
  indexService,
}: {
  db: Database;
  cfg: BffConfig;
  didResolver: DidResolver;
  fileFingerprints: Map<string, string>;
  indexService: IndexService;
}) {
  const inner = handler;
  const withMiddlewares = composeMiddlewares({
    db,
    cfg,
    didResolver,
    fileFingerprints,
    indexService,
  });
  return function handler(req: Request, connInfo: Deno.ServeHandlerInfo) {
    return withMiddlewares(req, connInfo, inner);
  };
}
