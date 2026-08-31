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
- **Configurable review lenses** — five by default (dsh.md compliance, bug & correctness, historical context, security, code-comment compliance), plus an optional performance lens; choose a subset per profile.
- **Confidence + severity scoring** — findings are deduplicated across lenses, then batch-scored for confidence (real vs false positive) and severity (blocker/major/minor/nit); anything below the threshold is dropped (default 80).
- **PR auto-reply** — pull-request results are posted back to the PR with `gh`; local results are reported in chat.
- **Configurable** — the confidence threshold is set per profile (see [Configuration](#configuration)).
- **Review report document** — local reviews are written as a structured Markdown report (in English) plus a machine-readable JSON sidecar, under `doc/` by default; override the directory with `--out <dir>` per invocation or `config.outputDir` per profile. The filename embeds the current HEAD's short sha (omitted outside a git repo).

## Requirements

- A dsh profile built on `@deepseek-ai/dsh-base` (every shipped profile), which provides the `commands` service and the subagent/bash/todo tools the workflow uses.
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

The `dsh plugin add` command installs the package into the profile and, because its `package.json` declares `dsh.bundle`, appends it to `dsh.profile.bundles` automatically. Restart or re-boot the profile to pick it up.

## Usage

### In the DSH web UI

1. Start the web UI and open the printed URL: `dsh web` (alias of `dsh --profile web`).
2. Start a new session and type `/code-review` in the composer. The command is registered automatically — no extra setup.
3. For pull requests the result is posted back to the PR via `gh`; for local review, findings are reported directly in chat.

### Examples

```
/code-review 123                                  # review a pull request by number
/code-review https://github.com/owner/repo/pull/123
/code-review review src/auth                      # local review of a named scope
/code-review review the whole project             # local review of the entire repository
/code-review                                      # local review of the current uncommitted changes
/code-review review src/auth --out reports        # save the report under reports/
/code-review --out docs review src/auth           # --out may come first or last
```

Empty input first probes the current branch's open PR, then falls back to reviewing uncommitted changes.

For local reviews, the report is also written to a Markdown document — under `doc/` by default, or wherever `--out <dir>` (or `config.outputDir`) points. The filename is `code-review-<sha7>-<slug>.md` in a git repo (`<sha7>` is the current HEAD's short sha, `<slug>` is derived from the review scope), and `code-review-<slug>.md` outside a git repo.

## How it works

The package is a standard dsh **bundle**:

- `package.json` declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`.
- `cordis.patch.yml` inserts one plugin row (`id: command-code-review`) into the profile layer stack.
- `lib/index.js` is a Cordis plugin that injects `commands` and registers the `code-review` command. The handler routes PR numbers/URLs to the pull-request workflow and everything else (including empty input) to the local-review workflow, then delivers it via `agent.followup`. The confidence threshold is configurable per profile (see Configuration), and the workflows tell the agent to await subagent completion notices rather than polling.

Users can disable or override the command from their own profile `cordis.patch.yml`:

```yaml
- disable: command-code-review
```

## Configuration

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
- **Review lenses**: available lens ids are `dsh-md`, `bugs`, `history`, `security`, `comments`, and `perf`. The default set is `dsh-md`, `bugs`, `history`, `security`, `comments`. Choose a subset per profile:

  ```yaml
  - id: command-code-review
    config:
      lenses: [dsh-md, bugs, security]
  ```
- **Adaptive lenses**: with `autoLenses: true` (the default), the security lens is auto-enabled when the scope touches security-sensitive files and the performance lens when it touches hot paths — if they are not already enabled. Disable with `autoLenses: false`.

## Troubleshooting

- **No review comment posted**: the PR is closed, draft, trivial, or already reviewed; or no finding scored 80 or above.
- **`gh` not found**: install and authenticate the GitHub CLI (`gh auth login`); only pull-request review needs it.
- **Code links do not render**: use the full commit SHA and the `#L[start]-L[end]` line range.

## Layout

```
lib/index.js             # Cordis plugin that registers the /code-review command
lib/lenses.js            # review-lens registry + resolution
lib/parse.js             # invocation parsing (--out flag)
test/smoke.test.mjs      # smoke test
test/parse.test.mjs      # parser unit test
test/lenses.test.mjs     # lens resolution unit test
cordis.patch.yml         # bundle patch
.github/workflows/       # ci.yml + release.yml + release-please.yml
```

## Development

```sh
npm install
npm test        # node --test (smoke + parser + lens unit tests)
```

## Contributing

Issues and pull requests are welcome.

## License

MIT
