import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';

import {
  AlertTriangleIcon,
  AvatarPlaceholderIcon,
  CancelSearchIcon,
  ChipRuneIcon,
  CloseSmallIcon,
  CoinIcon,
  DoorRoomIcon,
  PlayArrowIcon,
  RefreshIcon,
  SpinnerRuneIcon,
  StatusChipActiveIcon,
  SwordCrossedIcon,
} from '../assets/icons/hub3d/HubIcons';
import { PoiBadge } from '../game/Hub3D/PoiBadges';
import { HUB_POIS, type PoiId } from '../game/Hub3D/constants';
import { SKINS, type SkinConfig } from '../game/constants/skins';

const STYLE_TAG_ID = 'hub-poi-modal-anims';
const ANIM_OPEN_MS = 280;
const ANIM_CLOSE_MS = 200;

const ANIM_STYLES = `
@keyframes hub-modal-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes hub-modal-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes hub-modal-card-in {
  0% { opacity: 0; transform: translateY(18px) scale(0.92); }
  60% { opacity: 1; transform: translateY(-3px) scale(1.015); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes hub-modal-card-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(8px) scale(0.96); }
}
@keyframes hub-modal-cta-pulse {
  0%, 100% { box-shadow: var(--cta-glow); }
  50% { box-shadow: var(--cta-glow-strong); }
}
.hub-modal-backdrop-in { animation: hub-modal-backdrop-in ${ANIM_OPEN_MS}ms ease-out forwards; }
.hub-modal-backdrop-out { animation: hub-modal-backdrop-out ${ANIM_CLOSE_MS}ms ease-in forwards; }
.hub-modal-card-in { animation: hub-modal-card-in ${ANIM_OPEN_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
.hub-modal-card-out { animation: hub-modal-card-out ${ANIM_CLOSE_MS}ms ease-in forwards; }
.hub-modal-cta {
  position: relative;
  border: 2px solid var(--cta-c1);
  outline: 1.5px solid rgba(0,0,0,0.85);
  cursor: pointer;
  font-family: var(--font-hud);
  font-weight: 400;
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 12px 22px;
  border-radius: 6px;
  width: 100%;
  margin-top: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  text-shadow: -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 -1.5px 0 #000, 0 1.5px 0 #000, -1.5px 0 0 #000, 1.5px 0 0 #000;
  transition: transform 160ms ease, box-shadow 200ms ease, filter 160ms ease, background 160ms ease;
  background: rgba(0,0,0,0.55);
  box-shadow: var(--cta-glow), inset 0 0 0 1px rgba(0,0,0,0.75), inset 0 0 20px rgba(0,0,0,0.55);
  isolation: isolate;
  overflow: hidden;
}
.hub-modal-cta::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 45%);
  pointer-events: none;
}
.hub-modal-cta:hover:not(:disabled) {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.08);
  box-shadow: var(--cta-glow-strong), inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 0 20px rgba(0,0,0,0.5);
}
.hub-modal-cta:active:not(:disabled) {
  transform: translateY(0);
  filter: brightness(0.95);
}
.hub-modal-cta:focus-visible {
  outline: 2px solid var(--cta-focus);
  outline-offset: 2px;
}
.hub-modal-cta:disabled {
  cursor: not-allowed;
  filter: grayscale(0.6) brightness(0.7);
  opacity: 0.5;
  box-shadow: none;
}
.hub-modal-secondary {
  background: rgba(0,0,0,0.55);
  border: 2px solid rgba(255,255,255,0.4);
  outline: 1.5px solid rgba(0,0,0,0.85);
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  font-family: var(--font-hud);
  font-weight: 400;
  font-size: 0.82rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 11px 22px;
  border-radius: 6px;
  width: 100%;
  margin-top: 10px;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
}
.hub-modal-secondary:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.85); color: #fff; }
.hub-modal-close-medallion {
  position: relative;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: transform 200ms ease, filter 200ms ease;
}
.hub-modal-close-medallion:hover { transform: rotate(90deg) scale(1.05); filter: brightness(1.15); }
.hub-modal-close-medallion:focus-visible { outline: 2px solid rgba(255,255,255,0.4); outline-offset: 2px; }
.hub-modal-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(180,140,255,0.35) transparent;
}
.hub-modal-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.hub-modal-scroll::-webkit-scrollbar-track { background: transparent; }
.hub-modal-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(160,120,240,0.35), rgba(110,80,200,0.35));
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.hub-modal-scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(180,140,255,0.55), rgba(130,100,220,0.55));
  background-clip: padding-box;
}
.hub-modal-scroll::-webkit-scrollbar-corner { background: transparent; }
@media (max-height: 720px) {
  .hub-modal-scroll[role="dialog"] { padding: 22px 24px 24px !important; }
}
@media (max-width: 480px) {
  .hub-modal-scroll[role="dialog"] { padding: 18px 16px 20px !important; border-radius: 16px !important; }
  .hub-modal-cta { font-size: 0.86rem !important; padding: 11px 16px !important; }
  .hub-modal-secondary { font-size: 0.8rem !important; padding: 10px 16px !important; }
}
`;

function ensureAnimStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_TAG_ID)) return;
  const tag = document.createElement('style');
  tag.id = STYLE_TAG_ID;
  tag.textContent = ANIM_STYLES;
  document.head.appendChild(tag);
}

export interface RoomEntry {
  id: string;
  player1Id: string;
  createdAt: string;
  p1: { username: string };
}

interface ActionFeedback {
  busy: boolean;
  error: string | null;
  onClearError: () => void;
}

interface CombatActions extends ActionFeedback {
  isInQueue: boolean;
  hasOpenSession: boolean;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
}

interface VsAiActions extends ActionFeedback {
  hasOpenSession: boolean;
  isInQueue: boolean;
  onStart: () => void;
  onResume: () => void;
  onReset: () => void;
}

interface AppearanceActions extends ActionFeedback {
  currentSkin: string | undefined;
  username: string | undefined;
  gold: number | undefined;
  onSetSkin: (id: string) => void;
}

interface RoomsActions extends ActionFeedback {
  rooms: RoomEntry[];
  loading: boolean;
  isWaiting: boolean;
  hasOpenSession: boolean;
  isInQueue: boolean;
  playerId: string | undefined;
  onCreateRoom: () => void;
  onJoinRoom: (id: string) => void;
  onCancelRoom: () => void;
}

export interface HubPoiModalProps {
  activePoiId: PoiId | null;
  onClose: () => void;
  combat: CombatActions;
  vsAi: VsAiActions;
  appearance: AppearanceActions;
  rooms: RoomsActions;
}

const OVERLAY: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  background: 'rgba(0,0,0,0.8)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

const DESC: CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  fontSize: '0.9rem',
  lineHeight: 1.6,
  margin: '0 0 20px',
};

const FAINT: CSSProperties = {
  color: 'rgba(255,255,255,0.52)',
  fontSize: '0.82rem',
  margin: '10px 0 0',
};

const IDLE_SPRITE_FRAMES = 6;

function darken(color: string, factor: number): string {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const r = Math.max(0, Math.round(parseInt(hex.slice(0, 2), 16) * factor));
  const g = Math.max(0, Math.round(parseInt(hex.slice(2, 4), 16) * factor));
  const b = Math.max(0, Math.round(parseInt(hex.slice(4, 6), 16) * factor));
  return `rgb(${r},${g},${b})`;
}

function buildModalWrapStyle(): CSSProperties {
  return {
    position: 'relative',
    width: 'min(520px, calc(100vw - 24px))',
    maxWidth: '520px',
  };
}

function buildModalStyle(color: string): CSSProperties {
  return {
    position: 'relative',
    background: 'rgba(0,0,0,0.95)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '2px solid rgba(255,255,255,0.9)',
    outline: '1.5px solid rgba(0,0,0,0.85)',
    boxShadow: `0 0 30px ${color}30, 0 8px 32px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.75), inset 0 0 40px rgba(0,0,0,0.65)`,
    borderRadius: '6px',
    padding: '24px 28px 26px',
    color: 'white',
    fontFamily: 'var(--font-hud)',
    maxHeight: 'min(80vh, calc(100dvh - 32px))',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    zIndex: 1,
  };
}

