import type { DidResolver } from "@atproto/identity";
import type { Lexicons } from "@atproto/lexicon";
import { assertEquals, assertExists } from "@std/assert";
import { IndexService } from "../services/indexing.ts";
import type {
  ActorTable,
  BffConfig,
  BffContext,
  Database,
} from "../types.d.ts";
import { signCookie } from "../utils/cookies.ts";
import { createDb } from "../utils/database.ts";
import { Root } from "../utils/response.tsx";
import { composeMiddlewares } from "./compose.ts";

function createTestConfig(): BffConfig {
  return {
    // Required BffOptions fields
    appName: "test-app",

    // Required EnvConfig fields
    port: 3000,
    publicUrl: "http://localhost:3000",
    rootDir: "/tmp",
    litefsDir: "/tmp",
    cookieSecret: "test-secret-key-for-cookies",

    // Required BffConfig fields
    lexicons: {} as Lexicons,
    databaseUrl: ":memory:",
    oauthScope: "atproto transition:generic",
    rootElement: Root,
    buildDir: "static",

    collectionKeyMap: {},
  };
}

function createTestDatabase(): Database {
  const cfg = createTestConfig();
  return createDb(cfg);
}

function createMockDidResolver(): DidResolver {
  return {
    resolve: (did: string) =>
      Promise.resolve({
        id: did,
        service: [],
        verificationMethod: [],
      }),
  } as unknown as DidResolver;
}

Deno.test("composeMiddlewares - cookie authentication", async () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const indexService = new IndexService(db, cfg);
  const didResolver = createMockDidResolver();

  // Insert a test actor
  const testActor: ActorTable = {
    did: "did:plc:test123",
    handle: "test.bsky.social",
    indexedAt: "2024-01-01T00:00:00.000Z",
  };
  indexService.insertActor(testActor);

  const middleware = composeMiddlewares({
    db,
    cfg,
    didResolver,
    fileFingerprints: new Map(),
    indexService,
  });

  // Create a signed cookie - need to format it as "base64Value|signature"
  const base64Did = btoa(testActor.did);
  const signature = await signCookie(base64Did, cfg.cookieSecret);
  const signedCookie = `${base64Did}|${signature}`;

  // Create request with cookie
  const request = new Request("http://localhost:3000/test", {
    headers: {
      "Cookie": `auth=${signedCookie}`,
    },
  });

  // Mock inner handler that checks context
  const innerHandler = (_req: Request, ctx: BffContext) => {
    assertExists(ctx.currentUser);
    assertEquals(ctx.currentUser.did, testActor.did);
    assertEquals(ctx.currentUser.handle, testActor.handle);
    assertExists(ctx.agent);
    return Promise.resolve(new Response("OK"));
  };

  const response = await middleware(
    request,
    {} as Deno.ServeHandlerInfo,
    innerHandler,
  );
  assertEquals(response.status, 200);
});

// Deno.test("composeMiddlewares - JWT authentication", async () => {
//   const db = createTestDatabase();
//   const cfg = createTestConfig();
//   const indexService = new IndexService(db, cfg);
//   const oauthClient = createMockOAuthClient();
//   const didResolver = createMockDidResolver();

//   // Insert a test actor
//   const testActor: ActorTable = {
//     did: "did:plc:test456",
//     handle: "testjwt.bsky.social",
//     indexedAt: "2024-01-01T00:00:00.000Z",
//   };
//   indexService.insertActor(testActor);

//   const middleware = composeMiddlewares({
//     db,
//     oauthClient,
//     oauthClientNative: oauthClient,
//     cfg,
//     didResolver,
//     fileFingerprints: new Map(),
//     indexService,
//   });

//   // Create a JWT token
//   const token = jwt.sign({ did: testActor.did }, cfg.jwtSecret!);

//   // Create request with JWT Authorization header
//   const request = new Request("http://localhost:3000/test", {
//     headers: {
//       "Authorization": `Bearer ${token}`,
//     },
//   });

//   // Mock inner handler that checks context
//   const innerHandler = (_req: Request, ctx: BffContext) => {
//     assertExists(ctx.currentUser);
//     assertEquals(ctx.currentUser.did, testActor.did);
//     assertEquals(ctx.currentUser.handle, testActor.handle);
//     assertExists(ctx.agent);
//     return Promise.resolve(new Response("OK"));
//   };

//   const response = await middleware(
//     request,
//     {} as Deno.ServeHandlerInfo,
//     innerHandler,
//   );
//   assertEquals(response.status, 200);
// });

Deno.test("composeMiddlewares - invalid cookie authentication", async () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const indexService = new IndexService(db, cfg);
  const didResolver = createMockDidResolver();

  const middleware = composeMiddlewares({
    db,
    cfg,
    didResolver,
    fileFingerprints: new Map(),
    indexService,
  });

  // Create request with invalid cookie
  const request = new Request("http://localhost:3000/test", {
    headers: {
      "Cookie": `auth=invalid-cookie-value`,
    },
  });

  // Mock inner handler that checks context
  const innerHandler = (_req: Request, ctx: BffContext) => {
    assertEquals(ctx.currentUser, undefined);
    assertEquals(ctx.agent, undefined);
    return Promise.resolve(new Response("OK"));
  };

  const response = await middleware(
    request,
    {} as Deno.ServeHandlerInfo,
    innerHandler,
  );
  assertEquals(response.status, 200);
});

