import type {
  Labels,
} from "$lexicon/types/com/atproto/label/subscribeLabels.ts";
import type { Un$Typed } from "$lexicon/util.ts";
import * as colors from "@std/fmt/colors";

export type LabelerEvent = Un$Typed<Labels>;

export class Labeler {
  #handleEvent: (event: LabelerEvent) => void;
  #ws: WebSocket | null = null;
  #isConnected = false;
  #instanceUrl: string;
  #reconnectAttempt = 0;
  #maxReconnectAttempts = 10;
  #reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  #shouldReconnect = true;

  constructor(opts: {
    instanceUrl: string;
    handleEvent: (event: LabelerEvent) => void;
    maxReconnectAttempts?: number;
  }) {
    this.#instanceUrl = opts.instanceUrl;
    this.#handleEvent = opts.handleEvent;
    this.#maxReconnectAttempts = opts.maxReconnectAttempts ?? 10;
  }

  constructUrl() {
    return `${this.#instanceUrl}/xrpc/com.atproto.label.subscribeLabels`;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#shouldReconnect = true;
      this.#ws = new WebSocket(this.constructUrl());

      this.#ws.onopen = () => {
        this.#isConnected = true;
        this.#reconnectAttempt = 0;
        const localLabel = colors.bold("Labeler:");
        const instanceUrl = colors.cyan(
          `${this.#instanceUrl}`,
        );
        console.log(`    ${localLabel}  ${instanceUrl}`);
        resolve();
      };

      this.#ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.#handleEvent(data as LabelerEvent);
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
        console.log("Disconnected from Labeler");
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

export default Labeler;
