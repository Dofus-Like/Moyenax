/**
 * Matchmaking stress : simule 100 joueurs qui rejoignent la queue en rafale.
 *
 * Objectif : vérifier que le fix du bug #6 (lock distribué + TTL suffisant)
 * tient sous pression — pas de joueurs orphelins, ~50 sessions créées.
 *
 * Prérequis : seeds 100 users de test via scripts/dev/seed-load-users.mjs (à créer si nécessaire).
 * Pour un test rapide sans seed, on peut utiliser register en early stage.
 *
 * Exécution :
 *   k6 run scripts/load/matchmaking-stress.js
 */
import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const NB_USERS = Number(__ENV.NB_USERS || 100);

const matchedCounter = new Counter('matched_total');
const searchingCounter = new Counter('searching_total');
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    burst_join: {
      executor: 'per-vu-iterations',
      vus: NB_USERS,
      iterations: 1,
      maxDuration: '60s',
    },
  },
  thresholds: {
    error_rate: ['rate<0.05'], // < 5% d'erreurs acceptables
    http_req_duration: ['p(95)<2000'], // 2s au pire
  },
};

function registerAndLogin(i) {
  const email = `loadtest-${Date.now()}-${i}@test.com`;
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email,
      username: `loadtest-${i}-${Math.random().toString(36).slice(2, 6)}`,
      password: 'password123',
      selectedClass: 'warrior',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status !== 201) {
    errorRate.add(1);
    return null;
  }
  errorRate.add(0);
  return res.json('accessToken');
}

export default function () {
  const vuIdx = __VU;
  let token;

  group('register', () => {
    token = registerAndLogin(vuIdx);
  });

  if (!token) return;

  group('join_queue', () => {
    const res = http.post(
      `${BASE_URL}/game-session/join-queue`,
      null,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    check(res, {
      'join-queue status 201': (r) => r.status === 201,
    });

    const status = res.json('status');
    if (status === 'matched') matchedCounter.add(1);
    else if (status === 'searching') searchingCounter.add(1);
    else errorRate.add(1);
  });
}

export function handleSummary(data) {
  const matched = data.metrics.matched_total?.values.count ?? 0;
  const searching = data.metrics.searching_total?.values.count ?? 0;

  // Un match = 1 réponse "matched" (le matcheur), l'autre joueur est searching
  // Donc on s'attend à matched === searching ~= nbUsers/2
  const expectedMatches = Math.floor(NB_USERS / 2);
  const matchesReasonable = matched >= expectedMatches * 0.8 && matched <= expectedMatches * 1.2;

  const summary = {
    stdout: `
  ╔════════════════════════════════════╗
  ║    Matchmaking Load Test Results   ║
  ╚════════════════════════════════════╝
  Users total              : ${NB_USERS}
  Responses 'matched'      : ${matched}
  Responses 'searching'    : ${searching}
  Expected matches         : ~${expectedMatches}
  Matches within 20% range : ${matchesReasonable ? '✅' : '❌'}
  Error rate               : ${((data.metrics.error_rate?.values.rate ?? 0) * 100).toFixed(2)}%
  p95 latency              : ${data.metrics.http_req_duration?.values['p(95)']?.toFixed(0) ?? '?'}ms
`,
  };
  return summary;
}
