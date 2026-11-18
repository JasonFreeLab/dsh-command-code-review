# dsh-command-code-review

English | [中文](README.zh.md)

[![npm version](https://img.shields.io/npm/v/dsh-command-code-review)](https://www.npmjs.com/package/dsh-command-code-review) [![GitHub release](https://img.shields.io/github/v/release/JasonFreeLab/dsh-command-code-review)](https://github.com/JasonFreeLab/dsh-command-code-review/releases) [![License](https://img.shields.io/npm/l/dsh-command-code-review)](./LICENSE)

A [DSH](https://github.com/deepseek-ai/deepseek-harness) (DeepSeek Harness) slash-command bundle that runs a full code review — configurable review lenses with per-finding confidence and severity scoring, for both pull requests and local code.

> `/code-review` slash command for DeepSeek Harness — self-contained plugin bundle, installable into any dsh profile.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [How it works](#how-it-works)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Layout](#layout)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Two modes, one command** — `/code-review <pr number|url>` reviews a pull request; `/code-review [request]` (or empty) reviews local code.
- **Terminal-first results, opt-in PR comments** — like the upstream `claude/code-review` command, findings are reported in the chat by default; `--comment` posts the summary back to the pull request, and `--inline` adds one inline review comment per confirmed issue.
- **Validation before scoring** — bug, security, and guidance findings each get a dedicated validation subagent (mirroring the upstream command's step 5); only validated findings are deduplicated and scored. `--no-validate` skips the pass.
- **High-signal only** — review agents flag only compile/parse failures, clear logic errors, and quotable AGENTS.md/CLAUDE.md violations; nitpicks and style concerns are explicitly excluded.
- **Configurable review lenses** — five by default (AGENTS.md/CLAUDE.md compliance, bug & correctness, security & logic, historical context, code-comment compliance), plus optional test-coverage and performance lenses; choose a subset per profile.
- **Confidence + severity scoring** — findings are deduplicated across lenses, then batch-scored for confidence (real vs false positive) and severity (blocker/major/minor/nit); anything below the threshold is dropped (default 80).
- **Configurable** — the confidence threshold is set per profile (see [Configuration](#configuration)).
- **Review report document** — local reviews are written as a structured Markdown report (in English) plus a machine-readable JSON sidecar, under `doc/` by default; override the directory with `--out <dir>` per invocation or `config.outputDir` per profile. The filename embeds the current HEAD's short sha (omitted outside a git repo).
- **Tracks the current dsh runtime** — the bundle targets the dsh `0.2.x` plugin API: `engines.dsh` compatibility metadata, an exported schemastery `Config` schema, a producer-owned message source kind, and the asynchronous subagent tool contract.

## Requirements

- A dsh `0.2.x` runtime — `^0.2.2-rc.4`, declared as `engines.dsh` and validated by dsh `0.2.2-rc.4`. The dsh loader checks this range when the plugin is installed and when a profile boots; incompatible bundles are skipped unless the user grants an explicit exact-version exemption.
- Node.js `>=24.9.0`, the runtime dsh 0.2.2 itself requires.
- A dsh profile built on `@deepseek-ai/dsh-base` (the shipped `web`, `headless`, `sdk`, and `acp` profiles; `sdk-minimal` is a standalone tree and lacks the `commands` service), which provides the `commands` service and the subagent/bash/todo tools the workflow uses.
- The [GitHub CLI](https://cli.github.com) (`gh`) on `PATH`, authenticated — required only for pull-request review. Local review needs no `gh`.

## Install

From the npm registry:

```sh
dsh plugin --profile web add dsh-command-code-review
```

From a local checkout or tarball:

```sh
# directory
dsh plugin --profile web add /path/to/dsh-command-code-review

# packed tarball
dsh plugin --profile web add /path/to/dsh-command-code-review-<version>.tgz
```

The `dsh plugin add` command installs the package into the profile and, because its `package.json` declares `dsh.bundle`, appends it to `dsh.profile.bundles` automatically. The install also checks the bundle's dsh requirements (`engines.dsh`); if it names an incompatible runtime, upgrade either dsh or the plugin. Restart or re-boot the profile to pick it up.

## Usage

### In the DSH web UI

1. Start the web UI and open the printed URL: `dsh web` (alias of `dsh --profile web`).
2. Start a new session and type `/code-review` in the composer. The command is registered automatically — no extra setup.
3. Findings are reported in the chat. For pull requests, add `--comment` to post the summary back to the PR via `gh`, and `--inline` for one inline comment per confirmed issue.

### Examples

```
/code-review 123                                  # review a pull request by number, findings in chat
/code-review 123 --comment                        # also post the summary comment to the PR
/code-review 123 --comment --inline               # also leave one inline comment per issue
/code-review https://github.com/owner/repo/pull/123
/code-review review src/auth --no-report          # local review, chat only (no report file)
/code-review review the whole project             # local review of the entire repository
/code-review                                      # local review of the current uncommitted changes
/code-review review src/auth --out reports        # save the report under reports/
/code-review --out docs review src/auth           # --out may come first or last
```

Empty input first probes the current branch's open PR, then falls back to reviewing uncommitted changes.

Flags: `--comment` (post PR findings), `--inline` (inline comments, implies `--comment`), `--out <dir>` (report directory), `--no-validate` (skip the validation pass), `--no-report` (do not write report files).

For local reviews, the report is also written to a Markdown document — under `doc/` by default, or wherever `--out <dir>` (or `config.outputDir`) points. The filename is `code-review-<sha7>-<slug>.md` in a git repo (`<sha7>` is the current HEAD's short sha, `<slug>` is derived from the review scope), and `code-review-<slug>.md` outside a git repo.

## How it works

The package is a standard dsh **bundle**:

- `package.json` declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }` and the supported runtime range in `engines.dsh`.
- `cordis.patch.yml` inserts one plugin row (`id: command-code-review`) into the profile layer stack.
- `lib/index.js` is a Cordis plugin that injects `commands` and registers the `code-review` command. It exports a schemastery `Config` schema (so profile configuration is validated at load time) and one `handler` that routes PR numbers/URLs to the pull-request workflow and everything else (including empty input) to the local-review workflow, then delivers the workflow through `agent.followup` as a `notice` user message carrying this plugin's own `command-code-review` source kind. The workflows tell the agent to launch subagents in parallel and await the runtime's completion notices rather than polling; the dsh 0.2.x `subagent` tool is always asynchronous, returns the child's name, and has no background flag. Step numbers are rendered per invocation, so enabling or skipping the validation pass, posting, and the report keeps a contiguous sequence.

Users can disable or override the command from their own profile `cordis.patch.yml`:

```yaml
- id: command-code-review
  disabled: true
```

## Configuration

Configuration is validated by the exported `Config` schema, so an invalid value fails the plugin load with a clear error instead of being silently ignored.

- **Confidence threshold**: the workflow drops findings scored below a threshold (default 80). Override it in your profile `cordis.patch.yml`:

  ```yaml
  - id: command-code-review
    config:
      threshold: 90
  ```
- **Report output directory**: where local-review reports are saved (default `doc`). Override per profile:

  ```yaml
  - id: command-code-review
    config:
      outputDir: reports
  ```

  or per invocation with `--out`: `/code-review --out reports review src/auth`.
- **Review lenses**: available lens ids are `guidance`, `bugs`, `security`, `history`, `comments`, and the opt-in `tests` and `perf`. The default set is `guidance`, `bugs`, `security`, `history`, `comments`. Choose a subset per profile:

  ```yaml
  - id: command-code-review
    config:
      lenses: [guidance, bugs, security, tests]
  ```
- **Adaptive lenses**: with `autoLenses: true` (the default), the test-coverage lens is auto-enabled when the scope touches test files, the performance lens when it touches hot paths, and the security lens when it touches security-sensitive files — if they are not already enabled. Disable with `autoLenses: false`.
- **PR comments**: findings are printed in chat unless the invocation passes `--comment`. Set `postComment: true` to make posting the profile default:

  ```yaml
  - id: command-code-review
    config:
      postComment: true
  ```
- **Inline comments**: `--inline` posts one inline review comment per confirmed issue through `gh api`. Set `inlineComments: false` to disable inline comments even when `--inline` is passed.

## Troubleshooting

- **`Plugin dsh-command-code-review@… is incompatible with dsh …`**: the running dsh runtime is outside this version's `engines.dsh` range. Upgrade dsh to `0.2.x` or install a matching plugin version. Only as a last resort, grant the exact-version exemption (`dsh plugin allow-version`).
- **No review comment posted**: no `--comment` was passed; or the PR is closed, draft, trivial, or already reviewed; or no finding scored 80 or above.
- **Inline comments missing**: `gh api` needs a token with `repo` scope; issues whose line cannot be addressed are folded into the summary comment.
- **`gh` not found**: install and authenticate the GitHub CLI (`gh auth login`); only pull-request review needs it.
- **Code links do not render**: use the full commit SHA and the `#L[start]-L[end]` line range.

## Layout

```
lib/index.js             # Cordis plugin that registers the /code-review command
lib/lenses.js            # review-lens registry + resolution
lib/parse.js             # invocation parsing (--out/--comment/--inline/--no-validate/--no-report)
test/smoke.test.mjs      # package/bundle metadata smoke test
test/plugin.test.mjs     # command registration + handler delivery test
test/parse.test.mjs      # parser unit test
test/lenses.test.mjs     # lens resolution unit test
cordis.patch.yml         # bundle patch
.github/workflows/       # ci.yml + release.yml + release-please.yml
```

## Development

```sh
npm install
npm test        # node --test (smoke + plugin handler + parser + lens unit tests)
```

The plugin handler test imports `lib/index.js` against the declared peer dependencies and registers the command into a real `@deepseek-ai/dsh-commands` runtime, so it covers the real `createUserMessage`/schemastery/command-registry paths.

## Contributing

Issues and pull requests are welcome.

## License

MIT
