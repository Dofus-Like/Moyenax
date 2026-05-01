import { useId, type ReactElement } from 'react';

import type { PoiId } from './constants';

interface PoiBadgeProps {
  poiId: PoiId;
  size?: number;
  color: string;
  ariaHidden?: boolean;
}

interface BadgeSpec {
  bg: string;
  draw: ReactElement;
}

function tintBg(color: string): string {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return 'rgba(10,14,24,0.9)';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgb(${Math.round(r * 0.18)},${Math.round(g * 0.18)},${Math.round(b * 0.18)})`;
}

function combatDraw(): ReactElement {
  return (
    <>
      <path d="M30 66l16-16M50 60L66 44" stroke="#FFF5EA" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M44 34l5 11-9 9-11-5z" fill="#FFF5EA" />
      <path d="M52 56l9-9 11 5-5 11z" fill="#FFF5EA" />
    </>
  );
}

function vsAiDraw(): ReactElement {
  return (
    <>
      <rect x="26" y="30" width="44" height="38" rx="10" fill="#F2FDFF" fillOpacity="0.18" stroke="#F2FDFF" strokeWidth="3" />
      <circle cx="38" cy="46" r="6" fill="#F2FDFF" />
      <circle cx="58" cy="46" r="6" fill="#F2FDFF" />
      <path d="M37 59c4 3 18 3 22 0" stroke="#F2FDFF" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M38 20v8M58 20v8" stroke="#F2FDFF" strokeWidth="5" strokeLinecap="round" />
    </>
  );
}

function appearanceDraw(color: string): ReactElement {
  return (
    <>
      <path d="M48 20l9 13h14l-8 13 8 13H57l-9 13-9-13H25l8-13-8-13h14l9-13z" fill={color} fillOpacity="0.3" stroke="#F8F1FF" strokeWidth="3" />
      <circle cx="48" cy="50" r="13" fill="#F8F1FF" />
    </>
  );
}

function roomsDraw(): ReactElement {
  return (
    <>
      <path d="M22 58l26-20 26 20v14H22V58z" fill="#F4FFF8" fillOpacity="0.22" stroke="#F4FFF8" strokeWidth="3" strokeLinejoin="round" />
      <rect x="42" y="56" width="12" height="16" fill="#F4FFF8" />
    </>
  );
}

function getSpec(poiId: PoiId, color: string): BadgeSpec {
  if (poiId === 'combat') return { bg: tintBg(color), draw: combatDraw() };
  if (poiId === 'vs-ai') return { bg: tintBg(color), draw: vsAiDraw() };
  if (poiId === 'appearance') return { bg: tintBg(color), draw: appearanceDraw(color) };
  return { bg: tintBg(color), draw: roomsDraw() };
}

export function PoiBadge({ poiId, size = 28, color, ariaHidden = true }: PoiBadgeProps): ReactElement {
  const uid = useId();
  const { bg, draw } = getSpec(poiId, color);
  const gradId = `poiBadge-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden={ariaHidden}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="96" y2="96">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="38" fill={bg} stroke={`url(#${gradId})`} strokeWidth="4" />
      {draw}
    </svg>
  );
}
