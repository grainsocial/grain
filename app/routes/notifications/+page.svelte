<script lang="ts">
  import { onMount } from 'svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { infiniteScroll } from '$lib/actions/infinite-scroll'
  import { notificationsQuery } from '$lib/queries'
  import { markNotificationsSeen } from '$lib/preferences'
  import { viewer as viewerStore } from '$lib/stores'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import NotificationItem from '$lib/components/atoms/NotificationItem.svelte'
  import Spinner from '$lib/components/atoms/Spinner.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { callXrpc } from '$hatk/client'
  import type { NotificationItem as NotifItem } from '$hatk'

  const viewerDid = $derived($viewerStore?.did)
  const queryClient = useQueryClient()

  const notifications = createQuery(() => ({
    ...notificationsQuery(viewerDid ?? ''),
    enabled: !!viewerDid,
  }))

  let loadingMore = $state(false)
  let allItems: NotifItem[] = $state([])
  let currentCursor: string | undefined = $state(undefined)
  let hasMore = $state(true)

  $effect(() => {
    if (notifications.data) {
      allItems = notifications.data.notifications ?? []
      currentCursor = notifications.data.cursor
      hasMore = !!notifications.data.cursor
    }
  })

  onMount(async () => {
    if (viewerDid) {
      await markNotificationsSeen()
      queryClient.setQueryData(['unseenNotificationCount', viewerDid], 0)
    }
  })

  async function loadMore() {
    if (loadingMore || !hasMore || !viewerDid || !currentCursor) return
    loadingMore = true
    try {
      const result = await callXrpc('social.grain.unspecced.getNotifications', {
        limit: 20,
        cursor: currentCursor,
      })
      allItems = [...allItems, ...result.notifications]
      currentCursor = result.cursor
      hasMore = !!result.cursor
    } finally {
      loadingMore = false
    }
  }

</script>

<OGMeta title="Notifications - grain" />
<DetailHeader label="Notifications" />

{#if notifications.isLoading}
  <div class="center"><Spinner /></div>
{:else if allItems.length === 0}
  <div class="empty">No notifications yet</div>
{:else}
  <div class="notification-list">
    {#each allItems as notif (notif.uri)}
      <NotificationItem {notif} />
    {/each}
    {#if hasMore}
      <div use:infiniteScroll={loadMore} class="sentinel">
        {#if loadingMore}<Spinner />{/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .center {
    display: flex;
    justify-content: center;
    padding: 40px;
  }
  .empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .notification-list {
    display: flex;
    flex-direction: column;
  }
  .sentinel {
    display: flex;
    justify-content: center;
    padding: 20px;
  }
</style>
