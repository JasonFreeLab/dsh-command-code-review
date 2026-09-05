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

/** @typedef {{ title: string, core: boolean, optional?: boolean, instruction: string, triggers?: string[] }} Lens */

/**
 * @type {Record<string, Lens>}
 */
export const LENSES = {
  guidance: {
    title: "agent guidance (AGENTS.md/CLAUDE.md) compliance",
    core: true,
    instruction:
      "Audit the changes for compliance with the agent guidance files from step 2 — AGENTS.md first, then CLAUDE.md. Note that agent guidance is instruction for the agent as it writes code, so not all instructions apply during review; only flag issues the guidance specifically calls out.",
  },
  bugs: {
    title: "bug & correctness scan",
    core: true,
    instruction:
      "Scan the changes for real bugs, focusing on correctness: obvious logic errors, boundary/off-by-one conditions, missing or incorrect error handling, null/undefined handling, and race conditions. Avoid reading extra context beyond the changes. Ignore issues a linter, typechecker, or compiler would catch.",
  },
  security: {
    title: "security scan",
    core: true,
    instruction:
      "Scan the changes for security issues: hardcoded secrets or credentials, injection (SQL/command/header), XSS, path traversal, unsafe deserialization, and missing or broken authentication/authorization. Ignore speculative or low-likelihood findings.",
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
  perf: {
    title: "performance",
    core: false,
    optional: true,
    instruction:
      "Scan the changes for performance regressions: hot loops, redundant or repeated work, N+1 queries, excessive allocation, and blocking I/O on the hot path.",
    triggers: ["loop", "cache", "query", "render", "worker", "batch", "index", "hot"],
  },
};

/** The five lenses enabled by default, in report order. */
export const DEFAULT_LENS_IDS = ["guidance", "bugs", "history", "security", "comments"];

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
