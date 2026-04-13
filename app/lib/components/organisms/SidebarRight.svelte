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

  <div class="sidebar-card">
    <div class="sidebar-card-header">Feeds</div>
    {#each $pinnedFeeds as feed, i (feed.id)}
      {@const href = i === 0 ? '/' : feed.path}
      <a
        {href}
        class="sidebar-link"
        class:active={i === 0
          ? page.url.pathname === '/'
          : page.url.pathname + page.url.search === feed.path || page.url.pathname === feed.path}
      >
        <span class="sidebar-link-icon"><svelte:component this={feedIcon(feed)} size={16} /></span>
        <span class="sidebar-link-label">{feed.type === 'hashtag' ? feed.label.replace(/^#/, '') : feed.label}</span>
      </a>
    {/each}
    {#if $isAuthenticated}
      <a href="/feeds" class="sidebar-link more-feeds">
        <span class="sidebar-link-icon"><Plus size={16} /></span>
        <span class="sidebar-link-label">More feeds</span>
      </a>
    {/if}
  </div>

  {#if camerasQ.data?.length}
    <div class="sidebar-card">
      <div class="sidebar-card-header">Cameras</div>
      <div class="camera-grid">
        {#each (camerasQ.data ?? []).slice(0, 12) as c}
          <a class="camera-pill" href="/camera/{encodeURIComponent(c.camera)}">{c.camera}</a>
        {/each}
      </div>
    </div>
  {/if}

  {#if locationsQ.data?.length}
    <div class="sidebar-card">
      <div class="sidebar-card-header">Locations</div>
      <div class="camera-grid">
        {#each (locationsQ.data ?? []).slice(0, 12) as loc}
          <a class="camera-pill" href="/location/{encodeURIComponent(loc.h3Index)}?name={encodeURIComponent(loc.name)}">{loc.name}</a>
        {/each}
      </div>
    </div>
  {/if}

  <div class="sidebar-footer">
    <div class="footer-links">
      <a href="/support/terms">Terms</a>
      <a href="/support/privacy">Privacy</a>
      <a href="/support/copyright">Copyright</a>
      <a href="/support/community-guidelines">Guidelines</a>
    </div>
    <span>Powered by <a href="https://atproto.com">AT Protocol</a></span>
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
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 9px 16px 9px 36px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
  }
  .search-input::placeholder { color: var(--text-faint); }
  .search-input:focus { border-color: var(--grain); background: var(--bg-root); }
  .search-clear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
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

  .sidebar-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 14px;
  }
  .sidebar-card-header {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    padding: 12px 16px;
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.12s;
    text-decoration: none;
    min-width: 0;
  }
  .sidebar-link-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .sidebar-link:hover { background: var(--bg-hover); color: var(--text-primary); }
  .sidebar-link:last-child { border-radius: 0 0 14px 14px; }
  .sidebar-link.active { color: var(--grain); font-weight: 600; }
  .sidebar-link.more-feeds { color: var(--grain); font-size: 13px; }
  .sidebar-link-icon {
    width: 20px;
    font-size: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .camera-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 14px;
  }
  .camera-pill {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: var(--font-body);
    text-decoration: none;
  }
  .camera-pill:hover {
    border-color: var(--grain);
    color: var(--text-primary);
  }

  .sidebar-footer {
    padding: 12px 16px;
    font-size: 11px;
    color: var(--text-faint);
    line-height: 1.8;
  }
  .footer-links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-bottom: 4px;
  }
  .sidebar-footer a { color: var(--text-muted); text-decoration: none; }
  .sidebar-footer a:hover { text-decoration: underline; }

  @media (max-width: 1060px) { .sidebar-right { display: none; } }
</style>
