/**
 * Soak test : 20 VUs pendant 5 minutes sur /health.
 * Détecte les fuites mémoire / dégradation progressive de latence.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

const healthLatency = new Trend('health_latency_ms');

export const options = {
  scenarios: {
    soak: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 20),
      duration: __ENV.DURATION || '5m',
    },
  },
  thresholds: {
    health_latency_ms: ['p(95)<100', 'p(99)<300'],
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  healthLatency.add(res.timings.duration);
  check(res, {
    'status 200': (r) => r.status === 200,
    'database ok': (r) => r.json('services.database') === 'ok',
    'redis ok': (r) => r.json('services.redis') === 'ok',
  });
  sleep(0.5);
}
