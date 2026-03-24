<script lang="ts">
  const urlRe = /https?:\/\/[^\s<>[\]()]+/g
  const bareDomainRe = /(?<![/@\w])([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/[^\s<>[\]()]*)?/g
  const mentionRe = /@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?/g
  const hashtagRe = /#([a-zA-Z][a-zA-Z0-9_]*)/g

  let {
    value = $bindable(''),
    placeholder = '',
    maxlength,
    rows = 3,
    disabled = false,
  }: {
    value?: string
    placeholder?: string
    maxlength?: number
    rows?: number
    disabled?: boolean
  } = $props()

  function highlight(input: string): string {
    if (!input) return ''
    const matches: { start: number; end: number; type: string }[] = []

    for (const m of input.matchAll(urlRe)) {
      matches.push({ start: m.index!, end: m.index! + m[0].length, type: 'link' })
    }
    for (const m of input.matchAll(bareDomainRe)) {
      const s = m.index!, e = s + m[0].length
      if (matches.some((x) => s < x.end && e > x.start)) continue
      matches.push({ start: s, end: e, type: 'link' })
    }
    for (const m of input.matchAll(mentionRe)) {
      const s = m.index!, e = s + m[0].length
      if (matches.some((x) => s < x.end && e > x.start)) continue
      matches.push({ start: s, end: e, type: 'mention' })
    }
    for (const m of input.matchAll(hashtagRe)) {
      const s = m.index!, e = s + m[0].length
      if (matches.some((x) => s < x.end && e > x.start)) continue
      matches.push({ start: s, end: e, type: 'hashtag' })
    }

    matches.sort((a, b) => a.start - b.start)

    let result = ''
    let cursor = 0
    for (const m of matches) {
      if (m.start > cursor) result += esc(input.slice(cursor, m.start))
      result += `<span class="hl-${m.type}">${esc(input.slice(m.start, m.end))}</span>`
      cursor = m.end
    }
    if (cursor < input.length) result += esc(input.slice(cursor))
    // Trailing newline needs a space so the overlay height matches
    if (result.endsWith('\n')) result += ' '
    return result
  }

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  let el: HTMLTextAreaElement = $state()!

  function autoResize() {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function syncScroll() {
    const backdrop = el?.previousElementSibling as HTMLElement | null
    if (backdrop) {
      backdrop.scrollTop = el.scrollTop
      backdrop.scrollLeft = el.scrollLeft
    }
  }

  $effect(() => {
    value;
    autoResize();
  })

  const highlighted = $derived(highlight(value))
</script>

<div class="rich-textarea-wrap">
  <div class="backdrop" aria-hidden="true">{@html highlighted || `<span class="placeholder">${esc(placeholder)}</span>`}</div>
  <textarea
    bind:this={el}
    bind:value
    {placeholder}
    {maxlength}
    {rows}
    {disabled}
    class="input"
    oninput={() => { autoResize(); syncScroll(); }}
    onscroll={syncScroll}
  ></textarea>
</div>

<style>
  .rich-textarea-wrap {
    position: relative;
    width: 100%;
  }
  .backdrop, .input {
    font-family: inherit;
    font-size: 16px;
    line-height: 1.5;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 100%;
    box-sizing: border-box;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    color: var(--text-primary);
    pointer-events: none;
    overflow: hidden;
    background: none;
    border-color: transparent;
  }
  .backdrop :global(.hl-link),
  .backdrop :global(.hl-mention),
  .backdrop :global(.hl-hashtag) {
    color: var(--grain);
  }
  .backdrop :global(.placeholder) {
    color: var(--text-muted);
  }
  .input {
    position: relative;
    background: none;
    color: transparent;
    caret-color: var(--text-primary);
    resize: none;
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .input:focus {
    outline: none;
    border-color: var(--grain);
  }
  .input::placeholder {
    color: transparent;
  }
  .input:disabled {
    opacity: 0.5;
  }
</style>
