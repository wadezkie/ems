// Live integration check using disposable accounts; real demo accounts stay pending.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS loader compiles the existing TS services for this standalone integration check. */
// node --env-file=.env.local scripts/test-activation.cjs
// Only Brevo email delivery and Next request context are simulated.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
const originalTs = require.extensions['.ts'];
const suffix = randomBytes(5).toString('hex');
const email = `ems-activation-${suffix}@example.com`;
const employeeId = `TEST-${suffix.toUpperCase()}`;
const username = `test${suffix}`;
const password = randomBytes(24).toString('base64url') + 'Aa1!';
let deliveryFails = false;
let capturedToken;
let cookieToken = '';
const identifiers = new Set();

require.extensions['.ts'] = (mod, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  mod._compile(output.outputText, filename);
};
Module._load = function (id, parent, isMain) {
  if (id === 'server-only') return {};
  if (id === '@/lib/email/brevo') return { sendEmail: async message => {
    assert.equal(message.to.email, email, 'Never send test mail to real accounts');
    if (deliveryFails) return { ok: false };
    const link = message.text.match(/https?:\/\/\S+\/activate\/verify\?token=([\w-]+)/);
    if (link) capturedToken = link[1];
    return { ok: true };
  } };
  if (id === 'next/headers') return {
    headers: async () => new Headers({ 'x-forwarded-for': `activation-test-${suffix}` }),
    cookies: async () => ({ get: () => ({ value: cookieToken }), delete: () => {} }),
  };
  if (id === 'next/navigation') return { redirect: url => { throw new Error(`REDIRECT:${url}`); } };
  if (id === '@/lib/auth/dal') return { roleHome: role => role === 'department_manager' ? '/manager' : '/employee' };
  if (id === '@/lib/supabase/server') return { createClient: async () => publicClient };
  if (id === '@/lib/supabase/admin') return { createAdminClient: () => admin };
  if (id.startsWith('@/')) id = path.join(root, id.slice(2));
  return originalLoad.call(this, id, parent, isMain);
};
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, options);
const publicClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
async function must(promise) { const { data, error } = await promise; if (error) throw error; return data; }
const activation = require('../lib/auth/activation.ts');
const security = require('../lib/auth/security.ts');
const actions = require('../features/auth/actions.ts');
const { validateCredentials } = require('../features/auth/validation.ts');
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };

async function main() {
  console.log('Starting disposable Supabase activation checks...');
  let authId, rowId;
  const track = value => identifiers.add(security.hashIdentifier(value));
  track(`activation-test-${suffix}`);
  track(`${employeeId}|${email}`);
  track(username);
  track(`${username}new`);
  try {
    const department = await must(admin.from('departments').select('id').eq('code', 'IT').single());
    console.log('Department ready');
    const existing = await must(admin.from('employees').select('username').eq('employee_id', 'MGR-0001').single());
    console.log('Existing username ready');
    authId = (await must(admin.auth.admin.createUser({ email, password, email_confirm: false }))).user.id;
    console.log('Disposable Auth user ready');
    rowId = (await must(admin.from('employees').insert({ employee_id: employeeId, email, username, auth_user_id: authId, department_id: department.id, role: 'department_manager' }).select('id').single())).id;
    console.log('Disposable employee ready');
    const request = () => actions.requestActivation({ status: 'idle' }, form({ employeeId, companyEmail: email }));

    // Regression: a rejected email must never report successful delivery.
    deliveryFails = true;
    const failed = await request();
    assert.equal(failed.status, 'error', 'Email provider failure must surface to the activation form');
    console.log('PASS: email provider failure is shown as an error');
    deliveryFails = false;
    assert.equal((await request()).status, 'sent');
    assert.ok(capturedToken);
    const firstToken = capturedToken;
    track(security.hashToken(firstToken));
    assert.equal((await activation.getActivationLinkStatus(firstToken)).valid, true);
    assert.equal((await activation.getActivationLinkStatus(firstToken)).valid, true, 'Link inspection must not consume the token');
    assert.equal((await activation.getActivationLinkStatus('invalid')).valid, false);
    assert.equal((await request()).status, 'sent');
    const token = capturedToken;
    track(security.hashToken(token));
    assert.notEqual(token, firstToken);
    assert.equal((await activation.getActivationLinkStatus(firstToken)).valid, false, 'Resend revokes the old link');
    console.log('PASS: request, token validation, scanner-safe inspection, resend and revocation');

    const pendingLogin = await actions.signIn({}, form({ username, password }));
    assert.equal(pendingLogin.needsActivation, true);
    assert.ok(validateCredentials({ currentUsername: username, newUsername: `${username}new`, newPassword: 'weak', confirmPassword: 'weak' }).newPassword);
    cookieToken = token;
    const weak = await actions.updateDefaultCredentials({}, form({ currentUsername: username, newUsername: `${username}new`, newPassword: 'weak', confirmPassword: 'weak' }));
    assert.ok(weak.errors.newPassword);
    assert.equal((await activation.completeActivation({ token, currentUsername: 'wrong', newUsername: `${username}new`, newPassword: password })).reason, 'username_mismatch');
    assert.equal((await activation.completeActivation({ token, currentUsername: username, newUsername: existing.username, newPassword: password })).reason, 'username_taken');
    assert.equal((await activation.getActivationLinkStatus(token)).valid, true);
    console.log('PASS: pending login blocked; weak password, incorrect username and duplicate username rejected');

    await assert.rejects(actions.updateDefaultCredentials({}, form({ currentUsername: username, newUsername: `${username}new`, newPassword: password, confirmPassword: password })), /REDIRECT:\/activate\/success/);
    const activated = await must(admin.from('employees').select('activation_status,username,activated_at').eq('id', rowId).single());
    assert.equal(activated.activation_status, 'active');
    assert.equal(activated.username, `${username}new`);
    assert.ok(activated.activated_at);
    assert.ok((await must(admin.auth.admin.getUserById(authId))).user.email_confirmed_at);
    assert.equal((await activation.getActivationLinkStatus(token)).valid, false);
    assert.equal((await activation.completeActivation({ token, currentUsername: username, newUsername: `${username}new`, newPassword: password })).reason, 'invalid_link');
    console.log('PASS: activation completes, confirms email, changes username and prevents token replay');

    await assert.rejects(actions.signIn({}, form({ username: `${username}new`, password })), /REDIRECT:\/manager/);
    const own = await must(publicClient.from('employees').select('id,role').eq('auth_user_id', authId).single());
    assert.equal(own.id, rowId);
    assert.equal(own.role, 'department_manager');
    console.log('PASS: real password login, own-row RLS and manager redirect');

    const expired = security.generateToken();
    await must(admin.rpc('issue_activation_token', { p_employee_id: rowId, p_token_hash: security.hashToken(expired), p_expires_at: new Date(Date.now() - 60000).toISOString() }));
    assert.deepEqual(await must(admin.rpc('consume_activation_token', { p_token_hash: security.hashToken(expired) })), []);
    console.log('PASS: expired token cannot be consumed');
  } finally {
    if (rowId) await must(admin.from('employees').delete().eq('id', rowId));
    if (authId) await must(admin.auth.admin.deleteUser(authId));
    await must(admin.from('email_log').delete().eq('recipient_email', email));
    await must(admin.from('rate_limit_events').delete().in('key_hash', [...identifiers]));
    Module._load = originalLoad;
    if (originalTs) require.extensions['.ts'] = originalTs; else delete require.extensions['.ts'];
    console.log('Disposable account and test records removed.');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
