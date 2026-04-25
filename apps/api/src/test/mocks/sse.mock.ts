export type SseMock = {
  emit: jest.Mock;
  getStream: jest.Mock;
  removeStream: jest.Mock;
  getSubscriberCount: jest.Mock;
  emittedEvents: Array<{ sessionId: string; type: string; payload: unknown }>;
};

export function makeSseMock(): SseMock {
  const emittedEvents: Array<{ sessionId: string; type: string; payload: unknown }> = [];

  const emit = jest.fn((sessionId: string, message: { type: string; payload: unknown }) => {
    emittedEvents.push({ sessionId, ...message });
  });

  return {
    emit,
    getStream: jest.fn(),
    removeStream: jest.fn(),
    getSubscriberCount: jest.fn().mockReturnValue(0),
    emittedEvents,
  };
}
