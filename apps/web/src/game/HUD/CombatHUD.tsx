import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CombatPlayer } from "@game/shared-types";
import { CombatActionType, SpellFamily } from "@game/shared-types";

import { combatApi } from "../../api/combat.api";
import {
  SpellBar,
  type SpellBarItem,
} from "../../components/SpellBar/SpellBar";
import { useGameSession } from "../../pages/GameTunnel";
import { useAuthStore } from "../../store/auth.store";
import { useCombatStore } from "../../store/combat.store";
import { useTranslation } from "../../store/language.store";
import { assetUrl } from "../constants/assetUrl";

import { CombatPlayerPanel } from "./CombatPlayerPanel";
import { EndTurnButton } from "./EndTurnButton";
import { TurnTracker } from "./TurnTracker";

import "./CombatHUD.css";

const SPELL_FAMILY_ORDER: Record<SpellFamily, number> = {
  [SpellFamily.COMMON]: 1,
  [SpellFamily.WARRIOR]: 2,
  [SpellFamily.MAGE]: 3,
  [SpellFamily.NINJA]: 4,
};

function getCombatErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response
      ?.data?.message === "string"
  ) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message ?? fallback
    );
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function buildSpellItems(player: CombatPlayer): SpellBarItem[] {
  const sorted = [...player.spells].sort((a, b) => {
    const familyDiff =
      SPELL_FAMILY_ORDER[a.family] - SPELL_FAMILY_ORDER[b.family];
    if (familyDiff !== 0) return familyDiff;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
  return sorted.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    iconPath: s.iconPath,
    paCost: s.paCost,
    family: s.family,
    sortOrder: s.sortOrder,
    cooldown: player.spellCooldowns[s.id],
    damage: s.damage,
    effectKind: s.effectKind,
    effectConfig: s.effectConfig,
    minRange: s.minRange,
    maxRange: s.maxRange,
  }));
}

import { CombatChatPanel, type LogEntry } from "./CombatChatPanel";