function ctaVars(color: string): CSSProperties {
  const c1 = color;
  const c2 = darken(color, 0.7);
  return {
    ['--cta-c1' as never]: c1,
    ['--cta-c2' as never]: c2,
    ['--cta-glow' as never]: `0 0 16px ${color}55`,
    ['--cta-glow-strong' as never]: `0 0 28px ${color}99`,
    ['--cta-focus' as never]: `${color}cc`,
  } as CSSProperties;
}

function renderPanel(id: PoiId, props: HubPoiModalProps): ReactElement {
  if (id === 'combat') return <CombatPanel {...props.combat} />;
  if (id === 'vs-ai') return <VsAiPanel {...props.vsAi} />;
  if (id === 'appearance') return <AppearancePanel {...props.appearance} />;
  return <RoomsPanel {...props.rooms} />;
}

function useModalLifecycle(activePoiId: PoiId | null): { renderedId: PoiId | null; closing: boolean } {
  const [renderedId, setRenderedId] = useState<PoiId | null>(activePoiId);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    ensureAnimStyles();
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (activePoiId) {
      setRenderedId(activePoiId);
      setClosing(false);
      return;
    }
    if (renderedId === null) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setRenderedId(null);
      setClosing(false);
      closeTimerRef.current = null;
    }, ANIM_CLOSE_MS);
  }, [activePoiId, renderedId]);

  useEffect((): (() => void) => (): void => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  return { renderedId, closing };
}

export function HubPoiModal(props: HubPoiModalProps): ReactElement | null {
  const { activePoiId, onClose } = props;
  const { renderedId, closing } = useModalLifecycle(activePoiId);

  if (!renderedId) return null;

  const poiConfig = Object.values(HUB_POIS).find((p) => p.id === renderedId);
  const color = poiConfig?.color ?? '#888888';
  const backdropClass = closing ? 'hub-modal-backdrop-out' : 'hub-modal-backdrop-in';
  const cardClass = closing ? 'hub-modal-card-out' : 'hub-modal-card-in';

  return (
    <div style={OVERLAY} className={backdropClass} onClick={onClose}>
      <div
        style={buildModalWrapStyle()}
        className={cardClass}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hub-modal-scroll" style={buildModalStyle(color)} role="dialog" aria-modal="true">
          <ModalHeader poiId={renderedId} color={color} label={poiConfig?.label ?? ''} onClose={onClose} />
          {renderPanel(renderedId, props)}
        </div>
      </div>
    </div>
  );
}

