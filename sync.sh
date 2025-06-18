#!/usr/bin/env bash

# Helpful when running local-infra. Specify the repos you've created on a local pds instance.

DB="backup-2025-06-18.db"
REPOS=""
COLLECTIONS="social.grain.gallery,social.grain.actor.profile,social.grain.photo,social.grain.favorite,social.grain.gallery.item,social.grain.graph.follow,social.grain.photo.exif"
EXTERNAL_COLLECTIONS="app.bsky.actor.profile,app.bsky.graph.follow,sh.tangled.graph.follow,sh.tangled.actor.profile"
COLLECTION_KEY_MAP='{"social.grain.favorite":["subject"],"social.grain.graph.follow":["subject"],"social.grain.gallery.item":["gallery","item"],"social.grain.photo.exif":["photo"]}'

deno run -A --env=.env jsr:@bigmoves/bff-cli@0.3.0-beta.40 sync \
  --db="$DB" \
  --repos="$REPOS" \
  --collections="$COLLECTIONS" \
  --external-collections="$EXTERNAL_COLLECTIONS" \
  --collection-key-map="$COLLECTION_KEY_MAP"
