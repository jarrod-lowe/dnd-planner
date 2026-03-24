<script lang="ts">
  import { t } from '$lib/i18n';
</script>

<div class="journal-column">
  <div class="journal-column__todo">{$t('play.journal.todo')}</div>
</div>

<style>
  .journal-column {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .journal-column__todo {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--md-sys-color-outline);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    text-align: center;
    padding: var(--spacing-xl);
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
