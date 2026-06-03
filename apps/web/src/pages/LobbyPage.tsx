import React from 'react';
import { useNavigate } from 'react-router-dom';

import { gameSessionApi } from '../api/game-session.api';
import { Hub3DLoader, type Hub3DLoaderState } from '../game/Hub3D/Hub3DLoader';
import { Hub3DScene } from '../game/Hub3D/Hub3DScene';
import { HubBackdrop } from '../game/Hub3D/HubBackdrop';
import { HubChatPanel } from '../game/Hub3D/HubChatPanel';
import { HubOnboardingHint } from '../game/Hub3D/HubOnboardingHint';
import { useHubMultiplayer } from '../game/Hub3D/useHubMultiplayer';
import { type PoiId } from '../game/Hub3D/constants';
import { readOnboardingDismissed, writeOnboardingDismissed } from '../game/Hub3D/onboarding';
import { deriveActivePoiList, derivePoiStateLabels } from '../game/Hub3D/poiState';
import { SKINS } from '../game/constants/skins';
import { useAuthStore } from '../store/auth.store';
import { useTranslation } from '../store/language.store';
import { useGameSession } from './GameTunnel';
import { HubPoiModal } from './HubPoiModal';
import { getApiErrorMessage, useHubActionState } from './useHubActionState';
import './LobbyPage.css';

interface Room {
  id: string;
  player1Id: string;
  player2Id: string | null;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  createdAt: string;
  p1: {
    username: string;
  };
}

const LOBBY_POLL_MS = 5000;
const QUEUE_POLL_MS = 2000;

