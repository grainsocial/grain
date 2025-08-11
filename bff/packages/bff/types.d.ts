import type {
  LabelValue,
  LabelValueDefinition,
} from "$lexicon/types/com/atproto/label/defs.ts";
import type { Agent } from "@atproto/api";
import type { DidResolver } from "@atproto/identity";
import type { BlobRef, Lexicons } from "@atproto/lexicon";
import type { DatabaseSync } from "node:sqlite";
import type { ComponentChildren, FunctionComponent, VNode } from "preact";
import type { ATProtoSession } from "./aip/atproto-session.ts";
import type { IndexService } from "./services/indexing.ts";

export type Database = DatabaseSync;

export type ActorTable = {
  did: string;
  handle: string;
  lastSeenNotifs?: string;
  indexedAt: string;
};

export type RecordTable = {
  uri: string;
  cid: string;
  did: string;
  collection: string;
  json: string;
  indexedAt: string;
};

export type LabelTable = {
  id?: number;
  src: string;
  uri: string;
  cid?: string | null;
  val: string;
  neg?: boolean;
  cts: string;
  exp?: string | null;
};

export type FacetIndexTable = {
  uri: string;
  type: "mention" | "tag";
  value: string;
};

export type RecordMeta = {
  indexedAt: string;
  cid: string;
  did: string;
  uri: string;
};

export type WithBffMeta<T> = T & RecordMeta;

export type BffMiddleware = (
  req: Request,
  ctx: BffContext,
) => Promise<Response>;

type RootElement = <T extends Record<string, unknown>>(
  props: RootProps<T>,
) => preact.VNode;

export type onListenArgs = { indexService: IndexService; cfg: BffConfig };

export type BffOptions = {
  /** The name of the app, used for OAuth */
  appName: string;
  /**
   * The URL of the database, used for SQLite
   * @default ":memory:"
   */
  databaseUrl?: string;
  /** The URL of the Jetstream server */
  jetstreamUrl?: string;
  /** Collections to index off the firehose from internal lexicons */
  collections?: string[];
  /** Collections to index off the firehose from external lexicons */
  externalCollections?: string[];
  /**
   * ATProto OAuth Scopes
   * @default "atproto transition:generic"
   */
  oauthScope?: string;
  /** Functions that are called before rendering and can modify the content or make other changes. */
  middlewares?: BffMiddleware[];
  /** The lexicons class imported from codegen. */
  lexicons?: Lexicons;
  /** List of labelers that provide moderation labels. e.g. did:web:my-labeler.com */
  appLabelers?: string[];
  /** The collection declaring the labeler e.g. app.bsky.labeler.service */
  appLabelerCollection?: string;
  /**
   * The static/public folder relative to the root directory.
   * @default "static"
   */
  buildDir?: string;
  /** Collection key map. Define which key/value pairs to index. */
  collectionKeyMap?: Record<string, string[]>;
  /** Token callback e.g. passing jwt along to mobile app, only use server-side */
  tokenCallbackUrl?: string;
  /** Doesn't require DB, for running a standalone websocket notification service */
  notificationsOnly?: boolean;
  /** The root element of the app */
  rootElement?: RootElement;
  /** Called when the server starts listening. */
  onListen?: (params: onListenArgs) => Promise<void> | void;
  /** Called when the server throws an error. */
  onError?: (err: unknown) => Response | Promise<Response>;
};

export type EnvConfig = {
  /**
   * The port to serve the app on
   * @default 8080
   */
  port: number;
  /** The URL of the app, used for OAuth */
  publicUrl: string;
  /**
   * The root directory of the app
   * @default process.cwd()
   */
  rootDir: string;
  /** The lifefs directory. This should be what you set your fuse.dir config to in the litefs.yml config. */
  litefsDir: string;
  /** The cookie secret */
  cookieSecret: string;
  /** jwks private key 1 */
  privateKey1?: string;
  /** jwks private key 2 */
  privateKey2?: string;
  /** jwks private key 3 */
  privateKey3?: string;
  /** The PLC directory url */
  plcDirectoryUrl?: string;
  /** The URL of the Jetstream server */
  jetstreamUrl?: string;
};

export type BffConfig = BffOptions & EnvConfig & {
  lexicons: Lexicons;
  /**
   * The URL of the database, used for SQLite
   * @default ":memory:"
   */
  databaseUrl: string;
  oauthScope: string;
  rootElement: RootElement;
  buildDir: string;
};

