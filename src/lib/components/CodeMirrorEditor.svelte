<script lang="ts">
  /**
   * CodeMirrorEditor - thin Svelte 5 wrapper around CodeMirror 6 EditorView.
   * Lazy-loaded by parent components to keep CM6 out of the main bundle.
   */
  import { untrack } from 'svelte';
  import { EditorView } from '@codemirror/view';
  import { EditorState, type Extension } from '@codemirror/state';

  interface Props {
    value: string;
    onUpdate: (value: string) => void;
    extensions?: Extension[];
  }

  let { value = '', onUpdate, extensions = [] }: Props = $props();

  let container: HTMLElement | undefined = $state();
  let view: EditorView | undefined = $state();
  let isInternalChange = false;

  $effect(() => {
    if (!container) return;

    const initialValue = untrack(() => value);

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            isInternalChange = true;
            onUpdate(update.state.doc.toString());
            isInternalChange = false;
          }
        })
      ]
    });

    view = new EditorView({
      state,
      parent: container
    });

    return () => {
      view?.destroy();
      view = undefined;
    };
  });

  // Sync external value changes (e.g., reset)
  $effect(() => {
    if (!view || isInternalChange) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value }
      });
    }
  });
</script>

<div class="cm-editor-wrapper" bind:this={container}></div>

<style>
  .cm-editor-wrapper {
    flex: 1;
    width: 100%;
    min-height: 12rem;
    overflow: auto;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .cm-editor-wrapper :global(.cm-editor) {
    height: 100%;
    border-radius: var(--radius-md);
  }

  .cm-editor-wrapper :global(.cm-editor.cm-focused) {
    outline: none;
    border-color: var(--md-sys-color-primary);
    box-shadow: 0 0 0 1px var(--md-sys-color-primary);
  }

  .cm-editor-wrapper :global(.cm-scroller) {
    overflow: auto;
    font-family: monospace;
  }
</style>
