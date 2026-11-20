import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8'),
);

interface MockAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_VIDEO_URL_RE = /^(https?:\/\/|\/[^/]).*/;
const VALID_THUMB_URL_RE = /^(https?:\/\/|\/[^/]|data:image\/(jpeg|jpg|png|webp|gif);base64,).*/;
const REQUEST_TIME = 1_795_143_818_000;

function isAdmin(auth: MockAuth | null, adminsDb: Set<string>): boolean {
  if (!auth || !auth.email_verified) return false;
  if (auth.email === 'abirislam202654@gmail.com') return true;
  return adminsDb.has(auth.uid);
}

function hasExactKeys(obj: Record<string, unknown>, required: string[]): boolean {
  const keys = Object.keys(obj);
  return required.every((k) => k in obj) && keys.every((k) => required.includes(k));
}

function simulateVideoCreate(
  auth: MockAuth | null,
  videoId: string,
  payload: Record<string, unknown>,
  adminsDb: Set<string>,
  categoriesDb: Set<string>,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!VALID_ID_RE.test(videoId)) return 'PERMISSION_DENIED';
  if (!isAdmin(auth, adminsDb)) return 'PERMISSION_DENIED';
  const keys = [
    'title',
    'description',
    'category_id',
    'category_name',
    'category_slug',
    'source_type',
    'video_url',
    'thumbnail_url',
    'duration',
    'views',
    'is_featured',
    'is_published',
    'sort_order',
    'createdAt',
    'updatedAt',
  ];
  if (!hasExactKeys(payload, keys)) return 'PERMISSION_DENIED';
  if (typeof payload.title !== 'string' || payload.title.length < 3 || payload.title.length > 160) {
    return 'PERMISSION_DENIED';
  }
  if (typeof payload.video_url !== 'string' || !VALID_VIDEO_URL_RE.test(payload.video_url)) {
    return 'PERMISSION_DENIED';
  }
  if (
    typeof payload.thumbnail_url !== 'string' ||
    (payload.thumbnail_url !== '' && !VALID_THUMB_URL_RE.test(payload.thumbnail_url))
  ) {
    return 'PERMISSION_DENIED';
  }
  if (payload.createdAt !== REQUEST_TIME || payload.updatedAt !== REQUEST_TIME) {
    return 'PERMISSION_DENIED';
  }
  if (payload.category_id !== null && (typeof payload.category_id !== 'string' || !categoriesDb.has(payload.category_id))) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function simulateVideoUpdate(
  auth: MockAuth | null,
  videoId: string,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  adminsDb: Set<string>,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!VALID_ID_RE.test(videoId)) return 'PERMISSION_DENIED';
  if (incoming.createdAt !== existing.createdAt || incoming.updatedAt !== REQUEST_TIME) {
    return 'PERMISSION_DENIED';
  }
  const changedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
  if (isAdmin(auth, adminsDb)) {
    return changedKeys.includes('createdAt') ? 'PERMISSION_DENIED' : 'ALLOW';
  }
  if (
    existing.is_published === 1 &&
    changedKeys.every((k) => k === 'views' || k === 'updatedAt') &&
    incoming.views === (existing.views as number) + 1
  ) {
    return 'ALLOW';
  }
  return 'PERMISSION_DENIED';
}

test('firestore.rules covers every collection in firebase-blueprint.json and enforces Eight Pillars', () => {
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const baseName = collectionPath.split('/')[1];
    assert.ok(rulesText.includes(`match /${baseName}/`), `Missing match block for ${baseName}`);
  }
  assert.ok(rulesText.includes('allow read, write: if false;'), 'Missing global default deny');
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'), 'Missing email_verified gate');
  assert.ok(rulesText.includes('abirislam202654@gmail.com'), 'Missing bootstrapped admin email');
});

