import { BlobRef, Lexicons } from "@atproto/lexicon";
import { assertEquals, assertExists } from "@std/assert";
import type {
  ActorTable,
  BffConfig,
  Database,
  LabelTable,
  RecordTable,
} from "../types.d.ts";
import { createDb } from "../utils/database.ts";
import { Root } from "../utils/response.tsx";
import { IndexService } from "./indexing.ts";

function createTestDatabase(): Database {
  const cfg = createTestConfig();
  return createDb(cfg);
}

function createTestConfig(): BffConfig {
  return {
    // Required BffOptions fields
    appName: "test-app",

    // Required EnvConfig fields
    port: 3000,
    publicUrl: "http://localhost:3000",
    rootDir: "/tmp",
    litefsDir: "/tmp",
    cookieSecret: "test-secret",

    // Required BffConfig fields
    lexicons: new Lexicons(),
    databaseUrl: ":memory:",
    oauthScope: "atproto transition:generic",
    rootElement: Root,
    buildDir: "static",

    // Test-specific config
    collectionKeyMap: {
      "app.bsky.feed.post": ["text", "author"],
      "app.bsky.actor.profile": ["displayName", "handle"],
    },
  };
}

Deno.test("IndexService - insertRecord and getRecord", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const testRecord: RecordTable = {
    uri: "at://did:plc:test/app.bsky.feed.post/test123",
    cid: "bafytest123",
    did: "did:plc:test",
    collection: "app.bsky.feed.post",
    json: JSON.stringify({ text: "Hello world", author: "alice" }),
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertRecord(testRecord);

  const retrieved = service.getRecord(testRecord.uri);
  assertExists(retrieved);
  assertEquals(retrieved.uri, testRecord.uri);
  assertEquals(retrieved.cid, testRecord.cid);
  assertEquals(retrieved.did, testRecord.did);
  assertEquals(retrieved.text, "Hello world");
  assertEquals(retrieved.author, "alice");
});

Deno.test("IndexService - getRecords basic functionality", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  // Insert test records
  const records: RecordTable[] = [
    {
      uri: "at://did:plc:alice/app.bsky.feed.post/1",
      cid: "bafyalice1",
      did: "did:plc:alice",
      collection: "app.bsky.feed.post",
      json: JSON.stringify({ text: "First post", author: "alice" }),
      indexedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      uri: "at://did:plc:bob/app.bsky.feed.post/2",
      cid: "bafybob2",
      did: "did:plc:bob",
      collection: "app.bsky.feed.post",
      json: JSON.stringify({ text: "Second post", author: "bob" }),
      indexedAt: "2024-01-01T01:00:00.000Z",
    },
    {
      uri: "at://did:plc:alice/app.bsky.actor.profile/self",
      cid: "bafyaliceprofile",
      did: "did:plc:alice",
      collection: "app.bsky.actor.profile",
      json: JSON.stringify({
        displayName: "Alice",
        handle: "alice.bsky.social",
      }),
      indexedAt: "2024-01-01T02:00:00.000Z",
    },
  ];

  records.forEach((record) => service.insertRecord(record));

  // Test getting all posts
  const posts = service.getRecords("app.bsky.feed.post");
  assertEquals(posts.items.length, 2);
  assertEquals(posts.items[0].text, "First post");
  assertEquals(posts.items[1].text, "Second post");

  // Test getting profiles
  const profiles = service.getRecords("app.bsky.actor.profile");
  assertEquals(profiles.items.length, 1);
  assertEquals(profiles.items[0].displayName, "Alice");
});

Deno.test("IndexService - getRecords with where conditions", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  // Insert test records
  const records: RecordTable[] = [
    {
      uri: "at://did:plc:alice/app.bsky.feed.post/1",
      cid: "bafyalice1",
      did: "did:plc:alice",
      collection: "app.bsky.feed.post",
      json: JSON.stringify({ text: "Alice's post", author: "alice" }),
      indexedAt: "2024-01-01T00:00:00.000Z",
    },
    {
      uri: "at://did:plc:bob/app.bsky.feed.post/2",
      cid: "bafybob2",
      did: "did:plc:bob",
      collection: "app.bsky.feed.post",
      json: JSON.stringify({ text: "Bob's post", author: "bob" }),
      indexedAt: "2024-01-01T01:00:00.000Z",
    },
  ];

  records.forEach((record) => service.insertRecord(record));

  // Test filtering by DID
  const alicePosts = service.getRecords("app.bsky.feed.post", {
    where: { field: "did", equals: "did:plc:alice" },
  });
  assertEquals(alicePosts.items.length, 1);
  assertEquals(alicePosts.items[0].text, "Alice's post");

  // Test filtering by indexed key (author)
  const bobPosts = service.getRecords("app.bsky.feed.post", {
    where: { field: "author", equals: "bob" },
  });
  assertEquals(bobPosts.items.length, 1);
  assertEquals(bobPosts.items[0].text, "Bob's post");
});

