/**
 * Invocation parsing for the /code-review slash command.
 *
 * Extracts an optional output-directory override (`--out <dir>`, also
 * `--output` and the `=` form) from the raw command input; the remaining
 * text is the review request. This module has no runtime dependencies so it
 * can be unit-tested without installing the peer dependencies.
 *
 * @module dsh-command-code-review/lib/parse
 */

/** Matches `--out <dir>`, `--output <dir>`, `--out=<dir>`, `--output=<dir>`. */
const OUT_FLAG = /(?:^|\s)--(?:out|output)(?:\s+|=)([^\s]+)/i;

/**
 * Split the raw invocation into a review request and an output directory.
 *
 * @param {string} raw Raw slash-command input.
 * @param {string} defaultDir Output directory to use when no flag is present.
 * @returns {{ request: string, outDir: string }}
 */
export function parseInvocation(raw, defaultDir) {
  const input = String(raw ?? "").trim();
  const match = input.match(OUT_FLAG);
  if (!match) {
    return { request: input, outDir: defaultDir };
  }
  const outDir = match[1];
  const request = (input.slice(0, match.index) + input.slice(match.index + match[0].length)).trim();
  return { request, outDir };
}
