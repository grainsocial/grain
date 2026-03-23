export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  addresstype?: string;
  name?: string;
  place_id: number;
  address?: {
    amenity?: string;
    shop?: string;
    tourism?: string;
    leisure?: string;
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
  };
}

const POI_TYPES = new Set(["amenity", "shop", "tourism", "leisure"]);

export async function searchLocations(query: string): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "grain-app/1.0" },
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<NominatimResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "grain-app/1.0" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** Returns true if the result is a point-of-interest (venue, shop, etc.) */
export function isPOI(result: NominatimResult): boolean {
  return POI_TYPES.has(result.addresstype ?? "");
}

/** Format the display name — venue/place name for the gallery card. */
export function formatLocationName(result: NominatimResult): string {
  if (result.name) {
    return result.name;
  }
  return formatGeoContext(result) ?? result.display_name.split(",")[0];
}

/** Format geographic context — city/state/country for display. */
export function formatGeoContext(result: NominatimResult): string | undefined {
  const addr = result.address;
  if (!addr) return undefined;
  const parts: string[] = [];
  const city = addr.city || addr.town || addr.village;
  if (city) parts.push(city);
  if (addr.state) parts.push(addr.state);
  if (addr.country) parts.push(addr.country);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** Format street address for dropdown disambiguation. */
export function formatStreet(result: NominatimResult): string | undefined {
  const addr = result.address;
  if (!addr?.road) return undefined;
  return addr.house_number ? `${addr.house_number} ${addr.road}` : addr.road;
}

/** Extract structured address data from a Nominatim result. */
export function extractAddress(result: NominatimResult): {
  name?: string;
  street?: string;
  locality?: string;
  region?: string;
  country: string;
  postalCode?: string;
} | null {
  const addr = result.address;
  const countryCode = addr?.country_code?.toUpperCase();
  if (!countryCode) return null;

  const name = result.name || undefined;
  const street = formatStreet(result);
  const locality = addr?.city || addr?.town || addr?.village || undefined;
  const region = addr?.state || undefined;
  const postalCode = addr?.postcode || undefined;

  return {
    ...(name ? { name } : {}),
    ...(street ? { street } : {}),
    ...(locality ? { locality } : {}),
    ...(region ? { region } : {}),
    country: countryCode,
    ...(postalCode ? { postalCode } : {}),
  };
}
