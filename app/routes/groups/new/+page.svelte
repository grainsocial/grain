<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Field from '$lib/components/atoms/Field.svelte'
  import Input from '$lib/components/atoms/Input.svelte'
  import Textarea from '$lib/components/atoms/Textarea.svelte'
  import SpacesRequired from '$lib/components/molecules/SpacesRequired.svelte'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { groupHostQuery, spaceSupportQuery } from '$lib/queries'
  import { createGroup } from '$lib/mutations'
  import { goto } from '$app/navigation'

  // A group is an account of its own, run by the people who start it. The
  // host creates it with you as its first admin and hands Grain a session on
  // it, so the group's pool and profile are set up here without you leaving.
  const MAX_NAME = 64
  const MAX_DESCRIPTION = 300

  const host = createQuery(() => groupHostQuery())
  const spaces = createQuery(() => spaceSupportQuery())
  const noSpaces = $derived(spaces.isSuccess && spaces.data?.supported !== true)
  const queryClient = useQueryClient()

  let displayName = $state('')
  let name = $state('')
  let nameTouched = $state(false)
  let description = $state('')
  let creating = $state(false)
  let error = $state<string | null>(null)

  // The handle follows the name until someone edits it.
  const slug = (s: string) =>
    s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63)
  $effect(() => {
    if (!nameTouched) name = slug(displayName)
  })

  const canCreate = $derived(displayName.trim().length > 0 && name.length > 0 && !creating)

  async function create() {
    if (!canCreate) return
    creating = true
    error = null
    try {
      const { did } = await createGroup(
        { name, displayName: displayName.trim(), ...(description.trim() ? { description: description.trim() } : {}) },
        queryClient,
      )
      goto(`/group/${did}`)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      creating = false
    }
  }
</script>

<OGMeta title="Start a group — grain" />
<DetailHeader label="Start a group" />

{#if noSpaces}
  <SpacesRequired />
{:else}
<div class="page">
  <p class="lede">
    A group has its own account and a pool its members post galleries into. You'll be its first
    admin.
  </p>

  <Field label="Name" count={displayName.length} max={MAX_NAME}>
    <Input bind:value={displayName} maxlength={MAX_NAME} placeholder="Coastal Film Club" />
  </Field>

  <Field label="Handle">
    <div class="handle">
      <Input bind:value={name} oninput={() => (nameTouched = true)} maxlength={63} placeholder="coastal-film-club" />
      <span class="domain">{host.data?.handleDomain ?? ''}</span>
    </div>
  </Field>

  <Field label="Description" count={description.length} max={MAX_DESCRIPTION}>
    <Textarea bind:value={description} maxlength={MAX_DESCRIPTION} rows={3} />
  </Field>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <Button onclick={create} disabled={!canCreate}>
    {creating ? 'Starting…' : 'Start the group'}
  </Button>
</div>
{/if}

<style>
  .page {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .lede { margin: 0; font-size: 13px; line-height: 1.45; color: var(--text-muted); }
  .handle { display: flex; align-items: center; gap: 6px; }
  .domain { font-size: 14px; color: var(--text-muted); white-space: nowrap; }
  .error { margin: -8px 0 0; font-size: 13px; color: var(--danger); }
</style>
