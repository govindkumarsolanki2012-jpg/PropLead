const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'server/entitlementIdentity.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;
const exportsForTest = {};
vm.runInNewContext(compiled, { exports: exportsForTest, require, Date, URL, fetch, console });
const { accountIdentity, EntitlementIdentityStore } = exportsForTest;
const BASE = 'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents';
const NAME = 'projects/test/databases/(default)/documents/';
const s = value => ({ stringValue: value });
const identity = (uid = 'user-a', subject = 'google-a', email = 'original@gmail.com', emailVerified = true) =>
  accountIdentity({ uid, googleSubject: subject, email, emailVerified }, 'test');
const ownerPath = token => 'purchaseTokenOwners/' + crypto.createHash('sha256').update(token).digest('hex');

function database() {
  const docs = new Map(), requests = [];
  let version = 0;
  const put = (key, fields) => docs.set(key, { name: NAME + key, fields: structuredClone(fields),
    updateTime: `2026-11-01T00:00:00.${String(++version).padStart(6, '0')}Z` });
  const db = { docs, requests, put, failure: null };
  db.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (db.failure) return new Response('{}', { status: db.failure });
    if (url.endsWith(':runQuery')) {
      const query = JSON.parse(options.body).structuredQuery;
      const filter = query.where.fieldFilter;
      const rows = [...docs].filter(([key, doc]) => key.startsWith('accountDeletionJobs/') &&
        doc.fields[filter.field.fieldPath]?.stringValue === filter.value.stringValue)
        .map(([, document]) => ({ document }));
      return Response.json(rows);
    }
    if (url.endsWith(':commit')) {
      const { writes } = JSON.parse(options.body);
      for (const write of writes) {
        if (!write.update) continue;
        const old = docs.get(write.update.name.slice(NAME.length));
        const condition = write.currentDocument;
        if ((condition.exists === false && old) || (condition.updateTime && condition.updateTime !== old?.updateTime)) {
          return new Response('{}', { status: 409 });
        }
      }
      for (const write of writes) {
        if (write.update) put(write.update.name.slice(NAME.length), write.update.fields);
        if (write.delete) docs.delete(write.delete.slice(NAME.length));
      }
      return Response.json({});
    }
    const key = decodeURIComponent(url.slice(BASE.length + 1));
    return docs.has(key) ? Response.json(docs.get(key)) : new Response('{}', { status: 404 });
  };
  db.store = new EntitlementIdentityStore(BASE, async () => 'mock-admin-token', db.fetch);
  return db;
}

function deleted(db, uid, account, extra = {}) {
  db.put('accountDeletionJobs/' + uid, { uid: s(uid), status: s('completed'),
    identityHash: s(account.hash), email: s(account.email || ''), ...extra });
}

test('stable identity survives UID/email changes and separates Google subjects', () => {
  const a = identity(), recreated = identity('new-uid', 'google-a', 'renamed@gmail.com');
  assert.equal(a.hash, recreated.hash);
  assert.notEqual(a.hash, identity('user-b', 'google-b').hash);
  assert.equal(a.hash.length, 64);
  assert.equal(accountIdentity({uid:'x', email:'spoof@gmail.com'}, 'test'), null);
  assert.equal(accountIdentity(undefined, 'test'), null);
  assert.equal(identity('x','g','original@gmail.com',false).email, undefined);
});

test('two recreated UIDs can atomically claim only one trial', async () => {
  const db = database(), a = identity(), b = identity('recreated');
  const results = await Promise.all([a,b].map(i => db.store.reserveTrial(i, new Date('2026-11-01'), 7)));
  assert.equal(results.filter(r => r.allowed).length, 1);
  assert.equal(db.docs.size, 1);
});

test('partial activation retries preserve the original seven-day dates', async () => {
  const db = database(), a = identity();
  const first = await db.store.reserveTrial(a, new Date('2026-11-01'), 7);
  const retry = await db.store.reserveTrial(a, new Date('2026-11-02'), 7);
  assert.equal(retry.allowed, true);
  assert.deepEqual(retry.history, first.history);
  await db.store.finalizeTrial(a, first.history);
  assert.equal((await db.store.reserveTrial(a, new Date('2026-11-02'), 7)).allowed, false);
  assert.equal((await db.store.reserveTrial(identity('new'), new Date('2026-11-09'), 7)).allowed, false);
});

test('expired partial trial cannot restart its clock', async () => {
  const db = database(), a = identity();
  await db.store.reserveTrial(a, new Date('2026-10-01'), 7);
  assert.equal((await db.store.reserveTrial(a, new Date('2026-11-01'), 7)).allowed, false);
});

