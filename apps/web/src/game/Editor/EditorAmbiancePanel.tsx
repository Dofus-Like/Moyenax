import { type ReactElement } from 'react';

import { TIME_OF_DAY_LABELS, TIME_OF_DAY_ORDER } from '@game/shared-types';

import { useEditorStore } from '../../store/editor.store';

export function EditorAmbiancePanel(): ReactElement {
  const ambiance = useEditorStore((s) => s.template.ambiance);
  const setTimeOfDay = useEditorStore((s) => s.setTimeOfDay);
  const setAmbientIntensity = useEditorStore((s) => s.setAmbientIntensity);
  const setDirectionalIntensity = useEditorStore((s) => s.setDirectionalIntensity);

  return (
    <aside className="editor-panel editor-ambiance">
      <p className="editor-panel-title">🌤 Ambiance</p>
      <div className="editor-btn-grid">
        {TIME_OF_DAY_ORDER.map((time) => (
          <button
            key={time}
            type="button"
            className={`editor-btn${ambiance.timeOfDay === time ? ' is-on' : ''}`}
            onClick={() => setTimeOfDay(time)}
          >
            {TIME_OF_DAY_LABELS[time]}
          </button>
        ))}
      </div>
      <EditorSlider
        label={`Lumière ambiante ${ambiance.ambientIntensity.toFixed(2)}`}
        min={0}
        max={2}
        step={0.05}
        value={ambiance.ambientIntensity}
        onChange={setAmbientIntensity}
      />
      <EditorSlider
        label={`Soleil ${ambiance.directionalIntensity.toFixed(2)}`}
        min={0}
        max={3}
        step={0.05}
        value={ambiance.directionalIntensity}
        onChange={setDirectionalIntensity}
      />
    </aside>
  );
}

interface EditorSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

function EditorSlider({ label, min, max, step, value, onChange }: EditorSliderProps): ReactElement {
  return (
    <label className="editor-slider">
      <span className="editor-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number.parseFloat(event.target.value))}
      />
    </label>
  );
}
