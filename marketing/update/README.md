# The move to the new server

What grain says, and when, as it moves from the old server to grain-serve on
**Monday, Nov 16**.

- `posts.json`: every post's text, each image's size and alt text, and the
  steps below.
- `notice.html` and `render.mjs`: the images, rendered given the date.
- `post.mjs`: posts a step as grain.social.

```sh
node marketing/update/render.mjs "Monday, Nov 16"
GRAIN_SOCIAL_PASSWORD=<app password> node marketing/update/post.mjs <step> [--dry-run]
```

The app password is grain.social's, the one the support agent posts with
(`BSKY_APP_PASSWORD` in `/etc/grain/secrets/support-agent.env` on the host).
It is never kept here. A step already posted is not posted again.

## When each goes out

| When                                             | Step                      | What                                                        |
| ------------------------------------------------ | ------------------------- | ----------------------------------------------------------- |
| Both store versions live (iOS 11, Android 0.8.0) | `story-1`, then `story-2` | grain.social's stories                                      |
| Same day                                         | `announce`                | Bluesky post with `story-1.png`, and the web reply under it |
| Sunday, Nov 15                                   | `reminder`                | Bluesky post with `story-2.png`                             |
| Monday, Nov 16, the morning                      | `story-3`                 | grain.social's story                                        |
| Nov 16, as the cutover starts                    | `start`                   | Bluesky post                                                |
| Nov 16, once it's live                           | `done`                    | Bluesky post                                                |
| After the cutover                                |                           | `post.png`, the one item the old apps' feed shows           |

## The old apps' feed item

The app versions before iOS 11 and Android 0.8.0 ask for a feed grain-serve
does not serve. In front of it, Caddy answers with one item showing
`post.png`, which grain-serve's pages serve as `/update-notice.png`
(hetzner-infra's `stacks/grain/files/Caddyfile.tftpl`). iOS 10 and Android
0.7.0 are asked to update by the minimums in `/app-version.json` before
that.
