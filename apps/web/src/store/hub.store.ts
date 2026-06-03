import {
  HUB_EVENTS,
  type HubChatMessage,
  type HubChatPayload,
  type HubInitialState,
  type HubJoinPayload,
  type HubLeavePayload,
  type HubMovePayload,
  type HubPlayerSnapshot,
  type HubVector2,
} from '@game/shared-types';
import { create } from 'zustand';

import { hubApi } from '../api/hub.api';
import { playSfx } from '../utils/sfx';

const HUB_STREAM_BASE = '/api/v1/hub/events/global';

export type HubConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface HubState {
  status: HubConnectionStatus;
  selfId: string | null;
  players: Record<string, HubPlayerSnapshot>;
  chat: HubChatMessage[];
  _connectionId: number;
  _eventSource: EventSource | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reportMove: (position: HubVector2, target: HubVector2) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  heartbeat: () => Promise<void>;
}

const INITIAL: Pick<HubState, 'status' | 'selfId' | 'players' | 'chat' | '_connectionId' | '_eventSource'> = {
  status: 'idle',
  selfId: null,
  players: {},
  chat: [],
  _connectionId: 0,
  _eventSource: null,
};

function indexPlayers(snapshots: HubPlayerSnapshot[]): Record<string, HubPlayerSnapshot> {
  const result: Record<string, HubPlayerSnapshot> = {};
  for (const snap of snapshots) result[snap.playerId] = snap;
  return result;
}

export const useHubStore = create<HubState>((set, get) => ({
  ...INITIAL,

  connect: async () => {
    if (get().status === 'connecting' || get().status === 'connected') return;
    const connectionId = get()._connectionId + 1;
    set({ status: 'connecting', _connectionId: connectionId });

    try {
      const initial = await hubApi.join();
      if (get()._connectionId !== connectionId) return;
      applyInitialState(set, initial.data);

      const ticket = await hubApi.getStreamTicket();
      if (get()._connectionId !== connectionId) return;

      const url = `${HUB_STREAM_BASE}?ticket=${encodeURIComponent(ticket.data.ticket)}`;
      const source = new EventSource(url);
      attachSseHandlers(source, set, get, connectionId);
      set({ _eventSource: source, status: 'connected' });
    } catch (error) {
      console.error('[hub] connect failed', error);
      set({ status: 'error' });
    }
  },

  disconnect: async () => {
    const source = get()._eventSource;
    if (source) source.close();
    set({ ...INITIAL, _connectionId: get()._connectionId + 1 });
    try {
      await hubApi.leave();
    } catch (error) {
      console.warn('[hub] leave failed', error);
    }
  },

  reportMove: async (position, target) => {
    if (get().status !== 'connected') return;
    try {
      await hubApi.move({ position, target });
    } catch (error) {
      console.warn('[hub] move failed', error);
    }
  },

  sendChat: async (text) => {
    if (get().status !== 'connected') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await hubApi.chat(trimmed);
    } catch (error) {
      console.warn('[hub] chat failed', error);
    }
  },

  heartbeat: async () => {
    if (get().status !== 'connected') return;
    try {
      await hubApi.heartbeat();
    } catch (error) {
      console.warn('[hub] heartbeat failed', error);
    }
  },
}));

type SetFn = (partial: Partial<HubState> | ((state: HubState) => Partial<HubState>)) => void;
type GetFn = () => HubState;

function applyInitialState(set: SetFn, data: HubInitialState): void {
  set({
    selfId: data.self.playerId,
    players: indexPlayers([data.self, ...data.players]),
    chat: data.chatHistory,
  });
}

function attachSseHandlers(source: EventSource, set: SetFn, get: GetFn, connectionId: number): void {
  const guard = <T,>(handler: (data: T) => void) => (event: MessageEvent): void => {
    if (get()._connectionId !== connectionId) {
      source.close();
      return;
    }
    try {
      handler(JSON.parse(event.data) as T);
    } catch (error) {
      console.error('[hub] SSE parse error', error);
    }
  };

  source.addEventListener(HUB_EVENTS.PLAYER_JOIN, guard<HubJoinPayload>(({ player }) => {
    set((state) => ({ players: { ...state.players, [player.playerId]: player } }));
  }));

  source.addEventListener(HUB_EVENTS.PLAYER_LEAVE, guard<HubLeavePayload>(({ playerId }) => {
    set((state) => {
      const next = { ...state.players };
      delete next[playerId];
      return { players: next };
    });
  }));

  source.addEventListener(HUB_EVENTS.PLAYER_MOVE, guard<HubMovePayload>((payload) => {
    set((state) => {
      const existing = state.players[payload.playerId];
      if (!existing) return {};
      return {
        players: {
          ...state.players,
          [payload.playerId]: {
            ...existing,
            position: payload.position,
            target: payload.target,
            updatedAt: payload.updatedAt,
          },
        },
      };
    });
  }));

  source.addEventListener(HUB_EVENTS.CHAT_MESSAGE, guard<HubChatPayload>(({ message }) => {
    if (message.playerId !== get().selfId) {
      playSfx('hubChatMessage');
    }
    set((state) => ({ chat: [...state.chat, message].slice(-100) }));
  }));

  source.onerror = (): void => {
    if (get()._connectionId !== connectionId) return;
    set({ status: 'error' });
  };
}
