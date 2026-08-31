/**
 * dsh-command-code-review — "/code-review" slash command for DeepSeek Harness.
 *
 * Registers one global slash command with two modes:
 * - /code-review <pr number|url> — pull-request review workflow, posted back via gh.
 * - /code-review [request] (or empty) — local review of the requested scope or the current uncommitted changes, with an optional report document (--out <dir>, default "doc") and a machine-readable JSON sidecar.
 *
 * The review runs through configurable "lenses" (see lib/lenses.js): core lenses
 * run in parallel first, contextual lenses run second on files that already have
 * findings; findings are deduplicated, then batch-scored for confidence and
 * severity (blocker/major/minor/nit).
 *
 * @module dsh-command-code-review
 */
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { parseInvocation } from "./parse.js";
import { LENSES, resolveLenses, resolveAutoLenses, partitionLenses } from "./lenses.js";

/** Cordis plugin name (used in loader diagnostics). */
export const name = "command-code-review";

/** Services this plugin requires; commands ships in the standard dsh base profile. */
export const inject = ["commands"];

const COMMAND_DESCRIPTION = "Code review a pull request or a local change/requirement";

const CONFIDENCE_RUBRIC = `   a. 0: Not confident at all. This is a false positive that doesn't stand up to light scrutiny, or is a pre-existing issue.
   b. 25: Somewhat confident. This might be a real issue, but may also be a false positive. The agent wasn't able to verify that it's a real issue. If the issue is stylistic, it is one that was not explicitly called out in the relevant dsh.md.
   c. 50: Moderately confident. The agent was able to verify this is a real issue, but it might be a nitpick or not happen very often in practice. Relative to the rest of the change, it's not very important.
   d. 75: Highly confident. The agent double checked the issue, and verified that it is very likely it is a real issue that will be hit in practice. The existing approach is insufficient. The issue is very important and will directly impact the code's functionality, or it is an issue that is directly mentioned in the relevant dsh.md.
   e. 100: Absolutely certain. The agent double checked the issue, and confirmed that it is definitely a real issue, that will happen frequently in practice. The evidence directly confirms this.`;

const SEVERITY_RUBRIC = `   - blocker: will break the build, crash at runtime, leak secrets, or is a security vulnerability; must be fixed before merge.
   - major: a real bug or significant correctness/security issue that should be fixed, but does not block the change outright.
   - minor: a small bug or edge case that is unlikely to bite often.
   - nit: a stylistic or non-functional suggestion.`;

const FALSE_POSITIVES = `- Pre-existing issues
- Something that looks like a bug but is not actually a bug
- Pedantic nitpicks that a senior engineer wouldn't call out
- Issues that a linter, typechecker, or compiler would catch (eg. missing or incorrect imports, type errors, broken tests, formatting issues, pedantic style issues like newlines). No need to run these build steps yourself -- it is safe to assume that they will be run separately as part of CI.
- General code quality issues (eg. lack of test coverage, poor documentation), unless explicitly required in dsh.md
- Issues that are called out in dsh.md, but explicitly silenced in the code (eg. due to a lint ignore comment)
- Changes in functionality that are likely intentional or are directly related to the broader change
- Real issues, but on lines that were not modified by the change under review`;

const REPORT_TEMPLATE = `# Code Review

- **Scope**: <review scope / request>
- **Commit**: <short commit sha, or "n/a" if not a git repository>
- **Date**: <YYYY-MM-DD>
- **Mode**: local
- **Confidence threshold**: CONFIDENCE_THRESHOLD

## Summary

<one-sentence summary of the change under review>

## Issues

<group by severity: blocker > major > minor > nit; within a severity, by confidence>

1. <brief description> (severity: <blocker|major|minor|nit>, confidence: <0-100>)
   - <file>:<line> — <impact and suggested fix>

<or, if no issues passed the threshold:>

No issues found. Checked for bugs, security, and dsh.md compliance.`;

/** Render a numbered sub-agent list for a set of lens ids. */
function renderLensList(ids) {
  return ids
    .map((id, i) => "   " + String.fromCharCode(97 + i) + ". " + LENSES[id].title + ": " + LENSES[id].instruction)
    .join("\n");
}

