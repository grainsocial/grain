<script lang="ts">
  import { goto } from '$app/navigation'
  import { callXrpc } from '$hatk/client'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { parseInstagramExport, type ParsedPost } from '$lib/utils/instagram-import'
  import { resizeImage } from '$lib/utils/image-resize'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import { LoaderCircle, Check, ImageIcon, X } from 'lucide-svelte'
  import { viewer } from '$lib/stores'

  function galleryTitle(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  let step = $state<'select' | 'review' | 'importing' | 'done'>('select')
  let posts = $state<ParsedPost[]>([])
  let parsing = $state(false)
  let parseProgress = $state('')
  let error = $state<string | null>(null)
  let importProgress = $state({ current: 0, total: 0 })
  let importedCount = $state(0)
  let fileInput: HTMLInputElement = $state()!

  const selectedCount = $derived(posts.filter((p) => p.selected).length)
  const queryClient = useQueryClient()

  function openFilePicker() {
    fileInput?.click()
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!file.name.endsWith('.zip')) {
      error = 'Please select a .zip file from your Instagram export.'
      return
    }

    parsing = true
    error = null
    try {
      posts = await parseInstagramExport(file, (msg) => {
        parseProgress = msg
      })
      if (posts.length === 0) {
        error = 'No posts with photos found in this export.'
        return
      }
      step = 'review'
    } catch (err: any) {
      error = err.message || 'Failed to parse Instagram export.'
      console.error(err)
    } finally {
      parsing = false
    }
  }

  function togglePost(index: number) {
    posts[index].selected = !posts[index].selected
  }

  function selectAll() {
    for (const post of posts) post.selected = true
  }

  function deselectAll() {
    for (const post of posts) post.selected = false
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  async function importSelected() {
    const selected = posts.filter((p) => p.selected)
    if (selected.length === 0) return

    step = 'importing'
    importProgress = { current: 0, total: selected.length }
    importedCount = 0
    error = null

    for (const post of selected) {
      importProgress.current++
      try {
        const createdAt = post.createdAt.toISOString()
        const photoUris: string[] = []

        // Upload photos
        for (const photo of post.photos) {
          const base64 = photo.dataUrl.split(',')[1]
          const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
          const blob = new Blob([binary], { type: 'image/jpeg' })

          const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)

          const photoResult = await callXrpc('dev.hatk.createRecord', {
            collection: 'social.grain.photo',
            record: {
              photo: (uploadResult as any).blob,
              aspectRatio: { width: photo.width, height: photo.height },
              createdAt,
            },
          })
          photoUris.push((photoResult as any).uri as string)
        }

        // Create gallery
        const galleryResult = await callXrpc('dev.hatk.createRecord', {
          collection: 'social.grain.gallery',
          record: {
            title: galleryTitle(post.createdAt),
            ...(post.description.trim() ? { description: post.description.trim() } : {}),
            createdAt,
          },
        })
        const galleryUri = (galleryResult as any).uri as string

        // Create gallery items
        for (let i = 0; i < photoUris.length; i++) {
          await callXrpc('dev.hatk.createRecord', {
            collection: 'social.grain.gallery.item',
            record: {
              gallery: galleryUri,
              item: photoUris[i],
              position: i,
              createdAt,
            },
          })
        }

        importedCount++
      } catch (err: any) {
        console.error(`Failed to import post ${post.index}:`, err)
        error = `Failed on post ${importProgress.current} of ${importProgress.total}. ${importedCount} imported successfully.`
        step = 'review'
        return
      }
    }

    queryClient.invalidateQueries({ queryKey: ['getFeed'] })
    step = 'done'
  }
</script>

<DetailHeader label="Import from Instagram" onback={step === 'review' ? () => { step = 'select'; posts = [] } : undefined} />

