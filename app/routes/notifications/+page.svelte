<script lang="ts">
  import { untrack } from 'svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { infiniteScroll } from '$lib/actions/infinite-scroll'
  import { notificationsQuery } from '$lib/queries'
  import { markNotificationsSeen } from '$lib/preferences'
  import { viewer as viewerStore } from '$lib/stores'
  import { groupNotifications, type GroupedNotification } from '$lib/notifications'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import NotificationItem from '$lib/components/atoms/NotificationItem.svelte'
  import Spinner from '$lib/components/atoms/Spinner.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import { callXrpc } from '$hatk/client'

  const viewerDid = $derived($viewerStore?.did)
  const queryClient = useQueryClient()

  const notifications = createQuery(() => ({
    ...notificationsQuery(viewerDid ?? ''),
    enabled: !!viewerDid,
  }))

  let loadingMore = $state(false)
  let allItems: any[] = $state([])
  let currentCursor: string | undefined = $state(undefined)
  let hasMore = $state(true)

  let grouped: GroupedNotification[] = $state([])

  $effect(() => {
    const data = notifications.data
    if (data) {
      untrack(() => {
        allItems = data.notifications ?? []
        grouped = groupNotifications(allItems)
        currentCursor = data.cursor
        hasMore = !!data.cursor
      })
    }
  })

  let hasMark = false
  $effect(() => {
    if (viewerDid && !hasMark) {
      hasMark = true
      markNotificationsSeen().then(() => {
        queryClient.setQueryData(['unseenNotificationCount', viewerDid], 0)
      })
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
      grouped = groupNotifications(allItems)
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
{:else if grouped.length === 0}
  <div class="empty">No notifications yet</div>
{:else}
  <div class="notification-list">
    {#each grouped as group (group.notification.uri)}
      <NotificationItem {group} />
    {/each}
    {#if hasMore}
      <div use:infiniteScroll={() => { if (!loadingMore) loadMore() }} class="sentinel">
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