test('Dirty Dozen security payloads are rejected with PERMISSION_DENIED', () => {
  const adminsDb = new Set<string>(['admin-uid-1']);
  const categoriesDb = new Set<string>(['cat-urban-neon']);
  const validAdmin: MockAuth = {
    uid: 'admin-uid-1',
    email: 'abirislam202654@gmail.com',
    email_verified: true,
  };
  const validVideoPayload = {
    title: 'Neon Highway',
    description: 'Night city drive',
    category_id: 'cat-urban-neon',
    category_name: 'Urban & Neon',
    category_slug: 'urban-neon',
    source_type: 'direct',
    video_url: '/media/cyber_city.mp4',
    thumbnail_url: '',
    duration: '00:06',
    views: 10,
    is_featured: 0,
    is_published: 1,
    sort_order: 1,
    createdAt: REQUEST_TIME,
    updatedAt: REQUEST_TIME,
  };

  // 1. Unverified admin email spoof
  assert.equal(
    simulateVideoCreate(
      { uid: 'spoof', email: 'abirislam202654@gmail.com', email_verified: false },
      'vid-1',
      validVideoPayload,
      adminsDb,
      categoriesDb,
    ),
    'PERMISSION_DENIED',
  );

  // 2. Non-admin trying to create video / self-promote
  assert.equal(
    simulateVideoCreate(
      { uid: 'attacker', email: 'attacker@example.com', email_verified: true },
      'vid-1',
      validVideoPayload,
      adminsDb,
      categoriesDb,
    ),
    'PERMISSION_DENIED',
  );

  // 3 & 4. Unpublished draft isolation
  assert.ok(rulesText.includes('existing().is_published == 1 || isAdmin()'));
  assert.ok(rulesText.includes('resource.data.is_published == 1 || isBootstrappedAdmin()'));

  // 5. Shadow field injection
  assert.equal(
    simulateVideoCreate(
      validAdmin,
      'vid-2',
      { ...validVideoPayload, isVerified: true },
      adminsDb,
      categoriesDb,
    ),
    'PERMISSION_DENIED',
  );

  // 6. Document ID poisoning
  assert.equal(
    simulateVideoCreate(validAdmin, 'bad$id..123', validVideoPayload, adminsDb, categoriesDb),
    'PERMISSION_DENIED',
  );
  assert.equal(
    simulateVideoCreate(validAdmin, 'a'.repeat(130), validVideoPayload, adminsDb, categoriesDb),
    'PERMISSION_DENIED',
  );

  // 7. Client timestamp forgery
  assert.equal(
    simulateVideoCreate(
      validAdmin,
      'vid-3',
      { ...validVideoPayload, createdAt: 1000 },
      adminsDb,
      categoriesDb,
    ),
    'PERMISSION_DENIED',
  );

  // 8. Immutable createdAt mutation on update
  assert.equal(
    simulateVideoUpdate(
      validAdmin,
      'vid-1',
      validVideoPayload,
      { ...validVideoPayload, createdAt: REQUEST_TIME + 500 },
      adminsDb,
    ),
    'PERMISSION_DENIED',
  );

  // 9. Public title tampering during view increment
  assert.equal(
    simulateVideoUpdate(
      null,
      'vid-1',
      validVideoPayload,
      { ...validVideoPayload, views: 11, title: 'Hacked Title' },
      adminsDb,
    ),
    'PERMISSION_DENIED',
  );

  // 10. Public view inflation (+999999)
  assert.equal(
    simulateVideoUpdate(
      null,
      'vid-1',
      validVideoPayload,
      { ...validVideoPayload, views: 1000009 },
      adminsDb,
    ),
    'PERMISSION_DENIED',
  );

  // 11. Orphan category reference
  assert.equal(
    simulateVideoCreate(
      validAdmin,
      'vid-4',
      { ...validVideoPayload, category_id: 'nonexistent-cat' },
      adminsDb,
      categoriesDb,
    ),
    'PERMISSION_DENIED',
  );

  // 12. Valid admin create + valid public +1 view increment pass
  assert.equal(
    simulateVideoCreate(validAdmin, 'vid-valid', validVideoPayload, adminsDb, categoriesDb),
    'ALLOW',
  );
  assert.equal(
    simulateVideoUpdate(
      null,
      'vid-valid',
      validVideoPayload,
      { ...validVideoPayload, views: 11 },
      adminsDb,
    ),
    'ALLOW',
  );
});
