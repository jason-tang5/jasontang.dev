export const DAY = 86400000;
export const RETENTION = 30 * DAY;
export const removedText = '[message removed by administrator]';
export const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});
export const failure = (code, status = 400, extra = {}) => json({ error: code, ...extra }, status);
export async function hash(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function nicknameError(name, admin = false) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{3,20}$/.test(name)) return 'nickname-invalid';
  if (/^(jason|admin|administrator|system|moderator)$/i.test(name) && !(admin && name === 'Jason')) return 'nickname-reserved';
  return null;
}
export function messageError(text) {
  if (typeof text !== 'string' || !text.trim()) return 'empty';
  if ([...text.trim()].length > 250) return 'too-long';
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) return 'invalid-message';
  return null;
}