<div class="import-page">
  {#if error}
    <p class="error">{error}</p>
  {/if}

  <!-- Step: Select File -->
  {#if step === 'select'}
    <div class="step-select">
      <input
        type="file"
        accept=".zip"
        bind:this={fileInput}
        onchange={handleFileSelected}
        style="display:none"
      />
      <div class="instructions">
        <h3>How to export from Instagram</h3>
        <ol>
          <li>Open Instagram and go to <strong>Settings and activity</strong></li>
          <li>Tap <strong>Your activity</strong>, then <strong>Download your information</strong></li>
          <li>Tap <strong>Request a download</strong></li>
          <li>Select your Instagram account</li>
          <li>Choose <strong>Select types of information</strong> and pick <strong>Posts</strong></li>
          <li>Choose <strong>Format: JSON</strong> and <strong>Media quality: High</strong></li>
          <li>Tap <strong>Create files</strong></li>
          <li>Wait for Instagram to email you the download link (can take up to 48 hours)</li>
          <li>Download the .zip file and select it below</li>
        </ol>
      </div>
      <button class="select-btn" onclick={openFilePicker} disabled={parsing}>
        {#if parsing}
          <LoaderCircle size={24} class="spin" />
          <span>{parseProgress}</span>
        {:else}
          <span>Select Instagram Export</span>
          <span class="hint">Choose the .zip file (JSON format)</span>
        {/if}
      </button>
    </div>

  <!-- Step: Review Posts -->
  {:else if step === 'review'}
    <div class="review-header">
      <div class="review-summary">
        <span class="count">{selectedCount} of {posts.length} posts selected</span>
        <div class="select-actions">
          <button class="text-btn" onclick={selectAll}>Select all</button>
          <button class="text-btn" onclick={deselectAll}>Deselect all</button>
        </div>
      </div>
      <Button disabled={selectedCount === 0} onclick={importSelected}>
        Import {selectedCount} {selectedCount === 1 ? 'post' : 'posts'}
      </Button>
    </div>

    <div class="post-list">
      {#each posts as post, i}
        <button
          class="post-card"
          class:deselected={!post.selected}
          type="button"
          onclick={() => togglePost(i)}
        >
          <div class="post-check">
            {#if post.selected}
              <div class="check-on"><Check size={14} /></div>
            {:else}
              <div class="check-off"></div>
            {/if}
          </div>
          <div class="post-content">
            <div class="photo-strip">
              {#each post.photos as photo}
                <img class="thumb" src={photo.dataUrl} alt="" />
              {/each}
            </div>
            <div class="post-meta">
              <span class="post-date">{formatDate(post.createdAt)}</span>
              <span class="post-photo-count">
                <ImageIcon size={12} />
                {post.photos.length}
              </span>
            </div>
            {#if post.description}
              <p class="post-description">{post.description}</p>
            {/if}
          </div>
        </button>
      {/each}
    </div>

  <!-- Step: Importing -->
  {:else if step === 'importing'}
    <div class="step-importing">
      <LoaderCircle size={32} class="spin" />
      <p class="importing-text">Importing {importProgress.current} of {importProgress.total}...</p>
      <p class="importing-sub">Please don't close this page.</p>
    </div>

  <!-- Step: Done -->
  {:else if step === 'done'}
    <div class="step-done">
      <div class="done-icon"><Check size={32} /></div>
      <p class="done-text">Imported {importedCount} {importedCount === 1 ? 'gallery' : 'galleries'}</p>
      <Button onclick={() => goto(`/profile/${$viewer?.did}`)}>View Profile</Button>
    </div>
  {/if}
</div>

<style>
  .import-page {
    max-width: 600px;
    margin: 0 auto;
    min-height: 100vh;
  }

  .error {
    color: #f87171;
    padding: 12px 16px;
    margin: 0;
    text-align: center;
    font-size: 14px;
  }

  /* Select step */
  .step-select {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px;
    gap: 24px;
  }
  .select-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--bg-hover);
    border: 2px dashed var(--border);
    border-radius: 16px;
    padding: 40px 48px;
    cursor: pointer;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    transition: border-color 0.15s;
  }
  .instructions {
    width: 100%;
    max-width: 400px;
  }
  .instructions h3 {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 12px;
  }
  .instructions ol {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .select-btn:hover { border-color: var(--grain); }
  .select-btn:disabled { cursor: not-allowed; opacity: 0.6; }
  .hint {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
  }

  /* Review step */
  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 46px;
    background: var(--bg-root);
    z-index: 10;
  }
  .review-summary {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .count {
    font-size: 14px;
    font-weight: 600;
  }
  .select-actions {
    display: flex;
    gap: 12px;
  }
  .text-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    font-family: inherit;
    color: var(--grain);
    cursor: pointer;
  }
  .text-btn:hover { opacity: 0.8; }

  /* Post list */
  .post-list {
    display: flex;
    flex-direction: column;
  }
  .post-card {
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border);
    transition: opacity 0.15s;
    width: 100%;
  }
  .post-card:hover {
    background: var(--bg-hover);
  }
  .post-card.deselected {
    opacity: 0.4;
  }
  .post-check {
    flex-shrink: 0;
    padding-top: 4px;
  }
  .check-on {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--grain);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .check-off {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--border);
  }
  .post-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .photo-strip {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .photo-strip::-webkit-scrollbar { display: none; }
  .thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .post-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .post-date {
    font-size: 12px;
    color: var(--text-muted);
  }
  .post-photo-count {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .post-description {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-wrap;
  }

  /* Importing step */
  .step-importing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 12px;
  }
  .importing-text {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
  .importing-sub {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  /* Done step */
  .step-done {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    gap: 16px;
  }
  .done-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--grain);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .done-text {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
