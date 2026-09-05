# dsh-command-code-review

[English](README.md) | 中文

[![npm version](https://img.shields.io/npm/v/dsh-command-code-review)](https://www.npmjs.com/package/dsh-command-code-review) [![GitHub release](https://img.shields.io/github/v/release/JasonFreeLab/dsh-command-code-review)](https://github.com/JasonFreeLab/dsh-command-code-review/releases) [![License](https://img.shields.io/npm/l/dsh-command-code-review)](./LICENSE)

[DSH](https://github.com/deepseek-ai/deepseek-harness)（DeepSeek Harness）斜杠命令 bundle：一个 `/code-review` 命令即可对拉取请求或本地代码做完整代码审查 —— 可配置审查视角、逐发现置信度与严重度打分。

> `/code-review` 斜杠命令插件：自包含 bundle，可安装到任意 dsh profile。

## 目录

- [特性](#特性)
- [要求](#要求)
- [安装](#安装)
- [使用](#使用)
- [工作原理](#工作原理)
- [配置](#配置)
- [故障排查](#故障排查)
- [目录结构](#目录结构)
- [开发](#开发)
- [贡献](#贡献)
- [许可](#许可)

## 特性

- **一个命令，两种模式** —— `/code-review <PR 编号|链接>` 审查拉取请求；`/code-review [需求]`（或留空）审查本地代码。
- **可配置审查视角** —— 默认五个（AGENTS.md/CLAUDE.md 合规、bug/正确性、历史上下文、安全、代码注释合规），另有可选的性能视角；可按 profile 裁剪子集。
- **置信度 + 严重度打分** —— 发现跨视角去重后批量打分：置信度（真伪）+ 严重度（blocker/major/minor/nit）；低于阈值的丢弃（默认 80）。
- **PR 自动回帖** —— 拉取请求结果用 `gh` 回帖到 PR；本地结果直接在对话中输出。
- **可配置** —— 置信度阈值按 profile 配置（见「配置」）。
- **审查报告文档** —— 本地审查完成后把结构化 Markdown 报告（内容为英文）和一个机器可读 JSON 文件写入文档，默认保存到 `doc/`；可用 `--out <目录>` 每次覆盖，或用 `config.outputDir` 按 profile 配置。文件名带当前 HEAD 后 7 位短 sha（非 git 仓库则省略）。

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
dsh plugin --profile web add /path/to/dsh-command-code-review-<version>.tgz
```

`dsh plugin add` 会把包装进 profile，并且因为它的 `package.json` 声明了 `dsh.bundle`，会自动追加到 `dsh.profile.bundles`。重启或重新引导 profile 后生效。

## 使用

### 在 DSH web 界面

1. 启动 web 界面并打开打印出的地址：`dsh web`（即 `dsh --profile web`）。
2. 新建会话，在输入框输入 `/code-review`。命令会自动注册，无需额外配置。
3. 拉取请求的结果会用 `gh` 回帖到 PR；本地审查的结果直接在对话中输出。

### 示例

```
/code-review 123                                  # 按编号审查一个拉取请求
/code-review https://github.com/owner/repo/pull/123
/code-review 审查 src/auth 的改动                  # 审查指定的范围
/code-review 审查整个工程                          # 审查整个仓库
/code-review                                      # 审查当前未提交的改动
/code-review 审查 src/auth 的改动 --out reports    # 报告保存到 reports/
/code-review --out docs 审查 src/auth 的改动       # --out 可放前也可放后
```

留空时会先探测当前分支的拉取请求，存在则审查它，否则审查当前未提交改动。

本地审查的报告还会写成 Markdown 文档 —— 默认保存到 `doc/`，或用 `--out <目录>`（或 `config.outputDir`）指定位置。git 仓库里文件名为 `code-review-<sha7>-<slug>.md`（`<sha7>` 为当前 HEAD 后 7 位短 sha，`<slug>` 由审查范围生成），非 git 仓库则为 `code-review-<slug>.md`。

## 工作原理

这个包是一个标准的 dsh **bundle**：

- `package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`。
- `cordis.patch.yml` 向 profile 层栈插入一行插件（`id: command-code-review`）。
- `lib/index.js` 是一个 Cordis 插件，注入 `commands` 并注册 `code-review` 命令。handler 把 PR 编号 / URL 路由到拉取请求工作流，把其余输入（包括空输入）路由到本地审查工作流，再通过 `agent.followup` 投递。置信度阈值可配置（见「配置」），工作流会指示代理等待子代理完成通知而不是轮询。

用户可以在自己的 profile `cordis.patch.yml` 里禁用或覆盖该命令：

```yaml
- disable: command-code-review
```

## 配置

- **置信度阈值**：工作流会丢弃低于阈值的发现（默认 80）。在你的 profile `cordis.patch.yml` 里覆盖：

  ```yaml
  - id: command-code-review
    config:
      threshold: 90
  ```
- **报告保存目录**：本地审查报告的保存目录（默认 `doc`）。按 profile 覆盖：

  ```yaml
  - id: command-code-review
    config:
      outputDir: reports
  ```

  或每次调用用 `--out` 覆盖：`/code-review --out reports 审查 src/auth 的改动`。
- **审查视角**：可用视角 id 为 `guidance`、`bugs`、`history`、`security`、`comments`、`perf`。默认是 `guidance`、`bugs`、`history`、`security`、`comments`。按 profile 裁剪子集：

  ```yaml
  - id: command-code-review
    config:
      lenses: [guidance, bugs, security]
  ```
- **自适应视角**：`autoLenses: true`（默认）时，若审查范围命中安全敏感文件会自动启用安全视角，命中热路径会自动启用性能视角（若尚未启用）。用 `autoLenses: false` 关闭。

## 故障排查

- **PR 上没有回帖**：PR 已关闭 / 是 draft / 太简单 / 已审查过，或者没有发现达到 80 分。
- **提示 gh 不存在**：安装并认证 GitHub CLI（`gh auth login`）；只有 PR 审查需要它。
- **代码链接无法渲染**：必须用完整 commit SHA，以及 `#L[start]-L[end]` 行区间格式。

## 目录结构

```
lib/index.js             # 注册 /code-review 命令的 Cordis 插件
lib/lenses.js            # 审查视角注册表与解析
lib/parse.js             # 输入解析（--out 参数）
test/smoke.test.mjs      # 冒烟测试
test/parse.test.mjs      # 解析器单元测试
test/lenses.test.mjs     # 视角解析单元测试
cordis.patch.yml         # bundle patch
.github/workflows/       # ci.yml + release.yml + release-please.yml
```

## 开发

```sh
npm install
npm test        # node --test（冒烟 + 解析器 + 视角单元测试）
```

## 贡献

欢迎提交 Issue / PR。

## 许可

MIT
