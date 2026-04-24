<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import LocationMapBanner from '$lib/components/atoms/LocationMapBanner.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { locationFeedQuery, locationsQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  let { data } = $props()

  const h3Index = $derived(data.h3Index)
  const name = $derived(data.name)
  const nameParam = $derived(data.nameParam)
  const feed = createQuery(() => locationFeedQuery(h3Index, nameParam ?? undefined))
  const locations = createQuery(() => locationsQuery())
  const h3Cells = $derived(
    nameParam
      ? locations.data?.find((l) => l.name === nameParam)?.h3Cells
      : undefined,
  )
</script>

<OGMeta title="{name} - grain" />
<DetailHeader label={name}>
  {#snippet actions()}
    {#if $isAuthenticated}
      <PinButton feed={{ id: `location:${h3Index}`, label: name, type: 'location', path: `/location/${encodeURIComponent(h3Index)}?name=${encodeURIComponent(name)}` }} />
    {/if}
  {/snippet}
</DetailHeader>
<LocationMapBanner {h3Index} {h3Cells} />
{#if feed.isLoading}
  <FeedList feed="location" params={{ location: h3Index }} skeleton />
{:else}
  <FeedList
    feed="location"
    params={nameParam ? { location: h3Index, name: nameParam } : { location: h3Index }}
    initialItems={feed.data?.items ?? []}
    initialCursor={feed.data?.cursor}
  />
{/if}
