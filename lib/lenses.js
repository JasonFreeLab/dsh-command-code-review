/**
 * Review-lens registry and resolution for the /code-review command.
 *
 * A "lens" is one independent review perspective. Lenses are split into two
 * phases: core lenses run first (in parallel), contextual lenses run second
 * (only on files that already produced findings). This module has no runtime
 * dependencies so it can be unit-tested without the peer dependencies.
 *
 * @module dsh-command-code-review/lib/lenses
 */

/**
 * One review perspective.
 *
 * - `title` / `instruction`: the agent-facing prompt text.
 * - `core`: core lenses run in the first phase; the rest are contextual.
 * - `optional`: only runs when explicitly enabled or adaptively triggered.
 * - `triggers`: filename fragments that adaptively enable an optional lens.
 * - `validate`: gate this lens's findings through the validation pass.
 * - The default set is every lens without `optional`.
 */
/** @typedef {{ title: string, core: boolean, optional?: boolean, validate?: boolean, instruction: string, triggers?: string[] }} Lens */

/**
 * @type {Record<string, Lens>}
 */
export const LENSES = {
  guidance: {
    title: "agent guidance (AGENTS.md/CLAUDE.md) compliance",
    core: true,
    validate: true,
    instruction:
      "Audit the changes for compliance with the agent guidance files from step 2 — AGENTS.md first, then CLAUDE.md. When evaluating a file, only consider guidance files that share the file's directory or one of its parents. Note that agent guidance is instruction for the agent as it writes code, so not all instructions apply during review; only flag issues where you can quote the exact rule broken.",
  },
  bugs: {
    title: "bug & correctness scan",
    core: true,
    validate: true,
    instruction:
      "Scan the changes for significant bugs, focusing on correctness: obvious logic errors, boundary/off-by-one conditions, missing or incorrect error handling, null/undefined handling, and race conditions. Avoid reading extra context beyond the changes. Flag only issues you can confirm from the diff itself. Ignore nitpicks and issues a linter, typechecker, or compiler would catch.",
  },
  security: {
    title: "security & logic scan",
    core: true,
    validate: true,
    instruction:
      "Look for problems in the introduced code: security issues (hardcoded secrets, injection, XSS, path traversal, unsafe deserialization, missing authentication/authorization) and incorrect logic. Only flag issues that fall within the changed lines. Do not flag speculative or low-likelihood findings.",
    triggers: [
      "auth", "token", "secret", "password", "credential", "session",
      "crypto", "permission", "acl", "login", "jwt", "apikey", "api-key",
      ".sql", "migration",
    ],
  },
  history: {
    title: "historical context",
    core: false,
    instruction:
      "Read the git blame and history of the code under review, plus previous commits or pull requests that touched these files, to identify bugs in light of that context and any prior review comments that still apply.",
  },
  comments: {
    title: "code-comment compliance",
    core: false,
    instruction:
      "Read the code comments in the files under review and check that the changes comply with any guidance the comments give.",
  },
  tests: {
    title: "test coverage",
    core: false,
    optional: true,
    instruction:
      "Review the tests added or changed alongside the code: do they cover the new behavior and its failure paths, and would they fail if the change regressed? Flag missing coverage of a critical branch, not general lack of test coverage.",
    triggers: ["test", "spec", "__tests__", ".test.", "_test."],
  },
  perf: {
    title: "performance",
    core: false,
    optional: true,
    instruction:
      "Scan the changes for performance regressions: hot loops, redundant or repeated work, N+1 queries, excessive allocation, and blocking I/O on the hot path.",
    triggers: ["loop", "cache", "query", "render", "worker", "batch", "index", "hot"],
  },
};

/** The default lens set in report order: every lens without an opt-in requirement. */
export const DEFAULT_LENS_IDS = Object.keys(LENSES).filter((id) => !LENSES[id].optional);

/**
 * Resolve the enabled lens ids from a plugin config.
 *
 * @param {{ lenses?: string[] }} [config]
 * @returns {string[]} the enabled lens ids, defaults when unset/empty.
 */
export function resolveLenses(config) {
  const configured = config && Array.isArray(config.lenses) ? config.lenses : [];
  const source = configured.length > 0 ? configured : DEFAULT_LENS_IDS;
  const seen = new Set();
  const result = [];
  for (const id of source) {
    if (LENSES[id] && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Resolve whether adaptive (auto) lens enablement is on.
 *
 * @param {{ autoLenses?: boolean }} [config]
 * @returns {boolean}
 */
export function resolveAutoLenses(config) {
  return !(config && config.autoLenses === false);
}

/**
 * Split lens ids into core and contextual phases, preserving order.
 *
 * @param {string[]} ids
 * @returns {{ core: string[], contextual: string[] }}
 */
export function partitionLenses(ids) {
  const core = [];
  const contextual = [];
  for (const id of ids) {
    if (!LENSES[id]) continue;
    (LENSES[id].core ? core : contextual).push(id);
  }
  return { core, contextual };
}
