<script lang="ts">
  import NoticeStrip from '$lib/components/play/NoticeStrip.svelte';
  import type { Annotation } from '$lib/rules-engine';

  interface Props {
    initial: Annotation[];
  }

  let { initial }: Props = $props();

  // The strip's notices as the play screen would own them: they arrive and
  // leave as the engine re-evaluates, and the strip must follow. Capturing
  // the initial value once is the point.
  // svelte-ignore state_referenced_locally
  let notices = $state<Annotation[]>(initial);

  export function addNotice(notice: Annotation) {
    notices = [...notices, notice];
  }
</script>

<NoticeStrip {notices} />
