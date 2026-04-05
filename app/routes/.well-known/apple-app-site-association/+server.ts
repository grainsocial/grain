import { json } from "@sveltejs/kit";

export function GET() {
  return json({
    applinks: {
      apps: [],
      details: [
        {
          appID: "YN68LN9T7Z.social.grain.grain",
          paths: ["/profile/*/gallery/*", "/profile/*/story/*", "/profile/*"],
        },
      ],
    },
    webcredentials: {
      apps: ["YN68LN9T7Z.social.grain.grain"],
    },
  });
}
