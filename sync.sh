#!/usr/bin/env bash

# Helpful when running local-infra. Specify the repos you've created on a local pds instance.

REPOS="did:plc:yyz2m2gxnbaxoru2sepbltxv"
COLLECTIONS="social.grain.gallery,social.grain.actor.profile,social.grain.photo,social.grain.favorite,social.grain.gallery.item,social.grain.graph.follow,social.grain.photo.exif"
EXTERNAL_COLLECTIONS="app.bsky.actor.profile,app.bsky.graph.follow,sh.tangled.graph.follow,sh.tangled.actor.profile"

deno run -A --env=.env jsr:@bigmoves/bff-cli@0.3.0-beta.37 sync \
  --repos="$REPOS" \
  --collections="$COLLECTIONS" \
  --external-collections="$EXTERNAL_COLLECTIONS"
