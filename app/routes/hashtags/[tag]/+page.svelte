<script lang="ts">
  import FeedList from '$lib/components/organisms/FeedList.svelte'
  import DetailHeader from '$lib/components/molecules/DetailHeader.svelte'
  import PinButton from '$lib/components/atoms/PinButton.svelte'
  import { isAuthenticated } from '$lib/stores'
  import OGMeta from '$lib/components/atoms/OGMeta.svelte'

  let { data } = $props()
  const tag = $derived(data.tag)
</script>

<OGMeta title="#{tag} - grain" />
<DetailHeader label="#{tag}">
  {#snippet actions()}
    {#if $isAuthenticated}
      <PinButton feed={{ id: `hashtag:${tag}`, label: tag, type: 'hashtag', path: `/hashtags/${encodeURIComponent(tag)}` }} />
    {/if}
  {/snippet}
</DetailHeader>
<FeedList feed="hashtag" params={{ tag }} />
