<script lang="ts">
  // Desktop search. Slides out beside the nav so search is reachable from every
  // route — the typeahead used to live in the right rail, which is gone.
  import { Search, X } from 'lucide-svelte'
  import { goto } from '$app/navigation'
  import { callXrpc } from '$hatk/client'
  import Avatar from '../atoms/Avatar.svelte'

  let {
    open = $bindable(false),
    navWidth = '245px',
  }: { open?: boolean; navWidth?: string } = $props()

  let searchValue = $state('')
  let suggestions = $state<any[]>([])
  let activeIndex = $state(-1)
  let hasSearched = $state(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let inputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    if (open) inputEl?.focus()
    else reset()
  })

  function reset() {
    searchValue = ''
    suggestions = []
    activeIndex = -1
    hasSearched = false
  }

  function onInput() {
    const q = searchValue.trim()
    if (debounceTimer) clearTimeout(debounceTimer)
    if (!q || q.length < 2) {
      suggestions = []
      hasSearched = false
      return
    }
    debounceTimer = setTimeout(() => searchActors(q), 200)
  }

  async function searchActors(q: string) {
    try {
      const result = await callXrpc('social.grain.unspecced.searchActorsTypeahead', { q, limit: 8 })
      suggestions = result.actors || []
      activeIndex = -1
    } finally {
      hasSearched = true
    }
  }

  function submitSearch() {
    const q = searchValue.trim()
    if (!q) return
    open = false
    goto(`/search?q=${encodeURIComponent(q)}`)
  }

  function selectActor(actor: any) {
    open = false
    goto(`/profile/${actor.did}`)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      open = false
      return
    }
    const total = suggestions.length + 1 // +1 for the "search for …" row
    if (total <= 1) {
      if (e.key === 'Enter') {
        e.preventDefault()
        submitSearch()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = Math.min(activeIndex + 1, total - 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = Math.max(activeIndex - 1, -1)
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex > 0) selectActor(suggestions[activeIndex - 1])
        else submitSearch()
        break
    }
  }
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') open = false }} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scrim" style:--nav-w={navWidth} onclick={() => (open = false)}></div>

  <aside class="flyout" style:--nav-w={navWidth}>
    <h2 class="flyout-title">Search</h2>

    <div class="field">
      <span class="field-icon"><Search size={16} /></span>
      <input
        bind:this={inputEl}
        bind:value={searchValue}
        class="field-input"
        type="text"
        placeholder="Search people…"
        autocomplete="off"
        oninput={onInput}
        onkeydown={onKeydown}
      />
      {#if searchValue}
        <button class="field-clear" type="button" onclick={reset} aria-label="Clear search">
          <X size={14} />
        </button>
      {/if}
    </div>

    {#if searchValue.trim().length >= 2}
      <div class="results">
        <button
          class="row"
          class:active={activeIndex === 0}
          type="button"
          onclick={submitSearch}
        >
          <span class="row-icon"><Search size={20} /></span>
          <span class="row-name">{searchValue.trim()}</span>
        </button>

        {#each suggestions as actor, i (actor.did)}
          <button
            class="row"
            class:active={activeIndex === i + 1}
            type="button"
            onclick={() => selectActor(actor)}
          >
            <Avatar did={actor.did} src={actor.avatar ?? null} name={actor.displayName} size={36} />
            <span class="row-text">
              <span class="row-name">{actor.displayName || actor.handle || actor.did}</span>
              {#if actor.handle}<span class="row-handle">@{actor.handle}</span>{/if}
            </span>
          </button>
        {/each}

        {#if hasSearched && !suggestions.length}
          <p class="empty">No people found.</p>
        {/if}
      </div>
    {/if}
  </aside>
{/if}

<style>
  /* Stops short of the nav: the nav stays legible and clickable while the
     panel is open, which is the point of not collapsing it. */
  .scrim {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: calc(max(0px, (100vw - var(--shell-max)) / 2) + var(--nav-w));
    z-index: 120;
    background: rgba(0, 0, 0, 0.35);
  }
  .flyout {
    position: fixed;
    top: 0;
    bottom: 0;
    /* The shell is centred, so the nav's right edge is the shell's left margin
       plus the nav track — not just the nav width. Being fixed, this panel
       cannot inherit that from the shell, so it recomputes it. */
    left: calc(max(0px, (100vw - var(--shell-max)) / 2) + var(--nav-w));
    width: 392px;
    max-width: calc(100vw - var(--nav-w));
    z-index: 130;
    background: var(--bg-surface);
    box-shadow: 12px 0 34px rgba(0, 0, 0, 0.28);
    padding: 20px 14px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  .flyout-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.01em;
    margin: 0 6px;
  }
  .field { position: relative; }
  .field-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-faint);
    pointer-events: none;
    display: flex;
  }
  .field-input {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 34px 10px 36px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 14px;
    outline: none;
  }
  .field-input::placeholder { color: var(--text-faint); }
  .field-input:focus { border-color: var(--grain); }
  .field-clear {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
  }
  .field-clear:hover { color: var(--text-primary); }

  .results { display: flex; flex-direction: column; }
  .row {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 9px 8px;
    border: none;
    border-radius: 10px;
    background: none;
    cursor: pointer;
    text-align: left;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 14px;
  }
  .row:hover, .row.active { background: var(--bg-hover); }
  .row-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    flex: none;
  }
  .row-text { min-width: 0; display: flex; flex-direction: column; }
  .row-name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-handle {
    font-size: 12.5px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    font-size: 13px;
    color: var(--text-muted);
    padding: 10px 8px;
    margin: 0;
  }

  /* Mobile has its own full-screen search. */
  @media (max-width: 600px) {
    .scrim, .flyout { display: none; }
  }
</style>
