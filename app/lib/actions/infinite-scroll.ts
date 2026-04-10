/** Svelte action: calls `onIntersect` when the element scrolls into view.
 *  The callback should guard against re-entry (e.g. check `!isFetchingNextPage`). */
export function infiniteScroll(node: HTMLElement, onIntersect: () => void) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        onIntersect()
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
