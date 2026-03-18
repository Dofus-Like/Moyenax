import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface SseMessage {
  data: any;
  type?: string;
  id?: string;
}

@Injectable()
export class SseService {
  private readonly streams = new Map<string, Subject<SseMessage>>();

  getStream(sessionId: string): Observable<any> {
    if (!this.streams.has(sessionId)) {
      this.streams.set(sessionId, new Subject<SseMessage>());
    }
    // NestJS attend un objet avec { data }
    return this.streams.get(sessionId)!.asObservable();
  }

  emit(sessionId: string, type: string, data: unknown): void {
    const subject = this.streams.get(sessionId);
    if (!subject) {
      // Si le stream n'existe pas encore, on l'initialise
      this.getStream(sessionId);
      this.emit(sessionId, type, data);
      return;
    }
    
    subject.next({
      data,
      type,
    });
  }

  removeStream(sessionId: string): void {
    const subject = this.streams.get(sessionId);
    if (subject) {
      subject.complete();
      this.streams.delete(sessionId);
    }
  }
}
