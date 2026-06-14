import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Baseline load test for Cadenza admin portal (US-B-016).
 * Run: k6 run plan/load-tests/dashboard.js -e BASE_URL=https://staging.example.com -e AUTH_COOKIE="..."
 */

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_COOKIE = __ENV.AUTH_COOKIE || '';

export default function () {
  const headers = AUTH_COOKIE ? { Cookie: AUTH_COOKIE } : {};

  const dashboard = http.get(`${BASE_URL}/api/dashboard`, { headers });
  check(dashboard, { 'dashboard 200': (r) => r.status === 200 });

  const jobs = http.get(`${BASE_URL}/api/jobs?limit=50`, { headers });
  check(jobs, { 'jobs 200': (r) => r.status === 200 });

  const team = http.get(`${BASE_URL}/api/team`, { headers });
  check(team, { 'team 200': (r) => r.status === 200 });

  sleep(1);
}
