<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { viewer as viewerStore } from '$lib/stores'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import { Heart, UserPlus, MessageSquare, AtSign } from 'lucide-svelte'

  const queryClient = useQueryClient()
  const viewerDid = $derived($viewerStore?.did)

  interface NotifPref {
    push: boolean
    inApp: boolean
    from: 'all' | 'follows'
  }

  const defaultPrefs: Record<string, NotifPref> = {
    favorites: { push: true, inApp: true, from: 'all' },
    follows: { push: true, inApp: true, from: 'all' },
    comments: { push: true, inApp: true, from: 'all' },
    mentions: { push: true, inApp: true, from: 'all' },
  }

  const prefsQuery = createQuery(() => ({
    queryKey: ['notificationPrefs', viewerDid],
    queryFn: async () => {
      const res: any = await callXrpc('dev.hatk.getPreferences', {})
      return (res?.preferences?.notificationPrefs as Record<string, NotifPref>) ?? defaultPrefs
    },
    enabled: !!viewerDid,
    staleTime: Infinity,
  }))

  const prefs = $derived({ ...defaultPrefs, ...(prefsQuery.data ?? {}) })

  async function save(updated: Record<string, NotifPref>) {
    const previous = queryClient.getQueryData(['notificationPrefs', viewerDid])
    queryClient.setQueryData(['notificationPrefs', viewerDid], updated)
    try {
      await callXrpc('dev.hatk.putPreference', { key: 'notificationPrefs', value: updated })
    } catch {
      queryClient.setQueryData(['notificationPrefs', viewerDid], previous)
    }
  }

  function toggle(category: string, field: 'push' | 'inApp') {
    const current = { ...prefs }
    current[category] = { ...current[category], [field]: !current[category][field] }
    void save(current)
  }

  function setFrom(category: string, value: 'all' | 'follows') {
    const current = { ...prefs }
    current[category] = { ...current[category], from: value }
    void save(current)
  }

  const categories = [
    { key: 'favorites', label: 'Favorites', desc: 'When someone favorites your gallery or story', icon: Heart },
    { key: 'follows', label: 'New followers', desc: 'When someone follows you', icon: UserPlus },
    { key: 'comments', label: 'Comments', desc: 'When someone comments on your gallery or story', icon: MessageSquare },
    { key: 'mentions', label: 'Mentions', desc: 'When someone mentions you', icon: AtSign },
  ]

  let expandedCategory: string | null = $state(null)

  function toggleExpand(key: string) {
    expandedCategory = expandedCategory === key ? null : key
  }

  function summaryText(pref: NotifPref): string {
    const parts: string[] = []
    if (pref.inApp) parts.push('In-app')
    if (pref.push) parts.push('Push')
    if (parts.length === 0) parts.push('Off')
    parts.push(pref.from === 'all' ? 'Everyone' : 'Following')
    return parts.join(', ')
  }
</script>

<DetailHeader label="Notifications" />

<div class="settings-page">
  <div class="settings-group">
    {#each categories as cat (cat.key)}
      {@const pref = prefs[cat.key]}
      <button class="settings-row" onclick={() => toggleExpand(cat.key)}>
        <div class="row-icon">
          <cat.icon size={18} />
        </div>
        <div class="row-content">
          <span class="row-label">{cat.label}</span>
          <span class="row-summary">{summaryText(pref)}</span>
        </div>
        <span class="chevron" class:expanded={expandedCategory === cat.key}>&#x203A;</span>
      </button>
      {#if expandedCategory === cat.key}
        <div class="detail-panel">
          <p class="detail-desc">{cat.desc}</p>
          <label class="toggle-row">
            <span>Push notifications</span>
            <input type="checkbox" checked={pref.push} onchange={() => toggle(cat.key, 'push')} />
          </label>
          <label class="toggle-row">
            <span>In-app notifications</span>
            <input type="checkbox" checked={pref.inApp} onchange={() => toggle(cat.key, 'inApp')} />
          </label>
          <div class="divider"></div>
          <p class="from-label">From</p>
          <label class="radio-row">
            <input type="radio" name="from-{cat.key}" checked={pref.from === 'all'} onchange={() => setFrom(cat.key, 'all')} />
            <span>Everyone</span>
          </label>
          <label class="radio-row">
            <input type="radio" name="from-{cat.key}" checked={pref.from === 'follows'} onchange={() => setFrom(cat.key, 'follows')} />
            <span>People I follow</span>
          </label>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
  }
  .settings-group {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .settings-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    width: 100%;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.12s;
  }
  .settings-row:last-child {
    border-bottom: none;
  }
  .settings-row:hover {
    background: var(--bg-hover);
  }
  .row-icon {
    flex-shrink: 0;
    color: var(--text-secondary);
  }
  .row-content {
    flex: 1;
    min-width: 0;
  }
  .row-label {
    display: block;
    font-size: 15px;
    font-weight: 500;
  }
  .row-summary {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 1px;
  }
  .chevron {
    color: var(--text-muted);
    font-size: 20px;
    transition: transform 0.15s;
  }
  .chevron.expanded {
    transform: rotate(90deg);
  }
  .detail-panel {
    padding: 12px 16px 16px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elevated);
  }
  .detail-desc {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 12px;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    cursor: pointer;
  }
  .toggle-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--link);
  }
  .divider {
    height: 1px;
    background: var(--border);
    margin: 8px 0;
  }
  .from-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 6px;
  }
  .radio-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 14px;
    cursor: pointer;
  }
  .radio-row input[type="radio"] {
    accent-color: var(--link);
  }
</style>
