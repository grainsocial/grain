<script lang="ts">
  import type { CommentView } from '$hatk/client'
  import { callXrpc } from '$hatk/client'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { viewer, requireAuth } from '$lib/stores'
  import { parseTextToFacets } from '$lib/utils/rich-text'
  import CommentItem from '../molecules/Comment.svelte'
  import Avatar from '../atoms/Avatar.svelte'
  import { X, LoaderCircle } from 'lucide-svelte'

  let {
    open = false,
    subjectUri,
    onClose,
    contained = false,
  }: {
    open: boolean
    subjectUri: string
    onClose: () => void
    contained?: boolean
  } = $props()

  let comments = $state<CommentView[]>([])
  let totalCount = $state(0)
  let cursor = $state<string | undefined>(undefined)
  let loading = $state(false)
  let loadingMore = $state(false)
  let posting = $state(false)
  let inputValue = $state('')
  let replyToUri = $state<string | null>(null)
  let replyToHandle = $state<string | null>(null)
  let error = $state<string | null>(null)
  let inputEl = $state<HTMLInputElement | null>(null)
  let sheetEl = $state<HTMLDivElement | null>(null)

  const queryClient = useQueryClient()

  // Organize comments: roots first, then their replies
  const organized = $derived.by(() => {
    const roots = comments.filter((c) => !c.replyTo)
    const replyMap = new Map<string, CommentView[]>()
    for (const c of comments) {
      if (c.replyTo) {
        if (!replyMap.has(c.replyTo)) replyMap.set(c.replyTo, [])
        replyMap.get(c.replyTo)!.push(c)
      }
    }
    const result: CommentView[] = []
    for (const root of roots) {
      result.push(root)
      const replies = replyMap.get(root.uri) ?? []
      result.push(...replies)
    }
    return result
  })

  // Constrain sheet to center column on desktop
  $effect(() => {
    if (!open || !sheetEl || contained) return
    const col = sheetEl.closest('main')
    if (!col) return
    function position() {
      const rect = col!.getBoundingClientRect()
      sheetEl!.style.left = `${rect.left}px`
      sheetEl!.style.right = `${document.documentElement.clientWidth - rect.right}px`
    }
    position()
    window.addEventListener('resize', position)
    return () => window.removeEventListener('resize', position)
  })

  // Load comments when sheet opens
  $effect(() => {
    if (open && subjectUri) {
      loadComments()
    }
  })

  async function loadComments() {
    loading = true
    error = null
    try {
      const res = await callXrpc('social.grain.unspecced.getCommentThread', {
        subject: subjectUri,
        limit: 20,
      } as any)
      comments = (res as any).comments ?? []
      cursor = (res as any).cursor
      totalCount = (res as any).totalCount ?? 0
    } catch (err: any) {
      error = 'Failed to load comments'
      console.error(err)
    } finally {
      loading = false
    }
  }

  async function loadMore() {
    if (!cursor || loadingMore) return
    loadingMore = true
    try {
      const res = await callXrpc('social.grain.unspecced.getCommentThread', {
        subject: subjectUri,
        limit: 20,
        cursor,
      } as any)
      const older = (res as any).comments ?? []
      comments = [...older, ...comments]
      cursor = (res as any).cursor
    } catch (err: any) {
      console.error(err)
    } finally {
      loadingMore = false
    }
  }

  async function handlePost() {
    if (!requireAuth()) return
    if (!inputValue.trim() || posting) return
    posting = true
    error = null

    try {
      const text = inputValue.trim()
      const now = new Date().toISOString()

      // Parse facets
      const parsed = await parseTextToFacets(text)
      const facets = parsed.facets.length > 0 ? parsed.facets : undefined

      const result = await callXrpc('dev.hatk.createRecord', {
        collection: 'social.grain.comment',
        record: {
          text,
          subject: subjectUri,
          ...(facets ? { facets } : {}),
          ...(replyToUri ? { replyTo: replyToUri } : {}),
          createdAt: now,
        },
      })

      // Optimistic add
      const newComment: CommentView = {
        uri: (result as any).uri,
        cid: (result as any).cid,
        text,
        facets,
        author: {
          did: $viewer!.did,
          handle: $viewer!.handle ?? $viewer!.did,
          displayName: $viewer!.displayName,
          avatar: $viewer!.avatar ?? undefined,
          cid: '',
        },
        replyTo: replyToUri ?? undefined,
        createdAt: now,
      } as any

      comments = [...comments, newComment]
      totalCount++
      inputValue = ''
      replyToUri = null
      replyToHandle = null

      // Invalidate feed queries to update comment counts
      queryClient.invalidateQueries({ queryKey: ['getFeed'], refetchType: 'none' })
    } catch (err: any) {
      error = 'Failed to post comment'
      console.error(err)
    } finally {
      posting = false
    }
  }

  async function handleDelete(uri: string) {
    const rkey = uri.split('/').pop()!
    try {
      await callXrpc('dev.hatk.deleteRecord', {
        collection: 'social.grain.comment',
        rkey,
      })
      comments = comments.filter((c) => c.uri !== uri)
      totalCount--
      queryClient.invalidateQueries({ queryKey: ['getFeed'], refetchType: 'none' })
    } catch (err: any) {
      console.error('Failed to delete comment:', err)
    }
  }

  function handleReply(uri: string, handle: string) {
    replyToUri = uri
    replyToHandle = handle
    inputValue = `@${handle} `
    inputEl?.focus()
  }

  function cancelReply() {
    replyToUri = null
    replyToHandle = null
    inputValue = ''
  }
