import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from 'react';

import type { HubChatMessage } from '@game/shared-types';

import { useHubStore } from '../../store/hub.store';

import './HubChatPanel.css';

const MAX_LEN = 280;
const CHAT_ICON = '/assets/icons/chatting.png';

type ChatStatus = 'idle' | 'connecting' | 'connected' | 'error';

function getPlaceholder(status: ChatStatus): string {
  if (status === 'connected') return 'Parler au hub…';
  if (status === 'error') return "Hors-ligne — relance l'API";
  return 'Connexion…';
}

function HubChatList({ messages }: { messages: HubChatMessage[] }): ReactElement {
  if (messages.length === 0) {
    return <div className="log-entry type-chat hub-chat-empty">Aucun message pour le moment.</div>;
  }
  return (
    <>
      {messages.map((m) => (
        <div key={m.id} className="log-entry type-chat">
          <span className="chat-sender">{m.username}:</span> {m.text}
        </div>
      ))}
    </>
  );
}

function useUnseenCount(count: number, open: boolean): [number, () => void] {
  const [unseen, setUnseen] = useState(0);
  const prev = useRef(count);

  useEffect(() => {
    if (count > prev.current && !open) {
      setUnseen((c) => c + (count - prev.current));
    }
    prev.current = count;
  }, [count, open]);

  const reset = (): void => {
    setUnseen(0);
  };

  return [unseen, reset];
}

function ChatToggle({ open, unseen, onToggle }: { open: boolean; unseen: number; onToggle: () => void }): ReactElement {
  return (
    <button
      type="button"
      className={`hud-log-btn ${open ? 'active' : ''}`}
      onClick={onToggle}
      aria-label="Chat du hub"
      title="Chat"
    >
      <img src={CHAT_ICON} alt="Chat" width={18} height={18} />
      {unseen > 0 && <span className="hud-log-badge">{unseen}</span>}
    </button>
  );
}

interface ChatWindowProps {
  open: boolean;
  status: ChatStatus;
  draft: string;
  messages: HubChatMessage[];
  listRef: RefObject<HTMLDivElement>;
  onDraft: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function ChatWindow({ open, status, draft, messages, listRef, onDraft, onSubmit }: ChatWindowProps): ReactElement {
  return (
    <div className={`log-panel glass ${open ? 'log-panel--open' : ''}`}>
      <div className="log-panel-header">
        <span className="log-tab active">Chat</span>
      </div>
      <div className="log-panel-list" ref={listRef}>
        <HubChatList messages={messages} />
      </div>
      <form className="log-panel-input-container" onSubmit={onSubmit}>
        <input
          type="text"
          className="log-panel-input"
          placeholder={getPlaceholder(status)}
          value={draft}
          maxLength={MAX_LEN}
          disabled={status !== 'connected'}
          onChange={(event) => onDraft(event.target.value)}
        />
      </form>
    </div>
  );
}

export function HubChatPanel(): ReactElement | null {
  const status = useHubStore((state) => state.status);
  const messages = useHubStore((state) => state.chat);
  const sendChat = useHubStore((state) => state.sendChat);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [unseen, resetUnseen] = useUnseenCount(messages.length, open);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [messages.length, open]);

  if (status === 'idle') return null;

  const toggle = (): void => {
    setOpen((value) => !value);
    resetUnseen();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    void sendChat(trimmed);
    setDraft('');
  };

  return (
    <div className="hub-chat-root">
      <ChatToggle open={open} unseen={unseen} onToggle={toggle} />
      <ChatWindow
        open={open}
        status={status}
        draft={draft}
        messages={[...messages].reverse()}
        listRef={listRef}
        onDraft={setDraft}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