export function LobbyPage(): React.ReactNode {
  const { player, initialize, setSkin } = useAuthStore();
  const { activeSession, refreshSession } = useGameSession();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState(true);
  const [isInQueue, setIsInQueue] = React.useState(false);
  const [activePoiId, setActivePoiId] = React.useState<PoiId | null>(null);
  const [loaderState, setLoaderState] = React.useState<Hub3DLoaderState>('loading');
  const [onboardingDismissed, setOnboardingDismissed] = React.useState(readOnboardingDismissed);
  const action = useHubActionState();
  useHubMultiplayer();

  const handleDismissOnboarding = React.useCallback((): void => {
    writeOnboardingDismissed();
    setOnboardingDismissed(true);
  }, []);

  const handleGoVsAi = React.useCallback((): void => {
    setActivePoiId('vs-ai');
    handleDismissOnboarding();
  }, [handleDismissOnboarding]);

  const handleHubReady = React.useCallback((): void => {
    window.setTimeout(() => setLoaderState('done'), 350);
  }, []);

  const handleHubError = React.useCallback((): void => {
    setLoaderState('error');
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      setLoaderState((prev) => (prev === 'loading' ? 'slow' : prev));
    }, 6000);
    return () => window.clearTimeout(t);
  }, []);

  const fetchLobbyState = React.useCallback(async () => {
    try {
      const [roomsResponse, queueResponse] = await Promise.all([
        gameSessionApi.getWaitingSessions(),
        gameSessionApi.getQueueStatus(),
      ]);

      setRooms(roomsResponse.data);
      // Ne jamais repasser isInQueue à false ici : lors d'un match le serveur retire le
      // joueur de la file AVANT que la session soit visible. On ne quitte la recherche que
      // sur session active (navigation) ou annulation explicite — sinon le joueur en
      // attente perd son polling et n'est jamais envoyé dans la room.
      setIsInQueue((prev) => prev || (Boolean(queueResponse.data?.queued) && !activeSession));
    } catch (error) {
      console.error('Failed to fetch lobby state', error);
    } finally {
      setLoadingRooms(false);
    }
  }, [activeSession]);

  React.useEffect(() => {
    void initialize();
    void fetchLobbyState();
    const interval = window.setInterval(() => {
      void fetchLobbyState();
    }, LOBBY_POLL_MS);

    return () => window.clearInterval(interval);
  }, [fetchLobbyState, initialize]);

  React.useEffect(() => {
    void fetchLobbyState();
  }, [activeSession?.id, activeSession?.status, fetchLobbyState]);

  React.useEffect(() => {
    if (!activeSession) {
      return;
    }

    setIsInQueue(false);

    if (activeSession.status === 'ACTIVE') {
      navigate('/farming');
    }
  }, [activeSession, navigate]);

  const handleCreateRoom = async () => {
    await action.runAction('rooms', async () => {
      await gameSessionApi.createPrivateSession();
      await refreshSession({ silent: true });
      await fetchLobbyState();
    }, t('createRoom'));
  };

  const handleCancelOpenSession = async () => {
    if (!activeSession) return;
    await action.runAction('rooms', async () => {
      await gameSessionApi.endSession(activeSession.id);
      await refreshSession({ silent: true });
      await fetchLobbyState();
    }, t('cancelRoom'));
  };

  const handleJoinRoom = async (sessionId: string) => {
    await action.runAction('rooms', async () => {
      try {
        await gameSessionApi.joinPrivateSession(sessionId);
        await refreshSession({ silent: true });
        navigate('/farming');
      } catch (error) {
        const msg = getApiErrorMessage(error, t('join'));
        if (msg.includes('deja une room ouverte')) {
          await refreshSession({ silent: true });
          navigate('/farming');
          return;
        }
        throw error;
      }
    }, t('join'));
  };

  const handleResetSession = async () => {
    if (!window.confirm(t('resetSessionConfirm'))) {
      return;
    }
    await action.runAction('vsAi', async () => {
      await gameSessionApi.resetSession();
      await refreshSession({ silent: true });
      await fetchLobbyState();
      window.alert(t('resetSessionSuccess'));
    }, t('reset'));
  };

  const handleStartVsAiCombat = async () => {
    await action.runAction('vsAi', async () => {
      await gameSessionApi.startVsAi();
      await refreshSession({ silent: true });
      navigate('/farming');
    }, t('startVsAi'));
  };

  const handleJoinQueue = async () => {
    await action.runAction('combat', async () => {
      const response = await gameSessionApi.joinQueue();
      if (response.data?.status === 'matched') {
        await refreshSession({ silent: true });
        setIsInQueue(false);
        navigate('/farming');
        return;
      }
      setIsInQueue(true);
    }, t('startSearch'));
  };

  const handleLeaveQueue = async () => {
    await action.runAction('combat', async () => {
      await gameSessionApi.leaveQueue();
      setIsInQueue(false);
    }, t('cancel'));
  };

  const handleSetSkin = async (id: string) => {
    await action.runAction('appearance', async () => {
      await setSkin(id);
    }, 'Impossible de changer le skin.');
  };

  const { clearError } = action;
  React.useEffect(() => {
    if (activePoiId !== null) return;
    clearError('combat');
    clearError('vsAi');
    clearError('rooms');
    clearError('appearance');
  }, [activePoiId, clearError]);

  React.useEffect(() => {
    if (!isInQueue) return;

    const interval = window.setInterval(async () => {
      try {
        // On poll uniquement la session active : ne pas se baser sur la file pour arrêter
        // la recherche, sinon le joueur en attente (retiré de la file au moment du match,
        // avant que la session soit visible) perd son polling et reste bloqué dans le lobby.
        const sessionResponse = await gameSessionApi.getActiveSession();
        if (sessionResponse.data && sessionResponse.data.status === 'ACTIVE') {
          setIsInQueue(false);
          await refreshSession({ silent: true });
          navigate('/farming');
        }
      } catch (error) {
        console.error('Error polling queue/session:', error);
      }
    }, QUEUE_POLL_MS);

    return () => window.clearInterval(interval);
  }, [isInQueue, navigate, refreshSession]);

  const hasOpenSession = !!activeSession;
  const isWaitingPrivateSession =
    activeSession?.status === 'WAITING' &&
    activeSession.player1Id === player?.id &&
    activeSession.player2Id == null;
  const visibleRooms = React.useMemo(
    () => rooms.filter((room) => room.status === 'WAITING' && room.player2Id == null),
    [rooms],
  );

  const poiStateLabels = React.useMemo<Partial<Record<PoiId, string>>>(
    () => derivePoiStateLabels({ isInQueue, isWaitingPrivateSession, hasOpenSession }),
    [isInQueue, isWaitingPrivateSession, hasOpenSession],
  );

  const activePoi = React.useMemo<PoiId[]>(
    () => deriveActivePoiList({ isInQueue, isWaitingPrivateSession }),
    [isInQueue, isWaitingPrivateSession],
  );

  return (
    <div className="lobby-container">
      <section
        className="lobby-hub3d"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          overflow: 'hidden',
          background: '#07101f',
        }}
      >
        <HubBackdrop />
        <Hub3DScene
          onPoiActivate={setActivePoiId}
          activePoiId={activePoiId}
          poiStateLabels={poiStateLabels}
          activePoiIds={activePoi}
          onboardingHighlightId={!onboardingDismissed ? 'vs-ai' : null}
          onReady={handleHubReady}
          onError={handleHubError}
        />
        <Hub3DLoader state={loaderState} />
        <HubChatPanel />
        <HubOnboardingHint
          visible={!onboardingDismissed && activePoiId === null}
          onDismiss={handleDismissOnboarding}
          onGoVsAi={handleGoVsAi}
        />
        <HubPoiModal
          activePoiId={activePoiId}
          onClose={() => setActivePoiId(null)}
          combat={{
            isInQueue,
            hasOpenSession,
            busy: action.busy.combat,
            error: action.errors.combat,
            onJoinQueue: () => void handleJoinQueue(),
            onLeaveQueue: () => void handleLeaveQueue(),
            onClearError: () => action.clearError('combat'),
          }}
          vsAi={{
            hasOpenSession,
            isInQueue,
            busy: action.busy.vsAi,
            error: action.errors.vsAi,
            onStart: () => void handleStartVsAiCombat(),
            onQuickStart: () => navigate('/quick-combat'),
            onResume: () => navigate('/farming'),
            onReset: () => void handleResetSession(),
            onClearError: () => action.clearError('vsAi'),
          }}
          appearance={{
            currentSkin: player?.skin,
            username: player?.username,
            gold: player?.gold,
            busy: action.busy.appearance,
            error: action.errors.appearance,
            onSetSkin: (id) => void handleSetSkin(id),
            onClearError: () => action.clearError('appearance'),
          }}
          rooms={{
            rooms: visibleRooms,
            loading: loadingRooms,
            isWaiting: isWaitingPrivateSession,
            hasOpenSession,
            isInQueue,
            playerId: player?.id,
            busy: action.busy.rooms,
            error: action.errors.rooms,
            onCreateRoom: () => void handleCreateRoom(),
            onJoinRoom: (id) => void handleJoinRoom(id),
            onCancelRoom: () => void handleCancelOpenSession(),
            onClearError: () => action.clearError('rooms'),
            onPlayground: () => navigate('/playground'),
          }}
        />
      </section>

      <section className="lobby-skins">
        <div className="lobby-section-header">
          <h2>🎭 {t('chooseAppearance')}</h2>
        </div>
        <div className="skins-grid">
          {SKINS.map((skin) => (
            <div
              key={skin.id}
              className={`skin-card ${player?.skin === skin.id ? 'active' : ''}`}
              onClick={() => void handleSetSkin(skin.id)}
            >
              <div className="skin-preview-container">
                <div
                  className={`skin-sprite-icon type-${skin.type} avatar-${skin.type === 'soldier' ? 'soldier' : 'orc'}`}
                  style={{
                    filter: `hue-rotate(${skin.hue}deg) saturate(${skin.saturation})`,
                    backgroundImage: `url(/assets/sprites/${skin.type}/idle.png)`,
                  }}
                />
              </div>
              <div className="skin-info">
                <span className="skin-name">{skin.name}</span>
                <span className="skin-desc">{skin.description}</span>
              </div>
              {player?.skin === skin.id && <div className="skin-current-badge">{t('active')}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="lobby-matchmaking">
        <div className="matchmaking-card">
          <div className="matchmaking-info">
            <h3>🎮 {t('randomMatch')}</h3>
            <p>{t('randomMatchDesc')}</p>
          </div>
          {isInQueue && (
            <div className="queue-status">
              <div className="loader-dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </div>
              <span>{t('searchingOpponent')}</span>
              <button type="button" className="leave-queue-btn" onClick={handleLeaveQueue}>
                {t('cancel')}
              </button>
            </div>
          )}
          {!isInQueue && isWaitingPrivateSession && (
            <div className="queue-status">
              <span>{t('privateRoomWaiting')}</span>
              <button type="button" className="leave-queue-btn" onClick={handleCancelOpenSession}>
                {t('cancelRoom')}
              </button>
            </div>
          )}
          {!isInQueue && !isWaitingPrivateSession && (
            <button
              type="button"
              className="join-queue-btn"
              onClick={handleJoinQueue}
              disabled={hasOpenSession}
            >
              {t('startSearch')}
            </button>
          )}
        </div>
      </section>

      <section className="lobby-combat">
        <div className="lobby-section-header">
          <h2>⚔️ {t('customRooms')}</h2>
          <div className="lobby-combat-actions">
            <button
              type="button"
              className="lobby-btn action"
              onClick={isWaitingPrivateSession ? handleCancelOpenSession : handleCreateRoom}
              disabled={isInQueue || (hasOpenSession && !isWaitingPrivateSession)}
            >
              {isWaitingPrivateSession ? t('cancelRoom') : t('createRoom')}
            </button>
          </div>
        </div>

        <div className="rooms-grid">
          {(() => {
            if (loadingRooms) return <div className="no-rooms">{t('loadingRooms')}</div>;
            if (visibleRooms.length === 0) return <div className="no-rooms">{t('noRooms')}</div>;
            return visibleRooms.map((room) => (
              <div key={room.id} className="room-card">
                <div className="room-info">
                  <span className="room-host">{room.p1.username}</span>
                  <span className="room-date">{new Date(room.createdAt).toLocaleTimeString()}</span>
                </div>
                <button
                  type="button"
                  className="room-join-btn"
                  onClick={() => void handleJoinRoom(room.id)}
                  disabled={room.player1Id === player?.id || hasOpenSession || isInQueue}
                >
                  {room.player1Id === player?.id ? t('yourRoom') : t('join')}
                </button>
              </div>
            ));
          })()}
        </div>

        <div className="vs-ai-card">
          <div className="vs-ai-card-info">
            <h3>
              🤖 VS AI <span className="hot-badge">PROG</span>
            </h3>
            <p>{t('vsAiDesc')}</p>
          </div>
          <button
            type="button"
            className={`vs-ai-btn ${hasOpenSession ? 'resume' : ''}`}
            onClick={hasOpenSession ? () => navigate('/farming') : handleStartVsAiCombat}
            disabled={isInQueue}
          >
            {hasOpenSession ? t('resumeGame') : t('startVsAi')}
          </button>

          {!hasOpenSession && (
            <button
              type="button"
              className="quick-combat-btn"
              onClick={() => navigate('/quick-combat')}
              disabled={isInQueue}
            >
              ⚡ Combat direct
            </button>
          )}

          {hasOpenSession && (
            <button
              type="button"
              className="reset-session-link"
              onClick={handleResetSession}
            >
              🔄 {t('reset')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
