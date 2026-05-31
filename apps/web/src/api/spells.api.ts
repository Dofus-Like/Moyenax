import type { SpellDefinition } from '@game/shared-types';
import { apiClient } from './client';

export const spellsApi = {
  getAll: () => apiClient.get<SpellDefinition[]>('/spells'),
  getOne: (id: string) => apiClient.get<SpellDefinition>(`/spells/${id}`),
  create: (data: Partial<SpellDefinition>) => apiClient.post<SpellDefinition>('/spells', data),
  update: (id: string, data: Partial<SpellDefinition>) => apiClient.put<SpellDefinition>(`/spells/${id}`, data),
  remove: (id: string) => apiClient.delete(`/spells/${id}`),
};