Deno.test("IndexService - getRecords with pagination", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  // Insert test records with different timestamps
  const records: RecordTable[] = [];
  for (let i = 0; i < 5; i++) {
    records.push({
      uri: `at://did:plc:test/app.bsky.feed.post/${i}`,
      cid: `bafy${i}`,
      did: "did:plc:test",
      collection: "app.bsky.feed.post",
      json: JSON.stringify({ text: `Post ${i}`, author: "test" }),
      indexedAt: new Date(2024, 0, 1, i).toISOString(),
    });
  }

  records.forEach((record) => service.insertRecord(record));

  // Test with limit
  const firstPage = service.getRecords("app.bsky.feed.post", { limit: 2 });
  assertEquals(firstPage.items.length, 2);
  assertExists(firstPage.cursor);

  // Test with cursor
  const secondPage = service.getRecords("app.bsky.feed.post", {
    limit: 2,
    cursor: firstPage.cursor,
  });
  assertEquals(secondPage.items.length, 2);

  // Ensure different results
  assertEquals(firstPage.items[0].uri !== secondPage.items[0].uri, true);
});

Deno.test("IndexService - updateRecord", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const originalRecord: RecordTable = {
    uri: "at://did:plc:test/app.bsky.feed.post/test123",
    cid: "bafyoriginal",
    did: "did:plc:test",
    collection: "app.bsky.feed.post",
    json: JSON.stringify({ text: "Original text", author: "alice" }),
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertRecord(originalRecord);

  const updatedRecord: RecordTable = {
    ...originalRecord,
    cid: "bafyupdated",
    json: JSON.stringify({ text: "Updated text", author: "alice" }),
    indexedAt: "2024-01-01T01:00:00.000Z",
  };

  service.updateRecord(updatedRecord);

  const retrieved = service.getRecord(originalRecord.uri);
  assertExists(retrieved);
  assertEquals(retrieved.cid, "bafyupdated");
  assertEquals(retrieved.text, "Updated text");
});

Deno.test("IndexService - deleteRecord", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const testRecord: RecordTable = {
    uri: "at://did:plc:test/app.bsky.feed.post/test123",
    cid: "bafytest123",
    did: "did:plc:test",
    collection: "app.bsky.feed.post",
    json: JSON.stringify({ text: "To be deleted", author: "test" }),
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertRecord(testRecord);

  // Verify record exists
  let retrieved = service.getRecord(testRecord.uri);
  assertExists(retrieved);

  service.deleteRecord(testRecord.uri);

  // Verify record is deleted
  retrieved = service.getRecord(testRecord.uri);
  assertEquals(retrieved, undefined);
});

Deno.test("IndexService - actor operations", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const testActor: ActorTable = {
    did: "did:plc:alice",
    handle: "alice.bsky.social",
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertActor(testActor);

  // Test getActor by DID
  const actorByDid = service.getActor(testActor.did);
  assertExists(actorByDid);
  assertEquals(actorByDid.did, testActor.did);
  assertEquals(actorByDid.handle, testActor.handle);

  // Test getActorByHandle
  const actorByHandle = service.getActorByHandle(testActor.handle);
  assertExists(actorByHandle);
  assertEquals(actorByHandle.did, testActor.did);
  assertEquals(actorByHandle.handle, testActor.handle);

  // Test searchActors
  const searchResults = service.searchActors("alice");
  assertEquals(searchResults.length, 1);
  assertEquals(searchResults[0].did, testActor.did);
});

Deno.test("IndexService - updateActor", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const testActor: ActorTable = {
    did: "did:plc:alice",
    handle: "alice.bsky.social",
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertActor(testActor);
  service.updateActor(testActor.did, "2024-01-01T12:00:00.000Z");

  const updated = service.getActor(testActor.did);
  assertExists(updated);
  assertEquals(updated.lastSeenNotifs, "2024-01-01T12:00:00.000Z");
});

Deno.test("IndexService - label operations", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const testLabel: LabelTable = {
    src: "did:plc:moderator",
    uri: "at://did:plc:test/app.bsky.feed.post/123",
    cid: "bafytest",
    val: "spam",
    neg: false,
    cts: "2024-01-01T00:00:00.000Z",
  };

  service.insertLabel(testLabel);

  const labels = service.queryLabels({
    subjects: [testLabel.uri],
    issuers: [testLabel.src],
  });

  assertEquals(labels.length, 1);
  assertEquals(labels[0].val, "spam");
  assertEquals(labels[0].src, testLabel.src);
  assertEquals(labels[0].uri, testLabel.uri);
});

