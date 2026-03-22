import { SetMetadata } from '@nestjs/common';
import type { SseResourceType } from './sse-ticket.service';

export const SSE_RESOURCE_TYPE_KEY = 'sse-resource-type';

export const SseTicketResource = (resourceType: SseResourceType) =>
  SetMetadata(SSE_RESOURCE_TYPE_KEY, resourceType);
