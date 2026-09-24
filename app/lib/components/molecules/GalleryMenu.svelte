<script lang="ts">
  /**
   * The overflow menu a gallery carries: report for any signed-in viewer,
   * edit and delete for the owner. Shared by GalleryCard and the detail
   * page's desktop split, which draws its own header instead of the card's,
   * so both offer the same actions. Renders nothing for a signed-out viewer,
   * since every item needs an account.
   */
  import type { Snippet } from 'svelte'
  import type { GalleryView } from '$hatk/client'
  import { callXrpc } from '$hatk/client'
  import { goto } from '$app/navigation'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { Trash2, Flag, Pencil } from 'lucide-svelte'
  import OverflowMenu from '../atoms/OverflowMenu.svelte'
  import ReportButton from './ReportButton.svelte'
  import { isAuthenticated, viewer } from '$lib/stores'
  import { profilePath, galleryPath } from '$lib/utils'

  /**
   * `extra` is for actions that belong to a context this component has no
   * business knowing about — a group pool's "remove from pool", which only
   * whoever acts as the group may do. Rendered above the owner's items, since
   * it is somebody else's authority over the same gallery.
   */
  let { gallery, extra }: { gallery: GalleryView; extra?: Snippet } = $props()

  const queryClient = useQueryClient()
  const isOwner = $derived($viewer?.did === gallery.creator?.did)
  const rkey = $derived(gallery.uri.split('/').pop() ?? '')

  let deleting = $state(false)
  let reportOpen = $state(false)

  async function deleteGallery() {
    if (deleting) return
    if (!confirm('Delete this gallery? This cannot be undone.')) return

    deleting = true
    try {
      await callXrpc('social.grain.unspecced.deleteGallery', { rkey })
      queryClient.invalidateQueries({ queryKey: ['getFeed'] })
      goto(profilePath(gallery.creator))
    } catch (err) {
      console.error('Failed to delete gallery:', err)
      alert('Failed to delete gallery. Please try again.')
    } finally {
      deleting = false
    }
  }
</script>

{#if $isAuthenticated}
  <OverflowMenu horizontal>
    <button class="menu-item" type="button" onclick={() => (reportOpen = true)}>
      <Flag size={15} />
      Report
    </button>
    {#if extra}
      <div class="menu-divider"></div>
      {@render extra()}
    {/if}
    {#if isOwner}
      <div class="menu-divider"></div>
      {#if $viewer?.did === 'did:plc:bcgltzqazw5tb6k2g3ttenbj'}
        <a class="menu-item" href="{galleryPath(gallery)}/edit">
          <Pencil size={15} />
          Edit gallery
        </a>
      {/if}
      <button class="menu-item delete" type="button" onclick={deleteGallery} disabled={deleting}>
        <Trash2 size={15} />
        Delete gallery
      </button>
    {/if}
  </OverflowMenu>
  <ReportButton subjectUri={gallery.uri} subjectCid={gallery.cid} showButton={false} bind:open={reportOpen} />
{/if}

<style>
  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 13px;
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s;
  }
  .menu-item:hover {
    background: var(--bg-hover);
  }
  .menu-item.delete {
    color: var(--danger);
  }
  .menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .menu-divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>
