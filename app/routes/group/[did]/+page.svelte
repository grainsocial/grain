<script lang="ts">
  import GalleryGrid from '$lib/components/organisms/GalleryGrid.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Skeleton from '$lib/components/atoms/Skeleton.svelte'
  import RichText from '$lib/components/atoms/RichText.svelte'
  import Toast from '$lib/components/atoms/Toast.svelte'
  import { Grid3x3, Inbox, Check, LoaderCircle, ShieldCheck } from 'lucide-svelte'
  import { createQuery, createInfiniteQuery, useQueryClient } from '@tanstack/svelte-query'
  import { groupQuery, groupFeedQuery, groupSubmissionsQuery } from '$lib/queries'
  import { acceptSubmission } from '$lib/mutations'
  import { relativeTime } from '$lib/utils'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import type { PhotoView, SubmissionView } from '$hatk/client'

  // The profile page with the nouns swapped. A group is an account like any
  // other; what makes it a group is that its pool is other people's galleries.
  // "Acting" — the viewer signed in *as* the group through its community host
  // — is the only moderator signal Grain needs: that session can write the
  // group's repo, so it can accept.
  let { data } = $props()
  const did = $derived(data.did)
  const queryClient = useQueryClient()

  const group = createQuery(() => groupQuery(did))
  const feed = createInfiniteQuery(() => groupFeedQuery(did))
  const items = $derived(feed.data?.pages.flatMap((p) => p.items ?? []) ?? [])
  const acting = $derived(!!group.data?.viewer?.acting)
  const queue = createQuery(() => ({ ...groupSubmissionsQuery(did), enabled: acting }))
  const pending = $derived(queue.data ?? [])

  const tab = $derived.by(() => {
    page.url.href
    return page.url.searchParams.get('tab') === 'queue' && acting ? 'queue' : 'pool'
  })
  function setTab(next: 'pool' | 'queue') {
    const url = new URL(page.url)
    if (next === 'pool') url.searchParams.delete('tab')
    else url.searchParams.set('tab', next)
    goto(url, { replaceState: true, keepFocus: true, noScroll: true })
  }

  let accepting: string | null = $state(null)
  let toastMessage = $state('')
  let showToast = $state(false)
  async function accept(s: SubmissionView) {
    if (accepting) return
    accepting = s.uri
    try {
      await acceptSubmission(s.gallery.uri, s.uri, queryClient)
      toastMessage = `Added "${s.gallery.title}" to the pool`
      showToast = true
    } catch (err) {
      console.error('accept failed', err)
      toastMessage = 'Could not accept — is this session allowed to write the group?'
      showToast = true
    } finally {
      accepting = null
    }
  }
  function thumb(s: SubmissionView): string | undefined {
    return ((s.gallery.items ?? []) as PhotoView[])[0]?.thumb
  }
</script>

