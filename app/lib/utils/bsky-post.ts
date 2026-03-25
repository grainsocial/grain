import { callXrpc } from '$hatk/client'
import { parseTextToFacets } from '$lib/utils/rich-text'

interface BskyPostOptions {
  url: string
  location?: {
    name: string
    address?: {
      locality?: string
      region?: string
      country?: string
    }
  } | null
  description?: string
  images: Array<{
    dataUrl: string
    alt?: string
    width: number
    height: number
  }>
}

export async function createBskyPost(options: BskyPostOptions): Promise<void> {
  const { url, location, description, images } = options

  const graphemeLength = (s: string) => [...new Intl.Segmenter().segment(s)].length

  const lines: string[] = []
  if (location) {
    lines.push(`📍 ${location.name}`)
    if (location.address) {
      const parts: string[] = []
      if (location.address.locality) parts.push(location.address.locality)
      if (location.address.region) parts.push(location.address.region)
      if (location.address.country) parts.push(location.address.country)
      if (parts.length > 0) lines.push(parts.join(', '))
    }
  }

  const suffix = `\n\n${url}\n\n#grainsocial`
  const prefixText = lines.length > 0 ? lines.join('\n') + '\n' : ''
  const overhead = graphemeLength(prefixText + suffix)
  const maxDesc = 300 - overhead

  if (description?.trim()) {
    let desc = description.trim()
    if (graphemeLength(desc) > maxDesc) {
      const segments = [...new Intl.Segmenter().segment(desc)]
      desc = segments.slice(0, Math.max(0, maxDesc - 1)).map((s) => s.segment).join('') + '…'
    }
    if (desc) {
      lines.push('')
      lines.push(desc)
    }
  }
  lines.push('')
  lines.push(url)
  lines.push('')
  lines.push('#grainsocial')

  const postText = lines.join('\n')

  const resolveHandle = async (handle: string): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
      )
      if (!res.ok) return null
      const data = await res.json()
      return data.did ?? null
    } catch {
      return null
    }
  }
  const postFacets = (await parseTextToFacets(postText, resolveHandle)).facets

  const imageRefs: Array<{ image: any; alt: string; aspectRatio?: { width: number; height: number } }> = []
  for (const img of images.slice(0, 4)) {
    const base64 = img.dataUrl.split(',')[1]
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const blob = new Blob([binary], { type: 'image/jpeg' })
    const uploadResult = await callXrpc('dev.hatk.uploadBlob', blob as any)
    imageRefs.push({
      image: (uploadResult as any).blob,
      alt: img.alt || '',
      aspectRatio: { width: img.width, height: img.height },
    })
  }

  await callXrpc('dev.hatk.createRecord', {
    collection: 'app.bsky.feed.post',
    record: {
      $type: 'app.bsky.feed.post',
      text: postText,
      facets: postFacets.length > 0 ? postFacets : undefined,
      embed: imageRefs.length > 0
        ? { $type: 'app.bsky.embed.images', images: imageRefs }
        : undefined,
      tags: ['grainsocial'],
      createdAt: new Date().toISOString(),
    },
  })
}
