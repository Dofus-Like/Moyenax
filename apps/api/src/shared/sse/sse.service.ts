import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

interface SseEvent {
  data: string;
  type?: string;
  id?: string;
}

@Injectable()
export class SseService {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  getStream(sessionId: string): Observable<MessageEvent> {
    if (!this.streams.has(sessionId)) {
      this.streams.set(sessionId, new Subject<MessageEvent>());
    }
    return this.streams.get(sessionId)!.asObservable();
  }

  emit(sessionId: string, event: string, data: unknown): void {
    const subject = this.streams.get(sessionId);
    if (subject) {
      const messageEvent = new MessageEvent(event, {
        data: JSON.stringify(data),
      });
      subject.next(messageEvent);
    }
  }

  removeStream(sessionId: string): void {
    const subject = this.streams.get(sessionId);
    if (subject) {
      subject.complete();
      this.streams.delete(sessionId);
    }
  }
}
