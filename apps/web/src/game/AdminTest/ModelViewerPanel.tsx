import { Grid, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { type DragEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

import {
  buildModelTree,
  loadRawModels,
  MODELS,
  type ModelEntry,
  type ModelTreeNode,
} from '../models/modelRegistry';
import { computeModelStats, formatBytes, type ModelStats } from '../models/modelStats';

import './AdminTest.css';

interface ViewerSettings {
  autoRotate: boolean;
  rotateSpeed: number;
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  shadows: boolean;
  lightIntensity: number;
  background: string;
}

const DEFAULT_SETTINGS: ViewerSettings = {
  autoRotate: true,
  rotateSpeed: 1.6,
  wireframe: false,
  showGrid: true,
  showAxes: false,
  shadows: true,
  lightIntensity: 1.2,
  background: '#1a1a22',
};

const BACKGROUNDS = [
  { label: 'Sombre', value: '#1a1a22' },
  { label: 'Nuit', value: '#050507' },
  { label: 'Studio', value: '#3a3a44' },
  { label: 'Ardoise', value: '#222831' },
];

interface DroppedModel {
  name: string;
  url: string;
  size: number;
}

function ViewerModel({
  url,
  wireframe,
  onStats,
}: {
  url: string;
  wireframe: boolean;
  onStats: (s: ModelStats) => void;
}) {
  const gltf = useGLTF(url);
  const { node, scale } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    clone.position.set(-center.x, -center.y, -center.z);
    return { node: clone, scale: 2 / (Math.max(size.x, size.y, size.z) || 1) };
  }, [gltf.scene]);

  useEffect(() => {
    node.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
    });
  }, [node, wireframe]);

  useEffect(() => {
    onStats(computeModelStats(node, gltf.animations?.length ?? 0));
  }, [node, gltf.animations, onStats]);

  return (
    <group scale={scale}>
      <primitive object={node} />
    </group>
  );
}

function ResetWatcher({ signal }: { signal: number }) {
  const controls = useThree((s) => s.controls) as unknown as { reset?: () => void } | null;
  useEffect(() => {
    if (signal > 0) controls?.reset?.();
  }, [signal, controls]);
  return null;
}

