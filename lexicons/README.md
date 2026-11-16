# Lexicons

The schemas grain's records and XRPC methods are written to. `social.grain.*`
is grain's own; the rest (`app.bsky`, `com.atproto`, `dev.hatk`, ...) are
copies of other publishers', kept so the types and the validation have them.

## Moving off hatk

grain's Rust server serves `social.grain.*` methods only. Until it takes over,
hatk serves the `dev.hatk.*` and `social.grain.unspecced.*` methods the web
app and the apps call today, so both sets are here: the old ones go at
cutover, along with this section.

A renamed method takes the same parameters, input and output as the one it
replaces, so porting a caller is a rename. Objects an output defined for
itself, or inline, are named defs in the namespace's `defs.json`.

### `social.grain.unspecced`

| Was                                 | Is                                            |
| ----------------------------------- | --------------------------------------------- |
| `getActorFavorites`                 | `social.grain.actor.getFavorites`             |
| `getActorProfile`                   | `social.grain.actor.getProfile`               |
| `getSuggestedFollows`               | `social.grain.actor.getSuggestedFollows`      |
| `searchActorsTypeahead`             | `social.grain.actor.searchActorsTypeahead`    |
| `searchProfiles`                    | `social.grain.actor.searchActors`             |
| `getCommentThread`                  | `social.grain.comment.getThread`              |
| `deleteGallery`                     | `social.grain.gallery.deleteGallery`          |
| `getCameras`                        | `social.grain.gallery.getCameras`             |
| `getGalleryFavorites`               | `social.grain.gallery.getFavorites`           |
| `getGallery`                        | `social.grain.gallery.getGallery`             |
| `getLocations`                      | `social.grain.gallery.getLocations`           |
| `searchGalleries`                   | `social.grain.gallery.searchGalleries`        |
| `getBlocks`                         | `social.grain.graph.getBlocks`                |
| `getFollowers`                      | `social.grain.graph.getFollowers`             |
| `getFollowing`                      | `social.grain.graph.getFollowing`             |
| `getKnownFollowers`                 | `social.grain.graph.getKnownFollowers`        |
| `getMutes`                          | `social.grain.graph.getMutes`                 |
| `createGroup`                       | `social.grain.group.createGroup`              |
| `getGroupHost`                      | `social.grain.group.getGroupHost`             |
| `getGroup`                          | `social.grain.group.getGroup`                 |
| `getGroupSubmissions`               | `social.grain.group.getSubmissions`           |
| `joinGroup`                         | `social.grain.group.joinGroup`                |
| `leaveGroup`                        | `social.grain.group.leaveGroup`               |
| `listGroups`                        | `social.grain.group.listGroups`               |
| `createPoolComment`                 | `social.grain.group.createComment`            |
| `createPoolGallery`                 | `social.grain.group.createGallery`            |
| `deletePoolComment`                 | `social.grain.group.deleteComment`            |
| `deletePoolGallery`                 | `social.grain.group.deleteGallery`            |
| `getPoolGallery`                    | `social.grain.group.getGallery`               |
| `listPoolFeed`                      | `social.grain.group.listFeed`                 |
| `listPoolGalleries`                 | `social.grain.group.listGalleries`            |
| `putPoolFavorite`                   | `social.grain.group.putFavorite`              |
| `getNotifications` with `countOnly` | `social.grain.notification.getUnreadCount`    |
| `getNotifications`                  | `social.grain.notification.listNotifications` |
| `deleteAccount`                     | `social.grain.server.deleteAccount`           |
| `getSpaceSupport`                   | `social.grain.server.getSpaceSupport`         |
| `getSitemap`                        | `social.grain.server.getSitemap`              |
| `getStoryArchive`                   | `social.grain.story.getArchive`               |
| `getStoryAuthors`                   | `social.grain.story.getAuthors`               |
| `getStories`                        | `social.grain.story.getStories`               |
| `getStory`                          | `social.grain.story.getStory`                 |
| `markStoriesViewed`                 | `social.grain.story.markViewed`               |

Two deletes differ, as knotless's do. `social.grain.server.deleteAccount`
takes the account's `did`, named again, and a `limit`, and answers
`{deleted, done}`, as `dev.knotless.deleteAccountData` does: the web asks
until it is done; the apps delete their records at their own PDS first and
ask with a service token to be forgotten. `social.grain.gallery.deleteGallery`
is the web's alone, by its cookie: the apps delete a gallery's records at
their own PDS, then call `social.grain.sync.indexRecords`.

The notifications are shaped after Bluesky's, so they differ from hatk's
`getNotifications`: the count is a method of its own, and the list says
the viewer's `seenAt` and each notification's `indexedAt` and `isRead`,
where hatk's said `unseenCount`.

