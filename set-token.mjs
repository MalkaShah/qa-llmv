/**
 * set-token.mjs
 * Manually set the token when Chrome cookies are encrypted.
 * Usage: node set-token.mjs YOUR_TOKEN_HERE
 * 
 * Get token from: Chrome → F12 → Application → Cookies → dashboard.searchatlas.com → token
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');

const token = process.argv[2];

if (!token || token.length < 50) {
  console.error('❌ Usage: node set-token.mjs YOUR_TOKEN_HERE');
  console.error('   Get token from Chrome DevTools → Application → Cookies → token');
  process.exit(1);
}

// Update .env.db
let env = fs.readFileSync('.env.db', 'utf8');
if (env.includes('LLMV_TOKEN=')) {
  env = env.replace(/LLMV_TOKEN=.*/, `LLMV_TOKEN=${token}`);
} else {
  env += `\nLLMV_TOKEN=${token}`;
}
fs.writeFileSync('.env.db', env);
console.log('✓ .env.db updated');

// Update auth-state.json
const state = {
  cookies: [
    { name: 'token', value: token, domain: 'dashboard.searchatlas.com', path: '/', httpOnly: false, secure: true, sameSite: 'None' },
    { name: 'token', value: token, domain: '.searchatlas.com', path: '/', httpOnly: false, secure: true, sameSite: 'None' }
  ],
  origins: [{
    origin: 'https://dashboard.searchatlas.com',
    localStorage: [{ name: 'token', value: token }]
  }]
};
fs.writeFileSync('auth-state.json', JSON.stringify(state, null, 2));
console.log('✓ auth-state.json updated');
console.log('✓ Token length:', token.length);
console.log('\nReady. Run your tests now.');
