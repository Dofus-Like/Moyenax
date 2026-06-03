import type { TerrainType } from '@game/shared-types';
import { TERRAIN_PROPERTIES } from '@game/shared-types';
import { useEffect, useLayoutEffect, useRef } from 'react';

import { getResourceIconPath } from '../utils/resourceIcons';
import { useTranslation } from '../store/language.store';

const OFFSET = 14;
const MARGIN = 8;

interface FarmingTooltipProps {
  hoverInfo: { x: number; y: number; terrain: TerrainType } | null;
  previewPath: { x: number; y: number }[];
}

export function FarmingTooltip({ hoverInfo, previewPath }: FarmingTooltipProps) {
  const { t } = useTranslation();
  const elRef = useRef<HTMLDivElement | null>(null);
  const pxRef = useRef(0);
  const pyRef = useRef(0);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pxRef.current = e.clientX;
      pyRef.current = e.clientY;
      const el = elRef.current;
      if (!el) return;
      const w = el.offsetWidth || 252;
      const h = el.offsetHeight || 150;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = e.clientX + OFFSET;
      let top = e.clientY + OFFSET;
      if (left + w > vw - MARGIN) left = e.clientX - w - OFFSET;
      if (top + h > vh - MARGIN) top = e.clientY - h - OFFSET;
      left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
      top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
      el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      el.style.visibility = 'visible';
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useLayoutEffect(() => {
    if (!hoverInfo) return;
    const el = elRef.current;
    if (!el) return;
    const w = el.offsetWidth || 252;
    const h = el.offsetHeight || 150;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = pxRef.current + OFFSET;
    let top = pyRef.current + OFFSET;
    if (left + w > vw - MARGIN) left = pxRef.current - w - OFFSET;
    if (top + h > vh - MARGIN) top = pyRef.current - h - OFFSET;
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
    el.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    el.style.visibility = 'visible';
  }, [hoverInfo]);

  if (!hoverInfo) return null;

  const terrainProps = TERRAIN_PROPERTIES[hoverInfo.terrain];

  return (
    <div ref={elRef} className="floating-tile-tooltip" style={{ visibility: 'hidden' }}>
      <div className="tooltip-header">
        <strong>{hoverInfo.terrain}</strong>
        <span className="coords">({hoverInfo.x}, {hoverInfo.y})</span>
      </div>
      <div className="tooltip-body">
        {previewPath.length > 0 && <p className="distance">{t('tileDistance', { count: previewPath.length })}</p>}
        {terrainProps.harvestable && (
          <p className="resource">
            {t('tileResource')}&nbsp;
            <img
              src={getResourceIconPath(terrainProps.resourceName)}
              alt=""
              className="inline-res-icon"
            />
            <strong>{terrainProps.resourceName}</strong>
          </p>
        )}
        {!terrainProps.traversable && <p className="warning">{t('inaccessible')}</p>}
      </div>
    </div>
  );
}
