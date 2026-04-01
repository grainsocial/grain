import { seed } from "$hatk";

const { createAccount, createRecord, uploadBlob } = seed();

const alice = await createAccount("alice.test");
const bob = await createAccount("bob.test");
const carol = await createAccount("carol.test");
const dave = await createAccount("dave.test");

const now = Date.now();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

// Profiles with avatars
const aliceAvatar = await uploadBlob(alice, "./seeds/images/alice.png");
await createRecord(
  alice,
  "social.grain.actor.profile",
  {
    displayName: "Alice",
    description: "Street photography and cityscapes. Inspired by @bob.test",
    avatar: aliceAvatar,
    createdAt: ago(120),
  },
  { rkey: "self" },
);

await createRecord(
  bob,
  "social.grain.actor.profile",
  {
    displayName: "Bob",
    description: "Nature and wildlife photographer. Portfolio at https://bob.example.com",
    createdAt: ago(120),
  },
  { rkey: "self" },
);

await createRecord(
  carol,
  "social.grain.actor.profile",
  {
    displayName: "Carol",
    description: "Film photography enthusiast. Shooting with @alice.test and @bob.test",
    createdAt: ago(120),
  },
  { rkey: "self" },
);

// Dave has a bsky profile but no grain profile (tests on-login hook)
await createRecord(
  dave,
  "app.bsky.actor.profile",
  {
    displayName: "Dave",
    description: "Just here to test the on-login hook",
    createdAt: ago(120),
  },
  { rkey: "self" },
);

// Alice follows Bob and Carol
await createRecord(
  alice,
  "social.grain.graph.follow",
  { subject: bob.did, createdAt: ago(100) },
  { rkey: "follow-bob" },
);
await createRecord(
  alice,
  "social.grain.graph.follow",
  { subject: carol.did, createdAt: ago(100) },
  { rkey: "follow-carol" },
);

// Bob follows Alice back
await createRecord(
  bob,
  "social.grain.graph.follow",
  { subject: alice.did, createdAt: ago(95) },
  { rkey: "follow-alice" },
);

// Carol follows Alice and Bob
await createRecord(
  carol,
  "social.grain.graph.follow",
  { subject: alice.did, createdAt: ago(90) },
  { rkey: "follow-alice" },
);
await createRecord(
  carol,
  "social.grain.graph.follow",
  { subject: bob.did, createdAt: ago(90) },
  { rkey: "follow-bob" },
);

// ── Bsky follows (for suggested follows feature) ──

// Alice bsky-follows Bob, Carol, and Dave
await createRecord(
  alice,
  "app.bsky.graph.follow",
  { subject: bob.did, createdAt: ago(100) },
  { rkey: "bsky-follow-bob" },
);
await createRecord(
  alice,
  "app.bsky.graph.follow",
  { subject: carol.did, createdAt: ago(100) },
  { rkey: "bsky-follow-carol" },
);
await createRecord(
  alice,
  "app.bsky.graph.follow",
  { subject: dave.did, createdAt: ago(100) },
  { rkey: "bsky-follow-dave" },
);

// Bob bsky-follows Alice and Carol (but only grain-follows Alice — Carol will be suggested)
await createRecord(
  bob,
  "app.bsky.graph.follow",
  { subject: alice.did, createdAt: ago(95) },
  { rkey: "bsky-follow-alice" },
);
await createRecord(
  bob,
  "app.bsky.graph.follow",
  { subject: carol.did, createdAt: ago(95) },
  { rkey: "bsky-follow-carol" },
);

// Carol bsky-follows Alice, Bob, and Dave
await createRecord(
  carol,
  "app.bsky.graph.follow",
  { subject: alice.did, createdAt: ago(90) },
  { rkey: "bsky-follow-alice" },
);
await createRecord(
  carol,
  "app.bsky.graph.follow",
  { subject: bob.did, createdAt: ago(90) },
  { rkey: "bsky-follow-bob" },
);
await createRecord(
  carol,
  "app.bsky.graph.follow",
  { subject: dave.did, createdAt: ago(90) },
  { rkey: "bsky-follow-dave" },
);

