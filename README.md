# dsh-command-code-review

> `/code-review` slash command for DeepSeek Harness — five parallel review lenses, per-finding confidence scoring, for both pull requests and local code.

`/code-review` slash command for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) — a self-contained plugin bundle that runs a full code review, either on a pull request or on local code.

English | [中文](#中文)

## What it does

Registers one global slash command with two modes:

- `/code-review <pr number|url>` — pull-request review (eligibility check → 5 parallel review lenses → per-finding confidence scoring → posts the result back to the PR with `gh`).
- `/code-review [request]` (or empty) — local review of the requested scope, or the current uncommitted changes when no scope is given; reports findings directly in chat (no `gh` needed).

Both modes share the same core: collect relevant `dsh.md` guidance, launch 5 parallel review subagents (dsh.md adherence, shallow bug scan, git-history, prior-change comments, code-comment compliance), confidence-score each finding with a parallel subagent, and drop anything below 80.

## Requirements

- A dsh profile built on `@deepseek-ai/dsh-base` (every shipped profile), which provides the `commands` service and the subagent/bash/todo tools the workflow uses.
- The [GitHub CLI](https://cli.github.com) (`gh`) on `PATH`, authenticated — required only for pull-request review. Local review needs no `gh`.

## Install

From the npm registry (once published):

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

## License

MIT

## 中文

`/code-review`（代码审查）斜杠命令插件，支持两种模式：

- `/code-review <PR 编号或链接>` —— 拉取请求审查（资格检查 → 5 个并行审查视角 → 置信度打分过滤 → 用 `gh` 回帖到 PR）。
- `/code-review [审查需求]`（或留空）—— 本地代码审查：按需求审查指定范围，留空则审查当前未提交改动，结果直接在对话中输出（无需 `gh`）。

安装（发布到 npm 后）：

```sh
dsh plugin --profile web add dsh-command-code-review
```

本地目录或 tarball：

```sh
dsh plugin --profile web add /path/to/dsh-command-code-review
dsh plugin --profile web add /path/to/dsh-command-code-review-0.1.1.tgz
```

要求：基于 `@deepseek-ai/dsh-base` 的 dsh profile；`gh`（GitHub CLI）仅在审查 PR 时需要。
