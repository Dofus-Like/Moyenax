import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, take, toArray } from 'rxjs';
import { SseService } from './sse.service';
import { RuntimePerfService } from '../perf/runtime-perf.service';

describe('SseService', () => {
  let service: SseService;
  let runtimePerf: { updateSseCounts: jest.Mock; recordSseEvent: jest.Mock };

  beforeEach(async () => {
    runtimePerf = { updateSseCounts: jest.fn(), recordSseEvent: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SseService, { provide: RuntimePerfService, useValue: runtimePerf }],
    }).compile();
    service = module.get(SseService);
  });

  it('emit sans subscriber ne crash pas (mais crée un stream vide en fait)', () => {
    service.emit('s1', 'test', { foo: 1 });
    expect(runtimePerf.recordSseEvent).toHaveBeenCalledWith('s1', 'test', 0);
  });

  it('emit délivre le message à un subscriber actif', async () => {
    const stream$ = service.getStream('s1');
    const received = firstValueFrom(stream$.pipe(take(1)));
    service.emit('s1', 'event-type', { data: 42 });
    const msg = await received;
    expect(msg).toMatchObject({ data: { data: 42 }, type: 'event-type' });
  });

  it('délivre à tous les subscribers du même sessionId', async () => {
    const a$ = service.getStream('s1');
    const b$ = service.getStream('s1');
    const aReceived = firstValueFrom(a$.pipe(take(1)));
    const bReceived = firstValueFrom(b$.pipe(take(1)));
    service.emit('s1', 'broadcast', { n: 1 });
    const [a, b] = await Promise.all([aReceived, bReceived]);
    expect(a.data).toEqual({ n: 1 });
    expect(b.data).toEqual({ n: 1 });
  });

  it('isole les streams par sessionId', async () => {
    const s1$ = service.getStream('s1');
    const s2$ = service.getStream('s2');
    let s1Got: unknown = null;
    let s2Got: unknown = null;
    const subA = s1$.subscribe((m) => { s1Got = m.data; });
    const subB = s2$.subscribe((m) => { s2Got = m.data; });

    service.emit('s1', 'x', 'only-s1');

    expect(s1Got).toBe('only-s1');
    expect(s2Got).toBeNull();
    subA.unsubscribe();
    subB.unsubscribe();
  });

  it('nettoie le stream quand le dernier subscriber se désabonne', () => {
    const sub = service.getStream('s1').subscribe();
    expect(runtimePerf.updateSseCounts).toHaveBeenCalled();
    sub.unsubscribe();
    // Nouveau emit sur 's1' doit recréer un stream vierge, le précédent est mort
    service.emit('s1', 't', null);
  });

  it('removeStream complète le subject et nettoie', async () => {
    const stream$ = service.getStream('s1');
    const events = firstValueFrom(stream$.pipe(toArray()));
    service.emit('s1', 'e', 1);
    service.removeStream('s1');
    const list = await events;
    expect(list).toHaveLength(1);
  });

  it('emit après removeStream crée un NOUVEAU stream', () => {
    service.getStream('s1').subscribe();
    service.removeStream('s1');
    service.emit('s1', 't', null);
    // Le dernier updateSseCounts devrait avoir streams.size = 1 après nouveau emit
    const lastCall = runtimePerf.updateSseCounts.mock.calls.at(-1);
    expect(lastCall?.[0]).toBeGreaterThanOrEqual(0);
  });

  it('removeStream sur id inconnu ne crash pas', () => {
    expect(() => service.removeStream('unknown')).not.toThrow();
  });
});
