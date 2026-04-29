import { useCallback, useState } from 'react';

export type HubActionKey = 'combat' | 'vsAi' | 'rooms' | 'appearance';

type FlagMap = Record<HubActionKey, boolean>;
type ErrorMap = Record<HubActionKey, string | null>;

const INITIAL_FLAGS: FlagMap = { combat: false, vsAi: false, rooms: false, appearance: false };
const INITIAL_ERRORS: ErrorMap = { combat: null, vsAi: null, rooms: null, appearance: null };

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return fallback;
  }
  const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  return typeof message === 'string' ? message : fallback;
}

export interface HubActionState {
  busy: FlagMap;
  errors: ErrorMap;
  runAction: (key: HubActionKey, fn: () => Promise<void>, fallback: string) => Promise<void>;
  clearError: (key: HubActionKey) => void;
  setError: (key: HubActionKey, message: string | null) => void;
}

export function useHubActionState(): HubActionState {
  const [busy, setBusy] = useState<FlagMap>(INITIAL_FLAGS);
  const [errors, setErrors] = useState<ErrorMap>(INITIAL_ERRORS);

  const setError = useCallback((key: HubActionKey, message: string | null) => {
    setErrors((map) => ({ ...map, [key]: message }));
  }, []);

  const clearError = useCallback((key: HubActionKey) => {
    setErrors((map) => ({ ...map, [key]: null }));
  }, []);

  const runAction = useCallback(async (key: HubActionKey, fn: () => Promise<void>, fallback: string) => {
    setBusy((map) => ({ ...map, [key]: true }));
    setErrors((map) => ({ ...map, [key]: null }));
    try {
      await fn();
    } catch (err) {
      setErrors((map) => ({ ...map, [key]: getApiErrorMessage(err, fallback) }));
    } finally {
      setBusy((map) => ({ ...map, [key]: false }));
    }
  }, []);

  return { busy, errors, runAction, clearError, setError };
}
