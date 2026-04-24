import { usePerfHudStore } from './perf-hud.store';

let installed = false;
let idSeed = 0;

interface SsePayloadCandidate {
  type?: unknown;
}

function extractType(raw: string, fallbackEventType: string): string {
  if (!raw) return fallbackEventType;
  try {
    const parsed = JSON.parse(raw) as SsePayloadCandidate;
    if (parsed && typeof parsed.type === 'string') {
      return parsed.type;
    }
  } catch {
    // not JSON
  }
  return fallbackEventType;
}

export function installSseInspector(): void {
  if (installed || typeof window === 'undefined') return;
  const NativeEventSource = window.EventSource;
  if (!NativeEventSource) return;
  installed = true;

  class PatchedEventSource extends NativeEventSource {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(url, init);
      const source = typeof url === 'string' ? url : url.toString();

      const record = (event: MessageEvent) => {
        idSeed += 1;
        const data = typeof event.data === 'string' ? event.data : '';
        const type = extractType(data, event.type);
        const store = usePerfHudStore.getState();
        const keepData = data.length <= 2000;
        store.pushSseEvent({
          id: idSeed,
          source,
          type,
          sizeBytes: data.length,
          at: Date.now(),
          data: keepData ? data : `${data.slice(0, 200)}… (${data.length}B truncated)`,
        });
      };

      this.addEventListener('message', record);

      const originalAddEventListener = this.addEventListener.bind(this);
      this.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean) => {
        if (type !== 'message' && type !== 'open' && type !== 'error') {
          const wrapped = (event: Event) => {
            if (event instanceof MessageEvent) record(event);
            if (typeof listener === 'function') listener(event);
            else if (listener && typeof listener.handleEvent === 'function') listener.handleEvent(event);
          };
          return originalAddEventListener(type, wrapped as EventListener, options);
        }
        return originalAddEventListener(type, listener, options);
      }) as typeof this.addEventListener;
    }
  }

  // @ts-expect-error - override the global
  window.EventSource = PatchedEventSource;
}
