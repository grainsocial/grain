import { unzipSync } from 'fflate'
import { resizeImage } from './image-resize'

export interface InstagramMedia {
  uri: string
  creation_timestamp: number
  media_metadata?: {
    camera_metadata?: { has_camera_metadata: boolean }
  }
}

export interface InstagramPost {
  media: InstagramMedia[]
  title: string
  creation_timestamp: number
}

export interface ParsedPost {
  index: number
  description: string
  createdAt: Date
  photos: ParsedPhoto[]
  selected: boolean
}

export interface ParsedPhoto {
  dataUrl: string
  width: number
  height: number
  originalUri: string
}

/**
 * Instagram exports store UTF-8 text as Latin-1 byte values.
 * Each UTF-8 byte is stored as a separate Latin-1 character.
 * Decode by treating each char code as a byte and re-decoding as UTF-8.
 */
function decodeInstagramText(text: string): string {
  try {
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i)
    }
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return text
  }
}

function fileToDataUrl(data: Uint8Array, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([data as BlobPart], { type: mimeType })
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function getMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

export async function parseInstagramExport(
  file: File,
  onProgress?: (message: string) => void,
): Promise<ParsedPost[]> {
  onProgress?.('Reading zip file...')
  const buffer = await file.arrayBuffer()
  const files = unzipSync(new Uint8Array(buffer))

  // Find posts JSON
  onProgress?.('Finding posts...')
  const postsKey = Object.keys(files).find(
    (k) => k.includes('media/posts_1.json') || k.includes('media/posts.json'),
  )
  if (!postsKey) {
    throw new Error('Could not find posts JSON in the Instagram export. Make sure you selected the JSON format export.')
  }

  const postsJson = new TextDecoder().decode(files[postsKey])
  const posts: InstagramPost[] = JSON.parse(postsJson)

  const parsed: ParsedPost[] = []

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    onProgress?.(`Processing post ${i + 1} of ${posts.length}...`)

    const photos: ParsedPhoto[] = []
    for (const media of post.media) {
      // Only process images (skip videos)
      const ext = media.uri.split('.').pop()?.toLowerCase()
      if (ext === 'mp4' || ext === 'mov' || ext === 'avi') continue

      const mediaData = files[media.uri]
      if (!mediaData) continue

      const mimeType = getMimeType(media.uri)
      const rawDataUrl = await fileToDataUrl(mediaData, mimeType)

      // Resize through existing pipeline
      const resized = await resizeImage(rawDataUrl, {
        width: 2000,
        height: 2000,
        maxSize: 900_000,
      })

      photos.push({
        dataUrl: resized.dataUrl,
        width: resized.width,
        height: resized.height,
        originalUri: media.uri,
      })
    }

    if (photos.length === 0) continue

    parsed.push({
      index: i,
      description: decodeInstagramText(post.title || '').slice(0, 1000),
      createdAt: new Date(post.creation_timestamp * 1000),
      photos,
      selected: true,
    })
  }

  return parsed
}