function CloseMedallion({ color, onClose }: { color: string; onClose: () => void }): ReactElement {
  const gradId = `close-rim-${color.replace('#', '')}`;
  return (
    <button
      type="button"
      onClick={onClose}
      className="hub-modal-close-medallion"
      aria-label="Fermer"
    >
      <svg width="38" height="38" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`${gradId}-bg`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(36 24) rotate(90) scale(44)">
            <stop stopColor="#1a2236" />
            <stop offset="1" stopColor="#0a0e18" />
          </radialGradient>
          <linearGradient id={`${gradId}-rim`} x1="0" y1="0" x2="72" y2="72">
            <stop stopColor={color} />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <circle cx="36" cy="36" r="28" fill={`url(#${gradId}-bg)`} />
        <circle cx="36" cy="36" r="28" stroke={`url(#${gradId}-rim)`} strokeWidth="2.5" />
        <circle cx="36" cy="36" r="21" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
        <path d="M28 28L44 44M44 28L28 44" stroke="#F7FBFF" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function ModalHeader({ poiId, color, label, onClose }: { poiId: PoiId; color: string; label: string; onClose: () => void }): ReactElement {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <PoiBadge poiId={poiId} color={color} size={48} />
          <h2 style={{
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: 400,
            color: '#ffffff',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 -2px 0 #000, 0 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {label}
          </h2>
        </div>
        <CloseMedallion color={color} onClose={onClose} />
      </div>
      <div style={{
        marginTop: '16px',
        height: '1px',
        background: `linear-gradient(90deg, transparent 0%, ${color}66 20%, ${color}99 50%, ${color}66 80%, transparent 100%)`,
      }} />
    </div>
  );
}

function Spinner({ color }: { color: string }): ReactElement {
  return <SpinnerRuneIcon size={14} style={{ color }} />;
}

function ErrorBanner({ message, color, onDismiss }: { message: string; color: string; onDismiss: () => void }): ReactElement {
  return (
    <div
      role="alert"
      style={{
        marginBottom: '12px',
        padding: '10px 12px',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.55)',
        border: `2px solid ${color}99`,
        outline: '1.5px solid rgba(0,0,0,0.85)',
        color: 'rgba(255,255,255,0.92)',
        fontSize: '0.84rem',
        lineHeight: 1.45,
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
      }}
    >
      <AlertTriangleIcon size={15} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer l'erreur"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          padding: 0,
          marginLeft: '4px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <CloseSmallIcon size={12} />
      </button>
    </div>
  );
}


function CombatPanel({ isInQueue, hasOpenSession, busy, error, onJoinQueue, onLeaveQueue, onClearError }: CombatActions): ReactElement {
  const color = '#ef4444';
  if (isInQueue) {
    return (
      <div>
        {error && <ErrorBanner message={error} color={color} onDismiss={onClearError} />}
        <p style={DESC}>Recherche d'un adversaire en cours...</p>
        <p style={{ color, fontWeight: 700, marginBottom: '16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Spinner color={color} /> En file d'attente
        </p>
        <button type="button" className="hub-modal-secondary" onClick={onLeaveQueue} disabled={busy}>
          {busy ? 'Annulation…' : 'Annuler la recherche'}
        </button>
      </div>
    );
  }
  return (
    <div>
      {error && <ErrorBanner message={error} color={color} onDismiss={onClearError} />}
      <p style={DESC}>Affrontez un adversaire aléatoire en PvP. La partie commence dès qu'un match est trouvé.</p>
      <button type="button" className="hub-modal-cta" style={ctaVars(color)} disabled={hasOpenSession || busy} onClick={onJoinQueue}>
        {busy ? <><Spinner color="#fff" /> Recherche…</> : <><SwordCrossedIcon size={16} /> Lancer la recherche</>}
      </button>
      {hasOpenSession && <p style={FAINT}>Terminez d'abord votre session en cours.</p>}
    </div>
  );
}

function VsAiPanel({ hasOpenSession, isInQueue, busy, error, onStart, onResume, onReset, onClearError }: VsAiActions): ReactElement {
  const color = '#facc15';
  if (hasOpenSession) {
    return (
      <div>
        {error && <ErrorBanner message={error} color={color} onDismiss={onClearError} />}
        <p style={DESC}>Une session est déjà en cours.</p>
        <button type="button" className="hub-modal-cta" style={ctaVars('#10b981')} onClick={onResume} disabled={busy}>
          <PlayArrowIcon size={15} /> Reprendre la partie
        </button>
        <button type="button" className="hub-modal-secondary" onClick={onReset} disabled={busy}>
          {busy ? 'Réinitialisation…' : <><RefreshIcon size={15} /> Réinitialiser la session</>}
        </button>
      </div>
    );
  }
  return (
    <div>
      {error && <ErrorBanner message={error} color={color} onDismiss={onClearError} />}
      <p style={DESC}>Lancez un combat solo contre l'intelligence artificielle.</p>
      <button type="button" className="hub-modal-cta" style={ctaVars(color)} disabled={isInQueue || busy} onClick={onStart}>
        {busy ? <><Spinner color="#fff" /> Lancement…</> : <><ChipRuneIcon size={16} /> Lancer VS AI</>}
      </button>
      {isInQueue && <p style={FAINT}>Quittez la file d'attente d'abord.</p>}
    </div>
  );
}

interface BannerPreset { id: string; name: string; gradient: string; }
interface FramePreset { id: string; name: string; border: string; glow: string; }

const BANNER_PRESETS: BannerPreset[] = [
  { id: 'arcane', name: 'Arcane', gradient: 'linear-gradient(135deg, #6d28d9 0%, #c084fc 50%, #312e81 100%)' },
  { id: 'forge', name: 'Forge', gradient: 'linear-gradient(135deg, #b91c1c 0%, #f59e0b 60%, #1f2937 100%)' },
  { id: 'verdant', name: 'Verdant', gradient: 'linear-gradient(135deg, #065f46 0%, #34d399 60%, #064e3b 100%)' },
  { id: 'tide', name: 'Marée', gradient: 'linear-gradient(135deg, #1e3a8a 0%, #38bdf8 60%, #0f172a 100%)' },
];

const FRAME_PRESETS: FramePreset[] = [
  { id: 'gilded', name: 'Doré', border: '2px solid #fbbf24', glow: '0 0 18px #fbbf2455' },
  { id: 'silver', name: 'Argent', border: '2px solid #cbd5e1', glow: '0 0 16px #cbd5e144' },
  { id: 'obsidian', name: 'Obsidienne', border: '2px solid #1f2937', glow: '0 0 14px #93c5fd33' },
  { id: 'rose', name: 'Rose', border: '2px solid #f472b6', glow: '0 0 18px #f472b655' },
];

const SECTION_HEADER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  margin: '14px 0 8px',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)',
};

function getActiveBanner(id: string): BannerPreset {
  return BANNER_PRESETS.find((b) => b.id === id) ?? BANNER_PRESETS[0];
}

function getActiveFrame(id: string): FramePreset {
  return FRAME_PRESETS.find((f) => f.id === id) ?? FRAME_PRESETS[0];
}

function SkinAvatar({ skin, size, frame }: { skin: SkinConfig | undefined; size: number; frame?: FramePreset }): ReactElement {
  const radius = size * 0.18;
  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    backgroundColor: 'rgba(8,12,22,0.55)',
    boxShadow: frame?.glow ?? 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.05)',
    border: frame?.border,
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  if (!skin) {
    return (
      <div style={baseStyle} aria-hidden>
        <AvatarPlaceholderIcon size={size * 0.65} style={{ color: 'rgba(255,255,255,0.35)' }} />
      </div>
    );
  }
  const spriteStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url(/assets/sprites/${skin.type}/idle.png)`,
    backgroundSize: `${IDLE_SPRITE_FRAMES * 100}% 100%`,
    backgroundPosition: '0% 0%',
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
    filter: `hue-rotate(${skin.hue}deg) saturate(${skin.saturation})`,
  };
  return (
    <div style={baseStyle}>
      <div style={spriteStyle} />
    </div>
  );
}

function ProfileHeader({ username, gold, skin, banner, frame }: {
  username: string | undefined;
  gold: number | undefined;
  skin: SkinConfig | undefined;
  banner: BannerPreset;
  frame: FramePreset;
}): ReactElement {
  return (
    <div style={{
      position: 'relative',
      borderRadius: '6px',
      padding: '12px 14px',
      background: banner.gradient,
      border: '2px solid rgba(255,255,255,0.9)',
      outline: '1.5px solid rgba(0,0,0,0.85)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 12px rgba(0,0,0,0.3)',
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      <SkinAvatar skin={skin} size={52} frame={frame} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '-0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.55)' }}>
          {username ?? 'Aventurier'}
        </div>
        <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.85)', marginTop: '3px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CoinIcon size={13} /> {gold ?? 0}
          </span>
          <span style={{ opacity: 0.7 }}>{skin?.name ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

function SkinCard({ skin, isActive, onSelect }: { skin: SkinConfig; isActive: boolean; onSelect: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 10px 7px 7px',
        borderRadius: '10px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        background: isActive ? 'rgba(192,132,252,0.16)' : 'rgba(0,0,0,0.55)',
        border: `2px solid ${isActive ? '#c084fc' : 'rgba(255,255,255,0.3)'}`,
        boxShadow: isActive ? '0 0 14px rgba(192,132,252,0.4)' : 'inset 0 0 0 1px rgba(0,0,0,0.6)',
        transition: 'background 160ms ease, border-color 160ms ease, box-shadow 200ms ease',
        color: 'inherit',
        fontFamily: 'inherit',
      }}
    >
      <SkinAvatar skin={skin} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'rgba(255,255,255,0.95)' }}>{skin.name}</div>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.42)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
          {skin.description}
        </div>
      </div>
      {isActive && <StatusChipActiveIcon size={14} style={{ color: '#c084fc', flexShrink: 0 }} />}
    </button>
  );
}

function BannerSwatch({ preset, isActive, onSelect }: { preset: BannerPreset; isActive: boolean; onSelect: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={preset.name}
      aria-label={preset.name}
      style={{
        flex: 1,
        height: '34px',
        borderRadius: '8px',
        cursor: 'pointer',
        background: preset.gradient,
        border: `2px solid ${isActive ? '#ffffff' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: isActive ? '0 0 10px rgba(255,255,255,0.3)' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        padding: 0,
      }}
    />
  );
}

