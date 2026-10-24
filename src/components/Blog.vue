<script setup>
// blog list, article view and (when i'm signed in) the editor. posts come from
// blog.mjs plus whatever i've written on the site, which the worker keeps in kv
// (worker/blog.mjs). the test can pass its own posts in.
// every block renders as plain text, demos run in a sandboxed iframe.
import { computed, defineAsyncComponent, ref, watch, nextTick, onMounted } from 'vue';
import { posts as localPosts } from '../blog.mjs';
import { parse, slugify, safeSrc } from '../blog-markup.mjs';
import { pastedTable } from '../blog-paste.mjs';
import { withFigures } from '../blog-figures.mjs';
import InlineText from './InlineText.vue';
import ContactFigures from './ContactFigures.vue';
import BlogCode from './BlogCode.vue';
import BlogGraphic from './BlogGraphic.vue';
import BlogGallery from './BlogGallery.vue';
import BlogThumbnail from './BlogThumbnail.vue';
import { read, save, remove } from '../storage.js';
import { trackOnce } from '../analytics.js';

// which component draws a post's figures (the set in blog-figures.mjs). the ones for
// the posts in blog.mjs only load once one of those posts is opened
const figureSets = {
  contact: ContactFigures,
  ui: defineAsyncComponent(() => import('./UiFigures.vue')),
  analytics: defineAsyncComponent(() => import('./AnalyticsFigures.vue')),
  backend: defineAsyncComponent(() => import('./BackendFigures.vue')),
};

const props = defineProps({
  posts: { type: Array, default: () => localPosts },
});

const slug = ref(null);
const status = ref('');
const reading = ref(null);
const written = ref([]);
// my email once access says i'm signed in
const admin = ref(null);
const draft = ref(null);
const previewing = ref(false);
const saving = ref(false);

// posts written on the site win over ones in blog.mjs with the same slug
const allPosts = computed(() => {
  const slugs = new Set(written.value.map(p => p.slug));
  return [...written.value, ...props.posts.filter(p => !slugs.has(p.slug))]
    .sort((a, b) => b.date.localeCompare(a.date));
});
const thumbnails = computed(() => Object.fromEntries(allPosts.value.map(entry => {
  // a post that opens with a figure gets an icon card for it, see thumbnail in blog.mjs
  const src = entry.thumbnail || entry.leadImage || (entry.lead?.type === 'image' && entry.lead.src)
    || (entry.source ? parse(entry.source) : entry.blocks || []).find(block => block.type === 'image')?.src || '';
  // a /figures/ line is only a spot for an interactive figure, there's no picture there
  return [entry.slug, safeSrc(src) && !src.startsWith('/figures/') ? src : ''];
})));

const draftPost = computed(() => draft.value && {
  ...draft.value,
  lead: draft.value.leadImage ? { type: 'image', src: draft.value.leadImage, alt: draft.value.title } : null,
  blocks: parse(draft.value.source),
});

const post = computed(() => previewing.value ? draftPost.value : allPosts.value.find(p => p.slug === slug.value));

// posts written on the site keep their source, so parse that again rather than use
// the saved blocks. older posts then pick up anything the markup learns later.
// some images are swapped for interactive figures, see blog-figures.mjs
const blocks = computed(() => post.value && withFigures(post.value.slug, [
  post.value.lead && { ...post.value.lead, lead: true },
  ...(post.value.source ? parse(post.value.source) : post.value.blocks),
].filter(Boolean)));

// # is the biggest heading. the post title is the h1, so # starts at h2
const headingTag = block => `h${Math.min(Math.max(block.level ?? 2, 1), 3) + 1}`;

// the three A buttons while reading. the choice sticks in this browser
const sizes = [['Small', 1], ['Medium', 1.15], ['Large', 1.3]];
const textSize = ref(Math.min(Math.max(Number(read('blog-text-size', '0')) || 0, 0), sizes.length - 1));
watch(textSize, value => save('blog-text-size', String(value)));

