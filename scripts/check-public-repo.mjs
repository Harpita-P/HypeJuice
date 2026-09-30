// Defense in depth, not a guarantee that arbitrary secrets can be detected.
// Reports paths and reasons only. Never print matching credentials or file contents.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { parse } from 'dotenv';

const git = (...args) => execFileSync('git', args, { maxBuffer: 100 * 1024 * 1024 });
process.chdir(git('rev-parse', '--show-toplevel').toString().trim());
const mode = process.argv.includes('--history') ? 'history' : 'working tree';
const findings = new Set();
const report = (path, reason) => findings.add(`${JSON.stringify(path)}: ${reason}`);
const knownSecrets = new Set();
for (const name of readdirSync('.').filter((name) => /^\.env(?:\.|$)/.test(name) && name !== '.env.example')) {
  for (const [key, value] of Object.entries(parse(readFileSync(name)))) {
    if (key.startsWith('EXPO_PUBLIC_') || !/(KEY|SECRET|TOKEN|CREDENTIAL|PASSWORD)/i.test(key)) continue;
    if (value.length < 12 || /^(your_|placeholder|example|changeme)/i.test(value)) continue;
    knownSecrets.add(value);
    if (key === 'HF_CREDENTIALS') {
      for (const part of value.split(':')) if (part.length >= 12) knownSecrets.add(part);
    }
  }
}

const patterns = [
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['secret API token', /\bsk_(?:live_|test_)?[A-Za-z0-9]{32,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/],
  ['signed storage URL', /\/storage\/v1\/object\/sign\/[^\s"'<>]*[?&]token=[A-Za-z0-9_-]{20,}/],
];
function scan(path, buffer) {
  if (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example')) report(path, 'private environment file');
  if (/(^|\/)(?:\.studio-data|\.local-archive|node_modules|\.expo|test-results|playwright-report)\//.test(path)) report(path, 'private or generated directory');
  if (/\.(?:mp4|mov|webm|pem|key|p12|p8|mobileprovision)$/i.test(path)) report(path, 'private media or credential artifact');
  if (buffer.includes(0)) return;
  const content = buffer.toString('utf8');
  for (const secret of knownSecrets) if (content.includes(secret)) report(path, 'matches a credential in local environment');
  for (const [reason, pattern] of patterns) if (pattern.test(content)) report(path, reason);
  // Supabase legacy JWT service keys must never ship, even if not in local .env.
  for (const match of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1], 'base64url').toString()).role === 'service_role') report(path, 'Supabase service-role JWT');
    } catch { /* Not a decodable JWT. */ }
  }
}

let checked = 0;
if (mode === 'history') {
  // Every reachable blob, including deleted files and files on other branches/tags.
  const objects = git('rev-list', '--objects', '--all').toString().trim().split('\n').filter(Boolean);
  for (const object of objects) {
    const space = object.indexOf(' ');
    if (space < 0) continue;
    const id = object.slice(0, space);
    const path = object.slice(space + 1);
    if (git('cat-file', '-t', id).toString().trim() !== 'blob') continue;
    scan(path, git('cat-file', 'blob', id));
    checked++;
  }
} else {
  // Include untracked source that a future `git add` would pick up, but no ignored data.
  const files = new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').toString().split('\0').filter(Boolean));
  for (const path of files) {
    if (!existsSync(path)) continue;
    scan(path, readFileSync(path));
    checked++;
  }
  // Also inspect the index: staging an earlier version must not bypass this check.
  for (const entry of git('ls-files', '--stage', '-z').toString().split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t');
    const id = entry.slice(0, tab).split(' ')[1];
    const path = entry.slice(tab + 1);
    scan(path, git('cat-file', 'blob', id));
  }
}
for (const remote of git('remote').toString().split('\n').filter(Boolean)) {
  const url = git('remote', 'get-url', remote).toString().trim();
  if (/^https?:\/\/[^/]*@/.test(url)) report(`remote ${remote}`, 'HTTP credentials embedded in remote URL');
}
console.log(`Checked ${checked} ${mode} files/blobs plus applicable staged files. Local credential values are never printed.`);
if (findings.size) {
  console.error([...findings].join('\n'));
  console.error('Review flagged paths privately before publishing. Rotate any exposed credentials.');
  process.exitCode = 1;
} else {
  console.log('No matching local credentials, recognized secret patterns, or forbidden private artifacts found. Manual review is still required.');
}