Deno.test("IndexService - countRecords", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  // Insert test records
  const records: RecordTable[] = [];
  for (let i = 0; i < 3; i++) {
    records.push({
      uri: `at://did:plc:test/app.bsky.feed.post/${i}`,
      cid: `bafy${i}`,
      did: "did:plc:test",
      collection: "app.bsky.feed.post",
      json: JSON.stringify({ text: `Post ${i}`, author: "test" }),
      indexedAt: new Date(2024, 0, 1, i).toISOString(),
    });
  }

  records.forEach((record) => service.insertRecord(record));

  const count = service.countRecords("app.bsky.feed.post");
  assertEquals(count, 3);

  const countWithFilter = service.countRecords("app.bsky.feed.post", {
    where: { field: "did", equals: "did:plc:test" },
  });
  assertEquals(countWithFilter, 3);

  const countWithNoMatch = service.countRecords("app.bsky.feed.post", {
    where: { field: "did", equals: "did:plc:nonexistent" },
  });
  assertEquals(countWithNoMatch, 0);
});

Deno.test("IndexService - facet indexing", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const recordWithFacets: RecordTable = {
    uri: "at://did:plc:test/app.bsky.feed.post/facets",
    cid: "bafyfacets",
    did: "did:plc:test",
    collection: "app.bsky.feed.post",
    json: JSON.stringify({
      text: "Hello @alice #hashtag",
      facets: [
        {
          index: { byteStart: 6, byteEnd: 12 },
          features: [{
            $type: "app.bsky.richtext.facet#mention",
            did: "did:plc:alice",
          }],
        },
        {
          index: { byteStart: 13, byteEnd: 21 },
          features: [{ $type: "app.bsky.richtext.facet#tag", tag: "hashtag" }],
        },
      ],
    }),
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertRecord(recordWithFacets);

  // Test querying by facet
  const mentionResults = service.getRecords("app.bsky.feed.post", {
    facet: { type: "mention", value: "did:plc:alice" },
  });
  assertEquals(mentionResults.items.length, 1);
  assertEquals(mentionResults.items[0].uri, recordWithFacets.uri);

  const tagResults = service.getRecords("app.bsky.feed.post", {
    facet: { type: "tag", value: "hashtag" },
  });
  assertEquals(tagResults.items.length, 1);
  assertEquals(tagResults.items[0].uri, recordWithFacets.uri);
});

Deno.test("IndexService - getMentioningUris", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  const mentioningRecord: RecordTable = {
    uri: "at://did:plc:bob/app.bsky.feed.post/mention",
    cid: "bafymention",
    did: "did:plc:bob",
    collection: "app.bsky.feed.post",
    json: JSON.stringify({
      text: "Hello did:plc:alice",
      createdAt: "2024-01-01T00:00:00.000Z",
    }),
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertRecord(mentioningRecord);

  const mentioningUris = service.getMentioningUris("did:plc:alice");
  assertEquals(mentioningUris.length, 1);
  assertEquals(mentioningUris[0], mentioningRecord.uri);
});

Deno.test("IndexService - blob hydration", () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const service = new IndexService(db, cfg);

  // Create a record with blob references
  const recordWithBlobs: RecordTable = {
    uri: "at://did:plc:test/app.bsky.feed.post/blobs",
    cid: "bafyblobs",
    did: "did:plc:test",
    collection: "app.bsky.feed.post",
    json: JSON.stringify({
      text: "Post with images",
      embed: {
        $type: "app.bsky.embed.images",
        images: [
          {
            alt: "Test image",
            image: {
              $type: "blob",
              ref: {
                $link:
                  "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy",
              },
              mimeType: "image/jpeg",
              size: 123456,
            },
          },
        ],
      },
    }),
    indexedAt: "2024-01-01T00:00:00.000Z",
  };

  service.insertRecord(recordWithBlobs);

  // Retrieve the record and verify blob hydration
  const retrieved = service.getRecord(recordWithBlobs.uri);
  assertExists(retrieved);

  // The blob should be hydrated to a BlobRef instance
  const embed = (retrieved as any).embed;
  assertExists(embed);
  assertEquals(embed.$type, "app.bsky.embed.images");
  assertExists(embed.images);
  assertEquals(embed.images.length, 1);

  const image = embed.images[0];
  assertExists(image.image);

  // Check that the blob was hydrated to a BlobRef instance
  assertEquals(image.image instanceof BlobRef, true);
  assertEquals(image.image.mimeType, "image/jpeg");
  assertEquals(image.image.size, 123456);

  // Also test blob hydration through getRecords
  const records = service.getRecords("app.bsky.feed.post", {
    where: { field: "uri", equals: recordWithBlobs.uri },
  });
  assertEquals(records.items.length, 1);

  const recordFromList = records.items[0];
  const embedFromList = (recordFromList as any).embed;
  assertExists(embedFromList);
  const imageFromList = embedFromList.images[0];

  // Verify blob hydration in getRecords result
  assertEquals(imageFromList.image instanceof BlobRef, true);
  assertEquals(imageFromList.image.mimeType, "image/jpeg");
  assertEquals(imageFromList.image.size, 123456);
});
