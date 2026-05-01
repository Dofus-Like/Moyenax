import { HUB_ONBOARDING_KEY } from './constants';

export function readOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(HUB_ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeOnboardingDismissed(): void {
  try {
    localStorage.setItem(HUB_ONBOARDING_KEY, 'true');
  } catch {
    /* localStorage indisponible */
  }
}
