import React from 'react';
import Marquee from 'react-fast-marquee';

interface RetroMarqueeProps {
  children: React.ReactNode;
  speed?: number;
  pauseOnHover?: boolean;
  className?: string;
}

export function RetroMarquee({
  children,
  speed = 40,
  pauseOnHover = true,
  className = '',
}: RetroMarqueeProps) {
  return (
    <div
      className={`retro-marquee-wrapper ${className}`}
      style={{
        background: '#000080',
        borderTop: '2px solid #ffffff',
        borderBottom: '2px solid #808080',
        padding: '4px 0',
        overflow: 'hidden',
      }}
    >
      <Marquee speed={speed} gradient={false} pauseOnHover={pauseOnHover}>
        <span aria-hidden="true" style={{ display: 'inline-flex', gap: 48, padding: '0 24px' }}>
          {children}
        </span>
      </Marquee>
      <span className="sr-only" aria-live="polite" style={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </div>
  );
}
