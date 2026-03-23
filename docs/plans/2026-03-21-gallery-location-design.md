# Gallery Location Design

## Goal

Add location to galleries using H3 geohashing and Nominatim geocoding, with auto-suggest from photo EXIF GPS data. Display locations on gallery cards and provide location-based feeds.

## Data Model

**Gallery lexicon** (`social.grain.gallery`): Add optional `location` field referencing `social.grain.defs#location`.

**Location type** (`social.grain.defs#location`):

```json
{
  "type": "object",
  "required": ["name", "value"],
  "properties": {
    "name": { "type": "string", "description": "Display name (e.g. Tokyo, Japan)" },
    "value": { "type": "string", "description": "H3 cell index at resolution 5" }
  }
}
```

**Gallery view** (`social.grain.gallery.defs#galleryView`): Add optional `location` with same shape.

**Database**: The gallery table gains `location_name` and `location_value` columns.

**EXIF extraction**: Extend `extractExif()` in `image-resize.ts` to grab `GPSLatitude`/`GPSLongitude` from exifr. These are transient (not stored) — used only client-side to auto-suggest location.

**Dependencies**: Add `h3-js` package.

## Client Utilities

Port from atconf-astro:

- `app/lib/utils/h3.ts` — `latLonToH3(lat, lon, resolution=5)` using h3-js
- `app/lib/utils/nominatim.ts` — `searchLocations(query)` for forward geocoding, `reverseGeocode(lat, lon)` for EXIF GPS auto-suggest. Both hit `nominatim.openstreetmap.org`.

## Create Flow (Step 2)

Add `LocationInput` component below the description field:

- Text input with map pin icon
- Debounced Nominatim search (300ms, min 2 chars)
- Dropdown with up to 5 results
- On select: convert lat/lon to H3 cell, store name + h3Index
- Click-outside closes dropdown
- Optional — galleries without location are fine

**EXIF GPS auto-suggest**: On entering step 2, if the first photo has GPS coords, reverse-geocode via Nominatim and pre-fill the location input. User can clear or override.

**On publish**: Include `location: { name, value }` in the gallery record if set.

## Display

On `GalleryCard`: Show map pin icon + location name below EXIF info, linking to `/location/[h3]`.

## Feeds

**`server/xrpc/getLocations.ts`**: Top locations by gallery count, cached 5min (same pattern as getCameras).

**`server/feeds/location.ts`**: Filter galleries by H3 cell match.

**Lexicons**: Add `location` param to `getFeed.json`. Create `social.grain.unspecced.getLocations` lexicon.

**UI**: Location pills in sidebar and mobile drawer. `/location/[h3]` route with DetailHeader (location name) and FeedList.

## Hydration

Update `_hydrate.ts` to read `location_name`/`location_value` from the gallery row and include `location: { name, value }` in the hydrated gallery view.

## Files to Create/Modify

**Create:**

- `app/lib/utils/h3.ts`
- `app/lib/utils/nominatim.ts`
- `app/lib/components/atoms/LocationInput.svelte`
- `server/feeds/location.ts`
- `server/xrpc/getLocations.ts`
- `app/routes/location/[h3]/+page.ts`
- `app/routes/location/[h3]/+page.svelte`
- `lexicons/social/grain/unspecced/getLocations.json`

**Modify:**

- `lexicons/social/grain/defs.json` — add location type
- `lexicons/social/grain/gallery/gallery.json` — add location field
- `lexicons/social/grain/gallery/defs.json` — add location to galleryView
- `lexicons/dev/hatk/getFeed.json` — add location param
- `app/lib/utils/image-resize.ts` — extract GPS from EXIF
- `app/routes/create/+page.svelte` — add LocationInput to step 2
- `app/lib/components/molecules/GalleryCard.svelte` — display location
- `app/lib/components/organisms/SidebarRight.svelte` — location pills
- `app/lib/components/organisms/MobileDrawer.svelte` — location pills
- `app/lib/queries.ts` — add locationFeedQuery, locationsQuery
- `server/feeds/_hydrate.ts` — include location in gallery view
- `db/schema.sql` — add columns
- `package.json` — add h3-js
