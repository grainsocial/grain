<script lang="ts">
  import { Search, Plus, X } from 'lucide-svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { pinnedFeeds, feedIcon } from '$lib/preferences'
  import { isAuthenticated } from '$lib/stores'
  import { createQuery } from '@tanstack/svelte-query'
  import { camerasQuery, locationsQuery } from '$lib/queries'
  import { callXrpc } from '$hatk/client'
  import Avatar from '../atoms/Avatar.svelte'

  const camerasQ = createQuery(() => camerasQuery())
  const locationsQ = createQuery(() => locationsQuery())

  let searchValue = $state('')
  let suggestions = $state<any[]>([])
  let activeIndex = $state(-1)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let showSuggestions = $state(false)
  let hasSearched = $state(false)

  function onInput() {
    const q = searchValue.trim()
    if (debounceTimer) clearTimeout(debounceTimer)
    if (!q || q.length < 2) {
      suggestions = []
      showSuggestions = false
      hasSearched = false
      return
    }
    showSuggestions = true
    debounceTimer = setTimeout(() => searchActors(q), 200)
  }

  async function searchActors(q: string) {
    try {
      const result = await callXrpc('social.grain.unspecced.searchActorsTypeahead', { q, limit: 8 })
      suggestions = result.actors || []
      activeIndex = -1
      hasSearched = true
    } catch {
      hasSearched = true
    }
  }

  function submitSearch() {
    const q = searchValue.trim()
    if (!q) return
    suggestions = []
    showSuggestions = false
    goto(`/search?q=${encodeURIComponent(q)}`)
  }

  function selectActor(actor: any) {
    suggestions = []
    showSuggestions = false
    searchValue = ''
    goto(`/profile/${actor.did}`)
  }

  function clearSearch() {
    searchValue = ''
    suggestions = []
    showSuggestions = false
  }

  function onKeydown(e: KeyboardEvent) {
    const totalItems = suggestions.length + 1 // +1 for "search for" row
    if (!showSuggestions || totalItems <= 1) {
      if (e.key === 'Enter') { e.preventDefault(); submitSearch() }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = Math.min(activeIndex + 1, totalItems - 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = Math.max(activeIndex - 1, -1)
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex === 0) {
          submitSearch()
        } else if (activeIndex > 0) {
          selectActor(suggestions[activeIndex - 1])
        } else {
          submitSearch()
        }
        break
      case 'Escape':
        e.preventDefault()
        showSuggestions = false
        break
    }
  }

  function onFocusout() {
    setTimeout(() => { showSuggestions = false }, 150)
  }

  function onFocusin() {
    if (searchValue.trim().length >= 2 && suggestions.length > 0) {
      showSuggestions = true
    }
  }
</script>

