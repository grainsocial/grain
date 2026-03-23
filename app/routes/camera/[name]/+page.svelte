<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import { createQuery } from '@tanstack/svelte-query'
  import { cameraFeedQuery } from '$lib/queries'
  import { isAuthenticated } from '$lib/stores'

  let { data } = $props()

  const camera = $derived(data.camera)
  const feed = createQuery(() => cameraFeedQuery(camera))
</script>

<DetailHeader label={camera}>
  {#snippet actions()}
    {#if $isAuthenticated}
      <PinButton feed={{ id: `camera:${camera}`, label: camera, type: 'camera', path: `/camera/${encodeURIComponent(camera)}` }} />
    {/if}
  {/snippet}
</DetailHeader>
{#if feed.isLoading}
  <FeedList feed="camera" params={{ camera }} skeleton />
{:else}
  <FeedList
    feed="camera"
    params={{ camera }}
    initialItems={feed.data?.items ?? []}
    initialCursor={feed.data?.cursor}
  />
{/if}