// Upload photos
const cityNight = await uploadBlob(alice, "./seeds/images/city-night.jpg");
const skyline = await uploadBlob(alice, "./seeds/images/skyline.jpg");
const skylinePortrait = await uploadBlob(alice, "./seeds/images/skyline-portrait.jpg");
const forest = await uploadBlob(bob, "./seeds/images/forest.jpg");
const wildlife = await uploadBlob(bob, "./seeds/images/wildlife.jpg");
const filmCafe = await uploadBlob(carol, "./seeds/images/film-cafe.jpg");
const filmPortrait = await uploadBlob(carol, "./seeds/images/film-portrait.jpg");

// ── Alice's gallery: "City Lights" (2 photos) ──

const aliceGallery = await createRecord(
  alice,
  "social.grain.gallery",
  {
    title: "City Lights",
    description: "Evening shots around downtown Tokyo during golden hour. These were all taken within about 30 minutes as the sun was setting behind the skyscrapers. The neon lights were just starting to flicker on and the contrast between natural and artificial light was incredible. Shot on Fujifilm X-T5 with the 23mm f/1.4. #streetphotography #city #tokyo #goldenhour",
    location: { name: "Shibuya Crossing", value: "8a2f5a363ba7fff" },
    address: { name: "Shibuya Crossing", locality: "Shibuya", region: "Tokyo", country: "JP" },
    createdAt: ago(50),
  },
  { rkey: "city-lights" },
);

const alicePhoto1 = await createRecord(
  alice,
  "social.grain.photo",
  {
    photo: cityNight,
    alt: "Neon signs reflecting on wet pavement",
    aspectRatio: { width: 4, height: 3 },
    createdAt: ago(50),
  },
  { rkey: "photo-neon" },
);

const alicePhoto2 = await createRecord(
  alice,
  "social.grain.photo",
  {
    photo: skyline,
    alt: "Skyline at dusk from the bridge",
    aspectRatio: { width: 4, height: 3 },
    createdAt: ago(49),
  },
  { rkey: "photo-skyline" },
);

await createRecord(
  alice,
  "social.grain.gallery.item",
  { gallery: aliceGallery.uri, item: alicePhoto1.uri, position: 0, createdAt: ago(50) },
  { rkey: "gi-neon" },
);
await createRecord(
  alice,
  "social.grain.gallery.item",
  { gallery: aliceGallery.uri, item: alicePhoto2.uri, position: 1, createdAt: ago(49) },
  { rkey: "gi-skyline" },
);

const alicePhoto3 = await createRecord(
  alice,
  "social.grain.photo",
  {
    photo: skylinePortrait,
    alt: "Vertical view of the skyline through an alley",
    aspectRatio: { width: 3, height: 4 },
    createdAt: ago(48),
  },
  { rkey: "photo-skyline-portrait" },
);

await createRecord(
  alice,
  "social.grain.gallery.item",
  { gallery: aliceGallery.uri, item: alicePhoto3.uri, position: 2, createdAt: ago(48) },
  { rkey: "gi-skyline-portrait" },
);

// ── Bob's gallery: "Forest Trail" (2 photos) ──

const bobGallery = await createRecord(
  bob,
  "social.grain.gallery",
  {
    title: "Forest Trail",
    description: "Morning hike through old growth #nature #wildlife",
    location: { name: "Forest Park", value: "8a28f002358ffff" },
    address: { name: "Forest Park", locality: "Portland", region: "Oregon", country: "US" },
    createdAt: ago(30),
  },
  { rkey: "forest-trail" },
);

const bobPhoto1 = await createRecord(
  bob,
  "social.grain.photo",
  {
    photo: forest,
    alt: "Sunlight filtering through tall trees",
    aspectRatio: { width: 4, height: 3 },
    createdAt: ago(30),
  },
  { rkey: "photo-forest" },
);

const bobPhoto2 = await createRecord(
  bob,
  "social.grain.photo",
  {
    photo: wildlife,
    alt: "Deer at the edge of the clearing",
    aspectRatio: { width: 4, height: 3 },
    createdAt: ago(29),
  },
  { rkey: "photo-wildlife" },
);

