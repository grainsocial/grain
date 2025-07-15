import { lexicons } from "$lexicon/lexicons.ts";
import { bff } from "@bigmoves/bff";

bff({
  appName: "Grain Social Notifications",
  databaseUrl: ":memory:",
  lexicons,
  collections: [
    "social.grain.actor.profile",
    "social.grain.gallery",
    "social.grain.gallery.item",
    "social.grain.photo",
    "social.grain.photo.exif",
    "social.grain.favorite",
    "social.grain.graph.follow",
    "social.grain.comment",
  ],
  notificationsOnly: true,
});
