// mounts the blog renderer with a fake post so browser-check can test it.
// no real posts ship yet, so this is the only way to see the article view.
import { createApp } from 'vue';
import Blog from '../src/components/Blog.vue';

export function mountFixture() {
  const host = document.createElement('div');
  host.id = 'blog-fixture';
  host.style = 'position:fixed;inset:0;z-index:999999;background:white;display:flex';
  document.body.append(host);

  const post = {
    slug: 'test',
    title: 'Renderer fixture',
    date: '2026-09-25',
    lead: { type: 'image', src: '/tests/fixtures/vaporwave.svg', alt: 'Test sunset' },
    blocks: [
      { type: 'paragraph', text: 'A readable paragraph.' },
      { type: 'heading', text: 'Example section' },
      // the renderer should show this as text, not run it
      { type: 'code', language: 'js', code: 'const safe = "<script>";' },
    ],
  };

  createApp(Blog, { posts: [post], comingSoon: false }).mount(host);
}

// the published contact form post (fixtures/contact-post.json, a copy of /api/blog),
// so its figures from blog-figures.mjs can be checked without the worker
export async function mountContactFixture() {
  const post = await (await fetch('/tests/fixtures/contact-post.json')).json();
  const host = document.createElement('div');
  host.id = 'blog-fixture';
  host.style = 'position:fixed;inset:0;z-index:999999;background:white;display:flex';
  document.body.append(host);
  createApp(Blog, { posts: [{ ...post, lead: { type: 'image', src: post.leadImage, alt: post.title } }], comingSoon: false }).mount(host);
}

export function mountGalleryFixture() {
  const host = document.createElement('div');
  host.id = 'blog-fixture';
  host.style = 'position:fixed;inset:0;z-index:999999;display:flex';
  document.body.append(host);
  createApp(Blog, { posts: [{ slug: 'test-blog', title: 'test blog', date: '2026-09-27', source: 'hello world\n\nJason was here' }], comingSoon: false }).mount(host);
}
