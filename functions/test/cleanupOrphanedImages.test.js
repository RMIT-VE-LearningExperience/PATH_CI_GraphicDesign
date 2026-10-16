const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const databaseId = 'path-ci-graphicdesign';
const prefix = `${databaseId}/`;
const bucketName = 'printer-app-531a8.firebasestorage.app';
const url = path => `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=token`;
let collections;
let files;
let databaseCalls;
let storageCalls;

const load = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (options, handler) => handler };
  if (name === 'firebase-admin/firestore') return {
    getFirestore: id => {
      assert.equal(id, databaseId);
      databaseCalls++;
      return { listCollections: async () => collections };
    },
  };
  if (name === 'firebase-admin/storage') return {
    getStorage: () => ({ bucket: name => {
      assert.equal(name, bucketName);
      return { getFiles: async options => {
        assert.deepEqual(options, { prefix });
        storageCalls++;
        return [files];
      } };
    } }),
  };
  return load.call(this, name, parent, isMain);
};
let handlers;
try {
  handlers = require('../lib/cleanupOrphanedImages');
} finally {
  Module._load = load;
}

const collection = docs => ({ listDocuments: async () => docs });
const document = (data, children = []) => ({
  get: async () => ({ data: () => data }),
  listCollections: async () => children,
});

function reset() {
  collections = [];
  files = [];
  databaseCalls = 0;
  storageCalls = 0;
}

async function captureLogs(action) {
  const messages = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => messages.push(args);
  console.warn = (...args) => messages.push(args);
  try {
    await action();
    return messages;
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

test('legacy cleanup never reads or deletes storage or orphan records', async () => {
  reset();
  await captureLogs(handlers.cleanupOrphanedImages);
  assert.equal(databaseCalls, 0);
  assert.equal(storageCalls, 0);
});

test('read-only audit retains nested and legacy references under missing parents', async () => {
  reset();
  collections = [
    collection([document(undefined, [collection([document({
      imageUrls: [url(`${prefix}draft.jpg`)],
      contentHtml: `<img src="${url(`${prefix}inline.jpg`)}">`,
    })])])]),
    collection([document({ legacy: { thumbnailUrl: url(`${prefix}legacy.jpg`) } })]),
  ];
  files = ['draft', 'inline', 'legacy', 'unreferenced'].map(name => ({ name: `${prefix}${name}.jpg` }));
  const messages = await captureLogs(handlers.auditOrphanedImages);
  const candidates = messages.filter(args => args[0].startsWith('Unreferenced image candidate'));
  assert.deepEqual(candidates.map(args => args[1]), [`${prefix}unreferenced.jpg`]);
  assert.equal(storageCalls, 1);
  assert.match(messages.at(-1)[0], /3 referenced paths, 1 candidates\. No files deleted or queued\./);
});

test('failed database traversal aborts before storage candidates are reported', async () => {
  reset();
  collections = [collection([{
    get: async () => { throw new Error('Database read failed'); },
    listCollections: async () => [],
  }])];
  await assert.rejects(handlers.auditOrphanedImages(), /Database read failed/);
  assert.equal(storageCalls, 0);
});
