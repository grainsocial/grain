<script lang="ts">
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { callXrpc } from '$hatk/client'
  import { viewer } from '$lib/stores'
  import { actorProfileQuery } from '$lib/queries'
  import { readFileAsDataURL, resizeImage } from '$lib/utils/image-resize'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import AvatarCrop from '$lib/components/molecules/AvatarCrop.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Field from '$lib/components/atoms/Field.svelte'
  import Input from '$lib/components/atoms/Input.svelte'
  import RichTextarea from '$lib/components/atoms/RichTextarea.svelte'
  import Toast from '$lib/components/atoms/Toast.svelte'
  import { Camera, LoaderCircle, Trash2 } from 'lucide-svelte'

  let displayName = $state('')
  let description = $state('')
  let avatarPreview = $state<string | null>(null)
  let existingAvatarBlob = $state<any>(null)
  let newAvatarDataUrl = $state<string | null>(null)
  let avatarRemoved = $state(false)
  let showCrop = $state(false)
  let cropSrc = $state('')
  let saving = $state(false)
  let showToast = $state(false)
  let loaded = $state(false)
  let fileInput: HTMLInputElement = $state()!

  const profile = createQuery(() => actorProfileQuery($viewer?.did ?? ''))
  const queryClient = useQueryClient()

  $effect(() => {
    if (loaded || !profile.data) return
    const p = profile.data as any
    displayName = p.displayName || ''
    description = p.description || ''
    avatarPreview = p.avatar || null
    loaded = true
  })


  // Fetch raw record to preserve existing avatar blob ref on putRecord
  $effect(() => {
    const did = $viewer?.did
    if (!did) return
    callXrpc('dev.hatk.getRecord', {
      uri: `at://${did}/social.grain.actor.profile/self`,
    }).then((raw: any) => {
      existingAvatarBlob = raw?.record?.value?.avatar ?? null
    }).catch(() => {})
  })

  function openFilePicker() {
    fileInput?.click()
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const dataUrl = await readFileAsDataURL(file)
    const resized = await resizeImage(dataUrl, { width: 2000, height: 2000, maxSize: 900_000 })
    cropSrc = resized.dataUrl
    showCrop = true
  }

  function handleCrop(dataUrl: string) {
    newAvatarDataUrl = dataUrl
    avatarPreview = dataUrl
    avatarRemoved = false
    showCrop = false
  }

  function removeAvatar() {
    newAvatarDataUrl = null
    avatarPreview = null
    avatarRemoved = true
  }

  async function save() {
    if (saving || !$viewer) return
    saving = true

    try {
      let avatarBlob: any = undefined

      if (newAvatarDataUrl) {
        const base64 = newAvatarDataUrl.split(',')[1]
        const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const blob = new Blob([binary], { type: 'image/jpeg' })
        const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)
        avatarBlob = (uploadResult as any).blob
      }

      const record: Record<string, unknown> = {
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
        createdAt: new Date().toISOString(),
      }

      if (avatarBlob) {
        record.avatar = avatarBlob
      } else if (!avatarRemoved && existingAvatarBlob) {
        record.avatar = existingAvatarBlob
      }

      await callXrpc('dev.hatk.putRecord', {
        collection: 'social.grain.actor.profile',
        rkey: 'self',
        record,
      })

      queryClient.invalidateQueries({ queryKey: ['actorProfile', $viewer.did] })

      // Update local viewer store
      $viewer = {
        ...$viewer,
        displayName: displayName.trim() || $viewer.handle || '',
        avatar: avatarPreview,
      }

      showToast = true
    } catch (err: any) {
      alert(err.message || 'Failed to save profile')
    } finally {
      saving = false
    }
  }
</script>

<input
  type="file"
  accept="image/png,image/jpeg"
  bind:this={fileInput}
  onchange={handleFileSelected}
  style="display:none"
/>

{#if showCrop}
  <AvatarCrop src={cropSrc} onCrop={handleCrop} onCancel={() => (showCrop = false)} />
{/if}

<DetailHeader label="Edit Profile" />

<div class="edit-page">
  <div class="avatar-section">
    <button class="avatar-wrapper" onclick={openFilePicker}>
      <Avatar did={$viewer?.did ?? ''} src={avatarPreview} name={displayName} size={96} />
      <div class="avatar-overlay">
        <Camera size={20} />
      </div>
    </button>
    {#if avatarPreview && !avatarRemoved}
      <button class="remove-avatar" onclick={removeAvatar}>
        <Trash2 size={14} /> Remove
      </button>
    {/if}
  </div>

  <div class="form">
    <Field label="Display Name" count={displayName.length} max={64} showCount="always">
      <Input type="text" placeholder="Your name" maxlength={64} bind:value={displayName} />
    </Field>
    <Field label="Bio" count={description.length} max={256}>
      <RichTextarea placeholder="Tell us about yourself" maxlength={256} bind:value={description} rows={4} />
    </Field>
  </div>

  <div class="actions">
    <Button onclick={save} disabled={saving}>
      {#if saving}
        <LoaderCircle size={16} class="spin" /> Saving...
      {:else}
        Save
      {/if}
    </Button>
  </div>
</div>

<Toast message="Profile saved" bind:visible={showToast} />

<style>
  .edit-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 24px 16px;
  }
  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
  }
  .avatar-wrapper {
    position: relative;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    border-radius: 50%;
  }
  .avatar-overlay {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .avatar-wrapper:hover .avatar-overlay {
    opacity: 1;
  }
  .remove-avatar {
    display: flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .remove-avatar:hover { color: #f87171; }
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .actions {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
  }
  .actions :global(.btn) {
    padding: 10px 28px;
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