// jump back to the top whenever you switch posts
// counts which posts get read, for the analytics window
watch(slug, value => { if (value) trackOnce('blog-post', value); });

watch([slug, previewing], async () => {
  status.value = '';
  await nextTick();
  reading.value?.scrollTo(0, 0);
});

// keep the draft around so closing the window doesn't lose it
watch(draft, value => value ? save('blog-draft', JSON.stringify(value)) : remove('blog-draft'), { deep: true });

onMounted(async () => {
  try {
    const response = await fetch('api/blog');
    if (response.ok) written.value = (await response.json()).posts ?? [];
  } catch {
    // no worker (like in vite dev), so just the posts in blog.mjs
  }

  try {
    // without an access cookie this redirects to the sign in page, which counts as signed out
    const response = await fetch('api/admin/me', { redirect: 'manual' });
    if (response.ok) admin.value = (await response.json()).email ?? null;
  } catch {
    // signed out
  }

  if (admin.value) {
    try {
      const saved = JSON.parse(read('blog-draft', 'null'));
      if (saved) {
        draft.value = saved;
        status.value = 'Restored your unsaved draft.';
      }
    } catch {
      remove('blog-draft');
    }
  }
});

// noon so the date doesn't slip a day in timezones behind utc
function date(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function copy(code) {
  try {
    await navigator.clipboard.writeText(code);
    status.value = 'Code copied.';
  } catch {
    status.value = 'Copy unavailable. Select the code and copy it manually.';
  }
}

function newPost() {
  draft.value = { title: '', subtitle: '', slug: '', date: today(), leadImage: '', source: '', previousSlug: '', slugEdited: false };
  previewing.value = false;
}

function edit(entry) {
  draft.value = {
    title: entry.title,
    subtitle: entry.subtitle ?? '',
    slug: entry.slug,
    date: entry.date,
    leadImage: entry.leadImage ?? '',
    source: entry.source,
    previousSlug: entry.slug,
    slugEdited: true,
  };
  previewing.value = false;
}

function retitle() {
  if (!draft.value.slugEdited) draft.value.slug = slugify(draft.value.title);
}

function close() {
  if (draft.value.source && !confirm('Discard this draft?')) return;
  draft.value = null;
  previewing.value = false;
}

async function request(method, path, body) {
  const response = await fetch(`api/admin/blog/${encodeURIComponent(path)}`, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Couldn’t reach the server. Are you still signed in?');
  return result;
}

let uploads = 0;

// images upload (below). a copied table comes in as | a | b | rows, since the plain
// text version of it would lose the grid. anything else pastes as normal
function paste(event) {
  const { files } = event.clipboardData;
  if ([...files].some(file => file.type.startsWith('image/'))) return addImages(event, files);
  const text = pastedTable(event.clipboardData.getData('text/html'));
  if (!text) return;
  event.preventDefault();
  insertLines(event.target, text);
  status.value = 'Table pasted. The first row is its header.';
}

// pasting or dropping an image into the post uploads it and puts an image line
// where the cursor was. a placeholder line holds its spot while it uploads
async function addImages(event, files) {
  const images = [...files].filter(file => file.type.startsWith('image/'));
  if (!images.length) return;
  event.preventDefault();

  for (const file of images) {
    const placeholder = `![Uploading image ${++uploads}…]()`;
    insertLines(event.target, placeholder);
    try {
      const response = await fetch('api/admin/images', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': file.type }, body: file });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Couldn’t upload that image. Are you still signed in?');
      if (!draft.value) return; // cancelled while it uploaded
      // a dropped file's name makes a starting alt text, a pasted screenshot is just image.png
      const alt = file.name && file.name !== 'image.png' ? file.name.replace(/\.[^.]+$/, '') : 'Pasted image';
      draft.value.source = draft.value.source.replace(placeholder, `![${alt}](${result.src})`);
      status.value = 'Image added. Change the text in [ ] to describe it.';
    } catch (error) {
      if (!draft.value) return;
      draft.value.source = draft.value.source.replace(`${placeholder}\n`, '').replace(placeholder, '');
      status.value = error.message;
    }
  }
}

// images and tables only render on lines of their own
function insertLines(textarea, lines) {
  const { source } = draft.value;
  const at = textarea.selectionStart ?? source.length;
  const before = source.slice(0, at);
  const after = source.slice(textarea.selectionEnd ?? at);
  const text = `${before && !before.endsWith('\n') ? '\n' : ''}${lines}\n`;
  draft.value.source = before + text + after;
  nextTick(() => textarea.setSelectionRange(at + text.length, at + text.length));
}

async function publish() {
  if (saving.value) return;
  saving.value = true;
  status.value = 'Saving…';

  try {
    const { title, subtitle, date, leadImage, source, previousSlug } = draft.value;
    const saved = (await request('PUT', draft.value.slug, { title, subtitle, date, leadImage, source, previousSlug })).post;
    written.value = [saved, ...written.value.filter(p => p.slug !== saved.slug && p.slug !== previousSlug)];
    draft.value = null;
    previewing.value = false;
    slug.value = saved.slug;
    await nextTick();
    status.value = 'Published.';
  } catch (error) {
    status.value = error.message;
  } finally {
    saving.value = false;
  }
}

async function destroy() {
  const target = draft.value.previousSlug;
  if (!confirm(`Delete “${draft.value.title}”? This can’t be undone.`)) return;

  try {
    await request('DELETE', target);
    written.value = written.value.filter(p => p.slug !== target);
    draft.value = null;
    previewing.value = false;
    slug.value = null;
    await nextTick();
    status.value = 'Deleted.';
  } catch (error) {
    status.value = error.message;
  }
}
</script>

<template>
  <div class="app-layout">
    <!-- signed out, the list's toolbar would only say "Blog", so it's left off -->
    <div v-if="draft || post || admin" class="toolbar">
      <template v-if="draft">
        <button class="raised" :disabled="saving" @click="publish">Publish</button>
        <button class="raised" :class="{ pressed: previewing }" @click="previewing = !previewing">Preview</button>
        <button class="raised" @click="close">Cancel</button>
        <button v-if="draft.previousSlug" class="raised toolbar-link" @click="destroy">Delete</button>
      </template>
      <template v-else-if="post">
        <button class="raised" @click="slug = null">Back to Blog</button>
        <button v-if="admin && post.source" class="raised" @click="edit(post)">Edit</button>
        <div class="text-sizes toolbar-link" role="group" aria-label="Text size">
          <button
            v-for="([name], i) in sizes"
            :key="name"
            class="raised"
            :class="{ pressed: textSize === i }"
            :style="{ fontSize: `${11 + i * 3}px` }"
            :title="`${name} text`"
            :aria-label="`${name} text`"
            :aria-pressed="textSize === i"
            @click="textSize = i"
          >A</button>
        </div>
      </template>
      <template v-else>
        <span>Blog</span>
        <button v-if="admin" class="raised" @click="newPost">New Post</button>
        <a v-if="admin" class="toolbar-link" href="/cdn-cgi/access/logout">Sign out</a>
      </template>
    </div>

    <!-- enter in a field shouldn't publish half a post, so submitting does nothing -->
    <form v-if="draft && !previewing" class="blog-editor" @submit.prevent>
      <div class="mail-fields">
        <label class="raised mail-label" for="blog-title">Title</label>
        <input id="blog-title" v-model="draft.title" class="inset" maxlength="200" required @input="retitle">

        <label class="raised mail-label" for="blog-subtitle">Subtitle</label>
        <input id="blog-subtitle" v-model="draft.subtitle" class="inset" maxlength="200" placeholder="optional, one line under the title in the post list">

        <label class="raised mail-label" for="blog-slug">Slug</label>
        <input id="blog-slug" v-model="draft.slug" class="inset" maxlength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" required @input="draft.slugEdited = true">

        <label class="raised mail-label" for="blog-date">Date</label>
        <input id="blog-date" v-model="draft.date" class="inset" type="date" required>

        <label class="raised mail-label" for="blog-lead">Image</label>
        <input id="blog-lead" v-model="draft.leadImage" class="inset" placeholder="optional lead image, https://… or /assets/…">
      </div>

      <textarea
        v-model="draft.source"
        class="mail-message inset blog-source"
        aria-label="Post"
        maxlength="50000"
        placeholder="Write here. Blank lines split paragraphs, # ## ### start headings, **bold** *italic* __underline__ ~~strike~~ `code`, ![alt](url &quot;caption&quot;) adds an image (or paste one in). Use ```js for highlighted code or ```figure for graphic data."
        @paste="paste"
        @drop="addImages($event, $event.dataTransfer.files)"
      />
    </form>

    <div v-else ref="reading" class="content-scroll blog-reading">
      <template v-if="!post">
        <h1>Blog</h1>
        <p v-if="!allPosts.length">No posts published yet.</p>
        <ul v-else class="blog-list">
          <li v-for="entry in allPosts" :key="entry.slug">
            <button class="blog-entry" :aria-label="entry.title" @click="slug = entry.slug">
              <BlogThumbnail :src="thumbnails[entry.slug]" :gallery="entry.slug === 'test-blog'" />
              <span class="blog-entry-copy"><span class="blog-entry-title">{{ entry.title }}</span><time :datetime="entry.date">{{ date(entry.date) }}</time><span v-if="entry.subtitle" class="blog-subtitle">{{ entry.subtitle }}</span></span>
            </button>
          </li>
        </ul>
      </template>

      <article v-else :style="{ zoom: sizes[textSize][1] }">
        <h1>{{ post.title || 'Untitled' }}</h1>
        <time :datetime="post.date">{{ date(post.date) }}</time>
        <template v-for="(block, i) in blocks" :key="i">
          <component :is="block.type === 'paragraph' ? 'p' : headingTag(block)" v-if="block.type === 'paragraph' || block.type === 'heading'">
            <InlineText :text="block.text" />
          </component>
          <!-- wide tables scroll sideways on their own instead of stretching the post -->
          <div v-else-if="block.type === 'table'" class="blog-table">
            <table>
              <thead v-if="block.header">
                <tr>
                  <th v-for="(cell, j) in block.header" :key="j" :style="{ textAlign: block.align[j] }"><InlineText :text="cell" /></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, r) in block.rows" :key="r">
                  <td v-for="(cell, j) in row" :key="j" :style="{ textAlign: block.align[j] }"><InlineText :text="cell" /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <component :is="figureSets[block.set] ?? ContactFigures" v-else-if="block.type === 'figure'" :figure="block.figure" :caption="block.caption" :number="block.number" />
          <BlogGraphic v-else-if="block.type === 'graphic'" :graphic="block" />
          <figure v-else-if="block.type === 'image'">
            <img :src="block.src" :alt="block.alt">
            <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
          </figure>
          <iframe
            v-else-if="block.type === 'demo'"
            :src="block.src"
            :title="block.title"
            sandbox="allow-scripts"
            loading="lazy"
            class="blog-demo"
          />
          <BlogCode v-else-if="block.type === 'code'" :code="block.code" :language="block.language" @copy="copy" />
        </template>
        <BlogGallery v-if="post.slug === 'test-blog'" />
      </article>
    </div>

    <footer class="status-bar" role="status">
      <span>{{ status || (draft ? (previewing ? 'Previewing. Press Preview again to keep writing.' : 'Writing a post.') : `${allPosts.length} posts`) }}</span>
      <span v-if="admin">Signed in</span>
    </footer>
  </div>
</template>
