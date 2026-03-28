<script lang="ts">
  import { authStore } from '$lib/auth/authStore.svelte';
  import { characterStore } from '$lib/character/characterStore.svelte';
  import LandingPage from '$lib/components/LandingPage.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import SelectCharacterMode from '$lib/components/character/SelectCharacterMode.svelte';
  import PlayCharacterMode from '$lib/components/character/PlayCharacterMode.svelte';
  import CreateCharacterDialog from '$lib/components/character/CreateCharacterDialog.svelte';
  import ManageRulesMode from '$lib/components/character/ManageRulesMode.svelte';
  import { t } from '$lib/i18n';
  const title = $derived($t('app.title'));
  let showDialog = $state(false);
  let isCreating = $state(false);
  let createError = $state<string | null>(null);
  let hasLoadedCharacters = $state(false);
  let manageRulesActive = $state(false);

  // Load characters when authentication state changes to authenticated
  $effect(() => {
    if (authStore.state.isAuthenticated && !hasLoadedCharacters) {
      hasLoadedCharacters = true;
      characterStore.loadCharacters();
    }
  });

  async function handleCreateCharacter(name: string, species: string) {
    isCreating = true;
    createError = null;
    try {
      await characterStore.createCharacter(name, species);
      showDialog = false;
    } catch {
      createError = $t('character.createError');
    } finally {
      isCreating = false;
    }
  }

  function handleClearCreateError() {
    createError = null;
  }

  const canCreateCharacter = $derived(authStore.hasGroup('MayCreateCharacters'));
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

{#if authStore.state.isLoading}
  <div id="main-content" class="loading-screen" aria-live="polite" aria-busy="true">
    <div class="loading-spinner" aria-hidden="true"></div>
    <span>{$t('layout.loading')}</span>
  </div>
{:else if !authStore.state.isAuthenticated}
  <LandingPage onLogin={() => authStore.login()} />
{:else}
  <div class="app-layout">
    <TopBar
      email={authStore.state.email}
      onLogout={() => authStore.logout()}
      version="v0.0.0"
      selectedCharacter={characterStore.state.selectedCharacter}
      showManageRules={!!characterStore.state.selectedCharacter && !manageRulesActive}
      onManageRules={() => {
        manageRulesActive = true;
      }}
    />
    <main id="main-content" class="app-layout__body">
      {#if characterStore.state.selectedCharacter}
        {#if manageRulesActive}
          <ManageRulesMode
            character={characterStore.state.selectedCharacter}
            onBack={() => {
              manageRulesActive = false;
            }}
          />
        {:else}
          <PlayCharacterMode
            character={characterStore.state.selectedCharacter}
            onBack={() => characterStore.clearSelection()}
          />
        {/if}
      {:else}
        <SelectCharacterMode
          characters={characterStore.state.characters}
          isLoading={characterStore.state.isLoading}
          {canCreateCharacter}
          onSelect={(char) => characterStore.selectCharacter(char)}
          onCreateCharacter={() => (showDialog = true)}
        />
      {/if}
    </main>
  </div>

  <CreateCharacterDialog
    isOpen={showDialog}
    {isCreating}
    onCreate={handleCreateCharacter}
    onClose={() => {
      showDialog = false;
      createError = null;
    }}
    errorMessage={createError}
    onClearError={handleClearCreateError}
  />
{/if}

<style>
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: var(--spacing-lg);
    color: var(--md-sys-color-on-surface);
    font-family: var(--font-body);
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid var(--md-sys-color-outline-variant);
    border-top-color: var(--md-sys-color-primary);
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .app-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-layout__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-xl);
    background: var(--md-sys-color-background);
  }
</style>
