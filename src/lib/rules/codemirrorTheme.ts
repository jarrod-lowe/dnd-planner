/**
 * CodeMirror 6 theme built from the app's CSS variables.
 * Uses EditorView.theme() and HighlightStyle for consistent styling
 * with the rest of the application.
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--md-sys-color-surface-container)',
    color: 'var(--md-sys-color-on-surface)',
    fontFamily: 'monospace',
    fontSize: 'var(--font-size-sm)',
    lineHeight: '1.5'
  },
  '.cm-content': {
    fontFamily: 'monospace',
    caretColor: 'var(--md-sys-color-primary)'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--md-sys-color-primary)'
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--md-sys-color-surface-container-high)'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--md-sys-color-primary) !important',
    color: 'var(--md-sys-color-on-primary)'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--md-sys-color-surface-container)',
    color: 'var(--md-sys-color-on-surface-variant)',
    borderRight: '1px solid var(--md-sys-color-outline-variant)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--md-sys-color-surface-container-high)'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    fontFamily: 'monospace',
    fontSize: 'var(--font-size-xs)'
  },
  '.cm-lint-marker-error': {
    color: 'var(--md-sys-color-error)'
  },
  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L1 0 L2 3 L3 0 L4 3 L5 0 L6 3' fill='none' stroke='%23ba1a1a' stroke-width='1'/%3E%3C/svg%3E")`,
    backgroundPosition: 'bottom',
    backgroundRepeat: 'repeat-x',
    paddingBottom: '2px'
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--md-sys-color-surface-container-high)',
    border: '1px solid var(--md-sys-color-outline-variant)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--md-sys-color-on-surface)'
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    fontFamily: 'monospace'
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--md-sys-color-primary-container)',
    color: 'var(--md-sys-color-on-primary-container)'
  },
  '.cm-completionLabel': {
    fontFamily: 'monospace'
  },
  '.cm-completionDetail': {
    fontStyle: 'italic',
    color: 'var(--md-sys-color-on-surface-variant)'
  }
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--md-sys-color-primary)' },
  { tag: tags.string, color: 'var(--md-sys-color-tertiary)' },
  { tag: tags.number, color: 'var(--md-sys-color-tertiary)' },
  { tag: tags.bool, color: 'var(--md-sys-color-tertiary)' },
  { tag: tags.null, color: 'var(--md-sys-color-on-surface-variant)' },
  { tag: tags.comment, color: 'var(--md-sys-color-on-surface-variant)', fontStyle: 'italic' },
  { tag: tags.propertyName, color: 'var(--md-sys-color-secondary)' },
  { tag: tags.literal, color: 'var(--md-sys-color-tertiary)' },
  { tag: tags.separator, color: 'var(--md-sys-color-outline)' },
  { tag: tags.special(tags.string), color: 'var(--md-sys-color-tertiary)' }
]);

export const dndPlannerTheme = [editorTheme, syntaxHighlighting(highlightStyle)];
