# dsh-command-code-review

> `/code-review` 斜杠命令插件 —— 五个并行审查视角、逐发现置信度打分，同时支持拉取请求与本地代码审查。

`/code-review` 斜杠命令插件：一个自包含的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）bundle，可对拉取请求或本地代码做完整代码审查。

[English](README.md) | 中文

## 功能

注册一个全局斜杠命令，支持两种模式：

- `/code-review <PR 编号或链接>` —— 拉取请求审查（资格检查 → 5 个并行审查视角 → 逐发现置信度打分 → 用 `gh` 把结果回帖到 PR）。
- `/code-review [审查需求]`（或留空）—— 本地代码审查：按需求审查指定范围，留空则审查当前未提交改动，结果直接在对话中输出（无需 `gh`）。

两种模式共用同一套核心：收集相关的 `dsh.md` 指导，启动 5 个并行审查子代理（dsh.md 合规、浅层 bug 扫描、git 历史、历史改动评论、代码注释合规），再用并行子代理对每条发现做置信度打分，低于 80 的丢弃。

## 要求

- 基于 `@deepseek-ai/dsh-base` 的 dsh profile（所有内置 profile 都满足），它提供 `commands` 服务以及工作流用到的子代理 / bash / todo 工具。
- [GitHub CLI](https://cli.github.com)（`gh`）已安装并认证 —— 仅在拉取请求审查时需要。本地审查无需 `gh`。

## 安装

从 npm：

```sh
dsh plugin --profile web add dsh-command-code-review
```

从本地目录或 tarball：

```sh
# 目录
dsh plugin --profile web add /path/to/dsh-command-code-review

# 打包的 tarball
dsh plugin --profile web add /path/to/dsh-command-code-review-0.1.1.tgz
```

`dsh plugin add` 会把包装进 profile，并且因为它的 `package.json` 声明了 `dsh.bundle`，会自动追加到 `dsh.profile.bundles`。重启或重新引导 profile 后生效。

## 用法

在 Web 输入框输入 `/code-review`：

```
/code-review 123                                  # 按编号审查一个拉取请求
/code-review https://github.com/owner/repo/pull/123
/code-review 审查 src/auth 的改动                  # 审查指定的范围
/code-review                                      # 审查当前未提交的改动
```

## 工作原理

这个包是一个标准的 dsh **bundle**：

- `package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`。
- `cordis.patch.yml` 向 profile 层栈插入一行插件（`id: command-code-review`）。
- `lib/index.js` 是一个 Cordis 插件，注入 `commands` 并注册 `code-review` 命令。handler 把 PR 编号 / URL 路由到拉取请求工作流，把其余输入（包括空输入）路由到本地审查工作流，再通过 `agent.followup` 投递。

用户可以在自己的 profile `cordis.patch.yml` 里禁用或覆盖该命令：

```yaml
- disable: command-code-review
```

## 许可

MIT
