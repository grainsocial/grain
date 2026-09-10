// Demo data for the groups branch against the opensocial dev stack: the
// cycling club, in Grain. The riders already exist there — apps/community's
// seed founds the club and its members — so this only gives them a Grain
// profile, galleries of ride photos, and offers of them to the club's pool.
//
// The club (Peninsula Riders) is looked up on the host by handle. Without it
// the ride galleries still get written; only the offers are skipped.
//
//   PDS_URL=http://localhost:2583 HOST_URL=http://localhost:4000 \
//     npx tsx seeds/opensocial-demo.ts
//
// Ride photos are Bryan Newbold's, from bnewbold.net — see
// seeds/images/rides/CREDITS.md.
import exifr from "exifr";
import { seed } from "@hatk/hatk/seed";

const { createAccount, createRecord, uploadBlob } = seed({
  pds: process.env.PDS_URL ?? "http://localhost:2583",
  password: process.env.SEED_PASSWORD ?? "demo-pass",
});

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

// What the app records when you upload a photo, read here from the file
// instead of the browser: make, model, lens, exposure. Every number is scaled
// by a million, the way social.grain.photo.exif asks for it. Photos without
// EXIF simply get no record.
const SCALE = 1_000_000;
async function exifOf(path: string) {
  const raw = await exifr
    .parse(path, {
      pick: [
        "Make",
        "Model",
        "LensMake",
        "LensModel",
        "ExposureTime",
        "FNumber",
        "ISO",
        "FocalLengthIn35mmFormat",
        "Flash",
        "DateTimeOriginal",
      ],
    })
    .catch(() => null);
  if (!raw) return null;
  const out: Record<string, string | number> = {};
  for (const [from, to] of [
    ["Make", "make"],
    ["Model", "model"],
    ["LensMake", "lensMake"],
    ["LensModel", "lensModel"],
  ] as const) {
    if (raw[from]) out[to] = String(raw[from]).trim();
  }
  for (const [from, to] of [
    ["ExposureTime", "exposureTime"],
    ["FNumber", "fNumber"],
    ["ISO", "iSO"],
    ["FocalLengthIn35mmFormat", "focalLengthIn35mmFormat"],
  ] as const) {
    if (raw[from]) out[to] = Math.round(raw[from] * SCALE);
  }
  if (raw.Flash != null) out.flash = String(raw.Flash);
  if (raw.DateTimeOriginal instanceof Date)
    out.dateTimeOriginal = raw.DateTimeOriginal.toISOString();
  return Object.keys(out).length ? out : null;
}

type Rider = Awaited<ReturnType<typeof createAccount>>;

async function gallery(
  who: Rider,
  rkey: string,
  title: string,
  description: string,
  photos: { file: string; alt: string; ratio: [number, number] }[],
  minutesAgo: number,
) {
  const g = await createRecord(
    who,
    "social.grain.gallery",
    { title, description, createdAt: ago(minutesAgo) },
    { rkey },
  );
  for (const [i, p] of photos.entries()) {
    const blob = await uploadBlob(who, `./seeds/images/${p.file}`);
    const photo = await createRecord(
      who,
      "social.grain.photo",
      {
        photo: blob,
        alt: p.alt,
        aspectRatio: { width: p.ratio[0], height: p.ratio[1] },
        createdAt: ago(minutesAgo),
      },
      { rkey: `${rkey}-p${i}` },
    );
    await createRecord(
      who,
      "social.grain.gallery.item",
      { gallery: g.uri, item: photo.uri, position: i, createdAt: ago(minutesAgo) },
      { rkey: `${rkey}-i${i}` },
    );
    const exif = await exifOf(`./seeds/images/${p.file}`);
    if (exif) {
      await createRecord(
        who,
        "social.grain.photo.exif",
        { photo: photo.uri, ...exif, createdAt: ago(minutesAgo) },
        { rkey: `${rkey}-x${i}` },
      );
    }
  }
  console.log(`[seed] ${who.handle}: ${title} (${photos.length} photos) ${g.uri}`);
  return g;
}

// ------------------------------------------------- the club and its riders
//
// Peninsula Riders is founded by apps/community's seed on the opensocial host:
// its members, roles, events and rules all live there. Grain knows it only as
// a DID with a community.opensocial.declaration — the one discoverable fact a
// third-party app gates on — so all it needs from the host is that DID.

const HOST = process.env.HOST_URL ?? "http://localhost:4000";
const CLUB_HANDLE = process.env.CLUB_HANDLE ?? "peninsula-riders.opensocial.test";

/** The club's DID, or null if this network has no such community. */
async function findClub(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`${HOST}/xrpc/community.opensocial.listCommunities`);
    if (!res.ok) return null;
    const { communities } = (await res.json()) as {
      communities: { handle: string; did: string }[];
    };
    return communities.find((c) => c.handle === handle)?.did ?? null;
  } catch {
    return null;
  }
}

