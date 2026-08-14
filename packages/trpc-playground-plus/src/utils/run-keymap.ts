/**
 * Pure selection logic for the "run request" shortcut: given the tRPC calls found in
 * the document and the cursor offset, decide which call the shortcut should execute.
 * Kept separate from CodeEditor so it can be unit-tested without a DOM.
 */

export interface CallRange {
  start: number;
  end: number;
  code: string;
}

/**
 * Find top-level `trpc.*.query(...)` / `.mutate(...)` calls in the source, returning
 * each one's offset range and code. Only calls that begin at the start of a line
 * (ignoring whitespace) are considered "runnable" — mirrors the gutter play buttons.
 */
export function findTrpcCalls(text: string): CallRange[] {
  const calls: CallRange[] = [];
  const regex = /trpc\.\w+(?:\.\w+)*\.(query|mutate)\(/g;
  for (let match = regex.exec(text); match !== null; match = regex.exec(text)) {
    const start = match.index;
    let pos = start + match[0].length;
    let openParens = 1;

    const lineStart = text.lastIndexOf('\n', start) + 1;
    const linePrefix = text.substring(lineStart, start).trim();

    if (linePrefix === '') {
      while (pos < text.length && openParens > 0) {
        if (text[pos] === '(') openParens++;
        else if (text[pos] === ')') openParens--;
        pos++;
      }
      if (openParens === 0) {
        calls.push({ start, end: pos, code: text.substring(start, pos) });
      }
    }
  }
  return calls;
}

/**
 * Pick the call the cursor is acting on:
 *  1. the call whose `[start, end]` range contains the cursor;
 *  2. otherwise the last call that begins at or before the cursor (the one "above");
 *  3. otherwise the first call;
 *  4. otherwise `null` (no calls).
 */
export function pickCallAtCursor(calls: CallRange[], cursor: number): CallRange | null {
  if (calls.length === 0) return null;

  const containing = calls.find((c) => cursor >= c.start && cursor <= c.end);
  if (containing) return containing;

  let above: CallRange | null = null;
  for (const call of calls) {
    if (call.start <= cursor) above = call;
  }
  return above ?? calls[0];
}
