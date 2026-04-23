import React, { useState, useEffect } from 'react';

const FONTS = [
  { name: 'Cinzel (Default)', value: "'Cinzel', serif" },
  { name: 'MedievalSharp', value: "'MedievalSharp', cursive" },
  { name: 'Metamorphous', value: "'Metamorphous', cursive" },
  { name: 'Quicksand (Modern)', value: "'Quicksand', sans-serif" },
  { name: 'Great Vibes (Elegant)', value: "'Great Vibes', cursive" },
];

interface ThemeDebuggerProps {
  showUI?: boolean;
}

export function ThemeDebugger({ showUI = false }: ThemeDebuggerProps) {
  // Load saved settings
  const savedFont = localStorage.getItem('rpg-debug-font') || FONTS[0].value;
  const savedIntensity = Number(localStorage.getItem('rpg-debug-intensity')) || 6;

  const [activeFont, setActiveFont] = useState(savedFont);
  const [intensity, setIntensity] = useState(savedIntensity);
  const [isVisible, setIsVisible] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-main', activeFont);
  }, [activeFont]);

  const handleSave = () => {
    localStorage.setItem('rpg-debug-font', activeFont);
    localStorage.setItem('rpg-debug-intensity', intensity.toString());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <filter id="torn-edge-filter">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5" stitchTiles="stitch" />
            <feDisplacementMap in="SourceGraphic" scale={intensity} />
          </filter>
        </defs>
      </svg>

      {showUI && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 10000 }}>
          {!isVisible ? (
            <button onClick={() => setIsVisible(true)} style={{ background: '#8d6e63', color: '#fff', border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}>🛠️</button>
          ) : (
            <div style={{ background: '#fffef0', border: '2px solid #8d6e63', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: 260, fontSize: 13, fontFamily: 'sans-serif', color: '#2f2621' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <strong style={{ color: '#5d4037' }}>📜 DA CUSTOMIZER</strong>
                <button onClick={() => setIsVisible(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, textTransform: 'uppercase', color: '#8d6e63', fontWeight: 700, marginBottom: 4 }}>Parchment Edge: <span>{intensity}</span></label>
                <input type="range" min="0" max="25" step="0.5" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                <label style={{ fontSize: 10, textTransform: 'uppercase', color: '#8d6e63', fontWeight: 700 }}>Typography</label>
                {FONTS.map(font => (
                  <button key={font.name} onClick={() => setActiveFont(font.value)} style={{ padding: '4px 8px', borderRadius: 4, border: activeFont === font.value ? '2px solid #d4af37' : '1px solid #e8d0a9', background: activeFont === font.value ? '#f5e6c8' : '#fff', textAlign: 'left', fontFamily: font.value, cursor: 'pointer', fontSize: 11 }}>{font.name}</button>
                ))}
              </div>

              <button onClick={handleSave} style={{ width: '100%', padding: '10px', background: saved ? '#2e7d32' : '#8d6e63', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}>
                {saved ? '✔️ Saved!' : '💾 Sauvegarder'}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