const club = await findClub(CLUB_HANDLE);
console.log(
  club
    ? `[seed] club ${CLUB_HANDLE} ${club}`
    : `[seed] no ${CLUB_HANDLE} on ${HOST} — offers skipped`,
);

/** A club member with a Grain face: display name, bio, and an avatar. */
async function rider(handle: string, displayName: string, description: string, avatar: string) {
  const who = await createAccount(handle);
  const blob = await uploadBlob(who, `./seeds/images/rides/${avatar}`);
  await createRecord(
    who,
    "social.grain.actor.profile",
    { displayName, description, avatar: blob, createdAt: ago(60 * 24 * 30) },
    { rkey: "self" },
  );
  return who;
}

/**
 * Offer one of your galleries to the club's pool. The submission lives in the
 * member's own repo — it is a request, not a change to the club — and stays
 * pending until whoever holds the club's admit answers with a group.item.
 */
async function offer(who: Rider, g: { uri: string }, rkey: string, minutesAgo: number) {
  if (!club) return;
  await createRecord(
    who,
    "social.grain.group.submission",
    { group: club, gallery: g.uri, createdAt: ago(minutesAgo) },
    { rkey },
  );
  console.log(`[seed] ${who.handle} offered ${g.uri} to the pool`);
}

const priya = await rider(
  "priya-nair.test",
  "Priya Nair",
  "Organizer and moderator at Peninsula Riders. Tours when the club is off.",
  "avatar-priya.jpg",
);
const marcus = await rider(
  "marcus-oyelaran.test",
  "Marcus Oyelaran",
  "Posts the rides. Long way round, always.",
  "avatar-marcus.jpg",
);
const lena = await rider(
  "lena-fox.test",
  "Lena Fox",
  "Tuesday spin regular. Rain is just weather.",
  "avatar-lena.jpg",
);
const jo = await rider(
  "jo-tanaka.test",
  "Jo Tanaka",
  "Rides for the coffee. Hauls the rest of it.",
  "avatar-jo.jpg",
);
const tom = await rider(
  "tom-reyes.test",
  "Tom Reyes",
  "Fixes everyone's bike at the roadside. Owns four.",
  "avatar-tom.jpg",
);

const WIDE: [number, number] = [3, 2];
const PHONE: [number, number] = [4, 3];
const TALL: [number, number] = [3, 4];

// The galleries are dated to the club's rides — apps/community's seed puts a
// past ride at each of these distances — because the club's site files a
// gallery under the ride it came from by when it was made. Titles say which
// ride; the photos are members' own.
const DAY = 60 * 24;

const century = await gallery(
  priya,
  "century-from-the-sweep",
  "Century, from the sweep",
  "Riding sweep on the spring century: everything behind the second group, at the second group's pace. Loaded, slow, and worth it.",
  [
    {
      file: "rides/olympics-loaded-bike.jpg",
      alt: "A loaded touring bike leaning against a stone wall at the start",
      ratio: WIDE,
    },
    {
      file: "rides/olympics-three-up.jpg",
      alt: "Three riders with panniers riding a forest road together",
      ratio: WIDE,
    },
    {
      file: "rides/olympics-alder-tunnel.jpg",
      alt: "A rider disappearing into a tunnel of pale alder trunks",
      ratio: WIDE,
    },
    {
      file: "rides/olympics-lake-camp.jpg",
      alt: "A lake under cloud and mountains, from the second aid stop",
      ratio: WIDE,
    },
    {
      file: "rides/olympics-ferry-deck.jpg",
      alt: "Loaded bikes strapped to the rail on the ferry home",
      ratio: WIDE,
    },
  ],
  23 * DAY,
);
await offer(priya, century, "pool-century-from-the-sweep", 22 * DAY);

const tunnel = await gallery(
  marcus,
  "tunnel-hill-the-long-way",
  "Tunnel Hill, the long way",
  "Six hours, a tunnel, and about a hundred miles of nothing. Ask me about the headwind.",
  [
    {
      file: "rides/yakima-autumn-hillside.jpg",
      alt: "A hillside turning orange and red above the road",
      ratio: WIDE,
    },
    {
      file: "rides/yakima-tunnel-arches.jpg",
      alt: "The ribbed arches of the old railway tunnel, lit at the far end",
      ratio: TALL,
    },
    {
      file: "rides/yakima-empty-road.jpg",
      alt: "Empty two-lane road curving through dry golden hills",
      ratio: WIDE,
    },
    {
      file: "rides/yakima-stonehenge.jpg",
      alt: "A concrete Stonehenge replica on a bluff, one person for scale",
      ratio: WIDE,
    },
    {
      file: "rides/yakima-river-bend.jpg",
      alt: "The river bending below the road, blue against brown hills",
      ratio: WIDE,
    },
  ],
  51 * DAY,
);
await offer(marcus, tunnel, "pool-tunnel-hill-the-long-way", 50 * DAY);

