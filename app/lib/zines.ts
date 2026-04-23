// Client-only mock store for zines. Persists drafts + published zines to localStorage.
// No PDS, no lexicon — this is a UX prototype.

import { browser } from '$app/environment'

export type ZineElement =
  | {
      id: string
      type: 'photo'
      x: number // % of canvas width (0..100)
      y: number
      w: number
      h: number
      src: string
      alt?: string
    }
  | {
      id: string
      type: 'text'
      x: number
      y: number
      w: number
      h: number
      text: string
      fontSize?: number // px at canvas width = 600
      align?: 'left' | 'center' | 'right'
      weight?: 'regular' | 'bold'
    }

export type ZinePage = {
  id: string
  bg?: string
  elements: ZineElement[]
}

export type Zine = {
  rkey: string
  title: string
  pages: ZinePage[]
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

const KEY = 'grain.zine.drafts.v1'

function readAll(): Record<string, Zine> {
  if (!browser) return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, Zine>) {
  if (!browser) return
  localStorage.setItem(KEY, JSON.stringify(map))
}

export function listZines(): Zine[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getZine(rkey: string): Zine | null {
  return readAll()[rkey] ?? null
}

export function saveZine(zine: Zine): Zine {
  const map = readAll()
  const next = { ...zine, updatedAt: new Date().toISOString() }
  map[zine.rkey] = next
  writeAll(map)
  return next
}

export function deleteZine(rkey: string) {
  const map = readAll()
  delete map[rkey]
  writeAll(map)
}

export function newZineId(): string {
  // pseudo-TID: 13 lowercase alnum chars
  const chars = 'abcdefghijklmnopqrstuvwxyz234567'
  let out = ''
  for (let i = 0; i < 13; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function newElementId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function createDraft(): Zine {
  const now = new Date().toISOString()
  return {
    rkey: newZineId(),
    title: '',
    pages: [blankPage()],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

export function blankPage(): ZinePage {
  return { id: newElementId(), elements: [] }
}

export function coverPage(title = 'Untitled'): ZinePage {
  return {
    id: newElementId(),
    elements: [
      {
        id: newElementId(),
        type: 'text',
        x: 10,
        y: 40,
        w: 80,
        h: 20,
        text: title,
        fontSize: 42,
        align: 'center',
        weight: 'bold',
      },
    ],
  }
}

export function textPage(): ZinePage {
  return {
    id: newElementId(),
    elements: [
      {
        id: newElementId(),
        type: 'text',
        x: 10,
        y: 15,
        w: 80,
        h: 70,
        text: 'Start writing...',
        fontSize: 18,
        align: 'left',
        weight: 'regular',
      },
    ],
  }
}

// ── Spreads ─────────────────────────────────────────────────────────
// First page = cover (alone). Remaining pages pair up into spreads.

export type Spread = {
  index: number // spread index (0-based)
  pages: ZinePage[] // 1 or 2 pages
  pageIndices: number[] // indices into zine.pages
}

export function computeSpreads(pages: ZinePage[]): Spread[] {
  if (pages.length === 0) return []
  const out: Spread[] = [{ index: 0, pages: [pages[0]], pageIndices: [0] }]
  for (let i = 1; i < pages.length; i += 2) {
    const left = pages[i]
    const right = pages[i + 1]
    out.push({
      index: out.length,
      pages: right ? [left, right] : [left],
      pageIndices: right ? [i, i + 1] : [i],
    })
  }
  return out
}

// ── Layout presets ──────────────────────────────────────────────────
// Each preset returns the elements to place on left / right page.
// Photos use placeholder src when no real photo is provided.

const PLACEHOLDER = ''

export type LayoutPreset =
  | 'fullBleedLeft'
  | 'fullBleedRight'
  | 'marginedSolo'
  | 'breathingRoom'
  | 'diptych'
  | 'photoText'
  | 'heroStack'
  | 'grid2x2'

export const LAYOUT_PRESETS: { id: LayoutPreset; name: string; desc: string }[] = [
  { id: 'fullBleedLeft', name: 'Full-bleed (left)', desc: 'Edge-to-edge photo on left' },
  { id: 'fullBleedRight', name: 'Full-bleed (right)', desc: 'Edge-to-edge photo on right' },
  { id: 'marginedSolo', name: 'Margined solo', desc: 'Centered photo with breathing room' },
  { id: 'breathingRoom', name: 'Asymmetric', desc: 'Photo left, blank right' },
  { id: 'diptych', name: 'Diptych', desc: 'One photo per page, juxtaposed' },
  { id: 'photoText', name: 'Photo + text', desc: 'Photo left, caption right' },
  { id: 'heroStack', name: 'Hero + stack', desc: 'Big photo + 3 small' },
  { id: 'grid2x2', name: 'Grid (2×2)', desc: 'Four small photos on one page' },
]

function photoEl(x: number, y: number, w: number, h: number, src = PLACEHOLDER): ZineElement {
  return { id: newElementId(), type: 'photo', x, y, w, h, src }
}
function textEl(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts: Partial<Extract<ZineElement, { type: 'text' }>> = {},
): ZineElement {
  return {
    id: newElementId(),
    type: 'text',
    x,
    y,
    w,
    h,
    text,
    fontSize: opts.fontSize ?? 16,
    align: opts.align ?? 'left',
    weight: opts.weight ?? 'regular',
  }
}

export function applyPreset(preset: LayoutPreset): { left: ZineElement[]; right: ZineElement[] } {
  switch (preset) {
    case 'fullBleedLeft':
      return { left: [photoEl(0, 0, 100, 100)], right: [] }
    case 'fullBleedRight':
      return { left: [], right: [photoEl(0, 0, 100, 100)] }
    case 'marginedSolo':
      return { left: [photoEl(10, 10, 80, 80)], right: [] }
    case 'breathingRoom':
      return { left: [photoEl(8, 15, 84, 70)], right: [] }
    case 'diptych':
      return { left: [photoEl(8, 15, 84, 70)], right: [photoEl(8, 15, 84, 70)] }
    case 'photoText':
      return {
        left: [photoEl(8, 10, 84, 80)],
        right: [
          textEl(12, 18, 76, 10, 'Caption', { fontSize: 22, weight: 'bold' }),
          textEl(12, 30, 76, 60, 'Write something about this photo…', { fontSize: 14 }),
        ],
      }
    case 'heroStack':
      return {
        left: [photoEl(0, 0, 100, 100)],
        right: [
          photoEl(10, 8, 80, 26),
          photoEl(10, 37, 80, 26),
          photoEl(10, 66, 80, 26),
        ],
      }
    case 'grid2x2':
      return {
        left: [
          photoEl(6, 6, 43, 43),
          photoEl(51, 6, 43, 43),
          photoEl(6, 51, 43, 43),
          photoEl(51, 51, 43, 43),
        ],
        right: [],
      }
  }
}
