/** Svelte action: calls `onIntersect` when the element scrolls into view. */
export function infiniteScroll(node: HTMLElement, onIntersect: () => void) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        onIntersect()
        // Re-observe so it fires again if the sentinel stays in viewport
        // (e.g. when a page returns too few items to scroll it out of view)
        observer.unobserve(node)
        requestAnimationFrame(() => observer.observe(node))
      }
    },
    { rootMargin: '200px' },
  )
  observer.observe(node)
  return {
    update(newFn: () => void) { onIntersect = newFn },
    destroy() { observer.disconnect() },
  }
}
