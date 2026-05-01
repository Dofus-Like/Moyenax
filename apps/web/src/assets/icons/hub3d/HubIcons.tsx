import { useId, type CSSProperties, type ReactElement } from 'react';

interface IconProps {
  size?: number;
  style?: CSSProperties;
  className?: string;
}

const SPIN_ANIM_ID = 'hub-icon-spin-anim';
function ensureSpinAnim(): void {
  if (typeof document === 'undefined' || document.getElementById(SPIN_ANIM_ID)) return;
  const el = document.createElement('style');
  el.id = SPIN_ANIM_ID;
  el.textContent = '@keyframes hub-icon-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(el);
}

const BASE: CSSProperties = { display: 'block', flexShrink: 0 };

export function SwordCrossedIcon({ size = 20, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M6.2 20.2 20.2 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m16.9 3.8 3.3 3.3 1.15-4.45-4.45 1.15Z" fill="currentColor" />
      <path d="m4.9 17.45 1.65 1.65" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M17.8 20.2 3.8 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7.1 3.8 3.8 7.1 2.65 2.65 7.1 3.8Z" fill="currentColor" />
      <path d="m17.45 17.45 1.65 1.65" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function ChipRuneIcon({ size = 20, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <rect x="5" y="5" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 8.2v7.6M8.8 12h6.4M9.7 9.7l4.6 4.6M14.3 9.7l-4.6 4.6"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function PlayArrowIcon({ size = 16, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M8 5.8c0-.95 1.04-1.53 1.85-1.02l9.2 5.75c.75.47.75 1.56 0 2.03l-9.2 5.75A1.2 1.2 0 0 1 8 17.29V5.8Z"
        fill="currentColor" />
    </svg>
  );
}

export function RefreshIcon({ size = 16, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M19.2 7.2A8 8 0 0 0 5.4 5.8C2.3 8.9 2.3 14 5.4 17.1a8 8 0 0 0 12.2-1.2"
        stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M19.3 3.8v3.8h-3.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DoorRoomIcon({ size = 20, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M6 20V8.4C6 5.95 8 4 10.45 4h3.1C16 4 18 5.95 18 8.4V20"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.6 20V8.7c0-1.05.85-1.9 1.9-1.9h3c1.05 0 1.9.85 1.9 1.9V20"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".72" />
      <circle cx="13.7" cy="13" r=".9" fill="currentColor" />
      <path d="M4.5 20h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CoinIcon({ size = 14, style, className }: IconProps): ReactElement {
  const uid = useId();
  const gradId = `coinGold-${uid}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <defs>
        <linearGradient id={gradId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF2B8" />
          <stop offset=".48" stopColor="#F5B63F" />
          <stop offset="1" stopColor="#A86A18" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="8.7" fill={`url(#${gradId})`} />
      <circle cx="12" cy="12" r="6.25" stroke="#FFF3C4" strokeOpacity=".7" strokeWidth="1.3" />
      <path d="M12 7.4v9.2M9.6 9.5c.5-.7 1.4-1.1 2.4-1.1 1.6 0 2.7.8 2.7 2 0 1.35-1.15 1.8-2.7 1.8-1.55 0-2.7.45-2.7 1.8 0 1.2 1.1 2 2.7 2 1 0 1.9-.4 2.4-1.1"
        stroke="#5A3510" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function AvatarPlaceholderIcon({ size = 48, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <circle cx="24" cy="18" r="8" stroke="currentColor" strokeWidth="3" opacity=".8" />
      <path d="M10 40c2.2-8 7.4-12 14-12s11.8 4 14 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <path d="M24 5v4M16 8l2.1 3.2M32 8l-2.1 3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export function StatusChipActiveIcon({ size = 16, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M8 1.5 13.6 8 8 14.5 2.4 8 8 1.5Z" fill="currentColor" opacity=".24" />
      <path d="M8 1.5 13.6 8 8 14.5 2.4 8 8 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m5.4 8 1.7 1.7 3.6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertTriangleIcon({ size = 16, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M12 3.2 21 19a1.2 1.2 0 0 1-1.04 1.8H4.04A1.2 1.2 0 0 1 3 19l9-15.8Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 8.3v5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.9" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function CloseSmallIcon({ size = 12, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SpinnerRuneIcon({ size = 48, style, className }: IconProps): ReactElement {
  ensureSpinAnim();
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden
      width={size} height={size}
      style={{ ...BASE, animation: 'hub-icon-spin 900ms linear infinite', ...style }}
      className={className}>
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeOpacity=".22" strokeWidth="3" />
      <path d="M24 7a17 17 0 0 1 16.2 11.9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 7v6M40.2 18.9l-5.2 3M35.8 36l-4.1-4.1M12.2 36l4.1-4.1M7.8 18.9l5.2 3"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
    </svg>
  );
}

export function OnboardingBadgeGuideIcon({ size = 12, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <path d="M6.2 5.2h9.7c1.05 0 1.9.85 1.9 1.9v11.7l-3-1.75-3 1.75-3-1.75-3 1.75V5.6c0-.22.18-.4.4-.4Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.9 9h6.2M8.9 12.1h4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".78" />
    </svg>
  );
}

interface DividerProps {
  width?: string | number;
  height?: number;
  style?: CSSProperties;
  className?: string;
}

export function DividerArcaneIcon({ width = '100%', height = 16, style, className }: DividerProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 16" fill="none"
      preserveAspectRatio="none" aria-hidden
      width={width} height={height} style={{ display: 'block', ...style }} className={className}>
      <path d="M4 8h88" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M148 8h88" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M120 2.5 132 8l-12 5.5L108 8l12-5.5Z" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <circle cx="120" cy="8" r="2" fill="currentColor" opacity=".65" />
    </svg>
  );
}

export function CancelSearchIcon({ size = 16, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StatusDotPulseIcon({ size = 8, style, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none" aria-hidden
      width={size} height={size} style={{ ...BASE, ...style }} className={className}>
      <circle cx="9" cy="9" r="7" fill="currentColor" opacity=".16" />
      <circle cx="9" cy="9" r="4.2" fill="currentColor" opacity=".35" />
      <circle cx="9" cy="9" r="2.2" fill="currentColor" />
    </svg>
  );
}