### `dev.hatk`

| Was                                                                      | Is                                                                                                                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `createRecord`, `putRecord`, `deleteRecord`, `applyWrites`, `uploadBlob` | the web: `social.grain.repo.*`, without `repo`; the apps: `com.atproto.repo.*` on the user's PDS, then `social.grain.sync.indexRecords` |
| `getRecord`                                                              | `com.atproto.repo.getRecord` on the user's PDS                                                                                          |
| `getRecords`, `searchRecords`, `describeCollections`                     | no replacement: the web app does not call them                                                                                          |
| `getFeed`                                                                | `social.grain.feed.getFeed`, taking the feed's URI rather than its name                                                                 |
| `describeFeeds`                                                          | `social.grain.feed.describeFeeds`                                                                                                       |
| `getPreferences`                                                         | `social.grain.actor.getPreferences`                                                                                                     |
| `putPreference`                                                          | `social.grain.actor.putPreferences`, the whole set at once; `lastSeenNotifications` becomes `social.grain.notification.updateSeen`      |
| `push.registerToken`                                                     | `social.grain.notification.registerPush`                                                                                                |
| `push.unregisterToken`                                                   | `social.grain.notification.unregisterPush`                                                                                              |
| `createReport`                                                           | `com.atproto.moderation.createReport`                                                                                                   |
| `describeLabels`                                                         | `social.grain.moderation.describeLabels`, and the labels themselves `com.atproto.label.queryLabels`                                     |

Shaped after their Bluesky counterparts, so they differ from hatk's: the
preferences are typed (`social.grain.actor.defs#preferences`) rather than
free key and value, and a push registration names the service, the platform
(`ios`, `android`, `web`) and the app, as `app.bsky.notification.registerPush`
does.

A report names atproto's `reasonType` where hatk's `createReport` named one of
grain's labels, and is filed under the label its reason asks for: atproto's and
Ozone's reasons each have one, and `social.grain.moderation.defs#reasonCopyright`
and `#reasonNudity` name the two labels neither has a reason for. Ozone's
`reasonChildSafety*` reasons are filed under `csae`.

The label definitions come as a Bluesky labeler's service record holds them
(`app.bsky.labeler.defs#labelerPolicies`): `labelValueDefinitions` where hatk
answered `definitions`, beside `labelValues`, every value given out, and the
DID the labels name as their `src`.

### hatk's admin endpoints

| Was                                                | Is                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `GET /admin/reports`                               | `social.grain.admin.listReports`                                  |
| `POST /admin/reports/resolve`                      | `social.grain.admin.resolveReport`                                |
| `GET /admin/review`                                | `social.grain.admin.getReviewQueue`                               |
| `GET /admin/review/subject/:did`                   | `social.grain.admin.getReviewSubject`                             |
| `POST /admin/review/act`                           | `social.grain.admin.actOnReview`                                  |
| `POST /admin/review/scan`                          | `social.grain.admin.startScan`                                    |
| `GET /admin/review/stats`                          | `social.grain.admin.getReviewStats`                               |
| `POST /admin/labels`, `/admin/labels/negate`       | `social.grain.admin.applyLabel`, `social.grain.admin.negateLabel` |
| `GET /admin/labels/definitions`                    | `social.grain.admin.listLabelDefinitions`                         |
| `POST /admin/repos/add`                            | `social.grain.admin.addRepos`                                     |
| `POST /admin/repos/remove`                         | `social.grain.admin.removeRepos`                                  |
| `POST /admin/repos/resync`                         | `social.grain.admin.resyncRepos`                                  |
| `GET /admin/info`                                  | `social.grain.admin.getInfo`                                      |
| `GET /admin/info/:did`                             | `social.grain.admin.getRepo`                                      |
| `GET /admin/repos`, `/admin/search?type=accounts`  | `social.grain.admin.listRepos`                                    |
| `GET /admin/search?type=records`                   | `social.grain.admin.searchRecords`                                |
| `POST /admin/takedown`, `/admin/reverse-takedown`  | `com.atproto.admin.updateSubjectStatus`                           |
| `GET /admin/whoami`                                | nothing: an admin method answers 403 to anyone else               |
| `POST /admin/labels/reset`, `/admin/labels/rescan` | nothing yet                                                       |

Lexicons have no floats, so classifier scores are integers in thousandths:
hatk's `0.873` is `873`.

## Methods under a record's name

`social.grain.group` is a space declaration, and methods live under the same
name: `social.grain.group.createGroup`. An NSID's last segment is its name and
the rest its authority, so the declaration resolves at `_lexicon.grain.social` and
the methods at `_lexicon.group.grain.social`, and the files sit side by side,
`group.json` beside `group/`, as `group/defs.json` and the group's records
already do.