/** Render the adaptive (auto) lens-enablement note, or an empty string. */
function renderAutoLensNote() {
  const auto = Object.entries(LENSES).filter(([, lens]) => lens.triggers);
  if (auto.length === 0) return "";
  return "   - Adaptive lenses (auto):\n" +
    auto
      .map(([, lens]) => "   - If the scope touches any of [" + lens.triggers.join(", ") + '] and the "' + lens.title + '" lens is not already enabled, enable it for this run.')
      .join("\n");
}

/** Build the pull-request review workflow for the enabled lenses. */
function buildPrWorkflow(lensIds, autoLenses) {
  const { core, contextual } = partitionLenses(lensIds);
  const coreTitles = core.map((id) => LENSES[id].title).join(", ");
  const contextualTitles = contextual.length ? contextual.map((id) => LENSES[id].title).join(", ") : "none";
  const autoNote = autoLenses ? renderAutoLensNote() : "";

  return `Provide a code review for the given pull request. To do this, follow these steps precisely:

1. Use a lightweight subagent to check if the pull request (a) is closed, (b) is a draft, (c) does not need a code review (eg. because it is an automated pull request, or is very simple and obviously ok), or (d) already has a code review from you from earlier. If so, do not proceed.
2. Use another lightweight subagent to give you a list of file paths to (but not the contents of) any relevant dsh.md files from the codebase: the root dsh.md file (if one exists), as well as any dsh.md files in the directories whose files the pull request modified.
3. Use a lightweight subagent to view the pull request, and ask the agent to return a summary of the change.
4. Enable the review lenses for this run:
   - Core lenses: ${coreTitles}.
   - Contextual lenses: ${contextualTitles}.
${autoNote}
5. Launch the core lenses as parallel thorough subagents in the background (set run_in_background: true so they run concurrently). Each agent reviews the change and returns a list of issues; for each issue, state the file, line, a one-line description, and the reason it was flagged. The core agents are:
${renderLensList(core)}
6. Launch the contextual lenses as parallel thorough subagents in the background (set run_in_background: true). Only review the files that had findings in step 5; if step 5 found nothing, review the whole pull request. The contextual agents are:
${contextual.length ? renderLensList(contextual) : "   (none enabled)"}

Launch all subagents in one batch, then wait for the runtime to notify you when each one finishes — you are notified automatically when a background subagent settles, so do NOT poll their status with list_agents or repeated checks. Proceed only after all have reported.

7. Deduplicate the findings across lenses: merge issues that refer to the same file + line + category.
8. Launch ONE scoring subagent with the deduplicated list. For each issue, return (a) a confidence score 0-100 for whether the issue is real or a false positive, using the confidence rubric below, and (b) a severity of blocker/major/minor/nit using the severity rubric below.
9. Drop any issue with a confidence score below CONFIDENCE_THRESHOLD, then sort the remaining issues by severity (blocker > major > minor > nit), then by confidence.
10. Use a lightweight subagent to repeat the eligibility check from #1, to make sure that the pull request is still eligible for code review.
11. Finally, use the gh command (through the bash tool) to comment back on the pull request with the result. When writing your comment, keep in mind to:
   a. Keep your output brief
   b. Avoid emojis
   c. Link and cite relevant code, files, and URLs
   d. Group issues by severity (blocker first) and state each issue's severity

Confidence rubric (give this rubric to the scoring agent verbatim):
${CONFIDENCE_RUBRIC}

Severity rubric (give this rubric to the scoring agent verbatim):
${SEVERITY_RUBRIC}

Examples of false positives, for the lenses and scoring:

${FALSE_POSITIVES}

Notes:

- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to your code review.
- Use \`gh\` (through the bash tool) to interact with Github (eg. to fetch a pull request, or to create inline comments), rather than web fetch.
- Make a todo list first (with todo_write).
- You must cite and link each bug (eg. if referring to a dsh.md, you must link it).
- For your final comment, follow the following format precisely (assuming for this example that you found 3 issues):

---

### Code review

Found 3 issues:

1. <brief description of bug> (severity: blocker) (dsh.md says "<...>")

<link to file and line with full sha1 + line range for context, note that you MUST provide the full sha and not use bash here, eg. https://github.com/owner/repo/blob/<full-sha>/README.md#L13-L17>

2. <brief description of bug> (severity: major) (some/other/dsh.md says "<...>")

<link to file and line with full sha1 + line range for context>

3. <brief description of bug> (severity: minor) (bug due to <file and code snippet>)

<link to file and line with full sha1 + line range for context>

<sub>- If this code review was useful, please react with 👍. Otherwise, react with 👎.</sub>

---

- Or, if you found no issues:

---

### Code review

No issues found. Checked for bugs, security, and dsh.md compliance.

- When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: https://github.com/owner/repo/blob/<full-sha>/package.json#L10-L15
  - Requires full git sha
  - You must provide the full sha. Commands like \`https://github.com/owner/repo/blob/$(git rev-parse HEAD)/foo/bar\` will not work, since your comment will be directly rendered in Markdown.
  - Repo name must match the repo you're code reviewing
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to \`L4-7\`)`;
}