function ViewerStage({
  url,
  settings,
  resetSignal,
  onStats,
}: {
  url: string | undefined;
  settings: ViewerSettings;
  resetSignal: number;
  onStats: (s: ModelStats) => void;
}) {
  return (
    <Canvas shadows={settings.shadows} dpr={[1, 2]} camera={{ position: [3, 2, 4], fov: 45 }}>
      <color attach="background" args={[settings.background]} />
      <ambientLight intensity={settings.lightIntensity * 0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={settings.lightIntensity}
        castShadow={settings.shadows}
      />
      {settings.showGrid && (
        <Grid
          args={[20, 20]}
          position={[0, -1.05, 0]}
          cellColor="#555"
          sectionColor="#8aa"
          fadeDistance={28}
          infiniteGrid
        />
      )}
      {settings.showAxes && <axesHelper args={[2]} />}
      <Suspense fallback={null}>
        {url && (
          <ViewerModel key={url} url={url} wireframe={settings.wireframe} onStats={onStats} />
        )}
      </Suspense>
      <OrbitControls
        autoRotate={settings.autoRotate}
        autoRotateSpeed={settings.rotateSpeed}
        enableDamping
        makeDefault
      />
      <ResetWatcher signal={resetSignal} />
    </Canvas>
  );
}

function TreeView({
  node,
  selectedKey,
  onSelect,
}: {
  node: ModelTreeNode;
  selectedKey: string;
  onSelect: (m: ModelEntry) => void;
}) {
  return (
    <div className="at-tree">
      {node.folders.map((f) => (
        <div key={f.path} className="at-tree-folder">
          <p className="at-tree-folder-name">📁 {f.name}</p>
          <div className="at-tree-indent">
            <TreeView node={f} selectedKey={selectedKey} onSelect={onSelect} />
          </div>
        </div>
      ))}
      {node.models.map((m) => (
        <button
          key={m.key}
          type="button"
          className={`at-tree-model${m.key === selectedKey ? ' is-active' : ''}`}
          onClick={() => onSelect(m)}
          title={m.key}
        >
          🧊 {m.name}
        </button>
      ))}
    </div>
  );
}

function ToggleBtn({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`at-toggle${on ? ' is-on' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="at-slider">
      <span className="at-slider-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
    </div>
  );
}

interface SettingsProps {
  settings: ViewerSettings;
  onChange: (p: Partial<ViewerSettings>) => void;
  onReset: () => void;
}

function SettingsToggles({ settings, onChange, onReset }: SettingsProps) {
  return (
    <div className="at-viewer-toolbar">
      <ToggleBtn
        on={settings.autoRotate}
        label="🔄 Rotation"
        onClick={() => onChange({ autoRotate: !settings.autoRotate })}
      />
      <ToggleBtn
        on={settings.wireframe}
        label="🔲 Fil de fer"
        onClick={() => onChange({ wireframe: !settings.wireframe })}
      />
      <ToggleBtn
        on={settings.showGrid}
        label="▦ Grille"
        onClick={() => onChange({ showGrid: !settings.showGrid })}
      />
      <ToggleBtn
        on={settings.showAxes}
        label="✛ Axes"
        onClick={() => onChange({ showAxes: !settings.showAxes })}
      />
      <ToggleBtn
        on={settings.shadows}
        label="🌑 Ombres"
        onClick={() => onChange({ shadows: !settings.shadows })}
      />
      <button type="button" className="at-toggle" onClick={onReset}>
        🎯 Recentrer
      </button>
    </div>
  );
}

function SettingsPanel({ settings, onChange, onReset }: SettingsProps) {
  return (
    <div className="at-skin-section">
      <p className="at-group-label">Réglages</p>
      <SettingsToggles settings={settings} onChange={onChange} onReset={onReset} />
      <Slider
        label={`Lumière ${settings.lightIntensity.toFixed(1)}`}
        min={0}
        max={3}
        step={0.1}
        value={settings.lightIntensity}
        onChange={(v) => onChange({ lightIntensity: v })}
      />
      <Slider
        label={`Vitesse rotation ${settings.rotateSpeed.toFixed(1)}`}
        min={0}
        max={6}
        step={0.2}
        value={settings.rotateSpeed}
        onChange={(v) => onChange({ rotateSpeed: v })}
      />
      <select
        className="at-select"
        value={settings.background}
        onChange={(e) => onChange({ background: e.target.value })}
      >
        {BACKGROUNDS.map((b) => (
          <option key={b.value} value={b.value}>
            Fond : {b.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="at-meta-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function num(value: number | undefined): string {
  return value === undefined ? '—' : value.toLocaleString('fr-FR');
}

function metaRows(size: number, stats: ModelStats | null): { label: string; value: string }[] {
  const dims = stats
    ? `${stats.size.x.toFixed(1)} × ${stats.size.y.toFixed(1)} × ${stats.size.z.toFixed(1)}`
    : '—';
  return [
    { label: 'Taille fichier', value: formatBytes(size) },
    { label: 'Meshes', value: num(stats?.meshes) },
    { label: 'Triangles', value: num(stats?.triangles) },
    { label: 'Sommets', value: num(stats?.vertices) },
    { label: 'Matériaux', value: num(stats?.materials) },
    { label: 'Textures', value: num(stats?.textures) },
    { label: 'Animations', value: num(stats?.animations) },
    { label: 'Dimensions', value: dims },
  ];
}

function MetadataPanel({
  title,
  subtitle,
  size,
  stats,
}: {
  title: string;
  subtitle: string;
  size: number;
  stats: ModelStats | null;
}) {
  return (
    <div className="at-skin-section">
      <p className="at-group-label">Métadonnées</p>
      <p className="at-meta-title">{title}</p>
      <p className="at-hint">{subtitle}</p>
      <div className="at-meta-grid">
        {metaRows(size, stats).map((r) => (
          <MetaRow key={r.label} label={r.label} value={r.value} />
        ))}
      </div>
    </div>
  );
}

function HelpPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="at-skin-section">
      <button type="button" className="at-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} ❔ Aide & explications
      </button>
      {open && (
        <div className="at-help">
          <p>
            <b>🔄 Rotation</b> : tourne le modèle automatiquement (vitesse réglable).
          </p>
          <p>
            <b>🔲 Fil de fer</b> : affiche le maillage (géométrie) sans textures.
          </p>
          <p>
            <b>▦ Grille / ✛ Axes</b> : repères de sol et d'orientation X/Y/Z.
          </p>
          <p>
            <b>🌑 Ombres</b> : active les ombres portées · <b>Lumière</b> : intensité.
          </p>
          <p>
            <b>🎯 Recentrer</b> : remet la caméra à sa position initiale.
          </p>
          <p>
            <b>Souris</b> : glisser = orbiter · molette = zoom · clic droit = déplacer.
          </p>
          <p>
            <b>Glisser-déposer</b> : lâche un <code>.glb</code> sur la vue pour le tester sans
            l'ajouter.
          </p>
          <p>
            <b>Catalogue</b> : place un <code>.glb</code> dans{' '}
            <code>src/assets/models/&lt;dossier&gt;/</code> → il apparaît tout seul dans l'arbre.
          </p>
        </div>
      )}
    </div>
  );
}

function describeSelection(
  dropped: DroppedModel | null,
  selected: ModelEntry | undefined,
  fileSize: number,
) {
  if (dropped) {
    return {
      url: dropped.url,
      title: dropped.name,
      subtitle: '📥 fichier déposé (non catalogué)',
      size: dropped.size,
      selectedKey: '',
    };
  }
  return {
    url: selected?.url,
    title: selected?.name ?? '—',
    subtitle: selected?.key ?? '',
    size: fileSize,
    selectedKey: selected?.key ?? '',
  };
}

function useModelSelection() {
  const [selected, setSelected] = useState<ModelEntry | undefined>(MODELS[0]);
  const [dropped, setDropped] = useState<DroppedModel | null>(null);
  const [fileSize, setFileSize] = useState(0);

  useEffect(() => {
    if (dropped || !selected) return;
    let cancelled = false;
    fetch(selected.url, { method: 'HEAD' })
      .then((r) => Number.parseInt(r.headers.get('content-length') ?? '0', 10))
      .then((n) => !cancelled && setFileSize(n))
      .catch(() => !cancelled && setFileSize(0));
    return () => {
      cancelled = true;
    };
  }, [selected, dropped]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.glb')) return;
    setDropped((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { name: file.name, url: URL.createObjectURL(file), size: file.size };
    });
  }, []);

  const selectModel = useCallback((m: ModelEntry) => {
    setDropped((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setSelected(m);
  }, []);

  return { ...describeSelection(dropped, selected, fileSize), handleDrop, selectModel };
}

function useModelCatalog() {
  const [raw, setRaw] = useState<ModelEntry[]>([]);
  // Variantes "raw" chargées en dev seulement (exclues du build prod).
  useEffect(() => {
    loadRawModels().then(setRaw);
  }, []);
  const models = useMemo(
    () => [...MODELS, ...raw].sort((a, b) => a.key.localeCompare(b.key)),
    [raw],
  );
  const tree = useMemo(() => buildModelTree(models), [models]);
  return { tree, count: models.length };
}

export function ModelViewerPanel() {
  const sel = useModelSelection();
  const { tree, count } = useModelCatalog();
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const change = useCallback(
    (p: Partial<ViewerSettings>) => setSettings((s) => ({ ...s, ...p })),
    [],
  );

  return (
    <section className="at-panel">
      <h2 className="at-title">🧊 Modèles 3D ({count})</h2>
      <p className="at-hint">
        Visualise tous les GLB. Glisse un .glb sur la vue pour le tester, ou dépose-le dans
        src/assets/models/&lt;dossier&gt;/ pour l'ajouter au catalogue.
      </p>
      <div className="at-viewer">
        <aside className="at-viewer-tree">
          <TreeView node={tree} selectedKey={sel.selectedKey} onSelect={sel.selectModel} />
        </aside>
        <div className="at-viewer-main">
          <div
            className="at-viewer-stage"
            onDragOver={(e) => e.preventDefault()}
            onDrop={sel.handleDrop}
          >
            <ViewerStage
              url={sel.url}
              settings={settings}
              resetSignal={resetSignal}
              onStats={setStats}
            />
          </div>
        </div>
        <aside className="at-viewer-info">
          <SettingsPanel
            settings={settings}
            onChange={change}
            onReset={() => setResetSignal((n) => n + 1)}
          />
          <MetadataPanel title={sel.title} subtitle={sel.subtitle} size={sel.size} stats={stats} />
          <HelpPanel />
        </aside>
      </div>
    </section>
  );
}
