import { type ReactElement } from 'react';

import { useEditorStore } from '../../store/editor.store';

import type { AlignMode, Axis } from './arrange';

const ALIGN: { axis: Axis; mode: AlignMode; label: string }[] = [
  { axis: 'x', mode: 'min', label: '⇤ X' },
  { axis: 'x', mode: 'center', label: '⇔ X' },
  { axis: 'x', mode: 'max', label: '⇥ X' },
  { axis: 'z', mode: 'min', label: '⇤ Z' },
  { axis: 'z', mode: 'center', label: '⇔ Z' },
  { axis: 'z', mode: 'max', label: '⇥ Z' },
];

export function EditorArrangePanel(): ReactElement | null {
  const count = useEditorStore((s) => s.selectedIds.length);
  const alignSelected = useEditorStore((s) => s.alignSelected);
  const distributeSelected = useEditorStore((s) => s.distributeSelected);
  if (count < 2) return null;

  return (
    <aside className="editor-panel editor-arrange">
      <p className="editor-panel-title">📐 Aligner ({count})</p>
      <div className="editor-btn-grid">
        {ALIGN.map(({ axis, mode, label }) => (
          <button
            key={`${axis}-${mode}`}
            type="button"
            className="editor-btn"
            onClick={() => alignSelected(axis, mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="editor-btn-row">
        <button
          type="button"
          className="editor-btn"
          disabled={count < 3}
          onClick={() => distributeSelected('x')}
        >
          ⋯ Distribuer X
        </button>
        <button
          type="button"
          className="editor-btn"
          disabled={count < 3}
          onClick={() => distributeSelected('z')}
        >
          ⋮ Distribuer Z
        </button>
      </div>
    </aside>
  );
}