/** Build the local review workflow for the enabled lenses. */
function buildLocalWorkflow(lensIds, autoLenses) {
  const { core, contextual } = partitionLenses(lensIds);
  const coreTitles = core.map((id) => LENSES[id].title).join(", ");
  const contextualTitles = contextual.length ? contextual.map((id) => LENSES[id].title).join(", ") : "none";
  const autoNote = autoLenses ? renderAutoLensNote() : "";

  return `Review the code for the request below. To do this, follow these steps precisely:

1. Determine the review scope from the request: which files, directories, or changes to review. If the request is empty, review the current uncommitted changes first (run "git diff" plus "git diff --cached"); if there are none, review the repository's recently modified files. If the request explicitly asks to review the whole project (e.g. "entire project", "whole codebase"), review the entire repository. If the request names a file, directory, or module, review exactly that scope.
2. Use a lightweight subagent to give you a list of file paths to (but not the contents of) any relevant dsh.md files from the codebase: the root dsh.md file (if one exists), as well as any dsh.md files in the directories whose files are under review.
3. Use a lightweight subagent to summarize the code under review and the request, so the review stays focused on what matters.
4. Enable the review lenses for this run:
   - Core lenses: ${coreTitles}.
   - Contextual lenses: ${contextualTitles}.
${autoNote}
5. Launch the core lenses as parallel thorough subagents in the background (set run_in_background: true so they run concurrently). Each agent reviews the scope and returns a list of issues; for each issue, state the file, line, a one-line description, and the reason it was flagged. The core agents are:
${renderLensList(core)}
6. Launch the contextual lenses as parallel thorough subagents in the background (set run_in_background: true). Only review the files that had findings in step 5; if step 5 found nothing, review the whole scope. The contextual agents are:
${contextual.length ? renderLensList(contextual) : "   (none enabled)"}

Launch all subagents in one batch, then wait for the runtime to notify you when each one finishes — you are notified automatically when a background subagent settles, so do NOT poll their status with list_agents or repeated checks. Proceed only after all have reported.

7. Deduplicate the findings across lenses: merge issues that refer to the same file + line + category.
8. Launch ONE scoring subagent with the deduplicated list. For each issue, return (a) a confidence score 0-100 for whether the issue is real or a false positive, using the confidence rubric below, and (b) a severity of blocker/major/minor/nit using the severity rubric below.
9. Drop any issue with a confidence score below CONFIDENCE_THRESHOLD, then sort the remaining issues by severity (blocker > major > minor > nit), then by confidence.
10. Report the confirmed issues directly in your reply (no gh CLI and no pull-request comment, since this is not a PR). For each issue, state the file and line, the defect, the impact, and a suggested fix (include a suggested code patch where practical), with a link to the code where possible. Group and order by severity.

Confidence rubric (give this rubric to the scoring agent verbatim):
${CONFIDENCE_RUBRIC}

Severity rubric (give this rubric to the scoring agent verbatim):
${SEVERITY_RUBRIC}

Examples of false positives, for the lenses and scoring:

${FALSE_POSITIVES}

Notes:

- Do not check build signal or attempt to build or typecheck the app. These will run separately, and are not relevant to your code review.
- Make a todo list first (with todo_write).
- You must cite and link each bug (eg. if referring to a dsh.md, you must link it).

For your final report, follow this format (assuming 3 issues found):

---

### Code review

Found 3 issues:

1. <brief description> (severity: blocker) (dsh.md says "<...>")
   - <file>:<line> — <impact and suggested fix>

2. <brief description> (severity: major) (bug due to <file and code snippet>)
   - <file>:<line> — <impact and suggested fix>

3. <brief description> (severity: minor) (<reason>)
   - <file>:<line> — <impact and suggested fix>

---

Or, if you found no issues:

### Code review

No issues found. Checked for bugs, security, and dsh.md compliance.

11. Write the review report to a markdown document in English (regardless of any language guidance in dsh.md), following the REPORT_TEMPLATE below, and also write a machine-readable JSON file:
   a. Output directory: REPORT_OUTPUT_DIR. Create it if missing by running "mkdir -p REPORT_OUTPUT_DIR" through the bash tool.
   b. Short commit sha: run "git rev-parse --short HEAD" through the bash tool. If it fails (not a git repository), use no sha.
   c. Slug: derive a short slug from the review scope determined in step 1 — lowercase, replace each run of non-alphanumeric characters with "-", and trim leading/trailing "-". Use "uncommitted" when reviewing uncommitted changes, and "full" when reviewing the whole repository.
   d. Base filename: code-review-<sha7>-<slug>.md when a sha was obtained, otherwise code-review-<slug>.md.
   e. Write the Markdown report with the write tool to <output directory>/<base filename>, and write the machine-readable findings to <output directory>/<base filename>.json (the same basename but with a .json extension). The JSON shape is: {"scope":"<scope>","commit":"<short sha or null>","date":"<YYYY-MM-DD>","threshold":CONFIDENCE_THRESHOLD,"issues":[{"file":"<path>","line":<number>,"severity":"<blocker|major|minor|nit>","confidence":<0-100>,"title":"<one-line description>","description":"<impact and suggested fix>"}]}.
   f. Mention the saved paths in your final reply.

REPORT_TEMPLATE:

${REPORT_TEMPLATE}`;
}

