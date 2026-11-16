/**
 * AT Protocol TID (timestamp identifier) generation.
 *
 * We mint record keys client-side rather than letting the PDS assign them so
 * that writes are idempotent. A create with a server-assigned rkey turns every
 * replayed request into a brand new record — that is how a single gallery ended
 * up with the same photo at position 2 three times, ~20s apart, from one
 * `await`. With the rkey fixed up front a replay collides with the record it
 * already wrote and the PDS rejects it instead of duplicating it.
 *
 * A TID is 13 chars of base32-sortable encoding a 64-bit integer: one
 * always-zero high bit, 53 bits of microseconds since the UNIX epoch, then a
 * 10-bit clock id that keeps concurrent writers on different devices apart.
 */

const S32 = "234567abcdefghijklmnopqrstuvwxyz";

/** Random per-session, per the TID spec's clock identifier. */
const CLOCK_ID = BigInt(Math.floor(Math.random() * 1024));

let lastMicros = 0n;

/** Encode microseconds + clock id as a 13-char base32-sortable TID. */
export function encodeTid(micros: bigint, clockId: bigint): string {
  let n = (micros << 10n) | (clockId & 1023n);
  let out = "";
  for (let i = 0; i < 13; i++) {
    out = S32[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return out;
}

/**
 * Mint the next TID. Strictly increasing, so a batch of writes minted in a
 * loop sorts in call order.
 */
export function nextTid(): string {
  // Date.now() is millisecond-granular and a whole gallery's worth of rkeys is
  // minted inside one tick, so step forward by hand rather than handing back
  // the same rkey 30 times.
  const micros = BigInt(Date.now()) * 1000n;
  lastMicros = micros > lastMicros ? micros : lastMicros + 1n;
  return encodeTid(lastMicros, CLOCK_ID);
}
