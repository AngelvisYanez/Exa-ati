import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv, validateEnv, healthy, healthyHttp, withLock, activationTransaction, createDeployer, main, isAuthorizedRepo, AUTHORIZED_REPOS, artifactHash } from './deploy.mjs';
const sha = 'a'.repeat(40);
const testDB = { DATABASE_URL: 'postgresql://user:pass@test-pooler.neon.tech/db', DIRECT_DATABASE_URL: 'postgresql://user:pass@test.neon.tech/db' };
function production() {
  return {
    EXA_ATI_ENV: 'production', NODE_ENV: 'production', EXA_ATI_RELEASE_SHA: sha,
    NEXT_PUBLIC_APP_URL: 'https://ati.exacontable.com', EXA_ATI_DB_ISOLATED: 'true',
    EXA_ATI_SOURCE_DB_HOST: 'source.neon.tech', EXA_ATI_PRODUCTION_READY: 'true',
    DATABASE_URL: 'postgresql://user:pass@prod-pooler.neon.tech/db',
    DIRECT_DATABASE_URL: 'postgresql://user:pass@prod.neon.tech/db',
    SRI_ENVIRONMENT: 'production',
    SRI_RECEPTION_WSDL: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
    SRI_AUTHORIZATION_WSDL: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
    JWT_SECRET: 'private-value', ENCRYPTION_KEY: 'private-value', ENCRYPTION_SALT: 'private-value', CRON_SECRET: 'private-value',
    XMLS_DIR: '/opt/exa-ati/shared/downloads/xml', CERTS_DIR: '/opt/exa-ati/shared/downloads/certs',
    PDFS_DIR: '/opt/exa-ati/shared/downloads/pdf', TEMPLATES_DIR: '/opt/exa-ati/shared/downloads/templates',
  };
}
test('valid production configuration', () => assert.doesNotThrow(() => validateEnv(production(), 'production', testDB)));
for (const [label, change] of [
  ['missing WSDL', v => delete v.SRI_RECEPTION_WSDL],
  ['test WSDL', v => v.SRI_AUTHORIZATION_WSDL = v.SRI_AUTHORIZATION_WSDL.replace('cel.', 'celcer.')],
  ['arbitrary WSDL', v => v.SRI_RECEPTION_WSDL = 'https://example.com/wsdl'],
  ['test database', v => Object.assign(v, testDB)],
  ['source database', v => v.EXA_ATI_SOURCE_DB_HOST = 'prod-pooler.neon.tech'],
  ['mixed database', v => v.DIRECT_DATABASE_URL = testDB.DIRECT_DATABASE_URL],
  ['missing gate', v => delete v.EXA_ATI_PRODUCTION_READY],
  ['missing SHA', v => delete v.EXA_ATI_RELEASE_SHA],
  ['proxy', v => v.SRI_PROXY_HOST = 'example.com'],
  ['test SRI mode', v => v.SRI_ENVIRONMENT = 'development'],
  ['traversal', v => v.XMLS_DIR = '/opt/exa-ati/shared/downloads/../../outside'],
  ['missing secret', v => delete v.JWT_SECRET],
]) test(`reject ${label}`, () => { const v = production(); change(v); assert.throws(() => validateEnv(v, 'production', testDB)); });
test('comparison with test database cannot be skipped', () => assert.throws(() => validateEnv(production(), 'production')));
test('parser rejects ambiguous input without disclosing values', () => {
  for (const raw of ['TOKEN=private-value\nTOKEN=other', 'TOKEN="private-value', 'TOKEN=private value'])
    assert.throws(() => parseEnv(raw), error => !error.message.includes('private-value'));
  assert.equal(parseEnv("# comment\nTOKEN='literal$dollar'\n").TOKEN, 'literal$dollar');
});
test('health requires healthy JSON and database ok', () => {
  assert.equal(healthy('{"status":"healthy","checks":{"database":"ok"}}'), true);
  for (const body of ['OK', '<html>200</html>', '{}', '{"status":"healthy","checks":{"database":"failed"}}']) assert.equal(healthy(body), false);
});
test('HTTP 201/redirect do not pass even with a healthy body', () => {
  const body = '{"status":"healthy","checks":{"database":"ok"}}';
  assert.equal(healthyHttp(body + '\n200'), true);
  for (const code of ['201', '301', '503']) assert.equal(healthyHttp(body + '\n' + code), false);
});
test('lock prevents overlap and releases after failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exa-lock-'));
  try {
    assert.throws(() => withLock(dir, () => {
      assert.throws(() => withLock(dir, () => assert.fail('must not run')), /bloqueado/);
      throw Error('simulated failure');
    }), /simulated failure/);
    assert.equal(withLock(dir, () => 'next execution'), 'next execution');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('successful activation verifies first', () => {
  const calls = [], evidence = {};
  activationTransaction({ evidence, activate: () => calls.push('activate'), verify: () => calls.push('verify'), restore: () => assert.fail('unexpected'), verifyRestored() {} });
  assert.deepEqual(calls, ['activate', 'verify']);
  assert.equal(evidence.result, 'TECHNICAL_CHECKS_OK');
});
for (const phase of ['activate', 'verify']) test(`failure in ${phase} restores and verifies recovery`, () => {
  const calls = [], evidence = {};
  const step = name => () => { calls.push(name); if (name === phase) throw Error('private-value'); };
  assert.throws(() => activationTransaction({ evidence, activate: step('activate'), verify: step('verify'), restore: step('restore'), verifyRestored: step('verifyRestored') }), error => !error.message.includes('private-value') && error.message.includes('VERIFIED'));
  assert.deepEqual(calls.slice(-2), ['restore', 'verifyRestored']);
  assert.equal(evidence.result, 'FAILED');
  assert.equal(evidence.rollback, 'VERIFIED');
});
test('failed recovery requires operator', () => {
  const evidence = {};
  assert.throws(() => activationTransaction({ evidence, activate() { throw Error('fail'); }, verify() {}, restore() { throw Error('fail'); }, verifyRestored() { assert.fail('must not run'); } }), /FAILED_REQUIRES_OPERATOR/);
  assert.equal(evidence.result, 'FAILED');
});
test('CLI rejects unsafe SHA and unknown arguments before mutation', () => {
  assert.throws(() => main(['activate', '--mode', 'production', '--sha', '../../escape']), /--sha/);
  assert.throws(() => main(['activate', '--force', 'true']), /Argumento/);
});
test('authorized remotes include GitHub and GitLab', () => {
  assert.equal(isAuthorizedRepo('https://github.com/AngelvisYanez/Exa-ati.git'), true);
  assert.equal(isAuthorizedRepo('https://gitlab.com/exacontable1/exa-ati.git'), true);
  assert.equal(isAuthorizedRepo('git@gitlab.com:exacontable1/exa-ati.git'), true);
  assert.equal(isAuthorizedRepo('https://example.com/repo.git'), false);
  assert.equal(AUTHORIZED_REPOS.includes('git@gitlab.com:exacontable1/exa-ati.git'), true);
});
for (const reason of ['remote', 'dirty', 'origin', 'git failure']) {
  test(`Git gate blocks ${reason} before activation`, () => {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exa-git-')));
    fs.mkdirSync(path.join(root, 'releases', sha), { recursive: true });
    const execute = (command, args) => {
      assert.equal(command, 'git');
      if (reason === 'git failure') throw Error('unavailable');
      if (args.includes('get-url')) return reason === 'origin' ? 'https://example.com/repo.git' : 'https://github.com/AngelvisYanez/Exa-ati.git';
      if (args.includes('rev-parse')) return sha;
      if (args.includes('status')) return reason === 'dirty' ? '?? unexpected' : '';
      if (args.includes('ls-remote')) return 'b'.repeat(40) + '\trefs/heads/main';
      assert.fail('unexpected command');
    };
    try {
      assert.throws(() => createDeployer({ root, execute }).validateRelease(sha));
      assert.equal(fs.existsSync(path.join(root, 'current')), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}
test('GitLab origin is accepted when main SHA matches', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exa-git-gl-')));
  fs.mkdirSync(path.join(root, 'releases', sha), { recursive: true });
  const gitlab = 'https://gitlab.com/exacontable1/exa-ati.git';
  const execute = (command, args) => {
    assert.equal(command, 'git');
    if (args.includes('get-url')) return gitlab;
    if (args.includes('rev-parse')) return sha;
    if (args.includes('status')) return '';
    if (args.includes('ls-remote')) {
      assert.equal(args[1], gitlab);
      return `${sha}\trefs/heads/main`;
    }
    assert.fail('unexpected command');
  };
  try {
    assert.equal(createDeployer({ root, execute }).validateRelease(sha), path.join(root, 'releases', sha));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('artifactHash covers runtime trees and ignores build intermediates', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exa-art-'));
  try {
    fs.mkdirSync(path.join(dir, '.next', 'standalone'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.next', 'static', 'chunks'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.next', 'cache'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.next', 'diagnostics'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.next', 'BUILD_ID'), 'build-one\n');
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{"lockfileVersion":3,"name":"frontend"}');
    fs.writeFileSync(path.join(dir, '.next', 'standalone', 'server.js'), 'console.log("ok")');
    fs.writeFileSync(path.join(dir, '.next', 'static', 'chunks', 'main.js'), 'export default 1');
    fs.writeFileSync(path.join(dir, '.next', 'cache', 'heavy.bin'), 'SHOULD_NOT_AFFECT');
    fs.writeFileSync(path.join(dir, '.next', 'diagnostics', 'trace'), 'SHOULD_NOT_AFFECT');
    const first = artifactHash(dir);
    fs.writeFileSync(path.join(dir, '.next', 'cache', 'heavy.bin'), 'CHANGED_CACHE');
    fs.writeFileSync(path.join(dir, '.next', 'diagnostics', 'trace'), 'CHANGED_DIAG');
    assert.equal(artifactHash(dir), first);
    fs.writeFileSync(path.join(dir, '.next', 'standalone', 'server.js'), 'console.log("changed")');
    assert.notEqual(artifactHash(dir), first);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('artifactHash rejects missing runtime trees', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exa-art-miss-'));
  try {
    fs.mkdirSync(path.join(dir, '.next'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.next', 'BUILD_ID'), 'x');
    fs.writeFileSync(path.join(dir, 'package-lock.json'), '{}');
    assert.throws(() => artifactHash(dir), /standalone|static/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
