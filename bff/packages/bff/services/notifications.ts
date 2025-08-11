import type { ActorTable } from "../types.d.ts";
import type { IndexService } from "./indexing.ts";

export function getNotifications(
  currentUser: ActorTable | undefined,
  indexService: IndexService,
): <T extends Record<string, unknown>>() => T[] {
  return function <T extends Record<string, unknown>>(): T[] {
    if (!currentUser) {
      return [];
    }

    const mentions = indexService.getMentioningUris(currentUser.did);
    const notifications: T[] = [];

    for (const uri of mentions) {
      const record = indexService.getRecord(uri);
      if (record) {
        notifications.push(record as T);
      }
    }

    return notifications;
  };
}

export function updateSeen(
  currentUser: ActorTable | undefined,
  indexService: IndexService,
) {
  return (seenAt: string) => {
    if (!currentUser) {
      return;
    }
    indexService.updateActor(
      currentUser.did,
      seenAt,
    );
  };
}
