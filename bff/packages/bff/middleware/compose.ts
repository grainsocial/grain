import type { Agent } from "@atproto/api";
import type { DidResolver } from "@atproto/identity";
import { fetchATProtoSession } from "../aip/atproto-session.ts";
import {
  createGetATProtoSessionHelper,
  createRequireTokenHelper,
} from "../aip/context-helpers.ts";
import { AipSessionStore } from "../aip/session-store.ts";
import { backfillCollections, backfillUris } from "../services/backfill.ts";
import type { IndexService } from "../services/indexing.ts";
import { getLabelerDefinitions } from "../services/labeler.ts";
import { getNotifications, updateSeen } from "../services/notifications.ts";
import {
  createRecord,
  createRecords,
  deleteRecord,
  updateRecord,
  updateRecords,
} from "../services/pds.ts";
import type {
  ActorTable,
  BffConfig,
  BffContext,
  Database,
} from "../types.d.ts";
import { requireAuth } from "../utils/auth.ts";
import { uploadBlob } from "../utils/blob.ts";
import { rateLimit } from "../utils/rate_limit.ts";
import { html, json, redirect, render } from "../utils/response.tsx";
import { composeHandlers } from "../utils/routing.ts";

export function composeMiddlewares({
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
  return async (
    req: Request,
    _connInfo: Deno.ServeHandlerInfo,
    inner: (req: Request, ctx: BffContext) => Promise<Response>,
  ) => {
    let agent: Agent | undefined;
    let currentUser: ActorTable | undefined;

    // Create session resolver that works with both auth flows
    const getSession = async () => {
      // Check for Bearer token first (API/token flow)
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const accessToken = authHeader.substring(7);
        return await fetchATProtoSession(accessToken);
      }

      // Check for session cookie (web/cookie flow)
      const cookieHeader = req.headers.get("Cookie");
      if (cookieHeader) {
        const cookies = parseCookies(cookieHeader);
        const sessionId = cookies.sessionId;

        if (sessionId) {
          const sessionStore = new AipSessionStore(db);
          const session = sessionStore.get(sessionId);

          if (session) {
            // Use the access token from the session store
            return await fetchATProtoSession(session.accessToken);
          }
        }
      }

      throw new Error(
        "No authentication found - need either Bearer token or valid session cookie",
      );
    };

    // Helper function to parse cookies
    const parseCookies = (cookieHeader: string): Record<string, string> => {
      const cookies: Record<string, string> = {};
      cookieHeader.split(";").forEach((cookie) => {
        const [name, value] = cookie.trim().split("=");
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
      });
      return cookies;
    };

    const backfillCollectionsFn = backfillCollections(indexService, cfg);
    const backfillUrisFn = backfillUris(indexService, cfg);
    const uploadBlobFn = uploadBlob(getSession);
    const rateLimitFn = rateLimit(req, currentUser, db);
    const getNotificationsFn = getNotifications(currentUser, indexService);
    const updateSeenFn = updateSeen(currentUser, indexService);
    const getLabelerDefinitionsFn = getLabelerDefinitions(didResolver, cfg);

    const ctx: BffContext = {
      state: {},
      db,
      indexService: indexService,
      currentUser,
      agent,
      createRecord: createRecord(getSession, indexService, cfg),
      createRecords: createRecords(getSession, indexService, cfg),
      updateRecord: updateRecord(getSession, indexService, cfg),
      updateRecords: updateRecords(getSession, indexService, cfg),
      deleteRecord: deleteRecord(getSession, indexService),
      backfillCollections: backfillCollectionsFn,
      backfillUris: backfillUrisFn,
      uploadBlob: uploadBlobFn,
      didResolver,
      render: () => new Response(),
      html: html(),
      json: json(),
      redirect: redirect(req.headers),
      cfg,
      next: async () => new Response(),
      rateLimit: rateLimitFn,
      requireAuth: function () {
        return requireAuth(this);
      },
      getNotifications: getNotificationsFn,
      updateSeen: updateSeenFn,
      getLabelerDefinitions: getLabelerDefinitionsFn,
      fileFingerprints,
      requireToken: function () {
        return null as any;
      }, // Placeholder
      getATProtoSession: function () {
        return null as any;
      }, // Placeholder
    };

    ctx.render = render(ctx, cfg);

    ctx.requireToken = createRequireTokenHelper(ctx);
    ctx.getATProtoSession = createGetATProtoSessionHelper();

    const middlewares = cfg.middlewares || [];

    const composedHandler = composeHandlers([...middlewares, inner]);

    return composedHandler(req, ctx);
  };
}
