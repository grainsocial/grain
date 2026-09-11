// Demo data for the groups branch against the opensocial dev stack: the
// cycling club, in Grain. The riders already exist there — apps/community's
// seed founds the club and its members — so this only gives them a Grain
// profile and their galleries of ride photos.
//
// Most of those go straight into the club's pool, which is a permissioned
// space the club owns: the records are the rider's, in the rider's own repo,
// but only the club's members can read them. Nothing is offered and nothing is
// accepted — being a member is the whole permission. One gallery is published
// the ordinary public way, so the difference is visible in one seed.
//
// The club (Rain Shadow Riders) is looked up on the host by handle. Without it
// every gallery falls back to public.
//
//   PDS_URL=http://localhost:2583 HOST_URL=http://localhost:4000 \
//     npx tsx seeds/opensocial-demo.ts
//
// Ride photos are Bryan Newbold's, from bnewbold.net — see
// seeds/images/rides/CREDITS.md.
import exifr from "exifr";
import { seed } from "@hatk/hatk/seed";

const PDS = process.env.PDS_URL ?? "http://localhost:2583";
const { createAccount, createRecord, uploadBlob } = seed({
  pds: PDS,
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

/**
 * Write records into a space, as the account whose repo they land in.
 *
 * Not `createRecord`: that writes to the public repo, and the whole point of a
 * pool gallery is that it does not go there. A space write is the same commit
 * through a different door — `com.atproto.space.applyWrites`, naming the space
 * — and the PDS asks the space's authority whether this account may.
 */
async function applyWrites(who: Rider, space: string, writes: Record<string, unknown>[]) {
  const call = (nsid: string, body: unknown) =>
    fetch(`${PDS}/xrpc/${nsid}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${who.accessJwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

  const res = await call("com.atproto.space.applyWrites", { space, repo: who.did, writes });
  if (res.ok) return;
  const body = await res.text();
  // Everything here has a stable rkey, so a second run finds its own records
  // already there. One commit is the nice path; re-runnability is the one that
  // matters, so fall back to overwriting them one at a time.
  if (!body.includes("RecordAlreadyExists")) {
    throw new Error(`space.applyWrites ${res.status}: ${body}`);
  }
  for (const w of writes) {
    const put = await call("com.atproto.space.putRecord", {
      space,
      repo: who.did,
      collection: w.collection,
      rkey: w.rkey,
      validate: false,
      record: w.value,
    });
    if (!put.ok) throw new Error(`space.putRecord ${put.status}: ${await put.text()}`);
  }
}

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
// Rain Shadow Riders is founded by apps/community's seed on the opensocial host:
// its members, roles, events and rules all live there. Grain knows it only as
// a DID with a community.opensocial.declaration — the one discoverable fact a
// third-party app gates on — so all it needs from the host is that DID.

const HOST = process.env.HOST_URL ?? "http://localhost:4000";
const CLUB_HANDLE = process.env.CLUB_HANDLE ?? "rain-shadow-riders.opensocial.test";

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
    : `[seed] no ${CLUB_HANDLE} on ${HOST} — every gallery falls back to public`,
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

/** The club's pool, by the convention every app here uses: one space, skey `self`. */
const POOL = club ? `at://${club}/space/social.grain.group/self` : null;

/**
 * The same gallery, written into the club's pool instead of the public repo.
 *
 * Records in a space have no uri of their own — the address is the space, the
 * repo, the collection and the rkey — so an item names its gallery and its
 * photo by the uri each would have had in this rider's public repo. Every
 * reader, here and in apps/community, puts them back together that way.
 *
 * No EXIF record: the space declares the three collections a gallery is made
 * of, and a camera's serial number is not one of the things the club asked to
 * keep for its members.
 */
async function poolGallery(
  who: Rider,
  rkey: string,
  title: string,
  description: string,
  photos: { file: string; alt: string; ratio: [number, number] }[],
  minutesAgo: number,
) {
  if (!POOL) return gallery(who, rkey, title, description, photos, minutesAgo);
  const createdAt = ago(minutesAgo);
  const self = (collection: string, key: string) => `at://${who.did}/${collection}/${key}`;
  const writes: Record<string, unknown>[] = [
    {
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.gallery",
      rkey,
      value: { $type: "social.grain.gallery", title, description, createdAt },
    },
  ];
  for (const [i, p] of photos.entries()) {
    const blob = await uploadBlob(who, `./seeds/images/${p.file}`);
    const photoRkey = `${rkey}-p${i}`;
    writes.push({
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.photo",
      rkey: photoRkey,
      value: {
        $type: "social.grain.photo",
        photo: blob,
        alt: p.alt,
        aspectRatio: { width: p.ratio[0], height: p.ratio[1] },
        createdAt,
      },
    });
    writes.push({
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.gallery.item",
      rkey: photoRkey,
      value: {
        $type: "social.grain.gallery.item",
        gallery: self("social.grain.gallery", rkey),
        item: self("social.grain.photo", photoRkey),
        position: i,
        createdAt,
      },
    });
  }
  await applyWrites(who, POOL, writes);
  console.log(`[seed] ${who.handle}: ${title} (${photos.length} photos) → the club's pool`);
  return { uri: self("social.grain.gallery", rkey) };
}

/**
 * A favourite and a comment on somebody else's pool gallery.
 *
 * Both are the reader's own records, and both go into the pool rather than
 * their public repo — in the public repo they would name a private gallery to
 * the whole network, which is what the pool exists to prevent. It also means a
 * thread is spread across the repos of everyone in it: your reply to my gallery
 * was never mine to hold.
 */
async function poolFavorite(who: Rider, g: { uri: string }, rkey: string, minutesAgo: number) {
  if (!POOL) return;
  await applyWrites(who, POOL, [
    {
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.favorite",
      rkey,
      value: {
        $type: "social.grain.favorite",
        subject: g.uri,
        createdAt: ago(minutesAgo),
      },
    },
  ]);
}

async function poolComment(
  who: Rider,
  g: { uri: string },
  rkey: string,
  text: string,
  minutesAgo: number,
) {
  if (!POOL) return;
  await applyWrites(who, POOL, [
    {
      $type: "com.atproto.space.applyWrites#create",
      collection: "social.grain.comment",
      rkey,
      value: {
        $type: "social.grain.comment",
        subject: g.uri,
        text,
        createdAt: ago(minutesAgo),
      },
    },
  ]);
  console.log(`[seed] ${who.handle} commented on ${g.uri.split("/").pop()}`);
}

// Everyone on the club's roster gets a face, not just the riders whose photos
// are in the pool: the club's own site reads member avatars from this same
// `social.grain.actor.profile` record, so an organiser without one is a grey
// circle in both apps.
const alex = await rider(
  "alex-kim.test",
  "Alex Kim",
  "Founded Rain Shadow Riders in 2019. Still sweeps the Saturday loop.",
  "avatar-alex.jpg",
);
const dana = await rider(
  "dana-whitfield.test",
  "Dana Whitfield",
  "Moderates the club. Fixes your derailleur at the roadside, unasked.",
  "avatar-dana.jpg",
);

const sam = await rider(
  "sam-ortiz.test",
  "Sam Ortiz",
  "Newest on the Tuesday spin. Asks the tyre questions everyone else is thinking.",
  "avatar-sam.jpg",
);

const priya = await rider(
  "priya-nair.test",
  "Priya Nair",
  "Organizer and moderator at Rain Shadow Riders. Tours when the club is off.",
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

const century = await poolGallery(
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

const tunnel = await poolGallery(
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

await poolGallery(
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

const ferry = await poolGallery(
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

await poolGallery(
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

await poolGallery(
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

// The one that did not go to the club: an ordinary public gallery in Lena's
// own repo, on the same afternoon, from the same app. Anyone can see this one,
// including people who have never heard of Rain Shadow Riders — which is what
// the six above are not.
await gallery(
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

// What members say to each other inside the pool. Every one of these is the
// speaker's own record, written into the club's space: members see them, the
// network never does, and there is no public count of any of it anywhere.
await poolFavorite(jo, century, "fav-century", 21 * DAY);
await poolFavorite(tom, century, "fav-century", 20 * DAY);
await poolFavorite(lena, century, "fav-century", 19 * DAY);
await poolComment(
  jo,
  century,
  "comment-century",
  "The alder tunnel shot. That is exactly what it looked like from the back.",
  20 * DAY,
);
await poolComment(
  marcus,
  century,
  "comment-century",
  "Sweep is the best seat on the century and nobody believes me.",
  19 * DAY,
);
await poolFavorite(priya, tunnel, "fav-tunnel", 49 * DAY);
await poolComment(
  priya,
  tunnel,
  "comment-tunnel",
  "Lights checked at the start because of this ride, for the record.",
  49 * DAY,
);
await poolFavorite(jo, ferry, "fav-ferry", 78 * DAY);
await poolFavorite(alex, ferry, "fav-ferry", 77 * DAY);
await poolFavorite(sam, tunnel, "fav-tunnel", 47 * DAY);
await poolComment(
  dana,
  tunnel,
  "comment-tunnel",
  "Every light checked, nobody in the dark. Good ride.",
  48 * DAY,
);
await poolComment(
  lena,
  ferry,
  "comment-ferry",
  "Fixed it in nine minutes flat and still made the 10:40.",
  78 * DAY,
);

console.log("[seed] done");
