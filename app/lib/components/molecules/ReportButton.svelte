<script lang="ts">
  import { callXrpc } from '$hatk/client'
  import { createQuery } from '@tanstack/svelte-query'
  import { Flag, LoaderCircle } from 'lucide-svelte'
  import Modal from '../atoms/Modal.svelte'
  import Button from '../atoms/Button.svelte'
  import { labelDefsQuery } from '$lib/labels'

  let {
    subjectUri,
    subjectCid,
    variant = 'default',
    showButton = true,
    open: openProp = $bindable(false),
    onopen,
    onclose,
  }: {
    subjectUri: string
    subjectCid: string
    variant?: 'default' | 'overlay'
    showButton?: boolean
    open?: boolean
    onopen?: () => void
    onclose?: () => void
  } = $props()

  let open = $state(false)

  $effect(() => {
    if (openProp && !open) {
      openModal()
      openProp = false
    }
  })
  let label = $state('')
  let reason = $state('')
  let submitting = $state(false)
  let submitted = $state(false)
  let error = $state<string | null>(null)

  const labelsQuery = createQuery(() => labelDefsQuery())
  const labelDefs = $derived(labelsQuery.data ?? [])

  let wasOpen = false
  $effect.pre(() => {
    if (wasOpen && !open) onclose?.()
    wasOpen = open
  })

  function openModal() {
    label = labelDefs[0]?.identifier ?? ''
    reason = ''
    error = null
    submitted = false
    open = true
    onopen?.()
  }

  function defName(def: { identifier: string; locales?: Array<{ name: string }> }): string {
    return def.locales?.[0]?.name ?? def.identifier
  }

  async function submit() {
    if (!label || submitting) return
    submitting = true
    error = null
    try {
      await callXrpc('dev.hatk.createReport', {
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: subjectUri,
          cid: subjectCid,
        },
        label,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      })
    submitted = true
    } catch (err) {
      console.error('Report submission failed:', err)
      error = 'Failed to submit report. Please try again.'
    } finally {
      submitting = false
    }
  }
</script>

{#if showButton}
<button
  class={variant === 'overlay' ? 'overlay-btn' : 'stat'}
  type="button"
  onclick={(e) => { e.stopPropagation(); openModal() }}
  aria-label="Report"
  title="Report"
>
  <Flag size={variant === 'overlay' ? 20 : 18} />
</button>
{/if}

<Modal bind:open title={submitted ? 'Report Submitted' : 'Report Content'}>
  {#if submitted}
    <p class="success">Thank you. Your report has been submitted for review.</p>
    <div class="actions">
      <Button onclick={() => (open = false)}>Done</Button>
    </div>
  {:else}
    <div class="form">
      <label class="field">
        <span class="field-label">Category</span>
        <select bind:value={label}>
          {#each labelDefs as def}
            <option value={def.identifier}>{defName(def)}</option>
          {/each}
        </select>
      </label>
      <label class="field">
        <span class="field-label">Details (optional)</span>
        <textarea bind:value={reason} rows={3} maxlength={2000} placeholder="Provide additional context..."></textarea>
      </label>
      {#if error}
        <p class="error">{error}</p>
      {/if}
      <div class="actions">
        <Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
        <Button onclick={submit} disabled={submitting || !label}>
          {#if submitting}
            <LoaderCircle size={14} class="spin" /> Submitting...
          {:else}
            Submit Report
          {/if}
        </Button>
      </div>
    </div>
  {/if}
</Modal>

<style>
  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    font-size: 13px;
    transition: opacity 0.15s;
  }
  .stat:hover {
    opacity: 0.7;
  }
  .overlay-btn {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 4px;
    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  select,
  textarea {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  select:focus,
  textarea:focus {
    border-color: var(--grain);
  }
  textarea {
    resize: vertical;
    min-height: 60px;
  }
  .error {
    color: #f87171;
    font-size: 13px;
    margin: 0;
  }
  .success {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0 0 16px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
