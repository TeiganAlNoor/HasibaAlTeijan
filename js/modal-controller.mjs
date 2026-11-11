/** Native top-layer dialogs with reversible CSS motion, no dependencies. */
let lockCount = 0;
let savedScroll;

function lockScroll() {
  if (lockCount++ !== 0) return;
  const root = document.documentElement;
  const body = document.body;
  savedScroll = {
    x: scrollX, y: scrollY,
    overflow: root.style.overflow,
    padding: root.style.paddingInlineEnd,
    bodyOverflow: body.style.overflow,
  };
  const gap = innerWidth - root.clientWidth;
  if (gap > 0) root.style.paddingInlineEnd = `${parseFloat(getComputedStyle(root).paddingInlineEnd) + gap}px`;
  root.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
}

function unlockScroll() {
  if (--lockCount !== 0 || !savedScroll) return;
  document.documentElement.style.overflow = savedScroll.overflow;
  document.documentElement.style.paddingInlineEnd = savedScroll.padding;
  document.body.style.overflow = savedScroll.bodyOverflow;
  scrollTo({ left: savedScroll.x, top: savedScroll.y, behavior: 'instant' });
  savedScroll = null;
}

export function createModalController(dialog) {
  let generation = 0;
  let closing = null;
  let locked = false;
  dialog.classList.add('modal-motion');

  function open() {
    if (dialog.open || closing) return;
    generation++;
    const current = generation;
    closing = null;
    lockScroll();
    locked = true;
    dialog.dataset.motion = 'opening';
    dialog.showModal();
    // Establish the visible native dialog's initial state before retargeting.
    getComputedStyle(dialog).opacity;
    getComputedStyle(dialog, '::backdrop').opacity;
    requestAnimationFrame(() => {
      if (current === generation && dialog.open) dialog.dataset.motion = 'open';
    });
  }

  function close({ animate = true } = {}) {
    if (!dialog.open) return Promise.resolve();
    if (closing) return closing;
    generation++;
    dialog.dataset.motion = 'closing';
    getComputedStyle(dialog).opacity;
    getComputedStyle(dialog, '::backdrop').opacity;
    const animations = animate ? dialog.getAnimations() : [];
    closing = (async () => {
      // Includes the dialog/pseudo-element transitions, not its buttons' hovers.
      if (animations.length) await Promise.allSettled(animations.map(animation => animation.finished));
      if (dialog.open) dialog.close();
    })();
    return closing;
  }

  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', () => {
    generation++;
    if (locked) { locked = false; unlockScroll(); }
    delete dialog.dataset.motion;
    closing = null;
  });
  return Object.freeze({ open, close, get closing() { return closing !== null; } });
}