test('historical used trial is recovered by trusted deletion history', async () => {
  const db = database(), a = identity('recreated');
  db.put('accountDeletionJobs/old', {uid:s('old'), email:s(a.email), status:s('completed'), trialEverStarted:{booleanValue:true}});
  const history = await db.store.loadTrialHistory(a);
  assert.equal(history.firstUid, 'old');
  assert.equal((await db.store.reserveTrial(a, new Date(), 7)).allowed, false);
  assert.equal(db.docs.get('trialRecords/'+a.hash).fields.trialEverStarted.booleanValue, true);
});

test('deletion preserves trial history independently of deleted UID records', async () => {
  const db=database(), a=identity();
  await db.store.rememberUsedTrial(a, '2026-10-01', '2026-10-08');
  const before=structuredClone(db.docs.get('trialRecords/'+a.hash));
  await db.store.rememberUsedTrial(identity('recreated'), '2026-11-01', '2026-11-08');
  assert.deepEqual(db.docs.get('trialRecords/'+a.hash), before);
});

test('trial history/read or persistence failures never grant a trial', async () => {
  const db=database(); db.failure=403;
  await assert.rejects(db.store.reserveTrial(identity(),new Date(),7));
  const noCredentials = new EntitlementIdentityStore(BASE, async()=>null, db.fetch);
  await assert.rejects(noCredentials.reserveTrial(identity(),new Date(),7));
});

test('new purchase ownership stores only token hash and verified identity hash', async () => {
  const db=database(), a=identity();
  const result=await db.store.claimPurchase('raw-test-purchase',a.uid,a,async()=>null);
  assert.equal(result.allowed,true);
  assert.equal(db.docs.get(ownerPath('raw-test-purchase')).fields.ownerIdentityHash.stringValue,a.hash);
  const saved=JSON.stringify([...db.docs]);
  assert.ok(!saved.includes('raw-test-purchase') && !saved.includes('google-a') && !saved.includes(a.email));
});

test('existing current UID restores and safely enriches old ownership metadata', async () => {
  const db=database(), a=identity();
  db.put(ownerPath('token'), {ownerUid:s(a.uid)});
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=>null)).allowed,true);
  assert.equal(db.docs.get(ownerPath('token')).fields.ownerIdentityHash.stringValue,a.hash);
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=>null)).claimed,false);
});

test('same stable Google identity recovers after completed deletion, atomically removing old entitlement', async () => {
  const db=database(), a=identity('new');
  db.put(ownerPath('token'), {ownerUid:s('old'),ownerIdentityHash:s(a.hash)});
  db.put('subscriptions/old',{subscriptionStatus:s('ACTIVE')});
  db.put('subscriptions/other',{subscriptionStatus:s('ACTIVE')});
  deleted(db,'old',a);
  const result=await db.store.claimPurchase('token',a.uid,a,async()=>null);
  assert.equal(result.allowed,true);assert.equal(result.previousUid,'old');
  assert.equal(db.docs.get(ownerPath('token')).fields.ownerUid.stringValue,'new');
  assert.equal(db.docs.has('subscriptions/old'),false);
  assert.equal(db.docs.has('subscriptions/other'),true);
  const commit=db.requests.find(r=>r.url.endsWith(':commit'));
  assert.equal(JSON.parse(commit.options.body).writes.length,2);
});

test('different Google identity cannot claim an existing purchase', async () => {
  const db=database(), a=identity(), b=identity('b','google-b','different@gmail.com');
  db.put(ownerPath('token'),{ownerUid:s('old'),ownerIdentityHash:s(a.hash)});deleted(db,'old',a);
  const before=JSON.stringify([...db.docs]);
  assert.equal((await db.store.claimPurchase('token',b.uid,b,async()=>null)).reason,'OWNED_BY_ANOTHER_USER');
  assert.equal(JSON.stringify([...db.docs]),before);
});

test('ownership never moves while original account deletion is pending', async () => {
  const db=database(), a=identity('new');
  db.put(ownerPath('token'),{ownerUid:s('old'),ownerIdentityHash:s(a.hash)});
  deleted(db,'old',a,{status:s('pending')});
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=>null)).reason,'RECOVERY_REQUIRED');
  assert.equal(db.docs.get(ownerPath('token')).fields.ownerUid.stringValue,'old');
});

