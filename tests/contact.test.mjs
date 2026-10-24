import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, validate } from '../worker/contact.mjs';

const good = { subject: 'Hello', email: 'ada@example.com', message: 'hi there', website: '', elapsed: 8000 };

test('accepts a normal message', () => {
  assert.deepEqual(validate(good), { ok: true, data: { subject: 'Hello', email: 'ada@example.com', message: 'hi there' } });
});

test('rejects missing or bad fields with a readable error', () => {
  assert.equal(validate({ ...good, subject: '  ' }).ok, false);
  assert.equal(validate({ ...good, email: 'not an email' }).ok, false);
  assert.equal(validate({ ...good, message: '' }).ok, false);
  assert.equal(validate({ ...good, message: 'x'.repeat(5001) }).ok, false);
  assert.equal(validate(null).ok, false);
});

test('bots get a quiet fake success', () => {
  assert.deepEqual(validate({ ...good, website: 'http://spam.example' }), { ok: true, spam: true });
});

test('fast submissions get a retry error instead of a false success', () => {
  for (const elapsed of [400, undefined, -1]) {
    assert.deepEqual(validate({ ...good, elapsed }), {
      ok: false, error: 'Please wait a few seconds and try sending again.',
    });
  }
  assert.equal(validate({ ...good, elapsed: 3000 }).ok, true);
});

test('line breaks in the subject or email cannot add email headers', () => {
  const result = validate({ ...good, subject: 'Hello\r\nBcc: victim@example.com' });
  assert.equal(result.ok, true);
  assert.ok(!/[\r\n]/.test(result.data.subject));

  const raw = buildEmail(result.data, { from: 'contact@jasontang.dev', to: 'me@example.com', id: 'x' });
  const headers = raw.split('\r\n\r\n')[0].split('\r\n');
  assert.ok(!headers.some(h => h.startsWith('Bcc:')));

  assert.equal(validate({ ...good, email: 'ada@example.com\r\nBcc: victim@example.com' }).ok, false);
});

test('builds a plain text email with the visitor as reply-to', () => {
  const raw = buildEmail(
    { subject: 'Café?', email: 'zoe@example.com', message: 'héllo\nsecond line' },
    { from: 'contact@jasontang.dev', to: 'me@example.com', id: 'abc', now: new Date('2026-09-25T12:00:00Z') },
  );
  const [head, body] = raw.split('\r\n\r\n');

  assert.match(head, /^From: =\?UTF-8\?B\?[^?]+\?= <contact@jasontang\.dev>$/m);
  assert.match(head, /^To: <me@example\.com>$/m);
  assert.match(head, /^Reply-To: <zoe@example\.com>$/m);
  assert.match(head, /^Subject: =\?UTF-8\?B\?[^?]+\?=$/m);
  assert.match(head, /^Message-ID: <abc@jasontang\.dev>$/m);

  const text = new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\s/g, '')), c => c.charCodeAt(0)));
  assert.match(text, /^héllo\nsecond line\n\n— zoe@example\.com\n/);
});
