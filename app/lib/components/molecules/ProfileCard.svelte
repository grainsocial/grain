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

<a href="/profile/{profile.did}" class="profile-card">
  <Avatar did={profile.did} src={profile.avatar ?? null} size={40} />
  <div class="profile-card-info">
    <div class="profile-card-name">{profile.displayName || (profile.handle ? `@${profile.handle}` : truncDid(profile.did))}</div>
    {#if profile.handle}<div class="profile-card-handle">@{profile.handle}</div>{/if}
    {#if profile.description}<div class="profile-card-bio"><RichText text={profile.description} /></div>{/if}
  </div>
</a>

<style>
  .profile-card {
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
  .profile-card-name { font-weight: 600; font-size: 15px; }
  .profile-card-handle { font-size: 13px; color: var(--text-muted); }
  .profile-card-bio {
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
