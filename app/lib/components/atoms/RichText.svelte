<script lang="ts">
  type Segment =
    | { type: 'text'; text: string }
    | { type: 'link'; text: string; href: string }
    | { type: 'mention'; text: string; handle: string }
    | { type: 'hashtag'; text: string; tag: string }

  let { text }: { text: string } = $props()

  const urlRe = /https?:\/\/[^\s<>[\]()]+/g
  const bareDomainRe = /(?<![/@\w.])([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/[^\s<>[\]()]*)?/g
  const mentionRe = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g
  const hashtagRe = /#([a-zA-Z][a-zA-Z0-9_]*)/g

  function parse(input: string): Segment[] {
    const segments: Segment[] = []
    const matches: { start: number; end: number; segment: Segment }[] = []

    for (const m of input.matchAll(urlRe)) {
      matches.push({
        start: m.index!,
        end: m.index! + m[0].length,
        segment: { type: 'link', text: m[0], href: m[0] },
      })
    }

    for (const m of input.matchAll(bareDomainRe)) {
      const start = m.index!
      const end = start + m[0].length
      if (matches.some((x) => start < x.end && end > x.start)) continue
      matches.push({
        start,
        end,
        segment: { type: 'link', text: m[0], href: `https://${m[0]}` },
      })
    }

    for (const m of input.matchAll(mentionRe)) {
      const start = m.index!
      const end = start + m[0].length
      if (matches.some((x) => start < x.end && end > x.start)) continue
      matches.push({
        start,
        end,
        segment: { type: 'mention', text: m[0], handle: m[0].slice(1) },
      })
    }

    for (const m of input.matchAll(hashtagRe)) {
      const start = m.index!
      const end = start + m[0].length
      if (matches.some((x) => start < x.end && end > x.start)) continue
      matches.push({
        start,
        end,
        segment: { type: 'hashtag', text: m[0], tag: m[1] },
      })
    }

    matches.sort((a, b) => a.start - b.start)

    let cursor = 0
    for (const m of matches) {
      if (m.start > cursor) {
        segments.push({ type: 'text', text: input.slice(cursor, m.start) })
      }
      segments.push(m.segment)
      cursor = m.end
    }
    if (cursor < input.length) {
      segments.push({ type: 'text', text: input.slice(cursor) })
    }

    return segments
  }

  const segments = $derived(parse(text))
</script>

{#each segments as seg}{#if seg.type === 'link'}<a href={seg.href} target="_blank" rel="noopener noreferrer" class="rich-link">{seg.text}</a>{:else if seg.type === 'mention'}<a href="/profile/{seg.handle}" class="rich-mention">{seg.text}</a>{:else if seg.type === 'hashtag'}<a href="/hashtags/{seg.tag}" class="rich-hashtag">{seg.text}</a>{:else}{seg.text}{/if}{/each}

<style>
  .rich-link, .rich-mention, .rich-hashtag {
    color: var(--grain);
    text-decoration: none;
  }
  .rich-link:hover, .rich-mention:hover, .rich-hashtag:hover {
    text-decoration: underline;
  }
</style>
