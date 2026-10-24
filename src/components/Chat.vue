<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import RetroIcon from './RetroIcon.vue';
import MessengerClippy from './MessengerClippy.vue';
import ClippyArt from './ClippyArt.vue';
import { read, save } from '../storage.js';

const phase = ref('connecting');
const nickname = ref(read('chat-nickname', ''));
const you = ref(null);
const online = ref([]);
const messages = ref([]);
const draft = ref('');
const pending = ref(null);
// what the room turns down for the message itself, rather than the connection
const rejected = ['profanity', 'duplicate', 'too-long', 'empty', 'invalid-message', 'clippy-offline', 'clippy-busy', 'clippy-limit'];
const clippy = ref({ available: false, thinking: false, failed: false });
const clippyReplies = ref(0);
// clippy is listed with the people when the room can reach the ai, and counts as one of them
const clippyOnline = computed(() => clippy.value.available && phase.value === 'connected' && settings.value.chatEnabled);
const onlineCount = computed(() => online.value.length + (clippyOnline.value ? 1 : 0));
const composer = ref(null);
const error = ref('');
const settings = ref({ chatEnabled: true, slowModeSeconds: 3 });
const config = ref(null);
const transcript = ref(null);
const challenge = ref(null);
const turnstileToken = ref('');
const adminOpen = ref(false);
const overview = ref(null);
const adminBusy = ref(false);
const unread = ref(0);
const showPeople = ref(false);
const joining = ref(false);
let socket, reconnectTimer, heartbeat, disposed = false, attempts = 0, lastHeard = 0, widget;
let generation = 0;
const joined = computed(() => Boolean(you.value));
// slow mode: after each message, or when the room says to wait, the box keeps what
// you typed and send counts down until the room will take the next one
const cooldownUntil = ref(0);
const now = ref(Date.now());
let cooldownTimer = 0;
const waitLeft = computed(() => Math.max(0, Math.ceil((cooldownUntil.value - now.value) / 1000)));
function cooldown(seconds) {
  cooldownUntil.value = Math.max(cooldownUntil.value, Date.now() + seconds * 1000);
  now.value = Date.now();
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    now.value = Date.now();
    if (now.value >= cooldownUntil.value) clearInterval(cooldownTimer);
  }, 250);
}
const canSend = computed(() => phase.value === 'connected' && settings.value.chatEnabled && !pending.value && !waitLeft.value && draft.value.trim() && [...draft.value.trim()].length <= 250);
const status = computed(() => ({ connecting: 'Connecting…', reconnecting: 'Reconnecting…', connected: settings.value.chatEnabled ? 'Connected' : 'Chat offline', join: 'Signed out', banned: 'Session banned', unavailable: 'Unavailable' })[phase.value] || 'Offline');
const errors = {
  'clippy-offline': 'Clippy is away right now. You can still chat with everyone here.',
  'clippy-busy': 'Clippy needs a moment between questions. Try again shortly.',
  'clippy-limit': 'Clippy has used his daily allowance. He will be back tomorrow (00:00 UTC).',
  'nickname-invalid': 'Use 3–20 letters, numbers, underscores or hyphens.',
  'nickname-reserved': 'That name is reserved. Choose another nickname.',
  'nickname-taken': 'That nickname is in use. Choose another one.',
  'nickname-profanity': 'Pick a friendlier nickname.',
  'profanity': 'Keep it friendly! That message wasn’t sent.',
  'empty': 'Write a message first.', 'too-long': 'Messages can be up to 250 characters.',
  'invalid-message': 'That message could not be sent. Use plain text, up to 250 characters.',
  'rate-limited': 'Slow down! Please wait before sending another message.',
  'duplicate': 'You already sent that message. Say something new!',
  'chat-disabled': 'The chat is currently offline. Check back later!',
  'banned': 'This session has been banned from the room.',
  'muted': 'You are temporarily muted. You can still read the conversation.',
  'join-limited': 'Too many sign-in attempts. Please try again in 10 minutes.',
  'room-full': 'The room is full right now. Please try again later.',
  'captcha-failed': 'Please complete the verification again.',
  'captcha-unavailable': 'Verification is unavailable. Please try again shortly.',
  'unauthorized': 'Sign in as the owner to use moderation.',
  'unavailable': 'Messenger is not available yet. Please check back later.',
  'join-required': 'Your session ended. Please sign in again.',
};
function explain(data) {
  let text = errors[data.code || data.error] || 'Could not connect. Please try again.';
  if (data.retryAfter) text += ` Try again in ${data.retryAfter}s.`;
  if (data.until) text += ` Until ${new Date(data.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
  return text;
}
async function api(path, data) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store',
    ...(data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), signal: AbortSignal.timeout(12000) });
  const result = await response.json();
  if (!response.ok) throw new Error(explain(result));
  return result;
}
function atBottom() { const el = transcript.value; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 70; }
async function scrollDown() { await nextTick(); if (transcript.value) transcript.value.scrollTop = transcript.value.scrollHeight; unread.value = 0; }
function add(message) {
  if (message.id && messages.value.some(m => m.id === message.id)) return;
  const follow = atBottom();
  messages.value.push(message);
  if (messages.value.length > 200) messages.value.shift();
  if (follow) scrollDown(); else unread.value++;
}
function stopSocket() {
  clearTimeout(reconnectTimer); clearInterval(heartbeat);
  if (socket) { socket.onclose = null; socket.onmessage = null; socket.close(); socket = null; }
}
function retryLater() {
  if (disposed || ['join', 'banned', 'unavailable'].includes(phase.value)) return;
  phase.value = 'reconnecting';
  reconnectTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)) + Math.random() * 500);
}
async function connect() {
  if (disposed) return;
  stopSocket();
  const current = ++generation;
  try {
    const state = await api('/api/chat/session');
    if (disposed || current !== generation) return;
    config.value = state; settings.value = state.settings;
    if (!state.ready) { phase.value = 'unavailable'; return; }
    if (state.banned) { phase.value = 'banned'; error.value = errors.banned; return; }
    if (!state.you) { you.value = null; phase.value = 'join'; if (state.joinError) error.value = explain({ code: state.joinError }); await setupChallenge(); return; }
    you.value = state.you;
    const url = new URL('/api/chat/socket', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url); socket = ws;
    ws.onmessage = event => {
      if (disposed || current !== generation) return;
      lastHeard = Date.now();
      let data; try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'welcome') {
        phase.value = 'connected'; attempts = 0; error.value = '';
        you.value = data.you; online.value = data.online; settings.value = data.settings;
        clippy.value = data.clippy || { available: false, thinking: false };
        messages.value = data.history; scrollDown();
        if (pending.value && !pending.value.failed) ws.send(JSON.stringify({ type: 'send', clientId: pending.value.clientId, text: pending.value.text }));
        clearInterval(heartbeat);
        heartbeat = setInterval(() => {
          if (Date.now() - lastHeard > 70000) { ws.close(); return; }
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 25000);
      } else if (data.type === 'message') { add(data); if (data.bot) clippyReplies.value++; }
      else if (data.type === 'clippy') clippy.value = data;
      else if (data.type === 'ack') {
        add(data.message);
        if (pending.value?.clientId === data.clientId) { pending.value = null; cooldown(settings.value.slowModeSeconds); }
      } else if (data.type === 'system') add({ system: true, text: data.text, id: crypto.randomUUID() });
      else if (data.type === 'presence') online.value = data.online;
      else if (data.type === 'settings') settings.value = data;
      else if (data.type === 'deleted') {
        const row = messages.value.find(m => m.id === data.id);
        if (row) { row.text = '[message removed by administrator]'; row.deleted = true; }
      } else if (data.type === 'error' && data.code === 'rate-limited' && pending.value && data.clientId === pending.value.clientId) {
        // too soon: the message goes back in the box and send counts down, no banner
        editPending();
        cooldown(data.retryAfter || settings.value.slowModeSeconds);
      } else if (data.type === 'error') {
        error.value = explain(data);
        // a turned-down message goes back in the box to edit, so the conversation carries
        // on. anything else keeps it pending with Retry
        if (pending.value && data.clientId === pending.value.clientId) {
          if (rejected.includes(data.code)) editPending(true); else pending.value.failed = true;
        }
        if (data.code === 'banned') { phase.value = 'banned'; stopSocket(); }
        if (data.code === 'join-required') { you.value = null; phase.value = 'join'; stopSocket(); setupChallenge(); }
      }
    };
    ws.onclose = () => { clearInterval(heartbeat); retryLater(); };
    ws.onerror = () => { error.value = 'Connection interrupted. Trying to reconnect…'; };
  } catch {
    if (disposed || current !== generation) return;
    error.value = 'Messenger could not connect. Retrying shortly…'; retryLater();
  }
}
async function setupChallenge() {
  if (config.value?.local || !config.value?.siteKey || disposed) return;
  turnstileToken.value = '';
  await nextTick();
  try {
    if (!window.turnstile) {
      await new Promise((resolve, reject) => {
        let script = document.querySelector('script[data-chat-turnstile]');
        if (!script) { script = document.createElement('script'); script.dataset.chatTurnstile = ''; script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; document.head.append(script); }
        const timer = setTimeout(() => { script.remove(); reject(new Error('timeout')); }, 12000);
        script.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
        script.addEventListener('error', () => { clearTimeout(timer); script.remove(); reject(new Error('load')); }, { once: true });
      });
    }
    if (disposed || !challenge.value) return;
    if (widget !== undefined) window.turnstile.remove(widget);
    widget = window.turnstile.render(challenge.value, { sitekey: config.value.siteKey, action: 'chat-join', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      callback: value => { turnstileToken.value = value; },
      'expired-callback': () => { turnstileToken.value = ''; },
      'error-callback': () => { turnstileToken.value = ''; error.value = 'Verification failed to load. Check your connection and try again.'; },
    });
  } catch { error.value = 'Verification could not load. Check your connection and try again.'; }
}
async function join() {
  joining.value = true; error.value = '';
  try {
    const result = await api('/api/chat/join', { nickname: nickname.value, turnstileToken: turnstileToken.value });
    nickname.value = result.nickname; save('chat-nickname', result.nickname);
    if (widget !== undefined) { window.turnstile?.remove(widget); widget = undefined; }
    phase.value = 'connecting'; await connect();
  } catch (err) {
    error.value = err.message; turnstileToken.value = '';
    if (widget !== undefined) window.turnstile?.reset(widget);
  } finally {
    // Tokens are single-use, including when verification succeeds but joining fails.
    turnstileToken.value = '';
    joining.value = false;
  }
}
async function leave() {
  try {
    await api('/api/chat/leave', {});
    stopSocket(); ++generation; you.value = null; online.value = []; messages.value = [];
    if (pending.value) { draft.value = [pending.value.text, draft.value].filter(Boolean).join('\n'); pending.value = null; }
    phase.value = 'join'; error.value = ''; await setupChallenge();
  } catch (err) { error.value = err.message; }
}
function send() {
  if (!canSend.value || socket?.readyState !== WebSocket.OPEN) return;
  pending.value = { text: draft.value.trim(), clientId: crypto.randomUUID(), failed: false };
  draft.value = ''; error.value = ''; resend(); scrollDown();
}
function askClippy() {
  if (!/^@clippy\b/i.test(draft.value.trim())) draft.value = `@Clippy ${draft.value}`;
  composer.value?.focus();
}
function resend() {
  if (!pending.value || socket?.readyState !== WebSocket.OPEN) return;
  pending.value.failed = false; error.value = '';
  socket.send(JSON.stringify({ type: 'send', text: pending.value.text, clientId: pending.value.clientId }));
}
function editPending(keepError) { draft.value = [pending.value.text, draft.value].filter(Boolean).join('\n'); pending.value = null; if (keepError !== true) error.value = ''; }
function keydown(event) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); } }
async function refreshAdmin() {
  adminBusy.value = true;
  try { overview.value = await api('/api/admin/chat/overview'); } catch (err) { error.value = err.message; }
  finally { adminBusy.value = false; }
}
async function toggleAdmin() { adminOpen.value = !adminOpen.value; if (adminOpen.value) await refreshAdmin(); }
async function moderate(action, data) {
  adminBusy.value = true;
  try { await api(`/api/admin/chat/${action}`, data); await refreshAdmin(); }
  catch (err) { error.value = err.message; }
  finally { adminBusy.value = false; }
}
const time = value => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
onMounted(connect);
onBeforeUnmount(() => { disposed = true; ++generation; stopSocket(); clearInterval(cooldownTimer); if (widget !== undefined) window.turnstile?.remove(widget); });
</script>

<template>
  <section class="messenger" aria-label="MSN Messenger public chat">
    <nav class="msn-menu" aria-label="Messenger actions">
      <button v-if="joined" @click="leave">Sign out</button>
      <button v-else @click="connect">Reconnect</button>
      <button :aria-pressed="showPeople" @click="showPeople = !showPeople">People ({{ onlineCount }})</button>
      <button v-if="config?.adminAuthorized" :aria-pressed="adminOpen" @click="toggleAdmin">Moderation</button>
      <a v-else href="/api/admin/chat/login">Owner sign in</a>
    </nav>
    <header class="msn-banner">
      <span class="msn-logo"><RetroIcon name="messenger"/></span>
      <div><div class="msn-wordmark"><b>msn</b> Messenger</div></div>
      <span class="msn-public">PUBLIC ROOM<span>jasontang.dev</span></span>
    </header>
    <div class="msn-identity"><span class="msn-dot" :class="{ live: phase === 'connected' }"></span><strong>{{ you?.nickname || 'Not signed in' }}</strong><span>{{ status }}</span></div>

    <div v-if="phase === 'join'" class="msn-join">
      <RetroIcon name="messenger"/>
      <h2>Good to see you.</h2>
      <p>Pull up a chair in Jason’s lobby.<br>Say hello to everyone visiting the site.</p>
      <form @submit.prevent="join">
        <label for="msn-nickname">Your display name</label>
        <input id="msn-nickname" v-model="nickname" maxlength="20" placeholder="e.g. cool_guest99" autocomplete="nickname" :disabled="joining || config?.adminAuthorized">
        <small>{{ config?.adminAuthorized ? 'You will join as Jason (owner).' : '3–20 letters, numbers, _ or -. Leave blank for a guest name.' }}</small>
        <div ref="challenge" class="msn-challenge"></div>
        <button class="msn-primary" :disabled="joining || !settings.chatEnabled || (!config?.local && !turnstileToken)" type="submit">{{ joining ? 'Signing in…' : 'Sign in to the room' }} <span aria-hidden="true">→</span></button>
        <p v-if="!settings.chatEnabled" class="msn-note">The room is currently offline. Check back later!</p>
      </form>
      <p class="msn-privacy">No account needed. Messages are public and kept for 30 days.</p>
    </div>
    <div v-else-if="['unavailable', 'banned'].includes(phase)" class="msn-empty">
      <RetroIcon name="messenger"/><h2>{{ phase === 'banned' ? 'This session is banned.' : 'Messenger is taking a break.' }}</h2>
      <p>{{ phase === 'banned' ? 'You cannot join this room with this session.' : 'The public chat is not available yet. Please check back later.' }}</p>
      <button @click="connect">Try again</button>
    </div>
    <div v-else class="msn-room" :class="{ 'show-people': showPeople }">
      <main class="msn-conversation">
        <div class="msn-room-title"><strong>Jason’s lobby</strong><span>{{ onlineCount }} online</span></div>
        <div v-if="!settings.chatEnabled" class="msn-offline" role="status">Chat is currently offline. You can still read recent messages.</div>
        <div ref="transcript" class="msn-transcript" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" tabindex="0" @scroll="atBottom() && (unread = 0)">
          <div v-if="!messages.length" class="msn-welcome"><span aria-hidden="true">☺</span><strong>{{ phase === 'connected' ? 'You’re in good company.' : 'Finding the conversation…' }}</strong><p>{{ phase === 'connected' ? 'Be the first to say hello. Everyone in the room will see your message.' : 'Connecting to Jason’s lobby.' }}</p></div>
          <div v-for="message in messages" :key="message.id" class="msn-message" :class="{ system: message.system, deleted: message.deleted, own: message.nickname === you?.nickname }">
            <template v-if="message.system"><span aria-hidden="true">· </span>{{ message.text }}</template>
            <template v-else><div class="msn-message-heading"><ClippyArt v-if="message.bot" class="msn-bot-avatar" mood="happy"/><strong>{{ message.nickname }}</strong><span v-if="message.bot" class="msn-owner">AI</span><span v-if="message.admin" class="msn-owner">OWNER</span><time :datetime="new Date(message.at).toISOString()">{{ time(message.at) }}</time></div><p>{{ message.text }}</p></template>
          </div>
          <div v-if="pending" class="msn-message msn-pending"><strong>You <small>{{ pending.failed ? '— not sent' : '— sending…' }}</small></strong><p>{{ pending.text }}</p><template v-if="pending.failed"><button :disabled="phase !== 'connected' || !settings.chatEnabled" @click="resend">Retry</button> <button @click="editPending">Edit message</button></template></div>
        </div>
        <button v-if="unread" class="msn-new" @click="scrollDown">{{ unread }} new {{ unread === 1 ? 'message' : 'messages' }} ↓</button>
        <form class="msn-compose" @submit.prevent="send">
          <label for="msn-message">Your message <span>{{ [...draft].length }}/250</span></label>
          <div><textarea ref="composer" id="msn-message" v-model="draft" rows="2" placeholder="Say hello…" :disabled="!joined || phase === 'banned'" @keydown="keydown"></textarea><button class="msn-send" type="submit" aria-label="Send" :disabled="!canSend">{{ waitLeft ? `${waitLeft}s` : 'Send' }}</button></div>
          <small aria-live="polite">{{ waitLeft ? `Slow mode · you can send again in ${waitLeft}s` : 'Enter to send · Shift + Enter for a new line' }}</small>
        </form>
      </main>
      <aside class="msn-people" aria-label="Online visitors"><h3>Online ({{ onlineCount }})</h3><ul><li v-if="clippyOnline" class="msn-person-clippy"><ClippyArt class="msn-person-avatar" mood="neutral"/><span>Clippy<small>Online</small></span></li><li v-for="person in online" :key="person.nickname"><RetroIcon name="messenger" small/><span>{{ person.nickname }}<small v-if="person.admin">Owner</small><small v-else-if="person.nickname === you?.nickname">That’s you!</small></span></li></ul><MessengerClippy v-bind="clippy" :reply="clippyReplies" :connected="phase === 'connected' && settings.chatEnabled" @ask="askClippy"/></aside>
    </div>
    <div v-if="error" class="msn-error" role="alert"><span>{{ error }}</span><button aria-label="Dismiss message" @click="error = ''">×</button></div>
    <section v-if="adminOpen && config?.adminAuthorized" class="msn-admin" aria-label="Chat moderation">
      <header><strong>Room moderation</strong><button :disabled="adminBusy" @click="refreshAdmin">Refresh</button><button @click="adminOpen = false">Close</button></header>
      <template v-if="overview">
        <div class="msn-admin-settings"><button :disabled="adminBusy" @click="moderate('settings', { ...overview.settings, chatEnabled: !overview.settings.chatEnabled })">{{ overview.settings.chatEnabled ? 'Disable chat' : 'Enable chat' }}</button><label>Slow mode <select :value="overview.settings.slowModeSeconds" :disabled="adminBusy" @change="moderate('settings', { ...overview.settings, slowModeSeconds: Number($event.target.value) })"><option v-for="seconds in [3, 5, 10, 30, 60]" :key="seconds" :value="seconds">{{ seconds }} seconds</option></select></label></div>
        <details><summary>Sessions ({{ overview.sessions.length }})</summary><div v-for="session in overview.sessions" :key="session.id" class="msn-admin-row"><strong>{{ session.nickname }}</strong><span v-if="session.banned">Banned</span><span v-else-if="session.mutedUntil > Date.now()">Muted until {{ time(session.mutedUntil) }}</span><button :disabled="adminBusy" @click="moderate('moderate', { id: session.id, action: session.banned ? 'unban' : 'ban' })">{{ session.banned ? 'Unban' : 'Ban' }}</button></div></details>
        <p v-if="!overview.messages.length">No messages yet.</p>
        <div v-for="message in overview.messages" :key="message.id" class="msn-admin-row"><strong>{{ message.nickname }}</strong><p>{{ message.original }}</p><small v-if="message.deleted">Removed from public chat</small><div><button :disabled="adminBusy || message.deleted" @click="moderate('delete', { id: message.id })">Delete</button><button :disabled="adminBusy || message.admin || message.bot" @click="moderate('moderate', { id: message.sessionId, action: 'mute', minutes: 10 })">Mute 10m</button><button :disabled="adminBusy || message.admin || message.bot" @click="moderate('moderate', { id: message.sessionId, action: 'mute', minutes: 60 })">Mute 1h</button><button :disabled="adminBusy || message.admin || message.bot" @click="moderate('moderate', { id: message.sessionId, action: 'ban' })">Ban</button></div></div>
      </template>
    </section>
    <footer class="msn-footer"><span class="msn-dot" :class="{ live: phase === 'connected' && settings.chatEnabled }"></span><span role="status">{{ status }}</span><span>Messages are visible to other visitors.</span></footer>
  </section>
</template>

<style scoped>
.msn-bot-avatar,.msn-person-avatar{width:14px;height:25px;flex-shrink:0}
.messenger{width:100%;height:100%;min-height:0;display:flex;flex-direction:column;position:relative;background:#eef2f8;color:#23344e;font-family:Tahoma,Arial,sans-serif;font-size:12px;overflow:hidden;container-type:inline-size}
.messenger button,.messenger input,.messenger textarea,.messenger select{font:inherit;color:inherit}.messenger button{cursor:pointer}.messenger button:disabled{cursor:default;opacity:.5}.messenger button:focus-visible,.messenger a:focus-visible,.messenger input:focus-visible,.messenger textarea:focus-visible,.messenger select:focus-visible{outline:2px solid #255fa4;outline-offset:2px}
.msn-menu{display:flex;align-items:center;gap:2px;background:#f4f4f1;padding:3px 7px;border-bottom:1px solid #c5c8ce;flex-shrink:0}.msn-menu button,.msn-menu a{border:0;background:none;text-decoration:none;color:#28384d;padding:4px 8px;font-size:11px}.msn-menu a{margin-left:auto}.msn-menu button:hover,.msn-menu a:hover{background:#dde8f6}
.msn-banner{display:flex;align-items:center;gap:12px;padding:18px 22px;background:linear-gradient(115deg,#f8fcff 0%,#d9e9f9 50%,#b4d0ee 100%);border-bottom:1px solid #97b5d7;box-shadow:inset 0 1px #fff;flex-shrink:0}.msn-logo{width:52px;height:52px;display:grid;place-items:center;background:#ffffff86;border-radius:50%;border:1px solid #fff}.msn-logo .retro-icon{width:39px;height:39px}.msn-wordmark{font-size:23px;font-weight:400;color:#214f84;letter-spacing:-1px}.msn-wordmark b{font-style:italic;font-size:30px;letter-spacing:-2px;margin-right:3px}.msn-public{margin-left:auto;text-align:right;font-size:9px;font-weight:bold;letter-spacing:1.6px;color:#41658e}.msn-public span{display:block;font-size:10px;font-weight:normal;letter-spacing:0;margin-top:6px}
.msn-identity{display:flex;align-items:center;gap:7px;padding:8px 15px;background:#f4f7fb;border-bottom:1px solid #c5d2e2;flex-shrink:0}.msn-identity>span:last-child{margin-left:auto;color:#627287;font-size:10px}.msn-dot{display:inline-block;width:7px;height:7px;flex-shrink:0;border-radius:50%;background:#96a0ad;border:1px solid #77818e}.msn-dot.live{background:#6ac245;border-color:#438d26;box-shadow:inset 0 1px #b3ef90}
.msn-join,.msn-empty{flex:1;min-height:0;overflow:auto;text-align:center;padding:24px 20px;background:radial-gradient(ellipse at top,#fff,#edf3fa)}.msn-join>.retro-icon,.msn-empty>.retro-icon{width:48px;height:48px;margin:0 auto 8px}.msn-join h2,.msn-empty h2{font-size:22px;color:#285687;font-weight:normal;margin:6px 0 10px;letter-spacing:-.5px}.msn-join p,.msn-empty p{line-height:1.6;color:#61748c;margin:8px 0 18px}.msn-join form{max-width:310px;margin:0 auto;text-align:left}.msn-join label{display:block;font-weight:bold;font-size:11px;margin:0 0 7px}.msn-join input{width:100%;box-sizing:border-box;background:white;padding:9px 10px;border:1px solid #91a8c2;box-shadow:inset 1px 1px 2px #0000000c;border-radius:3px}.msn-join small{display:block;color:#687b91;font-size:10px;line-height:1.5;margin:6px 0 12px}.msn-challenge:empty{display:none}.msn-primary{display:flex;justify-content:space-between;width:100%;padding:10px 14px;background:linear-gradient(#fff,#dbe8f7);border:1px solid #7d9dbf;border-radius:3px;box-shadow:inset 0 0 0 1px #fff;margin-top:12px}.msn-join .msn-privacy{font-size:10px;margin:18px 0 0}.msn-empty button{padding:7px 18px}
.msn-room{display:flex;flex:1;min-height:0;position:relative}.msn-conversation{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;position:relative}.msn-room-title{display:flex;justify-content:space-between;gap:10px;padding:12px 15px;background:#fff;border-bottom:1px solid #e2e8f0;font-size:11px}.msn-room-title span{color:#6f8194;font-size:10px}.msn-transcript{flex:1;overflow:auto;min-height:0;padding:10px 16px;background:#fff;overflow-wrap:anywhere;scrollbar-width:thin}.msn-welcome{padding:26px 12px;text-align:center;color:#7488a0}.msn-welcome>span{display:block;font:36px Georgia;color:#94b5d9;margin-bottom:10px}.msn-welcome strong{display:block;color:#4c6b8e;font-size:13px}.msn-welcome p{max-width:270px;margin:10px auto;line-height:1.7;font-size:11px}.msn-message{margin:7px 0 15px;font-size:12px}.msn-message-heading{display:flex;align-items:center;gap:7px;color:#315e91;font-size:11px}.msn-message.own .msn-message-heading{color:#507b38}.msn-message-heading time{margin-left:auto;color:#9aa6b3;font-size:9px}.msn-message p{white-space:pre-wrap;line-height:1.5;margin:5px 0 0;color:#293a4f}.msn-message.system{color:#8593a4;font-size:10px;line-height:1.6;margin:8px 0 12px}.msn-message.deleted p{font-style:italic;color:#8492a3}.msn-owner{font-size:8px;letter-spacing:.6px;background:#e7eef8;padding:2px 4px;border-radius:2px}.msn-pending{opacity:.6}.msn-pending button{margin-top:7px}.msn-new{position:absolute;bottom:130px;align-self:center;border:1px solid #a3b7ce;border-radius:12px;padding:5px 12px;background:#e8f1fd;box-shadow:0 2px 8px #0002}
.msn-compose{padding:10px 12px 9px;border-top:1px solid #b9cce0;background:linear-gradient(#f5f8fc,#e9eff7)}.msn-compose label{display:flex;justify-content:space-between;font-size:10px;color:#627894;margin-bottom:6px}.msn-compose label span{font-size:9px}.msn-compose>div{display:flex;gap:7px}.msn-compose textarea{resize:none;min-width:0;flex:1;background:#fff;border:1px solid #a3b8d0;border-radius:3px;padding:8px;line-height:1.5;box-sizing:border-box;min-height:57px}.msn-send{width:65px;border:1px solid #8fa9c6;border-radius:3px;background:linear-gradient(#fff,#dce8f6);box-shadow:inset 0 0 0 1px #fff;font-weight:bold!important}.msn-compose>small{display:block;font-size:9px;color:#8090a3;margin-top:6px}.msn-people{display:flex;flex-direction:column;width:170px;flex-shrink:0;background:linear-gradient(100deg,#eaf1fa,#f6f9fd);border-left:1px solid #bfcee0;overflow:auto}.msn-people h3{font-size:11px;font-weight:normal;color:#557391;padding:13px 13px 8px;margin:0}.msn-people ul{list-style:none;margin:0;padding:0 12px}.msn-people li{display:flex;align-items:center;gap:7px;padding:9px 0;font-size:11px;overflow-wrap:anywhere}.msn-people li>span{min-width:0}.msn-people li small{display:block;font-size:9px;color:#8193a8;margin-top:3px}
.msn-error,.msn-offline{background:#fff6d9;border-top:1px solid #e2d19b;color:#765b2e;padding:8px 12px;font-size:11px;line-height:1.5;flex-shrink:0}.msn-error{display:flex;align-items:center;gap:10px;max-height:95px;overflow:auto}.msn-error button{margin-left:auto;border:0;background:none;font-size:18px}.msn-footer{display:flex;align-items:center;gap:6px;padding:6px 10px;background:#e4eaf3;border-top:1px solid #bdcbdd;font-size:9px;color:#687d96;flex-shrink:0}.msn-footer>span:last-child{margin-left:auto;text-align:right}
.msn-admin{position:absolute;inset:34px 8px 28px;z-index:2;background:#f6f8fc;border:1px solid #7593b7;box-shadow:0 4px 20px #1235;padding:12px;overflow:auto}.msn-admin header{display:flex;align-items:center;gap:8px;margin-bottom:12px}.msn-admin header strong{margin-right:auto}.msn-admin button{padding:4px 8px;border:1px solid #a5b4c8;background:#fff;border-radius:2px}.msn-admin-settings{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.msn-admin-settings select{margin-left:5px}.msn-admin-row{padding:10px 0;border-top:1px solid #d5dfe9;overflow-wrap:anywhere}.msn-admin-row p{white-space:pre-wrap;margin:6px 0}.msn-admin-row button{margin:5px 5px 0 0}.msn-admin-row>span{margin:0 8px}.msn-admin details{padding:8px 0}.msn-admin summary{cursor:pointer}
@container (max-width: 520px){.msn-public{display:none}.msn-banner{padding:12px 15px}.msn-wordmark{font-size:21px}.msn-wordmark b{font-size:27px}.msn-people{display:none;width:130px}.show-people .msn-people{display:flex}.msn-join{padding:18px 16px}.msn-join>.retro-icon{width:38px;height:38px}.msn-footer{font-size:8px}.msn-menu button,.msn-menu a{padding:4px 6px;font-size:10px}.msn-logo{width:44px;height:44px}.msn-logo .retro-icon{width:32px;height:32px}}
/* dark mode (theme.js sets data-theme): the same layout in night blues */
:root[data-theme="dark"] .messenger{background:#161c26;color:#d3deec}:root[data-theme="dark"] .messenger button:focus-visible,:root[data-theme="dark"] .messenger a:focus-visible,:root[data-theme="dark"] .messenger input:focus-visible,:root[data-theme="dark"] .messenger textarea:focus-visible,:root[data-theme="dark"] .messenger select:focus-visible{outline-color:#7fb2ea}
:root[data-theme="dark"] .msn-menu{background:#1d222b;border-color:#343c49}:root[data-theme="dark"] .msn-menu button,:root[data-theme="dark"] .msn-menu a{color:#c4cfdd}:root[data-theme="dark"] .msn-menu button:hover,:root[data-theme="dark"] .msn-menu a:hover{background:#2a3a52}
:root[data-theme="dark"] .msn-banner{background:linear-gradient(115deg,#1b2433 0%,#1d3150 55%,#24426b 100%);border-color:#2f4767;box-shadow:inset 0 1px #ffffff12}:root[data-theme="dark"] .msn-logo{background:#ffffff14;border-color:#ffffff30}:root[data-theme="dark"] .msn-wordmark{color:#a9cdf5}:root[data-theme="dark"] .msn-public{color:#8fb1d6}
:root[data-theme="dark"] .msn-identity{background:#1b222d;border-color:#2e3a4b}:root[data-theme="dark"] .msn-identity>span:last-child{color:#8a9bb0}:root[data-theme="dark"] .msn-dot{background:#5a6370;border-color:#454d58}:root[data-theme="dark"] .msn-dot.live{background:#5cb53a;border-color:#3d7f23;box-shadow:inset 0 1px #9ddf78}:root[data-theme="dark"] .msn-join,:root[data-theme="dark"] .msn-empty{background:radial-gradient(ellipse at top,#212b3a,#161c26)}:root[data-theme="dark"] .msn-join h2,:root[data-theme="dark"] .msn-empty h2{color:#9cc4ef}:root[data-theme="dark"] .msn-join p,:root[data-theme="dark"] .msn-empty p,:root[data-theme="dark"] .msn-join small{color:#93a4ba}
:root[data-theme="dark"] .msn-join input,:root[data-theme="dark"] .msn-compose textarea{background:#10151d;border-color:#3d4f68;box-shadow:inset 1px 1px 2px #0006}:root[data-theme="dark"] .msn-join input::placeholder,:root[data-theme="dark"] .msn-compose textarea::placeholder{color:#6b7b90}:root[data-theme="dark"] .msn-primary,:root[data-theme="dark"] .msn-send{background:linear-gradient(#34465f,#25344a);border-color:#4b6587;box-shadow:inset 0 0 0 1px #ffffff12}:root[data-theme="dark"] .msn-room-title,:root[data-theme="dark"] .msn-transcript{background:#131922;border-color:#273242}:root[data-theme="dark"] .msn-room-title span{color:#8696aa}
:root[data-theme="dark"] .msn-welcome{color:#8c9db3}:root[data-theme="dark"] .msn-welcome>span{color:#4f74a0}:root[data-theme="dark"] .msn-welcome strong{color:#a6c3e4}
:root[data-theme="dark"] .msn-message-heading{color:#83b3e8}:root[data-theme="dark"] .msn-message.own .msn-message-heading{color:#94cf74}:root[data-theme="dark"] .msn-message-heading time{color:#6f7d8f}:root[data-theme="dark"] .msn-message p{color:#d8e2ee}:root[data-theme="dark"] .msn-message.system{color:#7f8ea1}:root[data-theme="dark"] .msn-message.deleted p{color:#7f8ea1}
:root[data-theme="dark"] .msn-owner{background:#2a3b54;color:#bcd5f2}:root[data-theme="dark"] .msn-new{background:#24364f;border-color:#46607f;box-shadow:0 2px 8px #0008}
:root[data-theme="dark"] .msn-compose{background:linear-gradient(#1c2430,#18202a);border-color:#2f3d50}:root[data-theme="dark"] .msn-compose label{color:#8ea2bb}:root[data-theme="dark"] .msn-compose>small{color:#76869a}
:root[data-theme="dark"] .msn-people{background:linear-gradient(100deg,#1a2230,#171d27);border-color:#2d3a4c}:root[data-theme="dark"] .msn-people h3{color:#90acc9}:root[data-theme="dark"] .msn-people li small{color:#7a8ba0}:root[data-theme="dark"] .msn-error,:root[data-theme="dark"] .msn-offline{background:#3a3018;border-color:#5e4d24;color:#ecd9a6}
:root[data-theme="dark"] .msn-footer{background:#1a212b;border-color:#2e3a4b;color:#8394aa}
:root[data-theme="dark"] .msn-admin{background:#1a212c;border-color:#3f5a7c;box-shadow:0 4px 20px #0009}:root[data-theme="dark"] .msn-admin button{background:#253246;border-color:#45597a}:root[data-theme="dark"] .msn-admin-row{border-color:#2c3849}:root[data-theme="dark"] .msn-admin select{background:#10151d;border:1px solid #3d4f68}
</style>
