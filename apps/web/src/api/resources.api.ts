import { apiClient } from './client';

export const resourcesApi = {
  getResources: () => apiClient.get('/map/resources'),
  gatherResource: (resourceId: string) => apiClient.post(`/map/resources/${resourceId}/gather`),
};
