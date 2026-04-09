# For You Feed Design

Collaborative filtering feed for Grain, reverse-engineered from the Bluesky For You feed playground by spacecowboy17.

## Algorithm

### Personalized mode (user has favorites)

1. **Seed**: Get user's 500 most recent favorites
2. **Co-likers**: Find other users who also favorited those same galleries
3. **Candidates**: Collect galleries those co-likers favorited (excluding user's own favorites and own galleries)
4. **Score** each candidate:

```
For each path (co-liker → candidate gallery):
  path_score = 1 / (co_liker_total_likes ^ divisor_power)
  path_score *= (1 - corater_decay) ^ (items_from_this_corater - 1)

base_score = sum(path_scores)
smoothed = base_score * (num_paths ^ smoothing_factor)
time_factor = 0.5 ^ (age_hours / half_life)    // half_life=0 disables decay
final_score = smoothed * time_factor / (total_favorites ^ popularity_penalty)
```

5. **Rank** by final_score descending, paginate with cursor

### Cold start fallback (no favorites)

Return galleries ordered by favorite count descending, filtered to last 30 days.

## Default Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| half_life | 6 | Hours; demotes older posts |
| smoothing_factor | 0.5 | Boosts multi-path posts |
| popularity_penalty | 0.3 | Demotes generally popular posts |
| divisor_power | 1.0 | Divides by co-liker's total likes |
| corater_decay | 0 | Decay for same co-liker (0=none) |
| time_shift | 24 | Hours; co-like contribution window |
| seed_limit | 500 | Max seed favorites |

## Files

- `server/feeds/foryou.ts` — feed generator with scoring logic
- `app/lib/queries.ts` — add forYouFeedQuery
- `app/routes/feeds/for-you/+page.ts` — page load
- `app/routes/feeds/for-you/+page.svelte` — feed UI
- `app/lib/preferences.ts` — add to DEFAULT_PINNED

## Pagination

Score-based cursor: encode `score:rkey` as cursor string. Since scores are computed in JS (not SQL), fetch all candidates, score, sort, then slice by cursor position. For v1, use offset-based cursor to keep it simple.

## Filters

- Exclude galleries user already favorited
- Exclude user's own galleries
- Respect takedown status and hidden labels
- Require gallery to have at least 1 item
