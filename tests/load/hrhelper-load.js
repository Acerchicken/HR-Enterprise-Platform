import http from 'k6/http';
import { check, group } from 'k6';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const KEYCLOAK_TOKEN_URL = __ENV.KEYCLOAK_TOKEN_URL || 'http://localhost:8080/realms/hr/protocol/openid-connect/token';
const CLIENT_ID = __ENV.OIDC_CLIENT_ID || 'hr-api-test';
const PASSWORD = __ENV.TEST_PASSWORD || 'Passw0rd!';
const PROFILE = __ENV.LOAD_PROFILE || 'nfr'; // smoke | nfr | spike

const readLatency = new Trend('nfr_1_1_read_ms', true);     // NFR-1.1: p95 < 300 ms, p99 < 1000 ms
const writeLatency = new Trend('nfr_1_2_write_ms', true);   // NFR-1.2: p95 < 500 ms, p99 < 1500 ms
const searchLatency = new Trend('nfr_1_3_search_ms', true); // NFR-1.3: p95 < 1000 ms
const auditLatency = new Trend('nfr_2_4_audit_ms', true);   // NFR-2.4: p95 < 1000 ms

const SCENARIOS = {
  smoke: {
    executor: 'constant-arrival-rate',
    rate: 10,
    timeUnit: '1s',
    duration: '30s',
    preAllocatedVUs: 20,
    maxVUs: 50,
  },
  nfr: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 100,
    maxVUs: 500,
    stages: [
      { target: 50, duration: '1m' },
      { target: 50, duration: '15m' },
      { target: 0, duration: '30s' },
    ],
  },
  spike: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 150,
    maxVUs: 500,
    stages: [
      { target: 50, duration: '30s' },
      { target: 250, duration: '1m' },
      { target: 50, duration: '30s' },
      { target: 0, duration: '15s' },
    ],
  },
};

export const options = {
  scenarios: {
    hr_workload: SCENARIOS[PROFILE] || SCENARIOS.nfr,
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    nfr_1_1_read_ms: ['p(95)<300', 'p(99)<1000'],
    nfr_1_2_write_ms: ['p(95)<500', 'p(99)<1500'],
    nfr_1_3_search_ms: ['p(95)<1000'],
    nfr_2_4_audit_ms: ['p(95)<1000'],
  },
};

function fetchToken(username) {
  const res = http.post(
    KEYCLOAK_TOKEN_URL,
    { client_id: CLIENT_ID, grant_type: 'password', username, password: PASSWORD },
    { tags: { name: 'oidc_token' } },
  );
  if (res.status !== 200) {
    throw new Error(`Token error (${username}): HTTP ${res.status} - ${res.body}`);
  }
  return res.json('access_token');
}

function fetchAllTokens() {
  return {
    employee: fetchToken('employee'),
    manager: fetchToken('manager'),
    hr: fetchToken('hr'),
    fetchedAt: Date.now(),
  };
}

export function setup() {
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'API health 200': (r) => r.status === 200 });
  return fetchAllTokens();
}

let vuTokens = null;

function getTokens(initialTokens) {
  if (!vuTokens) vuTokens = { ...initialTokens };
  if (Date.now() - vuTokens.fetchedAt > 8 * 60 * 1000) {
    vuTokens = fetchAllTokens();
  }
  return vuTokens;
}

function authHeaders(token, extra = {}) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extra,
    },
  };
}

function weekday2026(vuId, iter) {
  const slot = ((vuId - 1) * 37 + iter) % 240;
  let weekOffset = Math.floor(slot / 5);
  if (weekOffset >= 16) weekOffset += 1;
  const dayOffset = slot % 5;
  const d = new Date(Date.UTC(2026, 0, 5 + weekOffset * 7 + dayOffset));
  return d.toISOString().slice(0, 10);
}

export default function (initialTokens) {
  const tokens = getTokens(initialTokens);
  const userPool = [tokens.employee, tokens.manager, tokens.hr];
  const activeToken = userPool[(__VU + __ITER) % userPool.length];
  const roll = Math.random();

  if (roll < 0.70) {
    group('NFR-1.1 Read APIs', () => {
      const pick = Math.random();
      let res;
      if (pick < 0.25) {
        res = http.get(`${BASE_URL}/me`, { ...authHeaders(activeToken), tags: { name: 'GET /me' } });
      } else if (pick < 0.50) {
        res = http.get(`${BASE_URL}/employees?size=20`, { ...authHeaders(activeToken), tags: { name: 'GET /employees' } });
      } else if (pick < 0.70) {
        res = http.get(`${BASE_URL}/leave-balances/me`, { ...authHeaders(activeToken), tags: { name: 'GET /leave-balances/me' } });
      } else if (pick < 0.85) {
        res = http.get(`${BASE_URL}/leave-requests/pending-approval`, { ...authHeaders(tokens.manager), tags: { name: 'GET /leave-requests/pending-approval' } });
      } else {
        res = http.get(`${BASE_URL}/leave-requests/me?size=20`, { ...authHeaders(activeToken), tags: { name: 'GET /leave-requests/me' } });
      }
      readLatency.add(res.timings.duration);
      check(res, { 'read status 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.82) {
    group('NFR-1.3 Search API', () => {
      const keywords = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ'];
      const q = encodeURIComponent(keywords[(__VU + __ITER) % keywords.length]);
      const res = http.get(`${BASE_URL}/employees?q=${q}&size=20`, {
        ...authHeaders(activeToken),
        tags: { name: 'GET /employees?q=' },
      });
      searchLatency.add(res.timings.duration);
      check(res, { 'search status 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.90) {
    group('NFR-2.4 Audit Query', () => {
      const res = http.get(`${BASE_URL}/audit-logs?size=20`, {
        ...authHeaders(tokens.hr),
        tags: { name: 'GET /audit-logs' },
      });
      auditLatency.add(res.timings.duration);
      check(res, { 'audit status 200': (r) => r.status === 200 });
    });
  } else {
    group('NFR-1.2 Leave Create & Cancel', () => {
      const day = weekday2026(__VU, __ITER);
      const idemKey = `k6-${__VU}-${__ITER}-${Date.now()}`;
      const createRes = http.post(
        `${BASE_URL}/leave-requests`,
        JSON.stringify({ leaveType: 'UNPAID', startDate: day, endDate: day, reason: 'k6 load test' }),
        { ...authHeaders(activeToken, { 'Idempotency-Key': idemKey }), tags: { name: 'POST /leave-requests' } },
      );
      writeLatency.add(createRes.timings.duration);
      const createdOk = check(createRes, { 'create leave 201': (r) => r.status === 201 });

      if (createdOk) {
        const created = createRes.json();
        const cancelRes = http.post(
          `${BASE_URL}/leave-requests/${created.id}/cancel`,
          JSON.stringify({ version: created.version }),
          { ...authHeaders(activeToken), tags: { name: 'POST /leave-requests/:id/cancel' } },
        );
        writeLatency.add(cancelRes.timings.duration);
        check(cancelRes, { 'cancel leave 200': (r) => r.status === 200 });
      }
    });
  }
}