/** True when the input names a GitHub pull request (number or URL). */
function isPrTarget(input) {
  return /^\d+$/.test(input) || /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/i.test(input);
}

const DEFAULT_THRESHOLD = 80;
const EMPTY_INPUT_PROBE = `First check whether the current branch has an open pull request (run "gh pr view" through the bash tool). If it does, review that pull request instead — switch to the pull-request workflow (eligibility check → review lenses → confidence/severity scoring → post the result back to the PR with gh). If there is no open PR, review the current uncommitted changes locally.

`;
const THRESHOLD_TOKEN = "CONFIDENCE_THRESHOLD";
const OUTPUT_DIR_TOKEN = "REPORT_OUTPUT_DIR";
const DEFAULT_OUTPUT_DIR = "doc";

/** Render a workflow template with the configured confidence threshold. */
function renderWorkflow(template, threshold) {
  return template.replaceAll(THRESHOLD_TOKEN, String(threshold));
}

/** Render the report output directory into a workflow template. */
function renderOutputDir(template, dir) {
  return template.replaceAll(OUTPUT_DIR_TOKEN, dir);
}

export function apply(ctx, config = {}) {
  const threshold = typeof config.threshold === "number" ? config.threshold : DEFAULT_THRESHOLD;
  const outputDir = typeof config.outputDir === "string" && config.outputDir.trim() ? config.outputDir.trim() : DEFAULT_OUTPUT_DIR;
  const lensIds = resolveLenses(config);
  const autoLenses = resolveAutoLenses(config);
  const workflowPr = renderWorkflow(buildPrWorkflow(lensIds, autoLenses), threshold);
  const workflowLocal = renderWorkflow(buildLocalWorkflow(lensIds, autoLenses), threshold);
  ctx.commands.register({
    name: "code-review",
    description: COMMAND_DESCRIPTION,
    input: { hint: "[pr number/url | review request] [--out <dir>]" },
    handler(invocation) {
      const { request, outDir } = parseInvocation(invocation.rawInput, outputDir);
      const local = renderOutputDir(workflowLocal, outDir);
      let text;
      if (request.length === 0) {
        text = EMPTY_INPUT_PROBE + local;
      } else if (isPrTarget(request)) {
        text = `Target pull request: ${request}\n\n${workflowPr}`;
      } else {
        text = `Review request: ${request}\n\n${local}`;
      }
      invocation.agent.followup(createUserMessage({
        content: [{ type: "text", text }],
        source: { kind: "plugin", plugin: "dsh-command-code-review", form: "notice", summary: "Code review started" },
      }));
      return { kind: "success", text: "Code review started." };
    },
  });
}
