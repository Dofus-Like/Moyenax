/**
 * Smoke test : vérifie que la stack répond correctement à charge légère.
 * 5 VUs pendant 30s sur /health + /version.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'], // <1% d'erreurs
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
    'health body ok': (r) => r.json('status') === 'ok',
  });

  const version = http.get(`${BASE_URL}/version`);
  check(version, {
    'version status 200': (r) => r.status === 200,
    'version has sha': (r) => r.json('sha') !== undefined,
  });

  sleep(1);
}
