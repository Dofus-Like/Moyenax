import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactElement } from 'react';

import { useHubStore } from '../../store/hub.store';

const PANEL: CSSProperties = {
  position: 'absolute',
  left: 16,
  bottom: 16,
  width: 480,
  maxWidth: 'calc(100vw - 32px)',
  background: 'rgba(0, 0, 0, 0.55)',
  border: '2px solid rgba(255,255,255,0.9)',
  outline: '1.5px solid rgba(0,0,0,0.85)',
  borderRadius: 6,
  padding: 8,
  zIndex: 80,
  fontFamily: 'var(--font-hud)',
  color: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  boxShadow:
    '0 8px 32px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.75), inset 0 0 40px rgba(0,0,0,0.65)',
};

const LOG: CSSProperties = {
  height: 168,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  padding: '4px 6px',
  background: 'rgba(0, 0, 0, 0.35)',
  borderRadius: 4,
};

const LINE: CSSProperties = { lineHeight: 1.35, wordBreak: 'break-word' };
const AUTHOR: CSSProperties = { color: '#a855f7', fontWeight: 700, marginRight: 6 };

const FORM: CSSProperties = { display: 'flex', gap: 6 };
const INPUT: CSSProperties = {
  flex: 1,
  background: 'rgba(0,0,0,0.55)',
  border: '2px solid rgba(255,255,255,0.3)',
  color: '#f8fafc',
  padding: '6px 8px',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'var(--font-hud)',
  outline: 'none',
};
const SEND: CSSProperties = {
  background: 'rgba(0,0,0,0.55)',
  border: '2px solid rgba(255,255,255,0.4)',
  outline: '1.5px solid rgba(0,0,0,0.85)',
  color: '#fff',
  fontWeight: 400,
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  fontFamily: 'var(--font-hud)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const MAX_LEN = 280;

function getPlaceholder(status: 'idle' | 'connecting' | 'connected' | 'error'): string {
  if (status === 'connected') return 'Parler au hub…';
  if (status === 'error') return 'Hors-ligne — relance l\'API';
  return 'Connexion…';
}

export function HubChatPanel(): ReactElement | null {
  const status = useHubStore((state) => state.status);
  const messages = useHubStore((state) => state.chat);
  const sendChat = useHubStore((state) => state.sendChat);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (status === 'idle') return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    void sendChat(trimmed);
    setDraft('');
  };

  const placeholder = getPlaceholder(status);

  return (
    <div style={PANEL}>
      <div ref={logRef} style={LOG}>
        {messages.length === 0 ? (
          <div style={{ opacity: 0.55, fontStyle: 'italic' }}>Aucun message pour le moment.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={LINE}>
              <span style={AUTHOR}>{m.username}</span>
              <span>{m.text}</span>
            </div>
          ))
        )}
      </div>
      <form style={FORM} onSubmit={handleSubmit}>
        <input
          style={INPUT}
          type="text"
          value={draft}
          maxLength={MAX_LEN}
          placeholder={placeholder}
          disabled={status !== 'connected'}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" style={SEND} disabled={status !== 'connected' || !draft.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  );
}
