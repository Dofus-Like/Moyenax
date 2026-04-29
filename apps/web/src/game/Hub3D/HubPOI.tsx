import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';

import { useHubGround } from './HubGround';
import { HubPOIAsset } from './HubPOIAsset';
import { PoiBadge } from './PoiBadges';
import type { PoiConfig } from './constants';

interface HubPOIProps {
  poi: PoiConfig;
  modalOpen: boolean;
  pulsing?: boolean;
  highlighted?: boolean;
  statusLabel?: string;
  stateActive?: boolean;
}

const COLLIDER_HEIGHT = 4.0;
const COLLIDER_RADIUS = 2.5;
const LABEL_Y = 1.95;

const LABEL_ANIM_TAG_ID = 'hub-poi-label-anims';
const LABEL_ANIMS = `
@keyframes hub-poi-label-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes hub-poi-status-pulse {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}
@keyframes hub-poi-status-dot {
  0%, 100% { transform: scale(0.85); opacity: 0.5; }
  50% { transform: scale(1.15); opacity: 1; }
}
@keyframes hub-poi-onboarding-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.85; }
}
.hub-poi-label-pulsing { animation: hub-poi-label-pulse 520ms ease-in-out 2; }
.hub-poi-status-active { animation: hub-poi-status-pulse 1.6s ease-in-out infinite; }
.hub-poi-status-dot { animation: hub-poi-status-dot 1.1s ease-in-out infinite; }
.hub-poi-onboarding-highlight { animation: hub-poi-onboarding-pulse 1.8s ease-in-out infinite; }
`;

function ensureLabelAnims(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LABEL_ANIM_TAG_ID)) return;
  const tag = document.createElement('style');
  tag.id = LABEL_ANIM_TAG_ID;
  tag.textContent = LABEL_ANIMS;
  document.head.appendChild(tag);
}

function buildChipStyle(color: string, hovered: boolean, dimmed: boolean): CSSProperties {
  return {
    pointerEvents: 'none',
    background: 'linear-gradient(135deg, rgba(8,12,22,0.78) 0%, rgba(14,20,36,0.72) 100%)',
    backdropFilter: 'blur(10px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(10px) saturate(1.2)',
    color: 'white',
    padding: '5px 12px 5px 5px',
    borderRadius: '999px',
    fontSize: '12.5px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    fontFamily: 'system-ui, sans-serif',
    border: `1px solid ${color}66`,
    boxShadow: `0 0 14px ${color}40, 0 4px 14px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)`,
    transform: hovered && !dimmed ? 'translateY(-2px) scale(1.06)' : 'translateY(0) scale(1)',
    transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease, opacity 220ms ease, border-color 180ms ease',
    userSelect: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    letterSpacing: '0.02em',
    opacity: dimmed ? 0.18 : 1,
    textShadow: '0 1px 6px rgba(0,0,0,0.55)',
  };
}

function buildLabelTextStyle(color: string, hovered: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    color: hovered ? '#ffffff' : 'rgba(255,255,255,0.94)',
    transition: 'color 160ms ease',
    paddingRight: '4px',
    textShadow: `0 0 6px ${color}33`,
  };
}

function StatusBadge({ color, label, active }: { color: string; label: string; active: boolean }): ReactElement {
  return (
    <div
      className={active ? 'hub-poi-status-active' : undefined}
      style={{
        marginTop: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '10.5px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: '#fff',
        background: `linear-gradient(135deg, ${color}cc 0%, ${color}99 100%)`,
        boxShadow: `0 0 10px ${color}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      {active && (
        <span
          aria-hidden
          className="hub-poi-status-dot"
          style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', flexShrink: 0 }}
        />
      )}
      <span>{label}</span>
    </div>
  );
}

function resolveLabelClass(pulsing: boolean, highlighted: boolean, hovered: boolean, dimmed: boolean): string | undefined {
  if (pulsing) return 'hub-poi-label-pulsing';
  if (highlighted && !hovered && !dimmed) return 'hub-poi-onboarding-highlight';
  return undefined;
}

function resolvePoiHovers(baseHover: boolean, highlighted: boolean, modalOpen: boolean): { chip: boolean; asset: boolean } {
  return {
    chip: baseHover && !modalOpen,
    asset: (baseHover || highlighted) && !modalOpen,
  };
}

function PoiLabel({ poi, hovered, dimmed, pulsing, highlighted, statusLabel, stateActive }: { poi: PoiConfig; hovered: boolean; dimmed: boolean; pulsing: boolean; highlighted: boolean; statusLabel?: string; stateActive: boolean }): ReactElement {
  ensureLabelAnims();
  const wrapperClass = resolveLabelClass(pulsing, highlighted, hovered, dimmed);
  return (
    <Html position={[0, LABEL_Y, 0]} center sprite style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          className={wrapperClass}
          style={buildChipStyle(poi.color, hovered, dimmed)}
        >
          <PoiBadge poiId={poi.id} color={poi.color} size={30} />
          <span style={buildLabelTextStyle(poi.color, hovered)}>{poi.label}</span>
        </div>
        {statusLabel && !dimmed && (
          <StatusBadge color={poi.color} label={statusLabel} active={stateActive} />
        )}
      </div>
    </Html>
  );
}

export function HubPOI({ poi, modalOpen, pulsing = false, highlighted = false, statusLabel, stateActive = false }: HubPOIProps): ReactElement {
  const [hovered, setHovered] = useState(false);
  const { snapY, ready } = useHubGround();
  const groundY = useMemo(
    () => snapY(poi.position[0], poi.position[2]),
    [snapY, poi.position, ready],
  );

  useEffect(() => {
    setHovered(false);
    document.body.style.cursor = '';
    return (): void => { document.body.style.cursor = ''; };
  }, [modalOpen]);

  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>): void => {
    if (modalOpen) return;
    event.stopPropagation();
    document.body.style.cursor = 'pointer';
    setHovered(true);
  }, [modalOpen]);

  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>): void => {
    event.stopPropagation();
    document.body.style.cursor = '';
    setHovered(false);
  }, []);

  const { chip: chipHover, asset: assetHover } = resolvePoiHovers(hovered || pulsing || stateActive, highlighted, modalOpen);

  return (
    <group position={[poi.position[0], groundY, poi.position[2]]}>
      <HubPOIAsset poi={poi} hovered={assetHover} />
      {!modalOpen && (
        <mesh
          position={[0, COLLIDER_HEIGHT / 2, 0]}
          userData={{ poiId: poi.id }}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[COLLIDER_RADIUS, COLLIDER_RADIUS, COLLIDER_HEIGHT, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}
      <PoiLabel
        poi={poi}
        hovered={chipHover}
        dimmed={modalOpen}
        pulsing={pulsing}
        highlighted={highlighted}
        statusLabel={statusLabel}
        stateActive={stateActive}
      />
    </group>
  );
}
