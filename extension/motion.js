(() => {
  const anime = window.anime;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const statusRuns = new WeakMap();
  const animate = (target, params) => {
    if (reducedMotion || !anime) return null;
    return anime.animate(target, params);
  };
  const pulse = (element) => {
    if (!element || reducedMotion || !anime) return;
    anime.animate(element, { scale: [1, 0.975, 1], duration: 260, ease: 'outCubic' });
  };
  const reveal = (element) => {
    if (!element || reducedMotion || !anime) return;
    anime.animate(element, { opacity: [0, 1], translateY: [8, 0], duration: 360, ease: 'outCubic' });
  };
  const setStatus = (element, message, state = 'neutral') => {
    if (!element) return;
    const run = (statusRuns.get(element) || 0) + 1;
    statusRuns.set(element, run);
    const apply = () => {
      if (statusRuns.get(element) !== run) return;
      element.textContent = message;
      element.dataset.state = state;
      if (reducedMotion || !anime) return;
      anime.animate(element, { opacity: [0, 1], translateY: [4, 0], duration: 240, ease: 'outCubic' });
    };
    if (reducedMotion || !anime || !element.textContent) return apply();
    anime.remove(element);
    anime.animate(element, { opacity: [1, 0], translateY: [0, -3], duration: 120, ease: 'inQuad', onComplete: apply });
  };
  const enter = (root, selector) => {
    if (!root || reducedMotion || !anime) return;
    anime.animate(root, { opacity: [0, 1], translateY: [12, 0], duration: 480, ease: 'outCubic' });
    const items = root.querySelectorAll(selector);
    anime.animate(items, { opacity: [0, 1], translateY: [10, 0], delay: anime.stagger(55, { start: 70 }), duration: 380, ease: 'outCubic' });
  };
  window.CodeGateMotion = { animate, enter, pulse, reveal, setStatus };
})();
