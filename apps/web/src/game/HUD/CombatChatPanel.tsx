import React from "react";
import "./CombatHUD.css"; // Uses styles from CombatHUD for now, could be split later if needed

export interface LogEntry {
  id: string;
  message: string;
  type: "damage" | "info" | "victory";
}

interface CombatChatPanelProps {
  logs: LogEntry[];
  open: boolean;
}

export function CombatChatPanel({ logs, open }: CombatChatPanelProps) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = React.useState<"combat" | "chat">("combat");
  const [chatInput, setChatInput] = React.useState("");
  const [chatMessages, setChatMessages] = React.useState<{id: string, sender: string, text: string}[]>([
    { id: '1', sender: 'Système', text: 'Bienvenue dans le chat local.' }
  ]);

  React.useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [logs.length, chatMessages.length, activeTab]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages(prev => [{ id: Date.now().toString(), sender: 'Vous', text: chatInput.trim() }, ...prev]);
    setChatInput("");
  };

  return (
    <div className={`log-panel glass ${open ? "log-panel--open" : ""}`}>
      <div className="log-panel-header">
        <button 
          className={`log-tab ${activeTab === "combat" ? "active" : ""}`}
          onClick={() => setActiveTab("combat")}
        >
          Combat
        </button>
        <button 
          className={`log-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          Chat
        </button>
      </div>

      <div className="log-panel-list" ref={listRef}>
        {activeTab === "combat" ? (
          <>
            {logs.length === 0 && (
              <>
                <div className="log-entry type-info">Combat initié…</div>
                <div className="log-entry type-damage">Adversaire subit 14 dégâts</div>
                <div className="log-entry type-info">Vous lancez Bouclier</div>
                <div className="log-entry type-info">Combat initié…</div>
                <div className="log-entry type-damage">Adversaire subit 14 dégâts</div>
                <div className="log-entry type-info">Vous lancez Bouclier</div>
              </>
            )}
            {logs.map((log) => (
              <div key={log.id} className={`log-entry type-${log.type}`}>
                {log.message}
              </div>
            ))}
          </>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <div key={msg.id} className="log-entry type-chat">
                <span className="chat-sender">{msg.sender}:</span> {msg.text}
              </div>
            ))}
          </>
        )}
      </div>

      {activeTab === "chat" && (
        <form className="log-panel-input-container" onSubmit={handleSendChat}>
          <input 
            type="text" 
            className="log-panel-input" 
            placeholder="Écrire un message..." 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
        </form>
      )}
    </div>
  );
}
