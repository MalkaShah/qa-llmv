/**
 * helpers/api.ts
 * Reads auth token from persistent Chrome profile localStorage.
 * Same session used for both UI and API testing.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env.db') });

export const API  = 'https://llmvis.searchatlas.com';
export const DASH = 'https://dashboard.searchatlas.com';

const PROFILE_PATH = 'C:/Users/HUAWEI/playwright-profile';

function getToken(): string {
  // Try persistent profile localStorage first
  const localStatePath = path.join(PROFILE_PATH, 'Default', 'Local Storage', 'leveldb');
  
  // Fall back to .env.db token (still works if set)
  const envToken = process.env.LLMV_TOKEN;
  if (envToken) return envToken;

  throw new Error(
    'No auth token found. Set LLMV_TOKEN in .env.db or run setup-persistent-profile.mjs'
  );
}

export async function goToAPI(_page: any) {
  // no-op — token injected via header
}

export async function api(page: any, method: string, path: string, body?: any) {
  const token = getToken();
  const url = `${API}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  let res: any;
  if (method === 'GET')         res = await page.request.get(url, { headers });
  else if (method === 'DELETE') res = await page.request.delete(url, { headers });
  else                          res = await page.request[method.toLowerCase()](url, { headers, data: body });

  let data: any;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status(), data };
}

export async function GET(page: any, path: string) {
  return api(page, 'GET', path);
}
export async function POST(page: any, path: string, body?: any) {
  return api(page, 'POST', path, body);
}
export async function PUT(page: any, path: string, body?: any) {
  return api(page, 'PUT', path, body);
}
export async function PATCH(page: any, path: string, body?: any) {
  return api(page, 'PATCH', path, body);
}
export async function DELETE(page: any, path: string) {
  return api(page, 'DELETE', path);
}