export type LabelerPolicies = {
  labelValues: LabelValue[];
  labelValueDefinitions: LabelValueDefinition[];
};

export type OrderByOption = {
  field: string;
  direction?: "asc" | "desc";
};

export type WhereOption = {
  field: string;
  equals?: string;
  contains?: string;
  in?: string[];
};

interface WhereCondition {
  field: string;
  equals?: string | number | boolean;
  contains?: string;
  in?: Array<string | number | boolean>;
}

type NestedWhere = {
  AND?: Where[];
  OR?: Where[];
  NOT?: Where;
};

export type Where = WhereCondition | NestedWhere;

export type QueryOptions = {
  orderBy?: OrderByOption[];
  where?: Where | Where[];
  facet?: {
    type: string;
    value: string;
  };
  limit?: number;
  cursor?: string;
};

export type CollectionKeyMap = Record<string, string[]>;

export type RecordKvTable = {
  uri: string;
  collection: string;
  key: string;
  value: string;
  indexedAt: string;
};

export type ApplicationType = "web" | "native";

export type BffContext<State = Record<string, unknown>> = {
  state: State;
  didResolver: DidResolver;
  db: Database;
  agent?: Agent;
  requireToken: (req: Request) => Promise<ActorTable>;
  getATProtoSession: (req: Request) => Promise<ATProtoSession>;
  createRecord: <T>(
    collection: string,
    data: Partial<T>,
    self?: boolean,
  ) => Promise<string>;
  createRecords: <T>(
    updates: Array<{
      collection: string;
      rkey?: string;
      data: Partial<T>;
    }>,
  ) => Promise<string[]>;
  updateRecord: <T>(
    collection: string,
    rkey: string,
    data: Partial<T>,
  ) => Promise<string>;
  updateRecords: <T>(
    updates: Array<{
      collection: string;
      rkey: string;
      data: Partial<T>;
    }>,
  ) => Promise<string[]>;
  deleteRecord: (uri: string) => Promise<void>;
  backfillCollections: (params: {
    collections?: string[];
    externalCollections?: string[];
    repos?: string[];
  }) => Promise<void>;
  backfillUris: (
    uris: string[],
  ) => Promise<void>;
  uploadBlob: (file: File) => Promise<BlobRef>;
  indexService: IndexService;
  currentUser?: ActorTable;
  cfg: BffConfig;
  next: () => Promise<Response>;
  render: (
    children: ComponentChildren,
    headers?: Record<string, string>,
  ) => Response;
  html: (vnode: VNode, headers?: Record<string, string>) => Response;
  json: (
    data: unknown,
    status?: number,
    headers?: Record<string, string>,
  ) => Response;
  redirect: (url: string) => Response;
  rateLimit: (options: {
    namespace: string;
    points?: number;
    limit: number;
    window: number;
    key?: string;
  }) => boolean;
  requireAuth: () => ActorTable; // Returns the currentUser if authenticated, throws otherwise
  getNotifications: <T extends Record<string, unknown>>() => T[];
  updateSeen: (seenAt: string) => void;
  getLabelerDefinitions: () => Promise<Record<string, LabelerPolicies>>;
  fileFingerprints: Map<string, string>;
};

export type onSignedInArgs = {
  actor: ActorTable;
  ctx: BffContext;
};

export type OauthMiddlewareOptions = {
  LoginComponent?: FunctionComponent<{ error?: string }>;
  /**
   * Hook that's called when a user logs in
   * @returns {string | undefined} The URL to redirect to after login
   */
  onSignedIn?: (params: onSignedInArgs) => Promise<string | undefined> | void;

  createAccountPdsHost?: string;
};

export type AipMiddlewareOptions = {
  LoginComponent?: FunctionComponent<{ error?: string }>;
  /**
   * Hook that's called when a user logs in
   * @returns {string | undefined} The URL to redirect to after login
   */
  onSignedIn?: (params: onSignedInArgs) => Promise<string | undefined> | void;
  createAccountPdsHost?: string;
};

export type RootProps<T = Record<string, unknown>> = {
  ctx: BffContext<T & { staticFilesHash?: Map<string, string> }>;
  children: ComponentChildren;
};

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  ctx: BffContext,
) => Promise<Response> | Response;
