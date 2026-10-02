<script lang="ts">
  import { page } from '$app/state'

  interface Props {
    title: string
    description?: string
    image?: string
    imageAlt?: string
    /** Canonical URL. Defaults to the current path without its query, which is
        right for every page whose query only filters or tabs the same thing. */
    url?: string
    type?: 'website' | 'profile' | 'article'
    /** Keep the page out of search indexes: personal, private, labeled, or not found. */
    noindex?: boolean
    /** schema.org structured data, serialized into a JSON-LD script. */
    jsonLd?: Record<string, unknown>
  }

  let { title, description, image, imageAlt, url, type = 'website', noindex = false, jsonLd }: Props = $props()

  const DEFAULT_DESCRIPTION = 'Grain is a photo sharing app built on the AT Protocol. Share galleries, follow photographers, and own your data.'
  const DEFAULT_IMAGE = '/og-default.jpg'

  const origin = $derived(page.url.origin)
  const canonical = $derived(url ?? `${origin}${page.url.pathname}`)
  const desc = $derived(description ?? DEFAULT_DESCRIPTION)
  const absoluteImage = $derived.by(() => {
    const src = image ?? DEFAULT_IMAGE
    return src.startsWith('http') ? src : `${origin}${src}`
  })

  // Svelte ends this component's own script block at the first literal closing
  // tag it meets, even inside a string or a comment, so the tag name is
  // assembled. `<` in the payload is escaped so a title or bio cannot end the
  // tag either.
  const TAG = 'script'
  const jsonLdTag = $derived(
    jsonLd ? `<${TAG} type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</${TAG}>` : '',
  )
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={desc} />
  {#if noindex}
    <meta name="robots" content="noindex" />
  {:else}
    <meta name="robots" content="max-image-preview:large" />
    <link rel="canonical" href={canonical} />
  {/if}
  <meta property="og:site_name" content="Grain" />
  <meta property="og:type" content={type} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={desc} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={absoluteImage} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  {#if imageAlt}
    <meta property="og:image:alt" content={imageAlt} />
  {/if}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={desc} />
  <meta name="twitter:image" content={absoluteImage} />
  {#if jsonLdTag}
    {@html jsonLdTag}
  {/if}
</svelte:head>
