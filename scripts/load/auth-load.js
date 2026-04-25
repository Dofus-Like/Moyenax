/**
 * Burst d'auth pour vérifier le comportement du rate limiter.
 * Rate config : 10 login/min par IP → on doit voir ~10 200 puis des 429.
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

const s200 = new Counter('status_200');
const s401 = new Counter('status_401');
const s429 = new Counter('status_429');
const sOther = new Counter('status_other');

export const options = {
  scenarios: {
    rate_limit_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 50 },
        { duration: '10s', target: 50 },
        { duration: '5s', target: 0 },
      ],
    },
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: 'warrior@test.com',
      password: 'wrong-password-on-purpose',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status === 200 || res.status === 201) s200.add(1);
  else if (res.status === 401) s401.add(1);
  else if (res.status === 429) s429.add(1);
  else sOther.add(1);

  check(res, {
    'received response': (r) => [200, 201, 401, 429].includes(r.status),
  });
}

export function handleSummary(data) {
  return {
    stdout: `
  ╔════════════════════════════════════╗
  ║    Auth Rate Limit Load Results    ║
  ╚════════════════════════════════════╝
  200/201 (ok)         : ${data.metrics.status_200?.values.count ?? 0}
  401 (bad creds)      : ${data.metrics.status_401?.values.count ?? 0}
  429 (rate limited)   : ${data.metrics.status_429?.values.count ?? 0}
  Other                : ${data.metrics.status_other?.values.count ?? 0}

  Le rate limiter doit émettre des 429 après ~10 requêtes par fenêtre de 60s.
  Si aucun 429 n'apparaît, soit le rate limiter est mal configuré, soit
  la fenêtre est trop grande pour le volume du test.
`,
  };
}
