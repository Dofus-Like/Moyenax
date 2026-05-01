import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getApiErrorMessage, useHubActionState } from './useHubActionState';

describe('getApiErrorMessage', () => {
  it('falls back when the error is not an axios-like object', () => {
    expect(getApiErrorMessage(null, 'fb')).toBe('fb');
    expect(getApiErrorMessage(undefined, 'fb')).toBe('fb');
    expect(getApiErrorMessage(new Error('boom'), 'fb')).toBe('fb');
  });

  it('extracts response.data.message when it is a string', () => {
    const err = { response: { data: { message: 'plein' } } };
    expect(getApiErrorMessage(err, 'fb')).toBe('plein');
  });

  it('falls back when response.data.message is not a string', () => {
    const err = { response: { data: { message: { nested: 'oops' } } } };
    expect(getApiErrorMessage(err, 'fb')).toBe('fb');
  });
});

describe('useHubActionState', () => {
  it('starts with all flags off and no errors', () => {
    const { result } = renderHook(() => useHubActionState());
    expect(result.current.busy).toEqual({ combat: false, vsAi: false, rooms: false, appearance: false });
    expect(result.current.errors).toEqual({ combat: null, vsAi: null, rooms: null, appearance: null });
  });

  it('toggles busy around a successful runAction', async () => {
    const { result } = renderHook(() => useHubActionState());
    let busyDuringRun = false;
    await act(async () => {
      const promise = result.current.runAction(
        'combat',
        async () => {
          busyDuringRun = true;
        },
        'fb',
      );
      await promise;
    });
    expect(busyDuringRun).toBe(true);
    expect(result.current.busy.combat).toBe(false);
    expect(result.current.errors.combat).toBeNull();
  });

  it('records an error message when runAction throws', async () => {
    const { result } = renderHook(() => useHubActionState());
    await act(async () => {
      await result.current.runAction(
        'rooms',
        async () => {
          throw { response: { data: { message: 'room pleine' } } };
        },
        'Impossible',
      );
    });
    expect(result.current.errors.rooms).toBe('room pleine');
    expect(result.current.busy.rooms).toBe(false);
  });

  it('uses the fallback message when the thrown error has no API message', async () => {
    const { result } = renderHook(() => useHubActionState());
    await act(async () => {
      await result.current.runAction('vsAi', async () => { throw new Error('low-level'); }, 'Impossible VS AI');
    });
    expect(result.current.errors.vsAi).toBe('Impossible VS AI');
  });

  it('clears a previously recorded error', async () => {
    const { result } = renderHook(() => useHubActionState());
    await act(async () => {
      await result.current.runAction('appearance', async () => { throw new Error('x'); }, 'fb');
    });
    expect(result.current.errors.appearance).toBe('fb');
    act(() => result.current.clearError('appearance'));
    expect(result.current.errors.appearance).toBeNull();
  });

  it('resets a previous error at the start of a new runAction', async () => {
    const { result } = renderHook(() => useHubActionState());
    await act(async () => {
      await result.current.runAction('combat', async () => { throw new Error('x'); }, 'fb');
    });
    expect(result.current.errors.combat).toBe('fb');
    await act(async () => {
      await result.current.runAction('combat', async () => { /* ok */ }, 'fb');
    });
    expect(result.current.errors.combat).toBeNull();
  });
});
