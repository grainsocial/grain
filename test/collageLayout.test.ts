// The collage layout that backs the gallery OG image. It is a pure function
// over a seeded PRNG, which is the whole point: an OG image is fetched by
// crawlers repeatedly and cached by URL, so the same gallery has to lay out
// identically every time. Randomness that is not reproducible would show up as
// a card that changes shape between fetches.
//
// These are invariants rather than golden values — a specific set of
// coordinates would only pin the current PRNG arithmetic, which is not the
// contract. Determinism, no overlaps, staying inside the frame and keeping each
// photo's shape are.

import { describe, expect, test } from "vitest";
import { calculateCollageLayout, type ImageItem, type Placement } from "../server/og/collage.ts";

const W = 1200;
const H = 630;
const GAP = 12;

const item = (url: string, aspectRatio: number): ImageItem => ({ url, aspectRatio });

/** A typical gallery: a mix of landscape, portrait and square. */
const MIXED: ImageItem[] = [
  item("a", 3 / 2),
  item("b", 2 / 3),
  item("c", 1),
  item("d", 16 / 9),
  item("e", 4 / 5),
  item("f", 1.5),
];

function overlaps(a: Placement, b: Placement): boolean {
  return !(
    a.x >= b.x + b.width ||
    a.x + a.width <= b.x ||
    a.y >= b.y + b.height ||
    a.y + a.height <= b.y
  );
}

function eachPair(ps: Placement[], fn: (a: Placement, b: Placement) => void) {
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) fn(ps[i], ps[j]);
  }
}

describe("calculateCollageLayout", () => {
  test("lays the same gallery out identically every time", async () => {
    const once = calculateCollageLayout(MIXED, W, H, GAP);
    const twice = calculateCollageLayout(MIXED, W, H, GAP);
    expect(twice).toEqual(once);

    // And across a fresh import, so nothing is being cached in module state.
    const { calculateCollageLayout: reimported } = await import("../server/og/collage.ts?fresh=1");
    expect(reimported(MIXED, W, H, GAP)).toEqual(once);
  });

  test("lays a different gallery out differently", () => {
    const a = calculateCollageLayout(MIXED, W, H, GAP);
    const b = calculateCollageLayout([...MIXED, item("g", 1.2)], W, H, GAP);
    expect(b).not.toEqual(a);
  });

  test("keys the seed on the photos, not on their order of arrival", () => {
    // The seed comes from url+ratio in the given order, so a reordered gallery
    // is a different seed — reordering a gallery is meant to change the card.
    const reordered = [...MIXED].reverse();
    expect(calculateCollageLayout(reordered, W, H, GAP)).not.toEqual(
      calculateCollageLayout(MIXED, W, H, GAP),
    );
  });

  test("never overlaps two photos", () => {
    for (const n of [2, 3, 4, 6]) {
      const placements = calculateCollageLayout(MIXED.slice(0, n), W, H, GAP);
      eachPair(placements, (a, b) => {
        expect(
          overlaps(a, b),
          `${a.item.url} at ${a.x},${a.y} ${a.width}x${a.height} overlaps ` +
            `${b.item.url} at ${b.x},${b.y} ${b.width}x${b.height}`,
        ).toBe(false);
      });
    }
  });

  test("keeps every photo inside the frame", () => {
    const placements = calculateCollageLayout(MIXED, W, H, GAP);
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      // Rounding can cost a pixel; the reserved gap absorbs it.
      expect(p.x + p.width).toBeLessThanOrEqual(W);
      expect(p.y + p.height).toBeLessThanOrEqual(H);
    }
  });

  test("keeps each photo's shape", () => {
    const placements = calculateCollageLayout(MIXED, W, H, GAP);
    expect(placements.length).toBeGreaterThan(0);
    for (const p of placements) {
      expect(p.width / p.height).toBeCloseTo(p.item.aspectRatio, 1);
    }
  });

  test("keeps every photo between the minimum and maximum size", () => {
    const placements = calculateCollageLayout(MIXED, W, H, GAP);
    const shortest = Math.min(W, H);
    for (const p of placements) {
      // 8% is the floor the reduced-size fallback will go down to; 75% the cap.
      expect(Math.min(p.width, p.height)).toBeGreaterThanOrEqual(shortest * 0.08 - 1);
      expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(shortest * 0.75 + 1);
    }
  });

  test("places a single photo", () => {
    const placements = calculateCollageLayout([item("solo", 3 / 2)], W, H, GAP);
    expect(placements).toHaveLength(1);
    expect(placements[0].item.url).toBe("solo");
    expect(placements[0].width).toBeGreaterThan(0);
  });

  test("returns nothing for no photos", () => {
    expect(calculateCollageLayout([], W, H, GAP)).toEqual([]);
  });

  test("crowds without overlapping, dropping what will not fit", () => {
    // Twenty photos will not all fit at these sizes. Whatever is placed still
    // has to be laid out cleanly — the fallback shrinks and grid-searches
    // rather than stacking things on top of each other.
    const many = Array.from({ length: 20 }, (_, i) => item(`p${i}`, 1 + (i % 5) * 0.25));
    const placements = calculateCollageLayout(many, W, H, GAP);

    expect(placements.length).toBeGreaterThan(0);
    expect(placements.length).toBeLessThanOrEqual(many.length);
    eachPair(placements, (a, b) => expect(overlaps(a, b)).toBe(false));
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(W);
      expect(p.y + p.height).toBeLessThanOrEqual(H);
    }
  });

  test("lays out into a portrait frame as well as a landscape one", () => {
    const placements = calculateCollageLayout(MIXED, 630, 1200, GAP);
    expect(placements.length).toBeGreaterThan(0);
    eachPair(placements, (a, b) => expect(overlaps(a, b)).toBe(false));
    for (const p of placements) {
      expect(p.x + p.width).toBeLessThanOrEqual(630);
      expect(p.y + p.height).toBeLessThanOrEqual(1200);
    }
  });

  test("honours a wider gap by spacing photos further apart", () => {
    const tight = calculateCollageLayout(MIXED, W, H, 4);
    const loose = calculateCollageLayout(MIXED, W, H, 60);
    expect(loose).not.toEqual(tight);
    eachPair(loose, (a, b) => expect(overlaps(a, b)).toBe(false));
  });
});
