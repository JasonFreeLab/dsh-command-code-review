# dsh-command-code-review

> `/code-review` slash command for DeepSeek Harness — five parallel review lenses, per-finding confidence scoring, for both pull requests and local code.

`/code-review` slash command for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) — a self-contained plugin bundle that runs a full code review, either on a pull request or on local code.

English | [中文](README.zh.md)

## What it does

Registers one global slash command with two modes:

- `/code-review <pr number|url>` — pull-request review (eligibility check → 5 parallel review lenses → per-finding confidence scoring → posts the result back to the PR with `gh`).
- `/code-review [request]` (or empty) — local review of the requested scope, or the current uncommitted changes when no scope is given; reports findings directly in chat (no `gh` needed).

Both modes share the same core: collect relevant `dsh.md` guidance, launch 5 parallel review subagents (dsh.md adherence, shallow bug scan, git-history, prior-change comments, code-comment compliance), confidence-score each finding with a parallel subagent, and drop anything below 80.

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
dsh plugin --profile web add /path/to/dsh-command-code-review-0.1.1.tgz
```

The `dsh plugin add` command installs the package into the profile and, because its `package.json` declares `dsh.bundle`, appends it to `dsh.profile.bundles` automatically. Restart or re-boot the profile to pick it up.

## Usage

Type `/code-review` in the web composer:

```
/code-review 123                                  # review a pull request by number
/code-review https://github.com/owner/repo/pull/123
/code-review 审查 src/auth 的改动                  # local review of a named scope
/code-review                                      # local review of the current uncommitted changes
```

## How it works

The package is a standard dsh **bundle**:

- `package.json` declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`.
- `cordis.patch.yml` inserts one plugin row (`id: command-code-review`) into the profile layer stack.
- `lib/index.js` is a Cordis plugin that injects `commands` and registers the `code-review` command. The handler routes PR numbers/URLs to the pull-request workflow and everything else (including empty input) to the local-review workflow, then delivers it via `agent.followup`.

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
- **Review lenses**: the 5 parallel review lenses (dsh.md compliance, bug scan, git-history, prior-change comments, code-comment compliance) live in `lib/index.js`; add or remove lenses to fit your needs.

## Troubleshooting

- **No review comment posted**: the PR is closed, draft, trivial, or already reviewed; or no finding scored 80 or above.
- **`gh` not found**: install and authenticate the GitHub CLI (`gh auth login`); only pull-request review needs it.
- **Code links do not render**: use the full commit SHA and the `#L[start]-L[end]` line range.

## License

MIT