{#if group.isLoading}
  <DetailHeader label={' '} />
  <div class="header"><div class="info"><Skeleton circle height="64px" /><div style="margin-top:10px"><Skeleton width="160px" height="22px" /></div></div></div>
{:else if group.isError || !group.data}
  <DetailHeader label="Not a group" />
  <p class="empty">This account hasn't declared itself a community.</p>
{:else}
  {@const g = group.data}
  {@const name = g.displayName || g.handle}
  <OGMeta title="{name} — Groups — Grain" description="{g.poolCount ?? 0} galleries in the pool" />
  <DetailHeader label={name} />

  <div class="header">
    <div class="info">
      <span class="av"><Avatar {did} src={g.avatar ?? null} name={name} size={64} /></span>
      <div class="name">{name} <span class="badge">g</span></div>
      <div class="handle">@{g.handle}</div>
      <div class="stats">
        <span><strong>{(g.poolCount ?? 0).toLocaleString()}</strong> in the pool</span>
        {#if acting}<span><strong>{(g.pendingCount ?? 0).toLocaleString()}</strong> waiting for review</span>{/if}
      </div>
      {#if g.description}<div class="bio"><RichText text={g.description} /></div>{/if}
    </div>
  </div>

  {#if acting}
    <div class="modbar">
      <ShieldCheck size={16} />
      <span>You're signed in as <b>{name}</b>.
        {#if (g.pendingCount ?? 0) > 0}<b>{g.pendingCount}</b> {g.pendingCount === 1 ? 'submission is' : 'submissions are'} waiting.{:else}Nothing waiting for review.{/if}
      </span>
      {#if tab !== 'queue' && (g.pendingCount ?? 0) > 0}
        <button class="review" type="button" onclick={() => setTab('queue')}>Review</button>
      {/if}
    </div>
  {/if}

  <div class="view-toggle">
    <div class="toggle-tabs">
      <button class="toggle-btn" class:active={tab === 'pool'} onclick={() => setTab('pool')} aria-label="Pool"><Grid3x3 size={20} /></button>
      {#if acting}
        <button class="toggle-btn" class:active={tab === 'queue'} onclick={() => setTab('queue')} aria-label="Queue">
          <Inbox size={20} />
          {#if (g.pendingCount ?? 0) > 0}<span class="count">{g.pendingCount}</span>{/if}
        </button>
      {/if}
    </div>
  </div>

  {#if tab === 'queue'}
    {#if queue.isLoading}
      <p class="empty">Loading…</p>
    {:else if pending.length === 0}
      <p class="empty">The queue is empty.</p>
    {:else}
      <div class="queue">
        {#each pending as s (s.uri)}
          {@const rkey = s.gallery.uri.split('/').pop()}
          <div class="qrow">
            <a class="qthumb" href="/profile/{s.gallery.creator.did}/gallery/{rkey}">
              {#if thumb(s)}<img src={thumb(s)} alt={s.gallery.title ?? ''} />{/if}
            </a>
            <div class="qt">
              <a class="qtitle" href="/profile/{s.gallery.creator.did}/gallery/{rkey}">{s.gallery.title}</a>
              <span class="qmeta">
                <a href="/profile/{s.gallery.creator.did}">{s.gallery.creator.displayName || `@${s.gallery.creator.handle}`}</a>
                · {((s.gallery.items ?? []) as PhotoView[]).length} {((s.gallery.items ?? []) as PhotoView[]).length === 1 ? 'photo' : 'photos'}
                · submitted {relativeTime(s.createdAt)}
              </span>
            </div>
            <button class="accept" type="button" onclick={() => accept(s)} disabled={accepting === s.uri}>
              {#if accepting === s.uri}<LoaderCircle size={14} class="spin" />{:else}<Check size={14} />{/if}
              Accept
            </button>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <GalleryGrid
      items={items}
      loading={feed.isLoading}
      emptyText="Nothing in the pool yet."
      hasMore={feed.hasNextPage}
      loadingMore={feed.isFetchingNextPage}
      onLoadMore={() => feed.fetchNextPage()}
      showAuthor
    />
  {/if}
{/if}

<Toast message={toastMessage} bind:visible={showToast} />

<style>
  .header { border-bottom: 1px solid var(--border); }
  .info { padding: 16px; }
  .av :global(img), .av :global(.avatar) { border-radius: 18px; }
  .name { font-family: var(--font-display); font-weight: 700; font-size: 20px; margin-top: 10px; display: flex; align-items: center; gap: 8px; }
  .badge {
    display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
    border-radius: 5px; background: var(--grain); color: var(--on-grain); font-size: 11px; font-weight: 800;
  }
  .handle { font-size: 13px; color: var(--text-muted); font-family: monospace; margin-top: 2px; }
  .stats { display: flex; gap: 16px; margin-top: 10px; font-size: 13px; color: var(--text-secondary); }
  .stats strong { color: var(--text-primary); font-weight: 600; }
  .bio { margin-top: 8px; font-size: 14px; color: var(--text-secondary); white-space: pre-wrap; }
  .modbar {
    display: flex; align-items: center; gap: 10px; margin: 12px 16px 0; padding: 10px 14px;
    border-radius: 12px; background: var(--grain-glow); border: 1px solid var(--grain);
    font-size: 13px; color: var(--text-secondary);
  }
  .modbar b { color: var(--text-primary); font-weight: 600; }
  .modbar :global(svg) { color: var(--grain); flex-shrink: 0; }
  .review {
    margin-left: auto; padding: 6px 12px; border-radius: 999px; border: none;
    background: var(--grain); color: var(--on-grain); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .view-toggle { display: flex; justify-content: center; padding: 8px 16px; border-bottom: 1px solid var(--border); }
  .toggle-tabs { display: flex; gap: 4px; }
  .toggle-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px;
    background: none; border: none; color: var(--text-muted); cursor: pointer; position: relative; transition: color 0.15s;
  }
  .toggle-btn::after {
    content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 28px; height: 2.5px; border-radius: 2px; background: transparent; transition: background 0.15s;
  }
  .toggle-btn.active { color: var(--text-primary); }
  .toggle-btn.active::after { background: var(--grain); }
  .count {
    font-size: 11px; font-weight: 700; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
    background: var(--grain); color: var(--on-grain); display: inline-flex; align-items: center; justify-content: center;
  }
  .queue { display: flex; flex-direction: column; }
  .qrow { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
  .qthumb { width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: var(--bg-elevated); flex-shrink: 0; }
  .qthumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .qt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .qtitle { font-weight: 600; font-size: 14px; color: var(--text-primary); text-decoration: none; }
  .qmeta { font-size: 12px; color: var(--text-muted); }
  .qmeta a { color: inherit; }
  .accept {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; border: none;
    background: var(--grain); color: var(--on-grain); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .accept:disabled { opacity: 0.6; cursor: default; }
  .empty { text-align: center; color: var(--text-muted); padding: 48px 16px; font-size: 14px; }
</style>