function FrameSwatch({ preset, isActive, onSelect }: { preset: FramePreset; isActive: boolean; onSelect: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={preset.name}
      style={{
        flex: 1,
        height: '34px',
        borderRadius: '8px',
        cursor: 'pointer',
        background: 'rgba(10,14,24,0.6)',
        border: preset.border,
        boxShadow: isActive ? `${preset.glow}, 0 0 0 2px rgba(255,255,255,0.35)` : preset.glow,
        transition: 'box-shadow 160ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.62rem',
        color: 'rgba(255,255,255,0.72)',
        letterSpacing: '0.05em',
        fontFamily: 'inherit',
        padding: 0,
      }}
    >
      {preset.name}
    </button>
  );
}

function AppearancePanel({ currentSkin, username, gold, busy, error, onSetSkin, onClearError }: AppearanceActions): ReactElement {
  const [bannerId, setBannerId] = useState<string>(BANNER_PRESETS[0].id);
  const [frameId, setFrameId] = useState<string>(FRAME_PRESETS[0].id);
  const skin = SKINS.find((s) => s.id === currentSkin);
  const banner = getActiveBanner(bannerId);
  const frame = getActiveFrame(frameId);

  return (
    <div>
      {error && <ErrorBanner message={error} color="#c084fc" onDismiss={onClearError} />}
      <ProfileHeader username={username} gold={gold} skin={skin} banner={banner} frame={frame} />
      {busy && (
        <p style={{ ...FAINT, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <Spinner color="#c084fc" /> Mise à jour de l'apparence…
        </p>
      )}

      <div style={SECTION_HEADER}><span>Apparence</span><span style={{ opacity: 0.5 }}>{SKINS.length}</span></div>
      <div
        className="hub-modal-scroll hub-modal-skins-list"
        style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '6px', opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}
      >
        {SKINS.map((s) => (
          <SkinCard key={s.id} skin={s} isActive={s.id === currentSkin} onSelect={() => onSetSkin(s.id)} />
        ))}
      </div>

      {/* TODO backend: bannière/cadre stockés localement (pas de persistance API) */}
      <div style={SECTION_HEADER}>
        <span>Bannière</span>
        <span style={{ opacity: 0.4, textTransform: 'none', fontSize: '0.65rem', letterSpacing: '0.04em' }}>local</span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {BANNER_PRESETS.map((p) => (
          <BannerSwatch key={p.id} preset={p} isActive={p.id === bannerId} onSelect={() => setBannerId(p.id)} />
        ))}
      </div>

      <div style={SECTION_HEADER}>
        <span>Cadre</span>
        <span style={{ opacity: 0.4, textTransform: 'none', fontSize: '0.65rem', letterSpacing: '0.04em' }}>local</span>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {FRAME_PRESETS.map((p) => (
          <FrameSwatch key={p.id} preset={p} isActive={p.id === frameId} onSelect={() => setFrameId(p.id)} />
        ))}
      </div>
    </div>
  );
}

function RoomCard({ room, isOwn, disabled, onJoin }: { room: RoomEntry; isOwn: boolean; disabled: boolean; onJoin: () => void }): ReactElement {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 14px',
      borderRadius: '6px',
      marginBottom: '8px',
      background: 'rgba(0,0,0,0.55)',
      border: '2px solid rgba(255,255,255,0.4)',
      borderLeft: '3px solid #22c55e',
      outline: '1.5px solid rgba(0,0,0,0.85)',
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{room.p1.username}</div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          <span>{new Date(room.createdAt).toLocaleTimeString()}</span>
          <span style={{ background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.28)', borderRadius: '999px', padding: '1px 7px', fontWeight: 600, color: 'rgba(34,197,94,0.88)', fontSize: '0.67rem', letterSpacing: '0.02em' }}>1 / 2</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onJoin}
        disabled={isOwn || disabled}
        className="hub-modal-cta"
        style={{ ...ctaVars('#22c55e'), width: 'auto', padding: '8px 16px', fontSize: '0.8rem', marginTop: 0 }}
      >
        {isOwn ? 'Votre room' : 'Rejoindre'}
      </button>
    </div>
  );
}

function RoomsContent({ loading, rooms, playerId, hasOpenSession, isInQueue, onJoinRoom }: {
  loading: boolean;
  rooms: RoomEntry[];
  playerId: string | undefined;
  hasOpenSession: boolean;
  isInQueue: boolean;
  onJoinRoom: (id: string) => void;
}): ReactElement {
  if (loading) return <p style={FAINT}>Chargement des rooms...</p>;
  if (rooms.length === 0) return <p style={FAINT}>Aucune room ouverte. Créez-en une !</p>;
  return (
    <>
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          isOwn={room.player1Id === playerId}
          disabled={hasOpenSession || isInQueue}
          onJoin={() => onJoinRoom(room.id)}
        />
      ))}
    </>
  );
}

