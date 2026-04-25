import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactElement, ReactNode } from 'react';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
  initialEntries?: string[];
  queryClient?: QueryClient;
}

export function AllProviders({ children, initialEntries = ['/'], queryClient }: WrapperProps) {
  const qc = queryClient ?? makeQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> & {
    initialEntries?: string[];
    queryClient?: QueryClient;
  } = {},
) {
  const { initialEntries, queryClient, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries} queryClient={queryClient}>
        {children}
      </AllProviders>
    ),
    ...rest,
  });
}

export class MockEventSource implements Partial<EventSource> {
  readyState = 0;
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  listeners: Record<string, Array<(event: Event) => void>> = {};

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners[type] = this.listeners[type] ?? [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  dispatchEvent(event: Event): boolean {
    const type = event.type;
    (this.listeners[type] ?? []).forEach((l) => l(event));
    if (type === 'message' && this.onmessage) this.onmessage(event as MessageEvent);
    return true;
  }

  emitMessage(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    this.dispatchEvent(event);
  }

  close() {
    this.readyState = 2;
  }
}
