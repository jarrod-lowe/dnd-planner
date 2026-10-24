<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<!-- The two copies of a ticker line. The viewport — the element carrying the
     owning component's line classes plus `.ticker` and the `ticker` action —
     stays in the parent's template: Svelte 5 does not add a parent's scoping
     class to a child component's root, so a component that owned the line
     would silently shed the parent's typography (scoped rules would target an
     element that never receives the scope class). The copies carry only the
     global `.ticker__copy` utility, so child-ownership is harmless here.

     Both copies render the same snippet; the duplicate is the seamless-loop
     device (see @keyframes ticker-scroll in base.css) and is aria-hidden so
     screen readers never announce a clamped label twice. It is display:none
     until the action's [data-ticker] verdict lands, so a fitting label
     renders as the plain line it replaces. -->
<span class="ticker__copy">{@render children()}</span>
<span class="ticker__copy ticker__copy--dup" aria-hidden="true">{@render children()}</span>
