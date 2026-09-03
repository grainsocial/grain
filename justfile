# grain task runner. `just` on its own lists what is here.

# Appview the live-data dev server reads from.
appview := "https://grain.social"

default:
    @just --list

# Dev server against the local PDS and the local appview.
dev:
    npm run dev

# `dev-live` points the browser's XRPC reads at a deployed appview, for looking
# at UI changes against real data. See the note above GRAIN_API_PROXY in
# vite.config.ts for how it is wired.
#
# Read-only and anonymous. Only GET queries are forwarded, so anything needing a
# session — notifications, private galleries, anything you post — still comes
# from the local appview, and fields a deployed appview does not return yet
# arrive empty.

# Dev server reading real data from a deployed appview.
dev-live target=appview:
    GRAIN_API_PROXY={{ target }} npm run dev
