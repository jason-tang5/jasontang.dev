// whether an element is on screen right now, for figures that only animate while
// someone can see them. a card scrolled out of the projects row, a minimized window and
// a background tab all count as off screen
import { onBeforeUnmount, ref, watch } from 'vue';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useInView(el) {
  const inView = ref(false);
  let seen = false;
  const update = () => { inView.value = seen && !document.hidden; };
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(([entry]) => { seen = entry.isIntersecting; update(); })
    : null;
  watch(el, (node, old) => {
    if (old) observer?.unobserve(old);
    if (!node) return;
    if (observer) observer.observe(node);
    else { seen = true; update(); }
  }, { immediate: true, flush: 'post' });
  document.addEventListener('visibilitychange', update);
  onBeforeUnmount(() => {
    observer?.disconnect();
    document.removeEventListener('visibilitychange', update);
  });
  return inView;
}