</script>

{#if open}
  {#if !contained}
    <div class="overlay" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="button" tabindex="-1"></div>
  {/if}
  <div class="sheet" class:contained bind:this={sheetEl}>
    <div class="sheet-header">
      <span class="sheet-title">Comments ({totalCount})</span>
      <button class="close-btn" onclick={onClose}>
        <X size={20} />
      </button>
    </div>

    <div class="comment-list">
      {#if cursor}
        <button class="load-more" onclick={loadMore} disabled={loadingMore}>
          {#if loadingMore}
            <LoaderCircle size={14} class="spin" /> Loading...
          {:else}
            Load earlier comments
          {/if}
        </button>
      {/if}

      {#if loading}
        <div class="empty"><LoaderCircle size={24} class="spin" /></div>
      {:else if organized.length === 0}
        <div class="empty">No comments yet. Be the first!</div>
      {:else}
        {#each organized as comment (comment.uri)}
          <CommentItem {comment} onReply={handleReply} onDelete={handleDelete} />
        {/each}
      {/if}
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    {#if replyToHandle}
      <div class="reply-bar">
        <span>Replying to @{replyToHandle}</span>
        <button class="cancel-reply" onclick={cancelReply}>
          <X size={14} />
        </button>
      </div>
    {/if}

    <div class="input-bar">
      {#if $viewer}
        <Avatar did={$viewer.did} src={$viewer.avatar} size={28} />
      {/if}
      <div class="input-wrapper">
        <input
          type="text"
          placeholder="Add a comment..."
          bind:value={inputValue}
          bind:this={inputEl}
          disabled={posting}
          onkeydown={(e) => e.key === 'Enter' && handlePost()}
        />
        <button class="send-btn" onclick={handlePost} disabled={!inputValue.trim() || posting}>
          {#if posting}
            <LoaderCircle size={14} class="spin" />
          {:else}
            Post
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }
  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 70vh;
    background: var(--bg-root);
    border-radius: 16px 16px 0 0;
    z-index: 201;
    display: flex;
    flex-direction: column;
  }
  .sheet.contained {
    position: absolute;
    max-height: 60%;
    background: rgba(30, 30, 30, 0.95);
    backdrop-filter: blur(12px);
    z-index: 20;
  }
  .sheet.contained .sheet-header,
  .sheet.contained .input-bar,
  .sheet.contained .reply-bar {
    border-color: rgba(255, 255, 255, 0.1);
  }
  @media (max-width: 600px) {
    .sheet:not(.contained) {
      bottom: calc(50px + env(safe-area-inset-bottom, 0px));
    }
  }
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .sheet-title {
    font-weight: 600;
    font-size: 16px;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 4px;
    display: flex;
  }

  .comment-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
  }
  .empty {
    text-align: center;
    color: var(--text-muted);
    padding: 32px 0;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .load-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px;
    margin-bottom: 8px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .load-more:hover { background: var(--bg-hover); }
  .load-more:disabled { opacity: 0.5; cursor: not-allowed; }

  .error {
    color: #f87171;
    font-size: 13px;
    text-align: center;
    margin: 0;
    padding: 8px 16px;
  }

  .reply-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg-hover);
    font-size: 13px;
    color: var(--text-secondary);
    border-top: 1px solid var(--border);
  }
  .cancel-reply {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    display: flex;
  }

  .input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .input-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    background: var(--bg-hover);
    border-radius: 20px;
    padding: 6px 6px 6px 14px;
  }
  .input-wrapper input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-size: 16px;
    color: var(--text-primary);
    font-family: inherit;
  }
  .input-wrapper input::placeholder {
    color: var(--text-muted);
  }
  .send-btn {
    background: none;
    border: none;
    color: var(--grain);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    padding: 4px 8px;
    font-family: inherit;
    display: flex;
    align-items: center;
  }
  .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
