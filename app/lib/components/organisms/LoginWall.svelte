<script lang="ts">
  // Shown to signed-out visitors once they have scrolled a way into a profile.
  //
  // Deliberately scroll-triggered rather than server-rendered: crawlers and
  // link unfurlers do not scroll, so the page stays fully indexable and a
  // shared profile link still previews. Only a real reader who keeps going
  // sees it.
  import { onMount } from 'svelte'
  import { afterNavigate } from '$app/navigation'
  import Avatar from '../atoms/Avatar.svelte'
  import Button from '../atoms/Button.svelte'
  import { loginModalOpen } from '$lib/stores'

  let {
    /** Viewport heights of scrolling before the wall appears. */
    after = 1.4,
    did = '',
    avatar = null,
    name = null,
    handle = null,
  }: {
    after?: number
    did?: string
    avatar?: string | null
    name?: string | null
    handle?: string | null
  } = $props()

  let shown = $state(false)
  let threshold = 0
  let scroller: HTMLElement | null = null

  // Below 600px the shell makes main.col-center a fixed, self-scrolling pane,
  // so the window never scrolls and a window listener would never fire. Watch
  // whichever element actually moves.
  function findScroller(): HTMLElement | null {
    const pane = document.querySelector('main.col-center') as HTMLElement | null
    return pane && getComputedStyle(pane).position === 'fixed' ? pane : null
  }

  function position() {
    return scroller ? scroller.scrollTop : window.scrollY
  }

  function viewportHeight() {
    return scroller ? scroller.clientHeight : window.innerHeight
  }

  function check() {
    if (!shown && position() > threshold) shown = true
  }

  function listen() {
    scroller?.removeEventListener('scroll', check)
    window.removeEventListener('scroll', check)
    scroller = findScroller()
    threshold = viewportHeight() * after
    ;(scroller ?? window).addEventListener('scroll', check, { passive: true })
  }

  onMount(() => {
    listen()
    check()
    window.addEventListener('resize', listen)
    return () => {
      scroller?.removeEventListener('scroll', check)
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', listen)
    }
  })

  // Navigating between two profiles keeps this component alive, so the wall
  // would still be up on arrival. Reset every navigation: each profile is
  // worth a fresh scroll before being asked to sign in.
  afterNavigate(() => {
    shown = false
    listen()
    requestAnimationFrame(check)
  })

  // Freeze the page behind the wall — scrolling on would just show more of what
  // the wall is gating.
  $effect(() => {
    if (!shown) return
    const root = document.documentElement
    const pane = scroller
    const prev = [root.style.overflow, document.body.style.overflow, pane?.style.overflow]
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    if (pane) pane.style.overflow = 'hidden'
    // Hides the mobile sign-in bar — the wall is the call to action now.
    document.body.classList.add('wall-open')
    return () => {
      document.body.classList.remove('wall-open')
      root.style.overflow = prev[0]!
      document.body.style.overflow = prev[1]!
      if (pane) pane.style.overflow = prev[2]!
    }
  })
</script>

{#if shown}
  <div class="wall" role="dialog" aria-modal="true" aria-labelledby="wall-title">
    <div class="wall-card">
      {#if did}
        <Avatar {did} src={avatar} {name} size={72} />
      {:else}
        <span class="wall-logo">grain</span>
      {/if}
      <h2 id="wall-title">Sign in to keep looking</h2>
      <p>Sign in with your Atmosphere account to see more{#if handle}{' '}from <strong>@{handle}</strong>{/if}, follow photographers and share your own work.</p>
      <Button onclick={() => ($loginModalOpen = true)}>Sign in</Button>
      <a class="wall-home" href="/">Back to grain</a>
    </div>
  </div>
{/if}

<style>
  .wall {
    position: fixed;
    inset: 0;
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.7);
  }
  .wall-card {
    width: 100%;
    max-width: 460px;
    margin: 0 16px;
    padding: 30px 28px 26px;
    border-radius: 18px;
    background: var(--bg-surface);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .wall-logo {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 26px;
    letter-spacing: -0.02em;
  }
  h2 {
    font-size: 17px;
    font-weight: 700;
    margin: 2px 0 0;
  }
  p {
    font-size: 13.5px;
    line-height: 1.5;
    color: var(--text-secondary);
    margin: 0 0 6px;
    max-width: 34ch;
  }
  .wall-home {
    font-size: 13px;
    color: var(--text-muted);
    text-decoration: none;
    margin-top: 2px;
  }
  .wall-home:hover { color: var(--text-primary); }

  p strong { color: var(--text-primary); font-weight: 600; }
</style>