export function CombatHUD() {
  const { t } = useTranslation();
  const combatState = useCombatStore((s) => s.combatState);
  const sessionId = useCombatStore((s) => s.sessionId);
  const selectedSpellId = useCombatStore((s) => s.selectedSpellId);
  const setSelectedSpell = useCombatStore((s) => s.setSelectedSpell);
  const setCombatState = useCombatStore((s) => s.setCombatState);
  const winnerId = useCombatStore((s) => s.winnerId);
  const disconnect = useCombatStore((s) => s.disconnect);
  const uiMessage = useCombatStore((s) => s.uiMessage);
  const setUiMessage = useCombatStore((s) => s.setUiMessage);
  const logs = useCombatStore((s) => s.logs);
  const surrender = useCombatStore((s) => s.surrender);
  const toggleTacticsMode = useCombatStore((s) => s.toggleTacticsMode);
  const tacticsMode = useCombatStore((s) => s.tacticsMode);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [statsOpen, setStatsOpen] = React.useState(false);
  const [unseenCount, setUnseenCount] = React.useState(0);
  const [isToastExiting, setIsToastExiting] = React.useState(false);
  const prevLogsLength = React.useRef(logs.length);

  React.useEffect(() => {
    if (logs.length > prevLogsLength.current && !logsOpen) {
      setUnseenCount((c) => c + (logs.length - prevLogsLength.current));
    }
    prevLogsLength.current = logs.length;
  }, [logs.length, logsOpen]);

  const handleToggleLogs = React.useCallback(() => {
    setLogsOpen((v) => !v);
    setUnseenCount(0);
  }, []);

  const user = useAuthStore((s) => s.player);
  const navigate = useNavigate();
  // Sur /playground, l'écran de fin de combat est géré par la page (retour bac à sable).
  const isPlaygroundRoute = useLocation().pathname.startsWith("/playground");
  const { activeSession } = useGameSession();

  const currentPlayer =
    combatState && user ? combatState.players[user.id] : null;
  const enemyId =
    combatState && user
      ? Object.keys(combatState.players).find((id) => id !== user.id)
      : null;
  const isMyTurn =
    combatState && user ? combatState.currentTurnPlayerId === user.id : false;

  React.useEffect(() => {
    if (!uiMessage) return;
    setIsToastExiting(false);
    const timer = setTimeout(() => {
      setIsToastExiting(true);
      setTimeout(() => setUiMessage(null), 200);
    }, 2400);
    return () => clearTimeout(timer);
  }, [setUiMessage, uiMessage]);

  if (!combatState || !user || !currentPlayer) return null;

  // Bac à sable /playground : pas de système de tour (ni frise, ni fin de tour, ni abandon).
  const isSandbox = combatState.isPlayground === true;

  const handleCombatExit = () => {
    disconnect();
    if (activeSession?.status === "ACTIVE") {
      navigate("/farming", { replace: true });
    } else {
      navigate("/");
    }
  };

  const handleEndTurn = async () => {
    if (!sessionId || !isMyTurn) return;
    try {
      const res = await combatApi.playAction(sessionId, {
        type: CombatActionType.END_TURN,
      });
      if (res?.data) setCombatState(res.data);
      setSelectedSpell(null);
    } catch (err) {
      setUiMessage(getCombatErrorMessage(err, t("endTurn")), "error");
    }
  };

  const isWinner = winnerId === user.id;
  const showCombatEnd = !!winnerId;
  const fighters = Object.values(combatState.players);
  const mappedSpellItems = buildSpellItems(currentPlayer);
  const canCastSpell = mappedSpellItems.some(
    (s) => s.paCost <= currentPlayer.remainingPa && (s.cooldown ?? 0) <= 0
  );
  const hasPm = currentPlayer.remainingPm > 0;

  return (
    <div className="combat-hud">
      {uiMessage && (
        <div key={uiMessage.id} className={`combat-toast${isToastExiting ? ' exiting' : ''}`}>{uiMessage.text}</div>
      )}

      {showCombatEnd && !isPlaygroundRoute && (
        <div
          className={`combat-end-overlay ${isWinner ? "victory" : "defeat"}`}
        >
          <div className="end-modal">
            <h1>{isWinner ? `🏆 ${t("victory")}` : `💀 ${t("defeat")}`}</h1>
            <p>{isWinner ? t("victoryText") : t("defeatText")}</p>
            <div className="end-modal-actions">
              <button className="exit-button" onClick={handleCombatExit}>
                {activeSession?.status === "ACTIVE"
                  ? t("continue")
                  : t("backToLobby")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP CENTER: Turn tracker (masqué en bac à sable : pas de tours) */}
      {!isSandbox && (
        <TurnTracker
          fighters={fighters}
          currentTurnPlayerId={combatState.currentTurnPlayerId}
          turnNumber={combatState.turnNumber}
          selfId={user.id}
        />
      )}

      {/* BOTTOM PLAYER PANELS */}
      <CombatPlayerPanel playerId={user.id} side="left" showStats={statsOpen} />
      {enemyId && <CombatPlayerPanel playerId={enemyId} side="right" showStats={statsOpen} />}

      {/* BOTTOM ROW: SpellBar + Chat + Actions */}
      <div className="hud-bottom-anchor">
        <div className="hud-bottom-row">
          <div className="hud-left-spacer" />

          <div className="hud-center-group">
            <div className="hud-left-actions">
              <button
                type="button"
                className="hud-log-btn"
                aria-label="Émotes"
                title="Émotes"
              >
                <img src={assetUrl('/assets/icons/emojis.png')} alt="Émotes" style={{ width: '18px', height: '18px' }} />
              </button>
              {!isSandbox && (
                <button
                  type="button"
                  className="hud-log-btn"
                  aria-label="Abandonner"
                  title="Abandonner"
                  onClick={() => {
                    if (window.confirm(t("confirmAbandon") || "Voulez-vous vraiment abandonner le combat ?")) {
                      surrender();
                      handleCombatExit();
                    }
                  }}
                >
                  <img src={assetUrl('/assets/icons/flag.png')} alt="Abandonner" style={{ width: '18px', height: '18px' }} />
                </button>
              )}
              <button
                type="button"
                className={`hud-log-btn ${tacticsMode ? "active" : ""}`}
                onClick={toggleTacticsMode}
                aria-label="Mode tactique"
                title={tacticsMode ? "Mode normal" : "Mode tactique"}
              >
                <img src={assetUrl('/assets/icons/eye.png')} alt="Tactique" style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <SpellBar
              spells={mappedSpellItems}
              selectedSpellId={selectedSpellId}
              onSpellClick={(id) => setSelectedSpell(id)}
              remainingPa={currentPlayer.remainingPa}
              maxPa={currentPlayer.stats.pa}
              remainingPm={currentPlayer.remainingPm}
              maxPm={currentPlayer.stats.pm}
              isMyTurn={isMyTurn}
              attackerStats={currentPlayer.stats}
              targetStats={
                enemyId ? combatState.players[enemyId]?.stats : undefined
              }
            >
              {!isSandbox && (
                <EndTurnButton
                  isMyTurn={isMyTurn}
                  onEndTurn={handleEndTurn}
                  canCastSpell={canCastSpell}
                  hasPm={hasPm}
                />
              )}
            </SpellBar>
          </div>

          <div className="hud-right-group">
            <div className="hud-chat-area">
              <CombatChatPanel logs={logs} open={logsOpen} />
            </div>
            <div className="hud-bottom-actions">
              <button
                type="button"
                className={`hud-log-btn ${logsOpen ? "active" : ""}`}
                onClick={handleToggleLogs}
                aria-label="Journal de combat"
              >
                <img src={assetUrl('/assets/icons/chatting.png')} alt="Journal de combat" style={{ width: '18px', height: '18px' }} />
                {unseenCount > 0 && (
                  <span className="hud-log-badge">{unseenCount}</span>
                )}
              </button>
              <button
                type="button"
                className={`hud-log-btn ${statsOpen ? "active" : ""}`}
                onClick={() => setStatsOpen((v) => !v)}
                aria-label="Statistiques"
              >
                <img src={assetUrl('/assets/icons/graph.png')} alt="Statistiques" style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
