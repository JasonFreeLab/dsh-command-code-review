# dsh-command-code-review

`/code-review` slash command for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) — a self-contained plugin bundle that runs a full pull-request code review.

English | [中文](#中文)

## What it does

Registers one global slash command:

```
/code-review [pr number or url]
```

The handler injects a complete review workflow into the agent and wakes it. The agent then:

1. Checks the PR is still eligible (open, not a draft, not automated/trivial, not already reviewed).
2. Collects any relevant `dsh.md` guidance files.
3. Summarizes the change.
4. Launches 5 parallel review subagents (dsh.md adherence, shallow bug scan, git-history, prior-PR comments, code-comment compliance).
5. Confidence-scores each finding with a parallel subagent and drops anything below 80.
6. Re-checks eligibility.
7. Posts the result back to the PR with `gh`.

## Requirements

- A dsh profile built on `@deepseek-ai/dsh-base` (every shipped profile), which provides the `commands` service and the subagent/bash/todo tools the workflow uses.
- The [GitHub CLI](https://cli.github.com) (`gh`) on `PATH`, authenticated, so the workflow can fetch the PR and post the review.

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
dsh plugin --profile web add /path/to/dsh-command-code-review-0.1.0.tgz
```

The `dsh plugin add` command installs the package into the profile and, because its `package.json` declares `dsh.bundle`, appends it to `dsh.profile.bundles` automatically. Restart or re-boot the profile to pick it up.

## Usage

Type `/code-review` in the web composer, optionally followed by a PR number or URL:

```
/code-review 123
/code-review https://github.com/owner/repo/pull/123
``

## How it works

The package is a standard dsh **bundle**:

- `package.json` declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`.
- `cordis.patch.yml` inserts one plugin row (`id: command-code-review`) into the profile layer stack.
- `lib/index.js` is a Cordis plugin that injects `commands` and registers the `code-review` command. The handler builds a user message with `createUserMessage` from `@deepseek-ai/dsh-llm` and delivers it via `agent.followup`.

Users can disable or override the command from their own profile `cordis.patch.yml`:

```yaml
- disable: command-code-review
```

## License

MIT

## 中文

`/code-review`（代码审查）斜杠命令插件。安装后即可在 dsh 的 Web 界面输入 `/code-review [PR 编号或链接]`，代理会按完整流程对拉取请求做代码审查（资格检查 → 收集 dsh.md 规范 → 5 个并行审查子代理 → 置信度打分过滤 → 用 `gh` 把结果回帖到 PR）。

安装（发布到 npm 后）：

```sh
dsh plugin --profile web add dsh-command-code-review
```

本地目录或 tarball：

```sh
dsh plugin --profile web add /path/to/dsh-command-code-review
dsh plugin --profile web add /path/to/dsh-command-code-review-0.1.0.tgz
```

要求：基于 `@deepseek-ai/dsh-base` 的 dsh profile，以及已认证的 `gh`（GitHub CLI）。
