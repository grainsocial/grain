<script lang="ts">
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import GalleryCard from '$lib/components/molecules/GalleryCard.svelte'
  import GalleryCardSkeleton from '$lib/components/molecules/GalleryCardSkeleton.svelte'
  import Avatar from '$lib/components/atoms/Avatar.svelte'
  import Button from '$lib/components/atoms/Button.svelte'
  import Field from '$lib/components/atoms/Field.svelte'
  import Input from '$lib/components/atoms/Input.svelte'
  import SettingsGroup from '$lib/components/atoms/SettingsGroup.svelte'
  import { callXrpc, type GalleryView } from '$hatk/client'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import { actorProfileQuery, privateGalleryQuery, spaceMembersQuery } from '$lib/queries'
  import { Lock } from 'lucide-svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { viewer } from '$lib/stores'

  const authority = $derived(page.params.authority ?? '')
  const skey = $derived(page.params.skey ?? '')
  const space = $derived(`at://${authority}/space/social.grain.gallery/${skey}`)

  const gallery = createQuery(() => privateGalleryQuery(space))
  const author = createQuery(() => actorProfileQuery(authority))
  const isAuthor = $derived($viewer?.did === authority)
  const members = createQuery(() => ({
    ...spaceMembersQuery(space),
    enabled: isAuthor && gallery.isSuccess,
  }))
  const queryClient = useQueryClient()

  // Never the CDN: the space hands a blob only to a credential holder, so these
  // come back through grain itself and are cached nowhere in between.
  function blobSrc(did: string, cid: string): string {
    return `/xrpc/social.grain.unspecced.getPrivateBlob?${new URLSearchParams({ space, did, cid })}`
  }

  /**
   * Shape the space's records into the view GalleryCard renders, so a private
   * gallery looks like every other one. Counts are absent rather than zero:
   * favorites and comments are public records, and this gallery is not, so
   * there is nothing to count.
   */
  const view = $derived.by((): GalleryView | null => {
    const data = gallery.data
    if (!data) return null
    return {
      uri: `at://${authority}/social.grain.gallery/${skey}`,
      cid: '',
      title: data.gallery?.title ?? 'Private gallery',
      description: data.gallery?.description,
      createdAt: data.gallery?.createdAt,
      creator: author.data ?? { did: authority },
      items: data.items.map((item) => ({
        uri: item.uri,
        cid: item.cid,
        thumb: blobSrc(item.did, item.cid),
        fullsize: blobSrc(item.did, item.cid),
        alt: item.alt,
        aspectRatio: item.aspectRatio,
      })),
    } as unknown as GalleryView
  })

  // The server tells these apart (SessionExpired, SpacesUnsupported,
  // NotAuthorized) but the client cannot see which: callXrpc throws
  // `XRPC <nsid> failed: <status>` and drops the body. So the page names all
  // three causes and offers the action that fixes the likeliest.
  //
  // FOLLOW-UP: once callXrpc carries the error name through, split these.

  let newMember = $state('')
  let adding = $state(false)
  let addError = $state<string | null>(null)

  async function addMember() {
    const did = newMember.trim()
    if (!did || adding) return
    if (!did.startsWith('did:')) {
      addError = 'A member is named by DID'
      return
    }
    adding = true
    addError = null
    try {
      await callXrpc('social.grain.unspecced.addSpaceMember', { space, did } as never)
      newMember = ''
      queryClient.invalidateQueries({ queryKey: ['spaceMembers', space] })
    } catch (err) {
      addError = err instanceof Error ? err.message : String(err)
    } finally {
      adding = false
    }
  }
</script>

<DetailHeader label={gallery.data?.gallery?.title ?? 'Private gallery'} />

<div class="detail-page">
  {#if gallery.isLoading}
    <GalleryCardSkeleton />
  {:else if gallery.isError}
    <p class="empty">
      This gallery didn't open. Either your session expired, or you're not on its list, or your PDS
      doesn't serve permissioned spaces. Signing in again fixes the first, and it's the most likely.
    </p>
    <div class="action">
      <Button
        onclick={() => goto(`/oauth/login?handle=${encodeURIComponent($viewer?.handle ?? '')}`)}
      >
        Sign in again
      </Button>
    </div>
  {:else if view}
    <div class="badge-row">
      <span class="badge"><Lock size={12} /> Private</span>
    </div>

    <GalleryCard gallery={view} privateGallery />

    {#if isAuthor}
      <div class="members">
        <SettingsGroup label="Shared with">
          {#each members.data?.members ?? [] as member (member.did)}
            <div class="member-row">
              <Avatar did={member.did} src={member.avatar} name={member.displayName ?? member.handle} size={28} />
              <span class="member-name">
                {member.displayName || (member.handle ? `@${member.handle}` : member.did)}
              </span>
            </div>
          {/each}
          {#if members.isSuccess && (members.data?.members ?? []).length === 0}
            <div class="member-row">
              <span class="member-name muted">Nobody yet. Only you can see this.</span>
            </div>
          {/if}
        </SettingsGroup>

        <Field label="Add someone">
          <Input bind:value={newMember} placeholder="did:plc:…" disabled={adding} />
        </Field>
        {#if addError}
          <p class="error">{addError}</p>
        {/if}
        <Button onclick={addMember} disabled={adding || !newMember.trim()}>
          {adding ? 'Adding…' : 'Share with this account'}
        </Button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .detail-page {
    max-width: 600px;
    margin: 0 auto;
  }
  .badge-row {
    padding: 12px 16px 0;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 999px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .members {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px 16px 32px;
  }
  .member-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
  }
  .member-row:not(:last-child) {
    border-bottom: 1px solid var(--border);
  }
  .member-name {
    font-size: 14px;
    color: var(--text-primary);
  }
  .member-name.muted {
    color: var(--text-muted);
  }
  .action {
    display: flex;
    justify-content: center;
    padding: 0 16px;
  }
  .empty {
    margin: 0;
    padding: 32px 16px;
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-muted);
    text-align: center;
  }
  .error {
    margin: 0;
    font-size: 13px;
    color: var(--danger);
  }
</style>
