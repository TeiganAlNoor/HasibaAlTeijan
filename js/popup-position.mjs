/** Keep an anchored, internally scrolling popup inside the visible viewport. */
export function revealFocusedAnchor(input) {
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const nav = document.querySelector('.main-navigation')?.getBoundingClientRect();
  const top = Math.max(viewportTop + 12, nav && nav.top <= viewportTop + 12 ? nav.bottom + 12 : 0);
  const bottom = viewportTop + (viewport?.height ?? innerHeight) - 12;
  const rect = input.getBoundingClientRect();
  if (rect.top < top) window.scrollBy({ top: rect.top - top, behavior: 'instant' });
  else if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom, behavior: 'instant' });
}

export function fitPopup(container, popup, preferredHeight = 360) {
  if (popup.hidden) return;
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const navigation = document.querySelector('.main-navigation');
  const nav = navigation?.getBoundingClientRect();
  // The original sticky navigation must not cover an upward-opening list.
  const top = Math.max(viewportTop + 12, nav && nav.top <= viewportTop + 12 ? nav.bottom + 6 : 0);
  const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 12;
  const anchor = container.getBoundingClientRect();
  const below = Math.max(0, bottom - anchor.bottom - 6);
  const above = Math.max(0, anchor.top - top - 6);
  const upward = below < Math.min(preferredHeight, 200) && above > below;
  popup.style.insetBlockStart = upward ? 'auto' : 'calc(100% + .35rem)';
  popup.style.insetBlockEnd = upward ? 'calc(100% + .35rem)' : 'auto';
  popup.style.maxBlockSize = `${Math.max(44, Math.min(preferredHeight, upward ? above : below))}px`;
  popup.style.transformOrigin = upward ? 'bottom right' : 'top right';
}
