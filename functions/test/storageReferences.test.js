const { test } = require('node:test');
const assert = require('node:assert/strict');
const { collectStoragePaths } = require('../lib/storageReferences');
const bucket = 'printer-app-531a8.firebasestorage.app';
const prefix = 'path-ci-graphicdesign/';
const url = (path, b = bucket) => `https://firebasestorage.googleapis.com/v0/b/${b}/o/${encodeURIComponent(path)}?alt=media&token=old-token`;

test('retains gallery, legacy, nested trash and embedded HTML references', () => {
  const paths = collectStoragePaths({
    imageUrls: [url(`${prefix}gallery.jpg`)],
    imageUrl: url(`${prefix}legacy.jpg`),
    data: { thumbnailUrl: url(`${prefix}trash.jpg`) },
    contentHtml: `<img src="${url(`${prefix}inline.jpg`).replace('&', '&amp;')}">`,
  }, bucket, prefix);
  assert.deepEqual([...paths].sort(), ['gallery', 'inline', 'legacy', 'trash'].map(p => `${prefix}${p}.jpg`));
});

test('requires exact bucket, host and namespace; ignores invalid URLs', () => {
  const paths = collectStoragePaths([
    url(`${prefix}valid.jpg`),
    url('path-ci-graphicdesign-other/foreign.jpg'),
    url(`${prefix}foreign.jpg`, 'another-bucket'),
    url(`${prefix}spoof.jpg`).replace('firebasestorage.googleapis.com', 'firebasestorage.googleapis.com.evil.test'),
    'https://firebasestorage.googleapis.com/v0/b/bad%ZZ/o/bad',
    `https://storage.googleapis.com/${bucket}/${prefix}direct.jpg`,
  ], bucket, prefix);
  assert.deepEqual([...paths].sort(), [`${prefix}direct.jpg`, `${prefix}valid.jpg`]);
});
