import * as colors from "@std/fmt/colors";

export enum JETSTREAM {
  EAST_1 = "wss://jetstream1.us-east.bsky.network",
  EAST_2 = "wss://jetstream2.us-east.bsky.network",
  WEST_1 = "wss://jetstream1.us-west.bsky.network",
  WEST_2 = "wss://jetstream2.us-west.bsky.network",
}

export type JetstreamEvent<T> = {
  did: string;
  time_us: number;
  kind: string;
  commit?: {
    rev: string;
    operation: string;
    collection: string;
    rkey: string;
    record: T;
    cid: string;
  };
};

export class Jetstream<T> {
  readonly wantedCollections: string[];

  #handleEvent: (event: JetstreamEvent<T>) => void;
  #ws: WebSocket | null = null;
  #isConnected = false;
  #instanceUrl: string;
  #reconnectAttempt = 0;
  #maxReconnectAttempts = 10;
  #reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  #shouldReconnect = true;

  constructor(opts: {
    instanceUrl?: string;
    handleEvent: (event: JetstreamEvent<T>) => void;
    wantedCollections: string[];
    maxReconnectAttempts?: number;
  }) {
    this.#instanceUrl = opts.instanceUrl ||
      "wss://jetstream2.us-west.bsky.network";
    this.#handleEvent = opts.handleEvent;
    this.wantedCollections = opts.wantedCollections;
    this.#maxReconnectAttempts = opts.maxReconnectAttempts ?? 10;
  }

  constructUrl() {
    const params = new URLSearchParams();
    for (const col of this.wantedCollections) {
      params.append("wantedCollections", col);
    }
    return `${this.#instanceUrl}/subscribe?${params.toString()}`;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#shouldReconnect = true;
      this.#ws = new WebSocket(this.constructUrl());

      this.#ws.onopen = () => {
        this.#isConnected = true;
        this.#reconnectAttempt = 0;
        const localLabel = colors.bold("Jetstream:");
        const instanceUrl = colors.cyan(
          `${this.#instanceUrl}`,
        );
        console.log(`    ${localLabel}  ${instanceUrl}`);
        resolve();
      };

      this.#ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.#handleEvent(data);
        } catch (error) {
          console.error("Error decoding message:", error);
        }
      };

      this.#ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (!this.#isConnected) {
          reject(error);
        }
      };

      this.#ws.onclose = () => {
        this.#isConnected = false;
        console.log("Disconnected from Jetstream");
        if (this.#shouldReconnect) {
          this.attemptReconnect();
        }
      };
    });
  }

  private attemptReconnect(): void {
    if (this.#reconnectAttempt >= this.#maxReconnectAttempts) {
      console.error(
        `Failed to reconnect after ${this.#maxReconnectAttempts} attempts`,
      );
      return;
    }

    this.#reconnectAttempt++;
    const delay = Math.min(
      1000 * Math.pow(2, this.#reconnectAttempt - 1),
      30000,
    ); // Exponential backoff with max of 30 seconds

    console.log(
      `Attempting to reconnect (${this.#reconnectAttempt}/${this.#maxReconnectAttempts}) in ${
        delay / 1000
      } seconds`,
    );

    this.#reconnectTimeout = setTimeout(() => {
      console.log(`Reconnecting... Attempt ${this.#reconnectAttempt}`);
      this.connect().catch(() => {
        // If connection attempt fails, the onclose handler will trigger another reconnect attempt
      });
    }, delay);
  }

  public disconnect() {
    this.#shouldReconnect = false;
    if (this.#reconnectTimeout) {
      clearTimeout(this.#reconnectTimeout);
      this.#reconnectTimeout = null;
    }
    if (this.#ws) {
      this.#ws.close();
      this.#ws = null;
    }
    this.#isConnected = false;
  }
}

export default Jetstream;
