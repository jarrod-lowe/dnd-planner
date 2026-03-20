<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/styles/themes/light.css';
  import '$lib/styles/themes/dark.css';
  import '$lib/styles/base.css';
  import { configureAmplify } from '$lib/auth/cognito';
  import { authStore } from '$lib/auth/authStore.svelte';

  // Configure Amplify once on client-side mount
  onMount(() => {
    configureAmplify();
    authStore.initialize();
  });
</script>

<slot />