await createRecord(
  bob,
  "social.grain.gallery.item",
  { gallery: bobGallery.uri, item: bobPhoto1.uri, position: 0, createdAt: ago(30) },
  { rkey: "gi-forest" },
);
await createRecord(
  bob,
  "social.grain.gallery.item",
  { gallery: bobGallery.uri, item: bobPhoto2.uri, position: 1, createdAt: ago(29) },
  { rkey: "gi-wildlife" },
);

// ── Carol's gallery: "Kodak Moments" (2 photos) ──

const carolGallery = await createRecord(
  carol,
  "social.grain.gallery",
  {
    title: "Kodak Moments",
    description: "Shot on Portra 400 #film #streetphotography",
    location: { name: "Café de Flore", value: "8a1fb4662557fff" },
    address: {
      name: "Café de Flore",
      street: "172 Boulevard Saint-Germain",
      locality: "Paris",
      country: "FR",
    },
    createdAt: ago(10),
  },
  { rkey: "kodak-moments" },
);

const carolPhoto1 = await createRecord(
  carol,
  "social.grain.photo",
  {
    photo: filmCafe,
    alt: "Corner cafe on a rainy afternoon",
    aspectRatio: { width: 3, height: 4 },
    createdAt: ago(10),
  },
  { rkey: "photo-cafe" },
);

const carolPhoto2 = await createRecord(
  carol,
  "social.grain.photo",
  {
    photo: filmPortrait,
    alt: "Portrait in natural light",
    aspectRatio: { width: 3, height: 4 },
    createdAt: ago(9),
  },
  { rkey: "photo-portrait" },
);

await createRecord(
  carol,
  "social.grain.gallery.item",
  { gallery: carolGallery.uri, item: carolPhoto1.uri, position: 0, createdAt: ago(10) },
  { rkey: "gi-cafe" },
);
await createRecord(
  carol,
  "social.grain.gallery.item",
  { gallery: carolGallery.uri, item: carolPhoto2.uri, position: 1, createdAt: ago(9) },
  { rkey: "gi-portrait" },
);

// ── EXIF data ──

// Alice's neon photo — Sony A7III + 35mm
await createRecord(
  alice,
  "social.grain.photo.exif",
  {
    photo: alicePhoto1.uri,
    make: "Sony",
    model: "ILCE-7M3",
    lensMake: "Sony",
    lensModel: "FE 35mm F1.4 GM",
    exposureTime: 8000, // 1/125s → 0.008 * 1_000_000
    fNumber: 2_000_000, // f/2.0
    iSO: 800_000_000, // ISO 800
    focalLengthIn35mmFormat: 35_000_000, // 35mm
    flash: "Off, Did not fire",
    dateTimeOriginal: ago(50),
    createdAt: ago(50),
  },
  { rkey: "exif-neon" },
);

// Alice's skyline photo — Sony A7III + 24-70mm
await createRecord(
  alice,
  "social.grain.photo.exif",
  {
    photo: alicePhoto2.uri,
    make: "Sony",
    model: "ILCE-7M3",
    lensMake: "Sony",
    lensModel: "FE 24-70mm F2.8 GM",
    exposureTime: 4000, // 1/250s → 0.004 * 1_000_000
    fNumber: 8_000_000, // f/8.0
    iSO: 100_000_000, // ISO 100
    focalLengthIn35mmFormat: 50_000_000, // 50mm
    flash: "Off, Did not fire",
    dateTimeOriginal: ago(49),
    createdAt: ago(49),
  },
  { rkey: "exif-skyline" },
);

// Bob's forest photo — Canon R5 + 70-200mm
await createRecord(
  bob,
  "social.grain.photo.exif",
  {
    photo: bobPhoto1.uri,
    make: "Canon",
    model: "EOS R5",
    lensMake: "Canon",
    lensModel: "RF 70-200mm F2.8L IS USM",
    exposureTime: 2000, // 1/500s → 0.002 * 1_000_000
    fNumber: 4_000_000, // f/4.0
    iSO: 400_000_000, // ISO 400
    focalLengthIn35mmFormat: 135_000_000, // 135mm
    flash: "Off, Did not fire",
    dateTimeOriginal: ago(30),
    createdAt: ago(30),
  },
  { rkey: "exif-forest" },
);

