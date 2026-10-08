/**
 * Where the advisor came from inside the portal, so a detail page's Back link can
 * return there instead of always to a fixed list.
 *
 * A stack, not a single "previous": with only one slot, customer -> policy -> Back
 * -> customer would point the customer page's Back at the policy again, and the two
 * pages would bounce between each other forever. Arriving at the entry just below
 * the top (our Back link, or the phone's own Back button) pops instead of pushing.
 *
 * Module state, so it is empty after a refresh or when a page is opened from a
 * shared link. Back links then fall back to their list, which is the right answer.
 */
const stack: string[] = [];
const MAX = 50;

export function recordLocation(loc: string) {
  if (stack[stack.length - 1] === loc) return;
  if (stack[stack.length - 2] === loc) {
    stack.pop();
    return;
  }
  stack.push(loc);
  if (stack.length > MAX) stack.shift();
}

export function previousLocation(): string | null {
  return stack.length > 1 ? stack[stack.length - 2] : null;
}
