import { describe, expect, test } from "vitest";
import { encodeTid, nextTid } from "../app/lib/utils/tid.ts";

/** Regex from the AT Protocol TID syntax: 13 base32-sortable chars, top bit clear. */
const TID_RE = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;

const S32 = "234567abcdefghijklmnopqrstuvwxyz";

function decode(tid: string): { micros: bigint; clockId: bigint } {
  let n = 0n;
  for (const c of tid) n = n * 32n + BigInt(S32.indexOf(c));
  return { micros: n >> 10n, clockId: n & 1023n };
}

describe("encodeTid", () => {
  test("matches rkeys the PDS actually minted", () => {
    // Real rkeys pulled from prod, with their decoded write times. If our
    // encoding drifts from the PDS's these stop matching.
    expect(encodeTid(1786983086755000n, 363n)).toBe("3mtc3q3q57sff");
    expect(encodeTid(1786983092839000n, 363n)).toBe("3mtc3qbjsmsff");
    expect(encodeTid(1786983128892000n, 363n)).toBe("3mtc3rdw2n2ff");
  });

  test("round-trips", () => {
    const { micros, clockId } = decode(encodeTid(1786983086755000n, 363n));
    expect(micros).toBe(1786983086755000n);
    expect(clockId).toBe(363n);
  });

  test("sorts lexicographically by time", () => {
    const early = encodeTid(1786983086755000n, 1023n);
    const late = encodeTid(1786983092839000n, 0n);
    expect(early < late).toBe(true);
  });
});

describe("nextTid", () => {
  test("emits valid TIDs", () => {
    expect(nextTid()).toMatch(TID_RE);
  });

  test("is strictly increasing within a single millisecond tick", () => {
    // A 10-photo gallery mints ~31 rkeys back to back; none may collide.
    const tids = Array.from({ length: 31 }, () => nextTid());
    expect(new Set(tids).size).toBe(31);
    expect([...tids].sort()).toEqual(tids);
    for (const tid of tids) expect(tid).toMatch(TID_RE);
  });

  test("encodes a timestamp close to now", () => {
    const before = BigInt(Date.now()) * 1000n;
    const { micros } = decode(nextTid());
    const after = BigInt(Date.now()) * 1000n;
    expect(micros >= before).toBe(true);
    // Allow for the manual +1us stepping done by earlier tests in this file.
    expect(micros - after < 1_000_000n).toBe(true);
  });
});