test('controlled legacy recovery requires matching verified Google Gmail and completed deletion', async () => {
  const db=database(), a=identity('new');
  db.put(ownerPath('token'),{ownerUid:s('old')});
  db.put('accountDeletionJobs/old',{uid:s('old'),status:s('completed'),email:s(a.email)});
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=>null)).allowed,true);
  assert.equal(db.docs.get(ownerPath('token')).fields.ownerIdentityHash.stringValue,a.hash);
});

for (const [label,email,verified,expected] of [
  ['different Gmail','another@gmail.com',true,'OWNED_BY_ANOTHER_USER'],
  ['unverified email','original@gmail.com',false,'OWNED_BY_ANOTHER_USER'],
  ['third-party email','original@example.com',true,'RECOVERY_REQUIRED'],
]) test('legacy recovery rejects '+label,async()=>{
  const db=database(), a=identity('new','google-a',email,verified);
  db.put(ownerPath('token'),{ownerUid:s('old')});
  db.put('accountDeletionJobs/old',{uid:s('old'),status:s('completed'),email:s(email==='another@gmail.com'?'original@gmail.com':email)});
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=>null)).reason,expected);
  assert.equal(db.docs.get(ownerPath('token')).fields.ownerUid.stringValue,'old');
});

test('stored stable identity mismatch cannot be bypassed by matching email',async()=>{
  const db=database(), a=identity('new');
  db.put(ownerPath('token'),{ownerUid:s('old')});
  deleted(db,'old',identity('old','different-google'));
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=>null)).reason,'OWNED_BY_ANOTHER_USER');
});

test('concurrent different-account purchase claims have one winner',async()=>{
  const db=database(), a=identity(), b=identity('b','google-b');
  const results=await Promise.all([a,b].map(i=>db.store.claimPurchase('token',i.uid,i,async()=>null)));
  assert.equal(results.filter(r=>r.allowed).length,1);
});

test('concurrent recreated accounts cannot both recover one purchase',async()=>{
  const db=database(), a=identity('new-a'), b=identity('new-b');
  db.put(ownerPath('token'),{ownerUid:s('old'),ownerIdentityHash:s(a.hash)});deleted(db,'old',a);
  const results=await Promise.all([a,b].map(i=>db.store.claimPurchase('token',i.uid,i,async()=>null)));
  assert.equal(results.filter(r=>r.allowed).length,1);
});

test('legacy subscription ownership also needs original-owner proof',async()=>{
  const db=database(), a=identity('new');deleted(db,'old',a);
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=> 'old')).allowed,true);
  const wrong=database();deleted(wrong,'old',identity('old','other'));
  assert.equal((await wrong.store.claimPurchase('token',a.uid,a,async()=> 'old')).reason,'OWNED_BY_ANOTHER_USER');
});

test('owner lookup and write failures fail closed without deleting entitlements',async()=>{
  const db=database(), a=identity();db.put('subscriptions/old',{subscriptionStatus:s('ACTIVE')});db.failure=403;
  assert.equal((await db.store.claimPurchase('token',a.uid,a,async()=>null)).reason,'OWNERSHIP_CHECK_UNAVAILABLE');
  assert.equal(db.docs.has('subscriptions/old'),true);
  await assert.rejects(db.store.ownerUid('token'));
});

test('server integrations preserve Play expiry and use canonical ownership for RTDN',()=>{
  const server=fs.readFileSync(path.join(root,'server.ts'),'utf8');
  assert.ok(server.includes('accountIdentity(verifiedToken, FIRESTORE_PROJECT_ID)'));
  assert.ok(server.includes('accountIdentity(res.locals.verifiedFirebaseToken, FIRESTORE_PROJECT_ID)'));
  assert.ok(server.includes('const ownerUid = await entitlementIdentities.ownerUid(purchaseToken)'));
  assert.ok(server.includes('record.subscriptionExpiryDate = verification.subscriptionExpiryDate'));
  assert.ok(server.includes('await entitlementIdentities.finalizeTrial(identity, reservation.history)'));
  assert.ok(server.includes('identityHash: deletionIdentity?.hash'));
});

test('restore UI keeps ownership/recovery errors instead of claiming no active purchase',()=>{
  const billing=fs.readFileSync(path.join(root,'src/utils/billing.ts'),'utf8');
  const modal=fs.readFileSync(path.join(root,'src/components/subscription/SubscriptionModal.tsx'),'utf8');
  assert.ok(billing.includes("| 'SUBSCRIPTION_RECOVERY_REQUIRED'"));
  assert.ok(billing.includes('you do not need to purchase it again'));
  assert.ok(modal.includes('setErrorMessage(result.message ||'));
  assert.ok(!modal.includes("setErrorMessage('No active subscription found for this account.')"));
});
