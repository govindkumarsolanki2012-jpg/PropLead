import crypto from 'node:crypto';

export interface VerifiedIdentityClaims {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  googleSubject?: string;
}

export interface AccountIdentity {
  uid: string;
  hash: string;
  email?: string;
}

// Call only with claims returned by the server's Firebase signature verifier.
export function accountIdentity(claims: VerifiedIdentityClaims | null | undefined, projectId: string): AccountIdentity | null {
  if (!claims?.uid || !claims.googleSubject) return null;
  return {
    uid: claims.uid,
    hash: crypto.createHash('sha256').update(`${projectId}:google.com:${claims.googleSubject}`).digest('hex'),
    email: claims.emailVerified && claims.email ? claims.email.trim().toLowerCase() : undefined,
  };
}

type Fields = Record<string, any>;
interface StoredDocument { name: string; fields: Fields; updateTime: string }
export interface TrialHistory {
  firstUid: string;
  state: string;
  start: string | null;
  end: string | null;
}
export type OwnershipDecision =
  | { allowed: true; ownerUid: string; claimed: boolean; previousUid?: string }
  | { allowed: false; reason: 'OWNED_BY_ANOTHER_USER' | 'OWNERSHIP_CHECK_UNAVAILABLE' | 'RECOVERY_REQUIRED' };

const stringField = (value: string) => ({ stringValue: value });
const fieldString = (fields: Fields, key: string): string => fields[key]?.stringValue || '';
const trialHistory = (fields: Fields): TrialHistory => ({
  firstUid: fieldString(fields, 'firstUid'),
  state: fieldString(fields, 'state'),
  start: fieldString(fields, 'trialStartDate') || null,
  end: fieldString(fields, 'trialEndDate') || null,
});

/** Backend-only records. No raw Google subject or purchase token is persisted here. */
export class EntitlementIdentityStore {
  constructor(
    private readonly base: string,
    private readonly getToken: () => Promise<string | null>,
    private readonly request: typeof fetch = fetch,
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getToken();
    if (!token) throw new Error('Entitlement identity credentials unavailable.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  private path(path: string): string {
    return `${this.base}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  private async read(path: string): Promise<StoredDocument | null> {
    const response = await this.request(this.path(path), { headers: await this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Entitlement identity read failed (${response.status}).`);
    return response.json();
  }

