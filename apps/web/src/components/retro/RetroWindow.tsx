import React from 'react';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: 'white' | 'yellow';
}

export function RetroWindow({
  title,
  children,
  className = '',
  contentClassName = '',
  variant = 'white',
}: RetroWindowProps) {
  return (
    <div className={`retro-window ${className}`}>
      <div className="retro-titlebar">{title}</div>
      <div className={`retro-window-content ${variant === 'yellow' ? 'yellow' : ''} ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