<aside class="sidebar-right">
  <div class="search-wrapper">
    <span class="search-icon"><Search size={16} /></span>
    <input
      type="text"
      class="search-input"
      placeholder="Search..."
      bind:value={searchValue}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocusout={onFocusout}
      onfocusin={onFocusin}
      autocomplete="off"
    />
    {#if searchValue}
      <button class="search-clear" type="button" onclick={clearSearch}><X size={14} /></button>
    {/if}
    {#if showSuggestions && searchValue.trim() && hasSearched}
      <div class="suggestions">
        <button
          class="suggestion-item search-row"
          class:active={activeIndex === 0}
          type="button"
          onmousedown={(e) => { e.preventDefault(); submitSearch() }}
        >
          <span class="suggestion-search-icon"><Search size={22} /></span>
          <span>{searchValue.trim()}</span>
        </button>
        {#each suggestions as actor, i}
          <button
            class="suggestion-item"
            class:active={activeIndex === i + 1}
            type="button"
            onmousedown={(e) => { e.preventDefault(); selectActor(actor) }}
          >
            <div class="suggestion-avatar">
              {#if actor.avatar}
                <img src={actor.avatar} alt="" />
              {:else}
                <Avatar did={actor.did} src={null} size={32} />
              {/if}
            </div>
            <div class="suggestion-info">
              <div class="suggestion-name">{actor.displayName || actor.handle || actor.did?.slice(0, 18)}</div>
              {#if actor.handle}
                <div class="suggestion-handle">@{actor.handle}</div>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <section class="sidebar-section">
    <h2 class="sidebar-section-header">Feeds</h2>
    {#each $pinnedFeeds as feed, i (feed.id)}
      {@const href = i === 0 ? '/' : feed.path}
      {@const FeedIcon = feedIcon(feed)}
      <a
        {href}
        class="sidebar-link"
        class:active={i === 0
          ? page.url.pathname === '/'
          : page.url.pathname + page.url.search === feed.path || page.url.pathname === feed.path}
      >
        <span class="sidebar-link-icon"><FeedIcon size={16} /></span>
        <span class="sidebar-link-label">{feed.type === 'hashtag' ? feed.label.replace(/^#/, '') : feed.label}</span>
      </a>
    {/each}
    {#if $isAuthenticated}
      <a href="/feeds" class="sidebar-link more-feeds">
        <span class="sidebar-link-icon"><Plus size={16} /></span>
        <span class="sidebar-link-label">More feeds</span>
      </a>
    {/if}
  </section>

  {#if camerasQ.data?.length}
    <section class="sidebar-section">
      <h2 class="sidebar-section-header">Cameras</h2>
      {#each (camerasQ.data ?? []).slice(0, 7) as c}
        <a class="sidebar-list-item" href="/camera/{encodeURIComponent(c.camera)}">{c.camera}</a>
      {/each}
      {#if (camerasQ.data ?? []).length > 7}
        <a class="sidebar-see-all" href="/cameras">See all →</a>
      {/if}
    </section>
  {/if}

  {#if locationsQ.data?.length}
    <section class="sidebar-section">
      <h2 class="sidebar-section-header">Locations</h2>
      {#each (locationsQ.data ?? []).slice(0, 7) as loc}
        <a class="sidebar-list-item" href="/location/{encodeURIComponent(loc.h3Index)}?name={encodeURIComponent(loc.name)}">{loc.name}</a>
      {/each}
      {#if (locationsQ.data ?? []).length > 7}
        <a class="sidebar-see-all" href="/locations">See all →</a>
      {/if}
    </section>
  {/if}

  <div class="sidebar-footer">
    <a href="/support/terms">Terms</a>
    <span class="dot">·</span>
    <a href="/support/privacy">Privacy</a>
    <span class="dot">·</span>
    <a href="/support/copyright">Copyright</a>
    <span class="dot">·</span>
    <a href="/support/community-guidelines">Guidelines</a>
    <span class="dot">·</span>
    <a href="https://atproto.com">AT Protocol</a>
  </div>
</aside>

<style>
  .sidebar-right {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .sidebar-right::-webkit-scrollbar { width: 0; }

  .search-wrapper { position: relative; }
  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    font-size: 14px;
    pointer-events: none;
    display: flex;
    align-items: center;
  }
  .search-input {
    width: 100%;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 36px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  .search-input::placeholder { color: var(--text-faint); }
  .search-input:focus { border-color: var(--grain); }
  .search-icon { left: 12px; }
  .search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
  }
  .search-clear:hover { color: var(--text-primary); }
  .suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    z-index: 100;
  }
  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    transition: background 0.1s;
    text-align: left;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 14px;
  }
  .suggestion-item:hover, .suggestion-item.active { background: var(--bg-hover); }
  .search-row { font-weight: 500; }
  .suggestion-search-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }
  .suggestion-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--bg-elevated);
  }
  .suggestion-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .suggestion-info { min-width: 0; flex: 1; }
  .suggestion-name {
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .suggestion-handle {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-section {
    display: flex;
    flex-direction: column;
  }
  .sidebar-section-header {
    margin: 0 0 6px;
    padding: 0 4px;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.12s;
    text-decoration: none;
    min-width: 0;
    border-radius: 4px;
  }
  .sidebar-link-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .sidebar-link:hover { color: var(--text-primary); }
  .sidebar-link.active { color: var(--grain); font-weight: 600; }
  .sidebar-link.more-feeds { color: var(--grain); font-size: 13px; }
  .sidebar-link-icon {
    width: 20px;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sidebar-list-item {
    display: block;
    padding: 6px 4px;
    font-size: 14px;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.12s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sidebar-list-item:hover { color: var(--text-primary); }

  .sidebar-see-all {
    display: block;
    padding: 6px 4px;
    margin-top: 2px;
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.12s;
  }
  .sidebar-see-all:hover { color: var(--grain); }

  .sidebar-footer {
    padding: 4px 4px 12px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-faint);
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .sidebar-footer .dot { color: var(--text-faint); }
  .sidebar-footer a { color: var(--text-muted); text-decoration: none; }
  .sidebar-footer a:hover { color: var(--text-primary); }

  @media (max-width: 1060px) { .sidebar-right { display: none; } }
</style>