function buildRoomsCta(isWaiting: boolean, busy: boolean): { color: string; content: ReactElement } {
  const color = isWaiting ? '#ef4444' : '#22c55e';
  if (busy) {
    const label = isWaiting ? 'Annulation…' : 'Création…';
    return { color, content: <><Spinner color="#fff" /> {label}</> };
  }
  if (isWaiting) return { color, content: <><CancelSearchIcon size={16} /> Annuler ma room</> };
  return { color, content: <><DoorRoomIcon size={16} /> Créer une room</> };
}

function RoomsHints({ isWaiting, isInQueue, hasOpenSession, busy, color }: { isWaiting: boolean; isInQueue: boolean; hasOpenSession: boolean; busy: boolean; color: string }): ReactElement | null {
  if (isWaiting && !busy) {
    return (
      <p style={{ ...FAINT, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Spinner color={color} /> En attente d'un joueur…
      </p>
    );
  }
  if (isWaiting) return null;
  if (isInQueue) return <p style={FAINT}>Quittez la file d'attente d'abord.</p>;
  if (hasOpenSession) return <p style={FAINT}>Terminez d'abord votre session en cours.</p>;
  return null;
}

function RoomsPanel({ rooms, loading, isWaiting, hasOpenSession, isInQueue, playerId, busy, error, onCreateRoom, onJoinRoom, onCancelRoom, onClearError }: RoomsActions): ReactElement {
  const createDisabled = isInQueue || (hasOpenSession && !isWaiting) || busy;
  const cta = buildRoomsCta(isWaiting, busy);
  return (
    <div>
      {error && <ErrorBanner message={error} color={cta.color} onDismiss={onClearError} />}
      <p style={DESC}>Créez ou rejoignez une room personnalisée.</p>
      <button
        type="button"
        className="hub-modal-cta"
        style={ctaVars(cta.color)}
        disabled={createDisabled}
        onClick={isWaiting ? onCancelRoom : onCreateRoom}
      >
        {cta.content}
      </button>
      <RoomsHints isWaiting={isWaiting} isInQueue={isInQueue} hasOpenSession={hasOpenSession} busy={busy} color={cta.color} />
      <div style={{ marginTop: '16px' }}>
        <RoomsContent
          loading={loading}
          rooms={rooms}
          playerId={playerId}
          hasOpenSession={hasOpenSession}
          isInQueue={isInQueue || busy}
          onJoinRoom={onJoinRoom}
        />
      </div>
    </div>
  );
}
