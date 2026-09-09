// Demo data for the groups branch against the opensocial dev stack. Every
// account here already exists there — packages/cli's seed-demo makes the
// generic ones, apps/community's seed makes the cycling club's — so this only
// gives them Grain profiles, galleries, and offers of a gallery to a group.
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
  pds: process.env.PDS_URL ?? "http://localhost:2683",
  password: process.env.SEED_PASSWORD ?? "demo-pass",
});

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const mia = await createAccount("member-mia.test");
const fay = await createAccount("founder-fay.test");

const miaAvatar = await uploadBlob(mia, "./seeds/images/alice.png");
await createRecord(
  mia,
  "social.grain.actor.profile",
  {
    displayName: "Mia",
    description: "Rides, mostly. Sometimes the coast.",
    avatar: miaAvatar,
    createdAt: ago(300),
  },
  { rkey: "self" },
);
await createRecord(
  fay,
  "social.grain.actor.profile",
  { displayName: "Fay", description: "Founded Open House. Trees and trails.", createdAt: ago(300) },
  { rkey: "self" },
);

// What the app records when you upload a photo, read here from the file
// instead of the browser: make, model, lens, exposure. Every number is scaled
// by a million, the way social.grain.photo.exif asks for it. Photos without
// EXIF — the older placeholder images — simply get no record.
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

async function gallery(
  who: typeof mia,
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

await gallery(
  mia,
  "skyline-loop",
  "Skyline Loop, the foggy bit",
  "Got dropped on the climb, got these instead.",
  [
    { file: "skyline.jpg", alt: "Skyline at dusk from the bridge", ratio: [4, 3] },
    {
      file: "skyline-portrait.jpg",
      alt: "Vertical view of the skyline through an alley",
      ratio: [3, 4],
    },
  ],
  180,
);
await gallery(
  mia,
  "night-market",
  "Night market",
  "Clement St after the ride.",
  [{ file: "city-night.jpg", alt: "Neon signs reflecting on wet pavement", ratio: [4, 3] }],
  90,
);
await gallery(
  mia,
  "film-cafe",
  "Film café",
  "Half a roll, one table.",
  [{ file: "film-cafe.jpg", alt: "A café table on expired film", ratio: [4, 3] }],
  30,
);
await gallery(
  mia,
  "coast-ride",
  "Coast ride",
  "Pescadero and back before the fog.",
  [{ file: "film-portrait.jpg", alt: "A rider at the turnaround, on film", ratio: [3, 4] }],
  20,
);
await gallery(
  mia,
  "deer",
  "The deer again",
  "Same clearing, same deer, better light.",
  [{ file: "wildlife.jpg", alt: "A deer at the edge of the clearing", ratio: [4, 3] }],
  10,
);
await gallery(
  fay,
  "forest-trail",
  "Forest trail",
  "Sunday, no plan.",
  [
    { file: "forest.jpg", alt: "Sunlight filtering through tall trees", ratio: [4, 3] },
    { file: "wildlife.jpg", alt: "A deer at the edge of the clearing", ratio: [4, 3] },
  ],
  240,
);

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
async function offer(
  who: Awaited<ReturnType<typeof createAccount>>,
  g: { uri: string },
  rkey: string,
  minutesAgo: number,
) {
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

const olympics = await gallery(
  priya,
  "around-the-olympics",
  "Around the Olympics",
  "Seven days round the peninsula with four others. Loaded, slow, and worth it.",
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
      alt: "A lake under cloud and mountains, from the camp beach",
      ratio: WIDE,
    },
    {
      file: "rides/olympics-ferry-deck.jpg",
      alt: "Loaded bikes strapped to the rail on a ferry car deck",
      ratio: WIDE,
    },
  ],
  60 * 24 * 9,
);
await offer(priya, olympics, "pool-around-the-olympics", 60 * 24 * 8);

const yakima = await gallery(
  marcus,
  "the-long-way-to-the-river",
  "The long way to the river",
  "Six days, a tunnel, and about a hundred miles of nothing. Ask me about the headwind.",
  [
    {
      file: "rides/yakima-autumn-hillside.jpg",
      alt: "A hillside turning orange and red above the road",
      ratio: WIDE,
    },
    {
      file: "rides/yakima-tunnel-arches.jpg",
      alt: "The ribbed arches of an old railway tunnel, lit at the far end",
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
  60 * 24 * 6,
);
await offer(marcus, yakima, "pool-the-long-way-to-the-river", 60 * 24 * 5);

const errands = await gallery(
  jo,
  "club-errands",
  "Club errands",
  "Everything the club needs, delivered by bike. The keg was the hard one.",
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
  60 * 24 * 3,
);
await offer(jo, errands, "pool-club-errands", 60 * 24 * 3);

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
// Offered half an hour ago, so it is still sitting in the queue a moderator
// sees — the club has not answered this one yet.
await offer(lena, gorge, "pool-rain-on-the-gorge", 30);

// Not offered to anyone — a member's gallery is theirs first, and the club's
// pool only holds what someone chose to put in it.
await gallery(
  tom,
  "ferry-and-a-flat",
  "Ferry, and a flat",
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
  60 * 5,
);

console.log("[seed] done");
