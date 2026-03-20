import { Injectable } from '@nestjs/common';
import { Observable, Subject, defer, finalize } from 'rxjs';
import { RuntimePerfService } from '../perf/runtime-perf.service';

interface SseMessage {
  data: unknown;
  type?: string;
  id?: string;
}

interface SseStreamEntry {
  subject: Subject<SseMessage>;
  subscribers: number;
}

@Injectable()
export class SseService {
  private readonly streams = new Map<string, SseStreamEntry>();

  constructor(private readonly runtimePerf: RuntimePerfService) {}

  getStream(sessionId: string): Observable<SseMessage> {
    return defer(() => {
      const entry = this.getOrCreateStream(sessionId);
      entry.subscribers += 1;
      this.runtimePerf.updateSseCounts(
        this.streams.size,
        this.getActiveSubscriberCount(),
      );

      return entry.subject.asObservable().pipe(
        finalize(() => {
          this.releaseSubscriber(sessionId, entry);
        }),
      );
    });
  }

  emit(sessionId: string, type: string, data: unknown): void {
    const entry = this.getOrCreateStream(sessionId);
    entry.subject.next({
      data,
      type,
    });
    this.runtimePerf.recordSseEvent(sessionId, type, entry.subscribers);
  }

  removeStream(sessionId: string): void {
    const entry = this.streams.get(sessionId);
    if (entry) {
      entry.subject.complete();
      this.streams.delete(sessionId);
      this.runtimePerf.updateSseCounts(
        this.streams.size,
        this.getActiveSubscriberCount(),
      );
    }
  }

  private getOrCreateStream(sessionId: string): SseStreamEntry {
    const existing = this.streams.get(sessionId);
    if (existing) {
      return existing;
    }

    const created: SseStreamEntry = {
      subject: new Subject<SseMessage>(),
      subscribers: 0,
    };
    this.streams.set(sessionId, created);
    this.runtimePerf.updateSseCounts(
      this.streams.size,
      this.getActiveSubscriberCount(),
    );
    return created;
  }

  private releaseSubscriber(sessionId: string, entry: SseStreamEntry): void {
    const current = this.streams.get(sessionId);
    if (!current || current !== entry) {
      return;
    }

    current.subscribers = Math.max(0, current.subscribers - 1);
    if (current.subscribers === 0) {
      this.removeStream(sessionId);
      return;
    }

    this.runtimePerf.updateSseCounts(
      this.streams.size,
      this.getActiveSubscriberCount(),
    );
  }

  private getActiveSubscriberCount(): number {
    let total = 0;
    for (const entry of this.streams.values()) {
      total += entry.subscribers;
    }

    return total;
  }
}
