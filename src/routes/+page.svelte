<script lang="ts">
  import { authStore } from '$lib/auth/authStore.svelte';
  import { characterStore } from '$lib/character/characterStore.svelte';
  import LandingPage from '$lib/components/LandingPage.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import SelectCharacterMode from '$lib/components/character/SelectCharacterMode.svelte';
  import PlayCharacterMode from '$lib/components/character/PlayCharacterMode.svelte';
  import CreateCharacterDialog from '$lib/components/character/CreateCharacterDialog.svelte';
  import ManageRulesMode from '$lib/components/character/ManageRulesMode.svelte';
  import ViewFactsMode from '$lib/components/character/ViewFactsMode.svelte';
  import { playStore } from '$lib/play/playStore.svelte';
  import { buildCharacterExport } from '$lib/character/exportCharacter';
  import { validateCharacterImport, importCharacter } from '$lib/character/importCharacter';
  import { getCache, ensureCached } from '$lib/rules/ruleGroupCache.svelte';
  import { apiGet, apiPost } from '$lib/api/client';
  import { SvelteMap } from 'svelte/reactivity';
  import { get } from 'svelte/store';
  import { t, locale } from '$lib/i18n';
  const title = $derived($t('app.title'));
  let showDialog = $state(false);
  let isCreating = $state(false);
  let isImporting = $state(false);
  let createError = $state<string | null>(null);
  let hasLoadedCharacters = $state(false);
  let manageRulesActive = $state(false);
  let viewFactsActive = $state(false);

  // In play mode, the standalone TopBar is hidden because IntentTopBar renders inside PlayCharacterMode.
  const isPlayMode = $derived(
    !!characterStore.state.selectedCharacter && !manageRulesActive && !viewFactsActive
  );

  // Compute locked rule groups: assigned groups that are required by other assigned groups
  let lockedRuleGroups = $derived.by(() => {
    const cache = getCache();
    const assigned = playStore.state.ruleGroupIds;
    const result = new SvelteMap<string, string[]>();

    for (const assignedId of assigned) {
      const meta = cache.get(assignedId);
      if (meta?.requires) {
        for (const depId of meta.requires) {
          if (assigned.includes(depId)) {
            const existing = result.get(depId) ?? [];
            existing.push(meta.name);
            result.set(depId, existing);
          }
        }
      }
    }

    return result;
  });

  // Load characters when authentication state changes to authenticated
  $effect(() => {
    if (authStore.state.isAuthenticated && !hasLoadedCharacters) {
      hasLoadedCharacters = true;
      characterStore.loadCharacters();
    }
  });

  async function handleCreateCharacter(options: {
    name: string;
    species: string;
    class: string;
    additionalRuleGroupIds: string[];
    effects: unknown[];
  }) {
    isCreating = true;
    createError = null;
    try {
      await characterStore.createCharacter(options);
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

  async function handleImportCharacter(parsedJson: unknown, chosenName: string) {
    isImporting = true;
    createError = null;
    try {
      const rawRuleGroups = (parsedJson as Record<string, unknown>)?.ruleGroups;
      if (Array.isArray(rawRuleGroups)) {
        const currentLocale = get(locale);
        const cached = await ensureCached(rawRuleGroups as string[], currentLocale);
        const availableIds = new Set(cached.keys());
        const validation = validateCharacterImport(parsedJson, availableIds);
        if (!validation.valid) {
          createError = validation
            .errors!.map((e) => $t(`character.${e.code}`, e.params))
            .join(' ');
          return;
        }

        const characterId = await importCharacter(validation.data!, chosenName, {
          createCharacter: async (name, species) => {
            await characterStore.createCharacter({ name, species });
            const char = characterStore.state.selectedCharacter;
            if (!char) throw new Error('Character creation failed');
            return { characterId: char.characterId };
          },
          fetchAssignedRuleGroups: async (cid) => {
            const res = await apiGet(`/api/characters/${cid}/rule-groups`);
            if (!res.ok) throw new Error(`Failed to fetch rule groups: ${res.status}`);
            const { ruleGroups } = await res.json();
            return ruleGroups as string[];
          },
          assignRuleGroup: async (cid, ruleGroupId) => {
            const res = await apiPost(`/api/characters/${cid}/rule-groups`, { ruleGroupId });
            if (!res.ok && res.status !== 409) throw new Error(`Assign failed: ${res.status}`);
          },
          saveEffects: async (cid, effects) => {
            const res = await apiPost(`/api/characters/${cid}/effects`, {
              effects: JSON.stringify(effects)
            });
            if (!res.ok) throw new Error(`Save effects failed: ${res.status}`);
          }
        });

        await playStore.loadRuleGroups(characterId);
      } else {
        createError = $t('character.importErrorMissingRuleGroups');
        return;
      }

      showDialog = false;
    } catch {
      createError = $t('character.importError');
    } finally {
      isImporting = false;
    }
  }

  function handleDownloadCharacter() {
    const character = characterStore.state.selectedCharacter;
    if (!character) return;

    const payload = buildCharacterExport(
      character,
      playStore.state.ruleGroupIds,
      playStore.state.committed
    );
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${character.name.replace(/[/\\?%*:|"<>]/g, '_').substring(0, 200)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
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
    {#if !isPlayMode}
      <TopBar
        email={authStore.state.email}
        onLogout={() => authStore.logout()}
        version="v0.0.0"
        selectedCharacter={characterStore.state.selectedCharacter}
        onBack={characterStore.state.selectedCharacter
          ? () => {
              playStore.reset();
              characterStore.clearSelection();
              manageRulesActive = false;
              viewFactsActive = false;
            }
          : undefined}
        showManageRules={!!characterStore.state.selectedCharacter &&
          !manageRulesActive &&
          !viewFactsActive}
        onManageRules={() => {
          manageRulesActive = true;
        }}
        showViewFacts={!!characterStore.state.selectedCharacter &&
          !manageRulesActive &&
          !viewFactsActive}
        onViewFacts={() => {
          viewFactsActive = true;
        }}
        showDownloadCharacter={!!characterStore.state.selectedCharacter &&
          !manageRulesActive &&
          !viewFactsActive &&
          !playStore.state.isLoadingRuleGroups &&
          !playStore.state.ruleGroupError}
        onDownloadCharacter={handleDownloadCharacter}
      />
    {/if}
    <main id="main-content" class="app-layout__body">
      {#if characterStore.state.selectedCharacter}
        {#if manageRulesActive}
          <ManageRulesMode
            character={characterStore.state.selectedCharacter}
            assignedRuleGroupIds={playStore.state.ruleGroupIds}
            {lockedRuleGroups}
            checkCondition={(id) => playStore.checkCondition?.(id) ?? true}
            onToggle={(ruleGroupId, isAssigned) => {
              const charId = characterStore.state.selectedCharacter!.characterId;
              return isAssigned
                ? playStore.unassignRuleGroup(charId, ruleGroupId)
                : playStore.assignRuleGroup(charId, ruleGroupId);
            }}
            onGetSettings={(ruleGroupId) => playStore.getSettingsForRuleGroup(ruleGroupId)}
            onToggleWithSettings={(ruleGroupId, values) => {
              const charId = characterStore.state.selectedCharacter!.characterId;
              return playStore.assignRuleGroupWithSettings(charId, ruleGroupId, values);
            }}
            onBack={() => {
              manageRulesActive = false;
            }}
          />
        {:else if viewFactsActive}
          <ViewFactsMode
            onBack={() => {
              viewFactsActive = false;
            }}
          />
        {:else}
          <PlayCharacterMode
            character={characterStore.state.selectedCharacter}
            email={authStore.state.email}
            onLogout={() => authStore.logout()}
            version="v0.0.0"
            onBack={() => {
              playStore.reset();
              characterStore.clearSelection();
              manageRulesActive = false;
              viewFactsActive = false;
            }}
            showManageRules={!!characterStore.state.selectedCharacter &&
              !manageRulesActive &&
              !viewFactsActive}
            onManageRules={() => {
              manageRulesActive = true;
            }}
            showViewFacts={!!characterStore.state.selectedCharacter &&
              !manageRulesActive &&
              !viewFactsActive}
            onViewFacts={() => {
              viewFactsActive = true;
            }}
            showDownloadCharacter={!!characterStore.state.selectedCharacter &&
              !manageRulesActive &&
              !viewFactsActive &&
              !playStore.state.isLoadingRuleGroups &&
              !playStore.state.ruleGroupError}
            onDownloadCharacter={handleDownloadCharacter}
          />
        {/if}
      {:else}
        <SelectCharacterMode
          characters={characterStore.state.characters}
          isLoading={characterStore.state.isLoading}
          {canCreateCharacter}
          onSelect={(char) => characterStore.selectCharacter(char)}
          onCreateCharacter={() => (showDialog = true)}
          onDeleteCharacter={async (char) => {
            await characterStore.deleteCharacter(char.characterId);
          }}
        />
      {/if}
    </main>
  </div>

  <CreateCharacterDialog
    isOpen={showDialog}
    {isCreating}
    {isImporting}
    onCreate={handleCreateCharacter}
    onImport={handleImportCharacter}
    onClose={() => {
      showDialog = false;
      createError = null;
      document.getElementById('create-character-btn')?.focus();
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
    height: 100vh;
    height: 100dvh;
  }

  .app-layout__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0;
    background: var(--md-sys-color-background);
    min-height: 0;
    overflow: auto;
  }
</style>
