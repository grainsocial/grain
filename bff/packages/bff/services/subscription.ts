import { stringifyLex } from "@atproto/lexicon";
import { Jetstream } from "../clients/jetstream.ts";
import type { BffConfig } from "../types.d.ts";
import { hydrateBlobRefs } from "../utils.ts";
import { getInstanceInfo } from "../utils/litefs.ts";
import type { IndexService } from "./indexing.ts";

// Global WebSocket clients map
export const wsClients = new Map<string, Set<WebSocket>>();

export function notifyMentionedDids(
  did: string,
  record: unknown,
) {
  // Find all DIDs mentioned in the record JSON
  const jsonStr = stringifyLex(record);
  const didRegex = /did:[a-z0-9]+:[a-zA-Z0-9._-]+/g;
  const mentionedDids = Array.from(new Set(jsonStr.match(didRegex) || []));
  for (const mentionedDid of mentionedDids) {
    if (mentionedDid === did) continue;
    if (wsClients.has(mentionedDid)) {
      for (const ws of wsClients.get(mentionedDid) ?? []) {
        ws.send(JSON.stringify({ type: "refresh-notifications" }));
      }
    }
  }
}

export function notifyAllConnectedClients() {
  for (const sockets of wsClients.values()) {
    for (const ws of sockets) {
      ws.send(JSON.stringify({ type: "refresh-notifications" }));
    }
  }
}

export function createSubscription(
  indexService: IndexService,
  cfg: BffConfig,
) {
  const jetstream = new Jetstream({
    instanceUrl: cfg.jetstreamUrl,
    wantedCollections: [
      ...(cfg.collections || []),
      ...(cfg.externalCollections || []),
    ],
    handleEvent: async (event) => {
      if (event.kind !== "commit" || !event.commit) return;

      const { currentIsPrimary } = await getInstanceInfo(cfg);
      if (!currentIsPrimary) return;

      const { did, commit } = event;
      const { collection, operation, rkey, cid, record } = commit;
      const uri = `at://${did}/${collection}/${rkey}`;

      // For external collections, verify the actor exists in the database
      if (cfg.externalCollections?.includes(collection)) {
        const actor = indexService.getActor(did);
        if (!actor) return;
      }

      console.log(`Received ${operation} event for ${uri}`);

      // Notifications-only mode: skip DB ops, just push notifications
      if (cfg.notificationsOnly) {
        if (operation === "create" || operation === "update") {
          try {
            cfg.lexicons.assertValidRecord(
              collection,
              hydrateBlobRefs(record),
            );
          } catch (err) {
            console.error(`Invalid record for ${uri}:`, err);
            return;
          }
          notifyMentionedDids(did, record);
        } else if (operation === "delete") {
          notifyAllConnectedClients();
        }
        return;
      }

      if (operation === "create" || operation === "update") {
        try {
          cfg.lexicons.assertValidRecord(
            collection,
            hydrateBlobRefs(record),
          );
        } catch (err) {
          console.error(`Invalid record for ${uri}:`, err);
          return;
        }

        try {
          indexService.insertRecord({
            uri,
            cid,
            did,
            collection,
            json: stringifyLex(record),
            indexedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error(`Failed to insert record for ${uri}:`, err);
          return;
        }
      } else if (operation === "delete") {
        try {
          indexService.deleteRecord(uri);
        } catch (err) {
          console.error(`Failed to delete record for ${uri}:`, err);
          return;
        }
      }
    },
  });

  return jetstream;
}

export function handleWebSocketUpgrade(
  req: Request,
  bffConfig: BffConfig,
): Response | undefined {
  const { pathname } = new URL(req.url);
  if (pathname !== "/ws" || req.headers.get("upgrade") !== "websocket") {
    return undefined;
  }
  const { socket, response } = Deno.upgradeWebSocket(req);

  socket.onopen = () => {
    // @TODO: use requreToken
    // // Extract DID from JWT in Authorization header
    // const did = parseJwtFromAuthHeader(req, bffConfig);
    // if (!did) {
    //   console.warn("WebSocket connection rejected: missing or invalid DID");
    //   socket.close();
    //   return;
    // }
    // if (!wsClients.has(did)) wsClients.set(did, new Set());
    // wsClients.get(did)!.add(socket);
    // console.log(`WebSocket connected for DID: ${did}`);

    // Only notify client to refresh notifications
    console.log("About to send refresh-notifications");
    try {
      socket.send(JSON.stringify({ type: "refresh-notifications" }));
      console.log("Sent refresh-notifications");
    } catch (err) {
      console.error("Error sending refresh-notifications:", err);
    }
  };

  socket.onclose = () => {
    let disconnectedDid: string | undefined;
    for (const [did, sockets] of wsClients.entries()) {
      if (sockets.has(socket)) {
        sockets.delete(socket);
        disconnectedDid = did;
        if (sockets.size === 0) wsClients.delete(did);
        break;
      }
    }
    if (disconnectedDid) {
      console.log(`WebSocket disconnected for DID: ${disconnectedDid}`);
    } else {
      console.log("WebSocket disconnected for unknown DID");
    }
  };

  return response;
}
