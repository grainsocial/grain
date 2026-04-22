import { describe, expect, test } from "vitest";
import { formatStoredLocation } from "../server/helpers/formatLocation.ts";

describe("formatStoredLocation", () => {
  test("POI with locality differs from name — includes full context", () => {
    expect(
      formatStoredLocation(
        { name: "Blue Bottle Coffee" },
        { locality: "Oakland", region: "California", country: "US" },
      ),
    ).toBe("Blue Bottle Coffee, Oakland, California, US");
  });

  test("POI where locality matches name — skips dup", () => {
    expect(
      formatStoredLocation(
        { name: "Manzanita" },
        { locality: "Manzanita", region: "Oregon", country: "US" },
      ),
    ).toBe("Manzanita, Oregon, US");
  });

  test("POI like Overlook with town locality — includes town", () => {
    expect(
      formatStoredLocation(
        { name: "Overlook Mountain Fire Tower" },
        { locality: "Town of Woodstock", region: "New York", country: "US" },
      ),
    ).toBe("Overlook Mountain Fire Tower, Town of Woodstock, New York, US");
  });

  test("Nominatim city fallback — dedupes locality and region matching primary", () => {
    expect(
      formatStoredLocation(
        { name: "New York, New York, United States" },
        { locality: "New York", region: "New York", country: "US" },
      ),
    ).toBe("New York, US");
  });

  test("city fallback with distinct state — keeps state", () => {
    expect(
      formatStoredLocation(
        { name: "Oakland, California, United States" },
        { locality: "Oakland", region: "California", country: "US" },
      ),
    ).toBe("Oakland, California, US");
  });

  test("county baked into name by legacy client — stripped via primary split", () => {
    expect(
      formatStoredLocation(
        { name: "Kansas City, Jackson County, Missouri, United States" },
        { locality: "Kansas City", region: "Missouri", country: "US" },
      ),
    ).toBe("Kansas City, Missouri, US");
  });

  test("deep Nominatim fallback for a street + district + city", () => {
    expect(
      formatStoredLocation(
        { name: "821 Southeast 14th Avenue, Central Eastside, Buckman, Portland, Multnomah County, Oregon, 97214, United States" },
        { locality: "Portland", region: "Oregon", country: "USA" },
      ),
    ).toBe("821 Southeast 14th Avenue, Portland, Oregon, USA");
  });

  test("name already has state abbrev — doesn't duplicate", () => {
    expect(
      formatStoredLocation(
        { name: "Seattle, WA" },
        { locality: "Seattle", region: "WA", country: "US" },
      ),
    ).toBe("Seattle, WA, US");
  });

  test("legacy hthree record with no address — preserves full name", () => {
    expect(
      formatStoredLocation(
        { name: "Eindhoven, North Brabant, Netherlands" },
        null,
      ),
    ).toBe("Eindhoven, North Brabant, Netherlands");
  });

  test("empty/null inputs return empty string", () => {
    expect(formatStoredLocation(null, null)).toBe("");
    expect(formatStoredLocation({ name: null }, null)).toBe("");
    expect(formatStoredLocation({}, {})).toBe("");
  });

  test("non-US location with only country — doesn't crash on missing region", () => {
    expect(
      formatStoredLocation(
        { name: "Taipei" },
        { locality: "Taipei", country: "TW" },
      ),
    ).toBe("Taipei, TW");
  });
});
