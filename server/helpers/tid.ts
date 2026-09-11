/**
 * A record key that sorts by time, the way `tid` keys do.
 *
 * Not the real clock-id encoding — nothing here dereferences it — just
 * monotonic and collision-resistant enough for one account's own writes into a
 * space, where the alternative is asking the client to invent one.
 */
export function tid(): string {
  const b32 = "234567abcdefghijklmnopqrstuvwxyz";
  let n = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
  let out = "";
  while (out.length < 13) {
    out = b32[Number(n % 32n)] + out;
    n /= 32n;
  }
  return out;
}
