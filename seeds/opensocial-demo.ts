// Demo data for the groups branch against the opensocial dev stack: the
// accounts already exist there (packages/cli seed-demo, password demo-pass),
// so this only gives two of them Grain profiles and a few galleries to submit.
//
//   PDS_URL=http://localhost:2683 npx tsx seeds/opensocial-demo.ts
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
console.log("[seed] done");
