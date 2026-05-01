import type { PoiId } from './constants';

export interface PoiStateInputs {
  isInQueue: boolean;
  isWaitingPrivateSession: boolean;
  hasOpenSession: boolean;
}

export function derivePoiStateLabels({
  isInQueue,
  isWaitingPrivateSession,
  hasOpenSession,
}: PoiStateInputs): Partial<Record<PoiId, string>> {
  const labels: Partial<Record<PoiId, string>> = {};
  if (isInQueue) labels.combat = 'Recherche…';
  if (isWaitingPrivateSession) labels.rooms = 'En attente…';
  if (hasOpenSession && !isWaitingPrivateSession) labels['vs-ai'] = 'Reprendre';
  return labels;
}

export function deriveActivePoiList(
  inputs: Pick<PoiStateInputs, 'isInQueue' | 'isWaitingPrivateSession'>,
): PoiId[] {
  const list: PoiId[] = [];
  if (inputs.isInQueue) list.push('combat');
  if (inputs.isWaitingPrivateSession) list.push('rooms');
  return list;
}
