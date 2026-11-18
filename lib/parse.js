/**
 * Invocation parsing for the /code-review slash command.
 *
 * Extracts the flags this command owns from the raw command input and leaves
 * everything else as the review request. This module has no runtime
 * dependencies so it can be unit-tested without installing the peer
 * dependencies.
 *
 * Recognized flags (case-insensitive, any position):
 * - `--out <dir>` / `--output <dir>` (also `--out=<dir>`) — report directory.
 * - `--comment` — post the review back to the pull request through `gh`.
 * - `--inline` — additionally post one inline review comment per confirmed issue.
 * - `--validate` — validate each bug/security finding with a dedicated agent
 *   before scoring (default on; `--no-validate` turns it off).
 * - `--no-validate` — skip the validation pass.
 * - `--no-report` — do not write the Markdown report or JSON sidecar.
 *
 * @module dsh-command-code-review/lib/parse
 */

/** Matches `--out <dir>`, `--output <dir>`, `--out=<dir>`, `--output=<dir>`. */
const OUT_FLAG = /(?:^|\s)--(?:out|output)(?:\s+|=)([^\s]+)/i;

/** Boolean flags owned by this command, mapped to their option field. */
const BOOLEAN_FLAGS = [
  ["--no-validate", "validate", false],
  ["--validate", "validate", true],
  ["--no-report", "report", false],
  ["--comment", "comment", true],
  ["--inline", "inline", true],
];

/**
 * Split the raw invocation into a review request and command options.
 *
 * @param {string} raw Raw slash-command input.
 * @param {string} defaultDir Output directory to use when no flag is present.
 * @returns {{ request: string, outDir: string, comment: boolean, inline: boolean, validate: boolean, report: boolean }}
 */
export function parseInvocation(raw, defaultDir) {
  let input = String(raw ?? "").trim();
  const match = input.match(OUT_FLAG);
  let outDir = defaultDir;
  if (match) {
    outDir = match[1];
    input = (input.slice(0, match.index) + input.slice(match.index + match[0].length)).trim();
  }
  const options = { comment: false, inline: false, validate: true, report: true };
  for (const [flag, field, value] of BOOLEAN_FLAGS) {
    const pattern = new RegExp(`(?:^|\\s)${flag}(?=\\s|$)`, "i");
    if (!pattern.test(input)) continue;
    options[field] = value;
    input = input.replace(pattern, " ").replace(/\s+/g, " ").trim();
  }
  return { request: input, outDir, ...options };
}
