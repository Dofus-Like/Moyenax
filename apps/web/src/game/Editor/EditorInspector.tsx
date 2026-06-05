import { type ReactElement } from 'react';

import type { Vec3 } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export function EditorInspector(): ReactElement | null {
  const selectedId = useEditorStore((s) => s.selectedId);
  const count = useEditorStore((s) => s.selectedIds.length);
  const prop = useEditorStore((s) => s.template.props.find((p) => p.id === selectedId) ?? null);
  const updateProp = useEditorStore((s) => s.updateProp);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const removeSelected = useEditorStore((s) => s.removeSelected);

  if (!prop) return null;
  const name = prop.modelKey.split('/').pop();
  const title = count > 1 ? `${count} objets` : name;

  return (
    <aside className="editor-panel editor-inspector">
      <p className="editor-panel-title">🔍 {title}</p>

      <VectorRow
        label="Position"
        value={prop.position}
        onChange={(position) => updateProp(prop.id, { position })}
      />
      <VectorRow
        label="Rotation°"
        value={prop.rotation.map((r) => Math.round(r * RAD2DEG)) as Vec3}
        onChange={(deg) => updateProp(prop.id, { rotation: deg.map((d) => d * DEG2RAD) as Vec3 })}
      />
      <NumberField
        label="Échelle"
        value={prop.scale}
        step={0.1}
        onChange={(scale) => updateProp(prop.id, { scale })}
      />

      <label className="editor-check">
        <input
          type="checkbox"
          checked={prop.collides}
          onChange={(event) => updateProp(prop.id, { collides: event.target.checked })}
        />
        Collision active
      </label>

      <div className="editor-btn-row">
        <button type="button" className="editor-btn" onClick={() => duplicateSelected()}>
          ⧉ Dupliquer
        </button>
        <button
          type="button"
          className="editor-btn editor-btn-danger"
          onClick={() => removeSelected()}
        >
          🗑 Supprimer
        </button>
      </div>
    </aside>
  );
}

interface VectorRowProps {
  label: string;
  value: Vec3;
  onChange: (value: Vec3) => void;
}

function VectorRow({ label, value, onChange }: VectorRowProps): ReactElement {
  const setAxis = (axis: number, next: number): void => {
    const updated = [...value] as Vec3;
    updated[axis] = next;
    onChange(updated);
  };
  return (
    <div className="editor-vec-row">
      <span className="editor-slider-label">{label}</span>
      <div className="editor-vec-inputs">
        {value.map((axisValue, axis) => (
          <input
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed 3-axis vector
            key={axis}
            type="number"
            step={0.5}
            value={Number.isFinite(axisValue) ? Number(axisValue.toFixed(2)) : 0}
            onChange={(event) => setAxis(axis, Number.parseFloat(event.target.value) || 0)}
          />
        ))}
      </div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, step, onChange }: NumberFieldProps): ReactElement {
  return (
    <label className="editor-vec-row">
      <span className="editor-slider-label">{label}</span>
      <input
        type="number"
        step={step}
        value={Number(value.toFixed(2))}
        onChange={(event) => onChange(Number.parseFloat(event.target.value) || 0)}
      />
    </label>
  );
}
