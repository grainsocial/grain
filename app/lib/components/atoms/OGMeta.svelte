<script lang="ts">
  import { page } from '$app/state'

  interface Props {
    title: string
    description?: string
    image?: string
    url?: string
  }

  let { title, description, image, url }: Props = $props()

  const origin = $derived(page.url.origin)
  const absoluteImage = $derived(image ? (image.startsWith('http') ? image : `${origin}${image}`) : undefined)
</script>

<svelte:head>
  <title>{title}</title>
  <meta property="og:title" content={title} />
  {#if description}
    <meta property="og:description" content={description} />
    <meta name="description" content={description} />
  {/if}
  {#if absoluteImage}
    <meta property="og:image" content={absoluteImage} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
  {/if}
  {#if url}
    <meta property="og:url" content={url} />
  {/if}
</svelte:head>
