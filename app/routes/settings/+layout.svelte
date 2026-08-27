<script lang="ts">
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import {
    User,
    Fingerprint,
    Pencil,
    Sun,
    Bell,
    Shield,
    Lock,
    Download,
    FileText,
  } from 'lucide-svelte'

  let { children }: { children: Snippet } = $props()

  // On a phone this stays a drill-down: the list is the /settings page, and a
  // child route takes over the screen. On desktop both panes are on at once.
  const isIndex = $derived(page.url.pathname === '/settings')

  type Item = { href: string; label: string; icon: typeof User; badge?: string }

  const groups: { label: string; items: Item[] }[] = [
    {
      label: 'You',
      items: [
        { href: '/settings', label: 'Accounts', icon: User },
        { href: '/settings/account', label: 'Identity & data', icon: Fingerprint },
        { href: '/settings/profile', label: 'Edit profile', icon: Pencil },
      ],
    },
    {
      label: 'Preferences',
      items: [
        { href: '/settings/appearance', label: 'Appearance', icon: Sun },
        { href: '/settings/notifications', label: 'Notifications', icon: Bell },
        { href: '/settings/moderation', label: 'Moderation', icon: Shield },
        { href: '/settings/upload-defaults', label: 'Upload defaults', icon: Lock },
      ],
    },
    {
      label: 'Tools',
      items: [
        { href: '/settings/import', label: 'Import from Instagram', icon: Download, badge: 'Beta' },
      ],
    },
  ]

  const legal = [
    { href: '/support/privacy', label: 'Privacy Policy' },
    { href: '/support/terms', label: 'Terms of Service' },
    { href: '/support/copyright', label: 'Copyright Policy' },
    { href: '/support/community-guidelines', label: 'Community Guidelines' },
  ]

  function isActive(href: string) {
    return href === '/settings'
      ? page.url.pathname === '/settings'
      : page.url.pathname.startsWith(href)
  }
</script>

<div class="settings-shell" class:index={isIndex}>
  <aside class="settings-nav">
    {#each groups as group (group.label)}
      <div class="group">
        <h2 class="group-label">{group.label}</h2>
        {#each group.items as item (item.href)}
          {@const Icon = item.icon}
          <a href={item.href} class="sub-item" class:active={isActive(item.href)}>
            <Icon size={18} />
            <span>{item.label}</span>
            {#if item.badge}<span class="badge">{item.badge}</span>{/if}
          </a>
        {/each}
      </div>
    {/each}

    <div class="group">
      <h2 class="group-label">About</h2>
      {#each legal as item (item.href)}
        <a href={item.href} class="sub-item">
          <FileText size={18} />
          <span>{item.label}</span>
        </a>
      {/each}
    </div>
  </aside>

  <div class="settings-pane">
    {@render children()}
  </div>
</div>

<style>
  .settings-shell {
    display: flex;
    flex-direction: column;
  }
  /* Phone: the index shows its content then the list, matching the drill-down
     this page has always had. A child route hides the list entirely. */
  .settings-pane { order: 1; }
  .settings-nav { order: 2; padding: 0 8px 24px; }
  .settings-shell:not(.index) .settings-nav { display: none; }

  .group { display: flex; flex-direction: column; }
  .group-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 18px 0 6px;
    padding: 0 12px;
  }
  .sub-item {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    transition: background 0.12s, color 0.12s;
  }
  .sub-item :global(svg) { flex: none; }
  .badge {
    margin-left: auto;
    flex: none;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--grain);
    background: var(--grain-glow);
    border-radius: 999px;
    padding: 2px 7px;
  }
  .sub-item:hover { background: var(--bg-hover); color: var(--text-primary); }
  .sub-item.active {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  @media (min-width: 900px) {
    .settings-shell,
    .settings-shell:not(.index) {
      display: grid;
      grid-template-columns: 236px minmax(0, 1fr);
      align-items: start;
      gap: 32px;
      padding: 8px 16px 40px;
    }
    .settings-shell .settings-nav,
    .settings-shell:not(.index) .settings-nav {
      order: 0;
      display: block;
      position: sticky;
      top: 8px;
      padding: 0;
    }
    .settings-pane { order: 0; min-width: 0; }
  }
</style>
