/**
 * discover-api.mjs
 * Discovers real API paths and confirms auth token extraction.
 * Run: node discover-api.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.db' });

const BASE = process.env.LLMV_BASE_URL;

// Read token from saved auth state
const authState = JSON.parse(fs.readFileSync('auth-state.json', 'utf8'));
const cookies = authState.cookies ?? [];
const origins = authState.origins ?? [];

// Extract token from localStorage
let token = null;
for (const origin of origins) {
  for (const entry of origin.localStorage ?? []) {
    if (entry.name?.toLowerCase().includes('token') ||
        entry.name?.toLowerCase().includes('auth')) {
      token = entry.value;
      console.log('Found token in localStorage key:', entry.name);
    }
  }
}

// Build cookie header
const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

console.log('\n=== Auth State ===');
console.log('Cookies found:', cookies.length);
console.log('Cookie header length:', cookieHeader.length);
console.log('Token from localStorage:', token ? token.slice(0,20)+'...' : 'NOT FOUND');

// Try to find the real API base path
const pathsToProbe = [
  '/api/v1/projects/',
  '/api/v2/projects/',
  '/api/projects/',
  '/llm-visibility/api/v1/projects/',
  '/v1/projects/',
  '/api/v1/platforms/',
  '/api/v1/credits/summary/',
  '/api/v1/credits/',
  '/api/v1/user/credits/',
  '/api/v1/account/credits/',
];

console.log('\n=== Probing API Paths ===');
for (const path of pathsToProbe) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Token ${token}`;
  if (cookieHeader) headers['Cookie'] = cookieHeader;

  try {
    const res = await fetch(`${BASE}${path}`, { headers });
    const text = await res.text();
    const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
    console.log(`${res.status} ${path} ${isJson ? '[JSON]' : '[HTML/other]'}`);
    if (isJson && res.status === 200) {
      console.log('  Sample:', text.slice(0, 120));
    }
  } catch(e) {
    console.log(`ERR ${path}: ${e.message}`);
  }
}

console.log('\n=== Checking auth header format ===');
// Try different auth header formats
const authFormats = [
  token ? `Token ${token}` : null,
  token ? `Bearer ${token}` : null,
].filter(Boolean);

for (const authHeader of authFormats) {
  const res = await fetch(`${BASE}/api/v1/projects/`, {
    headers: { 'Authorization': authHeader, 'Cookie': cookieHeader }
  });
  const text = await res.text();
  const isJson = text.trim().startsWith('{') || text.trim().startsWith('[');
  console.log(`${res.status} Authorization: ${authHeader.slice(0,30)}... → ${isJson ? 'JSON' : 'HTML'}`);
}
