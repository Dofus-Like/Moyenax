import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

export interface RequestContext {
  requestId: string;
  method?: string;
  path?: string;
  userId?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  patch(update: Partial<RequestContext>): void {
    const store = this.storage.getStore();
    if (!store) {
      return;
    }

    Object.assign(store, update);
  }
}
