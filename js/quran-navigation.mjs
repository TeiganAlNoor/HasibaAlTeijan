/**
 * Navigation over the canonical, flattened Mushaf order.
 * All verse indexes are zero-based and inclusive. The selected start/end stay
 * anchored. Index zero is the ENTIRE selection, never a paginated subset.
 * Nonzero indexes browse adjacent groups without changing that selection.
 */

function pageBounds(state, pageIndex = state.pageIndex) {
  const { start, end, total, groupLength } = state;
  let first;
  let last;
  if (pageIndex < 0) {
    first = start + pageIndex * groupLength;
    last = first + groupLength - 1;
  } else if (pageIndex > 0) {
    first = end + 1 + (pageIndex - 1) * groupLength;
    last = first + groupLength - 1;
  } else {
    first = start;
    last = end;
  }
  return { start: Math.max(0, first), end: Math.min(total - 1, last) };
}

function withPage(state, pageIndex) {
  const minimum = -Math.ceil(state.start / state.groupLength);
  const maximum = Math.ceil((state.total - 1 - state.end) / state.groupLength);
  const current = Math.max(minimum, Math.min(maximum, pageIndex));
  return Object.freeze({
    ...state,
    pageIndex: current,
    canPrevious: current > minimum,
    canNext: current < maximum,
  });
}

/** Create a navigation anchor without changing the selected range or verses. */
export function createNavigation(start, end, total, pageSize = 20) {
  if (![start, end, total, pageSize].every(Number.isSafeInteger)
      || total < 1 || pageSize < 1 || start < 0 || start > end || end >= total) {
    throw new RangeError('Navigation requires valid inclusive verse indexes and a positive page size.');
  }
  const length = end - start + 1;
  const groupLength = Math.min(pageSize, length);
  return withPage({
    start, end, total, pageSize, groupLength,
  }, 0);
}

/** Inclusive indexes of the full selection or currently browsed adjacent group. */
export function getNavigationPage(state) {
  return pageBounds(state);
}

/** Move by whole groups. The original state is never mutated. */
export function stepNavigation(state, delta) {
  if (!Number.isSafeInteger(delta)) throw new RangeError('Navigation delta must be an integer.');
  // Clamp before adding so even extreme valid deltas cannot lose precision.
  const boundedDelta = Math.max(-state.total, Math.min(state.total, delta));
  return withPage(state, state.pageIndex + boundedDelta);
}

/** Return to the immutable, complete selection from any browsed location. */
export function returnToSelection(state) {
  return withPage(state, 0);
}
