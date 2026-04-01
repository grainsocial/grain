<script lang="ts">
  import { login, createAccount } from '$lib/auth'
  import Modal from '../atoms/Modal.svelte'
  import Button from '../atoms/Button.svelte'

  let { open = $bindable(false) }: { open: boolean } = $props()

  let handle = $state('')
  let submitting = $state(false)
  let suggestions = $state<any[]>([])
  let activeIndex = $state(-1)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let inputEl: HTMLInputElement | undefined = $state()

  $effect(() => {
    if (open && inputEl) inputEl.focus()
  })

  async function submit() {
    if (!handle.trim() || submitting) return
    suggestions = []
    submitting = true
    try {
      await login(handle.trim())
    } catch (err: any) {
      alert('Login failed: ' + err.message)
      submitting = false
    }
  }

  function onInput() {
    const q = handle.trim()
    if (debounceTimer) clearTimeout(debounceTimer)
    if (!q || q.length < 2) {
      suggestions = []
      return
    }
    debounceTimer = setTimeout(() => search(q), 200)
  }

  async function search(q: string) {
    try {
      const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(q)}&limit=5`
      const res = await fetch(url)
      if (!res.ok) return
      const json = await res.json()
      suggestions = json.actors || []
      activeIndex = -1
    } catch {
      // ignore search errors
    }
  }

  function select(actor: any) {
    handle = actor.handle
    suggestions = []
    activeIndex = -1
  }

  function onKeydown(e: KeyboardEvent) {
    if (suggestions.length === 0) {
      if (e.key === 'Enter') submit()
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        activeIndex = Math.min(activeIndex + 1, suggestions.length - 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        activeIndex = Math.max(activeIndex - 1, 0)
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0) {
          select(suggestions[activeIndex])
        } else {
          submit()
        }
        break
      case 'Escape':
        e.preventDefault()
        suggestions = []
        break
    }
  }

  function onFocusout() {
    setTimeout(() => { suggestions = [] }, 150)
  }
</script>

<Modal bind:open title="Log in with your internet handle">
  <p class="subtitle">Enter the domain you use as your identity across the open social web. <a href="https://internethandle.org" target="_blank" rel="noopener noreferrer" class="link">Learn more</a></p>
  <div class="input-wrapper">
    <input
      type="text"
      placeholder="e.g. jasmine.garden"
      bind:value={handle}
      bind:this={inputEl}
      oninput={onInput}
      onkeydown={onKeydown}
      onfocusout={onFocusout}
      autocomplete="off"
    />
    {#if suggestions.length > 0}
      <ul class="suggestions" role="listbox">
        {#each suggestions as actor, i}
          <li
            class="suggestion-item"
            class:active={i === activeIndex}
            onmousedown={(e) => { e.preventDefault(); select(actor) }}
            role="option"
            aria-selected={i === activeIndex}
          >
            <div class="suggestion-avatar">
              {#if actor.avatar}
                <img src={actor.avatar} alt="" />
              {/if}
            </div>
            <div class="suggestion-info">
              <div class="suggestion-handle">@{actor.handle}</div>
              {#if actor.displayName}
                <div class="suggestion-name">{actor.displayName}</div>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <p class="legal-links">
    By signing in you agree to our <a href="/support/terms" onclick={() => (open = false)}>Terms</a>,
    <a href="/support/privacy" onclick={() => (open = false)}>Privacy Policy</a>, and
    <a href="/support/community-guidelines" onclick={() => (open = false)}>Community Guidelines</a>.
  </p>
  <div class="actions">
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button variant="primary" disabled={submitting} onclick={submit}>
      {submitting ? 'Signing in\u2026' : 'Sign in'}
    </Button>
  </div>
  <div class="create-account">
    <span class="create-account-text">Don't have an account?</span>
    <button class="create-account-link" onclick={createAccount}>Create one</button>
  </div>
</Modal>

<style>
  .subtitle { font-size: 13px; color: var(--text-muted); margin-bottom: 20px; }
  .link { color: var(--grain); }
  .input-wrapper {
    position: relative;
    margin-bottom: 16px;
  }
  input {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 16px;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus { border-color: var(--grain); }
  .suggestions {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin: 4px 0 0;
    padding: 4px;
    list-style: none;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    max-height: 240px;
    overflow-y: auto;
    z-index: 10;
  }
  .suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s;
  }
  .suggestion-item:hover, .suggestion-item.active {
    background: var(--bg-hover);
  }
  .suggestion-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-elevated);
    flex-shrink: 0;
    overflow: hidden;
  }
  .suggestion-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .suggestion-info {
    min-width: 0;
    flex: 1;
  }
  .suggestion-handle {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .suggestion-name {
    font-size: 12px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 12px; }
  .create-account { text-align: center; font-size: 13px; }
  .create-account-text { color: var(--text-muted); }
  .create-account-link {
    background: none;
    border: none;
    color: var(--grain);
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-body);
    padding: 0;
    text-decoration: none;
  }
  .create-account-link:hover { text-decoration: underline; }
  .legal-links {
    font-size: 11px;
    color: var(--text-faint);
    margin-bottom: 14px;
    line-height: 1.5;
  }
  .legal-links a { color: var(--text-muted); text-decoration: none; }
  .legal-links a:hover { text-decoration: underline; }
</style>
