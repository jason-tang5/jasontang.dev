// checks a contact form submission and turns it into a raw email.
// kept separate from the worker so it can be tested in plain node.

export const limits = { subject: 150, email: 200, message: 5000 };

// bots usually fill the whole form in instantly, a person takes a few seconds
const minimumFillTime = 3000;

// no line breaks or control characters, so nothing can sneak extra email headers in
const clean = text => String(text ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
const looksLikeEmail = text => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(text);

export function validate(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' };

  // "website" is a hidden field people never see, so anything in it means a bot.
  // those get a fake success so they don't retry
  if (clean(body.website)) return { ok: true, spam: true };
  if (!(Number(body.elapsed) >= minimumFillTime)) {
    return { ok: false, error: 'Please wait a few seconds and try sending again.' };
  }

  const subject = clean(body.subject);
  const email = clean(body.email);
  const message = String(body.message ?? '').replace(/\r\n?/g, '\n').trim();

  if (!subject) return { ok: false, error: 'Please add a subject.' };
  if (subject.length > limits.subject) return { ok: false, error: 'That subject is a bit long.' };
  if (!looksLikeEmail(email) || email.length > limits.email) return { ok: false, error: 'That email address doesn’t look right.' };
  if (!message) return { ok: false, error: 'The message is empty.' };
  if (message.length > limits.message) return { ok: false, error: `Messages can be up to ${limits.message} characters.` };

  return { ok: true, data: { subject, email, message } };
}

function toBase64(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// header text that might not be plain ascii, like a subject with accents
const encodeWord = text => `=?UTF-8?B?${toBase64(text)}?=`;

// a plain text email with the visitor as reply-to, so replying in gmail goes straight to them
export function buildEmail({ subject, email, message }, { from, to, id, now = new Date() }) {
  const body = `${message}\n\n— ${email}\nsent from the mail window on jasontang.dev\n`;

  return [
    `From: ${encodeWord('jasontang.dev')} <${from}>`,
    `To: <${to}>`,
    `Reply-To: <${email}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${id}@jasontang.dev>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    toBase64(body).replace(/.{76}/g, '$&\r\n'),
    '',
  ].join('\r\n');
}