const errands = await gallery(
  jo,
  "club-errands",
  "Club errands",
  "Everything the century after-party needed, delivered by bike. The keg was the hard one.",
  [
    {
      file: "rides/errand-beer-run.jpg",
      alt: "A pink bike with a case of beer strapped to the front rack",
      ratio: PHONE,
    },
    {
      file: "rides/errand-keg-trailer.jpg",
      alt: "A bike towing a trailer with a keg strapped into it",
      ratio: PHONE,
    },
    {
      file: "rides/errand-grocery-crew.jpg",
      alt: "Three riders behind a bike loaded with groceries on a sunny street",
      ratio: PHONE,
    },
  ],
  26 * DAY,
);
await offer(jo, errands, "pool-club-errands", 25 * DAY);

const ferry = await gallery(
  tom,
  "ferry-loop-and-a-flat",
  "Ferry loop, and a flat",
  "Two ways a ride ends up on the ground.",
  [
    {
      file: "rides/ferry-bike-deck.jpg",
      alt: "A single bike leaning on the rail of an empty ferry deck",
      ratio: PHONE,
    },
    {
      file: "rides/roadside-strip-down.jpg",
      alt: "A bike stripped down at a roadside pullout, bags spread on the tarmac",
      ratio: PHONE,
    },
  ],
  79 * DAY,
);
await offer(tom, ferry, "pool-ferry-loop-and-a-flat", 79 * DAY);

const rain = await gallery(
  tom,
  "rain-or-shine",
  "Rain or shine",
  "It said rain or shine. It was not shine.",
  [
    {
      file: "rides/rain-bridge-bikes.jpg",
      alt: "Loaded bikes leaning on a wet stone bridge wall, the river grey behind",
      ratio: PHONE,
    },
    {
      file: "rides/rain-highway-bridge.jpg",
      alt: "An empty highway bridge over the river, seen from the hill above in the rain",
      ratio: PHONE,
    },
    {
      file: "rides/rain-dam-cloud.jpg",
      alt: "Low cloud over the dam and the river, everything one shade of grey",
      ratio: PHONE,
    },
    {
      file: "rides/rain-wet-panniers.jpg",
      alt: "Yellow and red panniers stacked on a porch to dry",
      ratio: TALL,
    },
  ],
  107 * DAY,
);
await offer(tom, rain, "pool-rain-or-shine", 107 * DAY);

const wind = await gallery(
  lena,
  "wind-farm-loop",
  "Wind farm loop",
  "Tailwind home for once. The turbines were pointing the way we were going.",
  [
    {
      file: "rides/wind-pass-sign.jpg",
      alt: "A loaded bike with yellow panniers beside a summit sign on an empty road",
      ratio: WIDE,
    },
    {
      file: "rides/wind-viewpoint.jpg",
      alt: "A viewpoint sign naming the mountains, brown grass to the horizon",
      ratio: WIDE,
    },
    {
      file: "rides/wind-turbine-road.jpg",
      alt: "The road climbing toward a ridge of wind turbines",
      ratio: WIDE,
    },
    {
      file: "rides/wind-golden-hills.jpg",
      alt: "Golden hills and yellow rabbitbrush under a clear sky",
      ratio: WIDE,
    },
    {
      file: "rides/wind-old-road.jpg",
      alt: "A cracked old road running out toward the turbines",
      ratio: WIDE,
    },
  ],
  149 * DAY,
);
await offer(lena, wind, "pool-wind-farm-loop", 148 * DAY);

// Offered half an hour ago, so it is still sitting in the queue a moderator
// sees — the club has not answered this one yet.
const gorge = await gallery(
  lena,
  "rain-on-the-gorge",
  "Rain on the gorge",
  "It rained for two days. Turns out that is when the waterfalls are worth it.",
  [
    {
      file: "rides/gorge-misty-bikes.jpg",
      alt: "Two loaded bikes at a guardrail, a rider in red, mist in the firs",
      ratio: PHONE,
    },
    {
      file: "rides/gorge-wet-bridge.jpg",
      alt: "A rider crossing a wet steel bridge in the rain",
      ratio: TALL,
    },
    {
      file: "rides/gorge-waterfall.jpg",
      alt: "A tall waterfall dropping down a mossy basalt cliff",
      ratio: TALL,
    },
  ],
  45,
);
await offer(lena, gorge, "pool-rain-on-the-gorge", 30);

console.log("[seed] done");
