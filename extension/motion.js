(() => {
  const anime = window.anime;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const statusRuns = new WeakMap();
  const visibilityRuns = new WeakMap();
  const animate = (target, params) => {
    if (reducedMotion || !anime) return null;
    return anime.animate(target, params);
  };
  const pulse = (element) => {
    if (!element || reducedMotion || !anime) return;
    anime.animate(element, { scale: [1, 0.975, 1], duration: 260, ease: 'outCubic' });
  };
  const reveal = (element) => {
    if (!element) return;
    show(element);
  };
  const resetVisualStyles = (element) => {
    element.style.removeProperty('opacity');
    element.style.removeProperty('transform');
  };
  const show = (element) => {
    if (!element) return;
    const run = (visibilityRuns.get(element) || 0) + 1;
    visibilityRuns.set(element, run);
    if (anime) anime.remove(element);
    element.classList.remove('hidden');
    if (reducedMotion || !anime) return resetVisualStyles(element);
    anime.animate(element, {
      opacity: [0, 1], translateY: [8, 0], duration: 340, ease: 'outCubic',
      onComplete: () => { if (visibilityRuns.get(element) === run) resetVisualStyles(element); }
    });
  };
  const hide = (element) => {
    if (!element) return;
    const run = (visibilityRuns.get(element) || 0) + 1;
    visibilityRuns.set(element, run);
    if (anime) anime.remove(element);
    if (element.classList.contains('hidden')) return;
    const finish = () => {
      if (visibilityRuns.get(element) !== run) return;
      element.classList.add('hidden');
      resetVisualStyles(element);
    };
    if (reducedMotion || !anime) return finish();
    anime.animate(element, { opacity: [1, 0], translateY: [0, -5], duration: 180, ease: 'inCubic', onComplete: finish });
  };
  const setStatus = (element, message, state = 'neutral') => {
    if (!element) return;
    const run = (statusRuns.get(element) || 0) + 1;
    statusRuns.set(element, run);
    const apply = () => {
      if (statusRuns.get(element) !== run) return;
      element.textContent = message;
      element.dataset.state = state;
      if (!message) {
        resetVisualStyles(element);
        return;
      }
      if (reducedMotion || !anime) return;
      anime.animate(element, { opacity: [0, 1], translateY: [4, 0], duration: 240, ease: 'outCubic', onComplete: () => {
        if (statusRuns.get(element) === run) resetVisualStyles(element);
      } });
    };
    if (reducedMotion || !anime || !element.textContent) return apply();
    const opacity = Number.parseFloat(getComputedStyle(element).opacity) || 1;
    anime.remove(element);
    anime.animate(element, { opacity: [opacity, 0], translateY: [0, -3], duration: 140, ease: 'inQuad', onComplete: apply });
  };
  const enter = (root, selector) => {
    if (!root || reducedMotion || !anime) return;
    anime.animate(root, { opacity: [0, 1], translateY: [12, 0], duration: 480, ease: 'outCubic', onComplete: () => resetVisualStyles(root) });
    const items = Array.from(root.querySelectorAll(selector)).filter((item) => !item.hidden && getComputedStyle(item).display !== 'none');
    anime.animate(items, { opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(65, { start: 70 }), duration: 380, ease: 'outCubic', onComplete: () => {
      items.forEach(resetVisualStyles);
    } });
  };
  window.CodeGateMotion = { animate, enter, hide, pulse, reveal, setStatus, show };
})();
