import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HUB_ONBOARDING_KEY } from './constants';
import { readOnboardingDismissed, writeOnboardingDismissed } from './onboarding';

describe('onboarding storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when the key has never been written', () => {
    expect(readOnboardingDismissed()).toBe(false);
  });

  it('persists dismissal as the literal "true" under the documented key', () => {
    writeOnboardingDismissed();
    expect(localStorage.getItem(HUB_ONBOARDING_KEY)).toBe('true');
    expect(readOnboardingDismissed()).toBe(true);
  });

  it('does not throw when localStorage.setItem is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeOnboardingDismissed()).not.toThrow();
  });

  it('returns false when localStorage.getItem is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(readOnboardingDismissed()).toBe(false);
  });

  it('treats arbitrary string values as not-dismissed', () => {
    localStorage.setItem(HUB_ONBOARDING_KEY, '1');
    expect(readOnboardingDismissed()).toBe(false);
  });
});
