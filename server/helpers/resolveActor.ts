// A handle or a DID, resolved to a DID.
//
// The index answers for anyone grain has seen, which is not everyone worth
// sharing a gallery with: an account on a PDS that serves permissioned spaces
// is exactly the kind grain may never have indexed. So the viewer's own PDS is
// asked second, since resolving a handle is something every PDS does.

import { resolveHandle } from "./resolveHandle.ts";

type Db = { query: (sql: string, params?: unknown[]) => Promise<unknown[]> };

type PdsCall = (
  nsid: string,
  options?: { method?: "GET" | "POST"; params?: Record<string, string>; body?: unknown },
) => Promise<Record<string, unknown>>;

export async function resolveActor(db: Db, pds: PdsCall, actor: string): Promise<string | null> {
  const handle = actor.trim().replace(/^@/, "");
  if (!handle) return null;
  if (handle.startsWith("did:")) return handle;

  const indexed = await resolveHandle(db, handle);
  if (indexed) return indexed;

  try {
    const body = await pds("com.atproto.identity.resolveHandle", {
      method: "GET",
      params: { handle },
    });
    const did = body.did;
    return typeof did === "string" ? did : null;
  } catch {
    return null;
  }
}
