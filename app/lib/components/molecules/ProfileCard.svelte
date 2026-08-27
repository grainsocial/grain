<script lang="ts">
  import Avatar from '../atoms/Avatar.svelte'
  import RichText from '../atoms/RichText.svelte'
  import { truncDid } from '$lib/utils'

  let { profile }: {
    profile: {
      did: string
      handle?: string
      displayName?: string
      description?: string
      avatar?: string
    }
  } = $props()
</script>

<div class="profile-card">
  <Avatar did={profile.did} src={profile.avatar ?? null} name={profile.displayName ?? profile.handle} size={40} />
  <div class="profile-card-info">
    <a href="/profile/{profile.did}" class="profile-card-name"
      >{profile.displayName || (profile.handle ? `@${profile.handle}` : truncDid(profile.did))}</a
    >
    {#if profile.handle}<div class="profile-card-handle">@{profile.handle}</div>{/if}
    {#if profile.description}<div class="profile-card-bio"><RichText text={profile.description} /></div>{/if}
  </div>
</div>

<style>
  .profile-card {
    position: relative;
    display: flex;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    transition: background 0.12s;
    text-decoration: none;
    color: inherit;
  }
  .profile-card:hover { background: var(--bg-hover); }
  .profile-card-info { flex: 1; min-width: 0; }
  .profile-card-name {
    font-weight: 600;
    font-size: 15px;
    color: inherit;
    text-decoration: none;
  }
  /* Stretched link: covers the card so the whole row is clickable, without
     making the card itself an anchor. */
  .profile-card-name::after {
    content: '';
    position: absolute;
    inset: 0;
  }
  .profile-card-handle { font-size: 13px; color: var(--text-muted); }
  /* Sits above the stretched link so its own links stay clickable. */
  .profile-card-bio {
    position: relative;
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