Deno.test("composeMiddlewares - invalid JWT authentication", async () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const indexService = new IndexService(db, cfg);
  const didResolver = createMockDidResolver();

  const middleware = composeMiddlewares({
    db,
    cfg,
    didResolver,
    fileFingerprints: new Map(),
    indexService,
  });

  // Create request with invalid JWT
  const request = new Request("http://localhost:3000/test", {
    headers: {
      "Authorization": `Bearer invalid-jwt-token`,
    },
  });

  // Mock inner handler that checks context
  const innerHandler = (_req: Request, ctx: BffContext) => {
    assertEquals(ctx.currentUser, undefined);
    assertEquals(ctx.agent, undefined);
    return Promise.resolve(new Response("OK"));
  };

  const response = await middleware(
    request,
    {} as Deno.ServeHandlerInfo,
    innerHandler,
  );
  assertEquals(response.status, 200);
});

Deno.test("composeMiddlewares - no authentication", async () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const indexService = new IndexService(db, cfg);
  const didResolver = createMockDidResolver();

  const middleware = composeMiddlewares({
    db,
    cfg,
    didResolver,
    fileFingerprints: new Map(),
    indexService,
  });

  // Create request with no authentication
  const request = new Request("http://localhost:3000/test");

  // Mock inner handler that checks context
  const innerHandler = (_req: Request, ctx: BffContext) => {
    assertEquals(ctx.currentUser, undefined);
    assertEquals(ctx.agent, undefined);

    // Verify other context properties are set
    assertExists(ctx.indexService);
    assertExists(ctx.createRecord);
    assertExists(ctx.json);
    assertExists(ctx.html);
    assertExists(ctx.redirect);
    assertExists(ctx.cfg);
    assertExists(ctx.requireAuth);

    return Promise.resolve(new Response("OK"));
  };

  const response = await middleware(
    request,
    {} as Deno.ServeHandlerInfo,
    innerHandler,
  );
  assertEquals(response.status, 200);
});

// Deno.test("composeMiddlewares - JWT takes precedence when cookie fails", async () => {
//   const db = createTestDatabase();
//   const cfg = createTestConfig();
//   const indexService = new IndexService(db, cfg);
//   const oauthClient = createMockOAuthClient();
//   const didResolver = createMockDidResolver();

//   // Insert a test actor
//   const testActor: ActorTable = {
//     did: "did:plc:test789",
//     handle: "fallback.bsky.social",
//     indexedAt: "2024-01-01T00:00:00.000Z",
//   };
//   indexService.insertActor(testActor);

//   const middleware = composeMiddlewares({
//     db,
//     oauthClient,
//     oauthClientNative: oauthClient,
//     cfg,
//     didResolver,
//     fileFingerprints: new Map(),
//     indexService,
//   });

//   // Create a valid JWT token
//   const token = jwt.sign({ did: testActor.did }, cfg.jwtSecret!);

//   // Create request with both invalid cookie and valid JWT
//   const request = new Request("http://localhost:3000/test", {
//     headers: {
//       "Cookie": `auth=invalid-cookie`,
//       "Authorization": `Bearer ${token}`,
//     },
//   });

//   // Mock inner handler that checks context
//   const innerHandler = (_req: Request, ctx: BffContext) => {
//     assertExists(ctx.currentUser);
//     assertEquals(ctx.currentUser.did, testActor.did);
//     assertEquals(ctx.currentUser.handle, testActor.handle);
//     assertExists(ctx.agent);
//     return Promise.resolve(new Response("OK"));
//   };

//   const response = await middleware(
//     request,
//     {} as Deno.ServeHandlerInfo,
//     innerHandler,
//   );
//   assertEquals(response.status, 200);
// });

Deno.test("composeMiddlewares - context methods and properties", async () => {
  const db = createTestDatabase();
  const cfg = createTestConfig();
  const indexService = new IndexService(db, cfg);
  const didResolver = createMockDidResolver();

  const middleware = composeMiddlewares({
    db,
    cfg,
    didResolver,
    fileFingerprints: new Map([["test.js", "abc123"]]),
    indexService,
  });

  const request = new Request("http://localhost:3000/test");

  const innerHandler = (_req: Request, ctx: BffContext) => {
    // Test all context properties exist and have correct types
    assertExists(ctx.state);
    assertEquals(typeof ctx.state, "object");

    assertExists(ctx.indexService);
    assertExists(ctx.didResolver);
    assertExists(ctx.cfg);
    assertExists(ctx.fileFingerprints);

    // Test function properties
    assertEquals(typeof ctx.createRecord, "function");
    assertEquals(typeof ctx.createRecords, "function");
    assertEquals(typeof ctx.updateRecord, "function");
    assertEquals(typeof ctx.updateRecords, "function");
    assertEquals(typeof ctx.deleteRecord, "function");
    assertEquals(typeof ctx.backfillCollections, "function");
    assertEquals(typeof ctx.backfillUris, "function");
    assertEquals(typeof ctx.uploadBlob, "function");
    assertEquals(typeof ctx.render, "function");
    assertEquals(typeof ctx.html, "function");
    assertEquals(typeof ctx.json, "function");
    assertEquals(typeof ctx.redirect, "function");
    assertEquals(typeof ctx.rateLimit, "function");
    assertEquals(typeof ctx.requireAuth, "function");
    assertEquals(typeof ctx.getNotifications, "function");
    assertEquals(typeof ctx.updateSeen, "function");
    assertEquals(typeof ctx.getLabelerDefinitions, "function");

    // Test file fingerprints are accessible
    assertEquals(ctx.fileFingerprints.get("test.js"), "abc123");

    return Promise.resolve(new Response("OK"));
  };

  const response = await middleware(
    request,
    {} as Deno.ServeHandlerInfo,
    innerHandler,
  );
  assertEquals(response.status, 200);
});