// Bob's wildlife photo — Canon R5 + 100-400mm
await createRecord(
  bob,
  "social.grain.photo.exif",
  {
    photo: bobPhoto2.uri,
    make: "Canon",
    model: "EOS R5",
    lensMake: "Canon",
    lensModel: "RF 100-400mm F5.6-8 IS USM",
    exposureTime: 1000, // 1/1000s → 0.001 * 1_000_000
    fNumber: 5_600_000, // f/5.6
    iSO: 1600_000_000, // ISO 1600
    focalLengthIn35mmFormat: 400_000_000, // 400mm
    flash: "Off, Did not fire",
    dateTimeOriginal: ago(29),
    createdAt: ago(29),
  },
  { rkey: "exif-wildlife" },
);

// Carol's cafe photo — no EXIF (film camera, scanned)

// Carol's portrait photo — Nikon FM2 (manual entry)
await createRecord(
  carol,
  "social.grain.photo.exif",
  {
    photo: carolPhoto2.uri,
    make: "Nikon",
    model: "FM2",
    lensModel: "Nikkor 50mm f/1.4",
    fNumber: 1_400_000, // f/1.4
    focalLengthIn35mmFormat: 50_000_000, // 50mm
    createdAt: ago(9),
  },
  { rkey: "exif-portrait" },
);

// ── Favorites ──

// Alice favorites Bob's gallery
await createRecord(
  alice,
  "social.grain.favorite",
  { subject: bobGallery.uri, createdAt: ago(25) },
  { rkey: "fav-forest" },
);

// Bob favorites Alice's gallery
await createRecord(
  bob,
  "social.grain.favorite",
  { subject: aliceGallery.uri, createdAt: ago(40) },
  { rkey: "fav-city" },
);

// Carol favorites Alice's gallery
await createRecord(
  carol,
  "social.grain.favorite",
  { subject: aliceGallery.uri, createdAt: ago(35) },
  { rkey: "fav-city-2" },
);

// Carol favorites Bob's gallery
await createRecord(
  carol,
  "social.grain.favorite",
  { subject: bobGallery.uri, createdAt: ago(20) },
  { rkey: "fav-forest-2" },
);

// ── Comments ──

// Bob comments on Alice's gallery
await createRecord(
  bob,
  "social.grain.comment",
  {
    text: "Love the neon reflections! What lens were you using?",
    subject: aliceGallery.uri,
    createdAt: ago(45),
  },
  { rkey: "comment-1" },
);

// Carol comments on Alice's gallery
await createRecord(
  carol,
  "social.grain.comment",
  {
    text: "That skyline shot is incredible",
    subject: aliceGallery.uri,
    createdAt: ago(38),
  },
  { rkey: "comment-2" },
);

// Alice comments on Bob's gallery
await createRecord(
  alice,
  "social.grain.comment",
  {
    text: "So peaceful. I need to get out of the city more often.",
    subject: bobGallery.uri,
    createdAt: ago(22),
  },
  { rkey: "comment-3" },
);

// Alice comments on Carol's gallery
await createRecord(
  alice,
  "social.grain.comment",
  {
    text: "Portra colors are unmatched. These are gorgeous!",
    subject: carolGallery.uri,
    createdAt: ago(8),
  },
  { rkey: "comment-4" },
);

// Bob comments on Carol's gallery
await createRecord(
  bob,
  "social.grain.comment",
  {
    text: "Film is alive and well",
    subject: carolGallery.uri,
    createdAt: ago(5),
  },
  { rkey: "comment-5" },
);

// ── Stories ──

await createRecord(
  alice,
  "social.grain.story",
  {
    media: cityNight,
    aspectRatio: { width: 4, height: 3 },
    location: { name: "Shibuya Crossing", value: "8a2f5a363ba7fff" },
    address: { name: "Shibuya Crossing", locality: "Shibuya", region: "Tokyo", country: "JP" },
    createdAt: new Date().toISOString(),
  },
  { rkey: "story-alice-1" },
);

await createRecord(
  bob,
  "social.grain.story",
  {
    media: forest,
    aspectRatio: { width: 4, height: 3 },
    createdAt: new Date().toISOString(),
  },
  { rkey: "story-bob-1" },
);

console.log("\n[seed] Done!");