  private async commit(path: string, fields: Fields, previous: StoredDocument | null, deleteUid?: string): Promise<boolean> {
    const prefix = this.base.slice(this.base.indexOf('/projects/') + 1);
    const writes: any[] = [{
      update: { name: `${prefix}/${path}`, fields },
      currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false },
    }];
    if (deleteUid) writes.push({ delete: `${prefix}/subscriptions/${deleteUid}` });
    const response = await this.request(`${this.base}:commit`, {
      method: 'POST', headers: await this.headers(), body: JSON.stringify({ writes }),
    });
    if (response.status === 409 || response.status === 412) return false;
    if (!response.ok) throw new Error(`Entitlement identity write failed (${response.status}).`);
    return true;
  }

  private async deletedAccounts(field: 'identityHash' | 'email', value: string): Promise<StoredDocument[]> {
    const response = await this.request(`${this.base}:runQuery`, {
      method: 'POST', headers: await this.headers(),
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'accountDeletionJobs' }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: stringField(value) } },
      } }),
    });
    if (!response.ok) throw new Error(`Trial history lookup failed (${response.status}).`);
    const rows = await response.json() as Array<{ document?: StoredDocument }>;
    return rows.flatMap(row => row.document ? [row.document] : []);
  }

  async loadTrialHistory(identity: AccountIdentity): Promise<TrialHistory | null> {
    const path = `trialRecords/${identity.hash}`;
    const existing = await this.read(path);
    if (existing?.fields.trialEverStarted?.booleanValue) return trialHistory(existing.fields);

    // Historical jobs were server-written from verified tokens. Never query a client-supplied email.
    const history = await this.deletedAccounts('identityHash', identity.hash);
    if (identity.email) history.push(...await this.deletedAccounts('email', identity.email));
    const used = history.find(job => job.fields.trialEverStarted?.booleanValue === true);
    if (!used) return null;
    const fields = {
      trialEverStarted: { booleanValue: true },
      firstUid: stringField(fieldString(used.fields, 'uid')),
      state: stringField('used'),
      updatedAt: { timestampValue: new Date().toISOString() },
    };
    if (await this.commit(path, fields, existing)) return trialHistory(fields);
    const winner = await this.read(path);
    if (!winner?.fields.trialEverStarted?.booleanValue) throw new Error('Trial history changed. Please retry.');
    return trialHistory(winner.fields);
  }

  async rememberUsedTrial(identity: AccountIdentity, start?: string | null, end?: string | null): Promise<void> {
    if (await this.loadTrialHistory(identity)) return;
    const fields: Fields = {
      trialEverStarted: { booleanValue: true }, firstUid: stringField(identity.uid),
      state: stringField('used'), updatedAt: { timestampValue: new Date().toISOString() },
    };
    if (start) fields.trialStartDate = stringField(start);
    if (end) fields.trialEndDate = stringField(end);
    if (!await this.commit(`trialRecords/${identity.hash}`, fields, null)) {
      if (!await this.loadTrialHistory(identity)) throw new Error('Could not preserve trial history.');
    }
  }

  async reserveTrial(identity: AccountIdentity, now: Date, durationDays: number): Promise<{ allowed: boolean; history: TrialHistory }> {
    const existing = await this.loadTrialHistory(identity);
    if (existing) {
      // Retry a partially persisted activation using its original dates; never restart the clock.
      const retry = existing.state === 'pending' && existing.firstUid === identity.uid &&
        Boolean(existing.end) && new Date(existing.end!).getTime() > now.getTime();
      return { allowed: retry, history: existing };
    }
    const fields = {
      trialEverStarted: { booleanValue: true }, firstUid: stringField(identity.uid), state: stringField('pending'),
      trialStartDate: stringField(now.toISOString()),
      trialEndDate: stringField(new Date(now.getTime() + durationDays * 86_400_000).toISOString()),
      updatedAt: { timestampValue: now.toISOString() },
    };
    if (await this.commit(`trialRecords/${identity.hash}`, fields, null)) {
      return { allowed: true, history: trialHistory(fields) };
    }
    const winner = await this.loadTrialHistory(identity);
    if (!winner) throw new Error('Could not reserve trial.');
    return { allowed: winner.state === 'pending' && winner.firstUid === identity.uid &&
      Boolean(winner.end) && new Date(winner.end!).getTime() > now.getTime(), history: winner };
  }

  async finalizeTrial(identity: AccountIdentity, history: TrialHistory): Promise<void> {
    const path = `trialRecords/${identity.hash}`;
    const current = await this.read(path);
    if (!current || fieldString(current.fields, 'firstUid') !== identity.uid ||
      fieldString(current.fields, 'trialStartDate') !== history.start ||
      fieldString(current.fields, 'trialEndDate') !== history.end) throw new Error('Trial reservation changed.');
    if (fieldString(current.fields, 'state') === 'active') return;
    if (!await this.commit(path, { ...current.fields, state: stringField('active') }, current)) {
      const winner = await this.read(path);
      if (!winner || fieldString(winner.fields, 'state') !== 'active' ||
        fieldString(winner.fields, 'firstUid') !== identity.uid) throw new Error('Could not finalize trial.');
    }
  }

  async ownerUid(purchaseToken: string): Promise<string | null> {
    const hash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
    const owner = await this.read(`purchaseTokenOwners/${hash}`);
    if (!owner) return null;
    const uid = fieldString(owner.fields, 'ownerUid');
    if (!uid) throw new Error('Invalid purchase owner record.');
    return uid;
  }

  /** Called only AFTER Google Play has confirmed a valid active purchase. */
  async claimPurchase(
    purchaseToken: string, uid: string, identity: AccountIdentity | null,
    legacyOwner: () => Promise<string | null>,
  ): Promise<OwnershipDecision> {
    const hash = crypto.createHash('sha256').update(purchaseToken).digest('hex');
    const path = `purchaseTokenOwners/${hash}`;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await this.read(path);
        const previousUid = current ? fieldString(current.fields, 'ownerUid') : await legacyOwner();
        if (current && !previousUid) throw new Error('Invalid purchase owner.');
        if (identity && identity.uid !== uid) throw new Error('Invalid identity binding.');
        const previousHash = current ? fieldString(current.fields, 'ownerIdentityHash') : '';
        if (previousHash && identity && previousHash !== identity.hash) {
          return { allowed: false, reason: 'OWNED_BY_ANOTHER_USER' };
        }
        if (previousUid && previousUid !== uid) {
          if (!identity) return { allowed: false, reason: 'OWNED_BY_ANOTHER_USER' };
          const job = await this.read(`accountDeletionJobs/${previousUid}`);
          if (!job || fieldString(job.fields, 'status') !== 'completed') {
            return { allowed: false, reason: 'RECOVERY_REQUIRED' };
          }
          const deletedHash = fieldString(job.fields, 'identityHash');
          if (deletedHash && deletedHash !== identity.hash) return { allowed: false, reason: 'OWNED_BY_ANOTHER_USER' };
          if (!previousHash && !deletedHash) {
            // Controlled legacy recovery: completed server deletion + verified Google Gmail
            // identity + matching recorded email + possession of a Play-verified active token.
            // Third-party/Workspace addresses can be reassigned; never auto-transfer those.
            const sameEmail = identity.email && fieldString(job.fields, 'email').trim().toLowerCase() === identity.email;
            if (!sameEmail) return { allowed: false, reason: 'OWNED_BY_ANOTHER_USER' };
            if (!/@(?:gmail|googlemail)\.com$/.test(identity.email!)) return { allowed: false, reason: 'RECOVERY_REQUIRED' };
            if (job.fields.emailVerified?.booleanValue === false) return { allowed: false, reason: 'RECOVERY_REQUIRED' };
          }
        }
        if (current && previousUid === uid && (!identity || previousHash === identity.hash)) {
          return { allowed: true, ownerUid: uid, claimed: false };
        }
        const fields: Fields = { ...(current?.fields || {}), ownerUid: stringField(uid),
          updatedAt: { timestampValue: new Date().toISOString() } };
        if (!current) fields.createdAt = { timestampValue: new Date().toISOString() };
        if (identity) fields.ownerIdentityHash = stringField(identity.hash);
        const movedFrom = previousUid && previousUid !== uid ? previousUid : undefined;
        // CAS owner change and old entitlement removal form one atomic commit.
        if (await this.commit(path, fields, current, movedFrom)) {
          return { allowed: true, ownerUid: uid, claimed: !current || Boolean(movedFrom), previousUid: movedFrom };
        }
      }
    } catch {
      // Never log credentials, purchase tokens, email or full UID.
    }
    return { allowed: false, reason: 'OWNERSHIP_CHECK_UNAVAILABLE' };
  }
}
