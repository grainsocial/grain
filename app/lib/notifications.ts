/**
 * Client-side notification grouping.
 *
 * Groupable reasons: gallery-favorite, story-favorite, follow.
 * Notifications are grouped when they share the same reason AND the same
 * subject (or no subject, for follows) within a 48-hour window.
 */

const GROUPABLE_REASONS = new Set([
  "gallery-favorite",
  "story-favorite",
  "follow",
]);

const MS_2DAY = 1e3 * 60 * 60 * 48;

export interface GroupedNotification {
  /** Primary notification (most recent in the group). */
  notification: any;
  /** Additional grouped notifications (oldest first). */
  additional: any[];
  /** Total author count (1 + additional unique authors). */
  authorCount: number;
}

export function groupNotifications(notifs: any[]): GroupedNotification[] {
  const groups: GroupedNotification[] = [];

  for (const notif of notifs) {
    if (!GROUPABLE_REASONS.has(notif.reason)) {
      groups.push({ notification: notif, additional: [], authorCount: 1 });
      continue;
    }

    const ts = +new Date(notif.createdAt);
    let matched = false;

    for (const group of groups) {
      const gts = +new Date(group.notification.createdAt);
      if (
        Math.abs(gts - ts) < MS_2DAY &&
        notif.reason === group.notification.reason &&
        subjectKey(notif) === subjectKey(group.notification) &&
        notif.author?.did !== group.notification.author?.did
      ) {
        // Don't add duplicate authors
        const alreadyHas = group.additional.some(
          (a: any) => a.author?.did === notif.author?.did,
        );
        if (!alreadyHas) {
          group.additional.push(notif);
          group.authorCount = 1 + group.additional.length;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push({ notification: notif, additional: [], authorCount: 1 });
    }
  }

  return groups;
}

function subjectKey(notif: any): string {
  if (notif.reason === "follow") return "__follow__";
  return notif.galleryUri ?? notif.storyUri ?? notif.uri;
}
