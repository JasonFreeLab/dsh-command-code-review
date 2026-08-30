# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows [Semantic Versioning](https://semver.org/).

## [0.2.0](https://github.com/JasonFreeLab/dsh-command-code-review/compare/v0.1.9...v0.2.0) (2026-08-30)


### Features

* write local review report to a markdown document ([2468a0a](https://github.com/JasonFreeLab/dsh-command-code-review/commit/2468a0a2f91d9d287a55cdb72507e0f72fe6e2d9))

## [0.1.9] - 2026-08-28

- Added release automation: publish to npm via trusted publishing and create a GitHub Release on tag push; fixed the CI workflow to install dependencies before testing.

## [0.1.8] - 2026-08-26

- The local workflow now reviews the entire repository when the request explicitly asks for the whole project, alongside empty-input (uncommitted changes) and named-scope reviews.

## [0.1.7] - 2026-08-25

- Removed Chinese from the workflow text; refreshed README/CHANGELOG/description for the 0.1.x feature set.

## [0.1.6] - 2026-08-25

- The workflows now instruct the agent to await subagent completion notices instead of polling `list_agents`.

## [0.1.5] - 2026-08-25

- The PR-probe now applies only when `/code-review` is invoked with no input; explicit review requests stay on the local workflow.

## [0.1.4] - 2026-08-25

- The confidence threshold is now configurable via `config.threshold` (default 80) in a profile's `cordis.patch.yml`.

## [0.1.3] - 2026-08-25

- Empty `/code-review` now auto-detects the current branch's open PR and reviews it before falling back to local review.

## [0.1.2] - 2026-08-25

- Set `readme` to `README.md` so npm shows the English readme.

## [0.1.1] - 2026-08-25

- Added a local-review mode: `/code-review [request]` (or empty) reviews the requested scope or the current uncommitted changes and reports directly in chat, with no `gh` dependency.
- Split the README into English (`README.md`) and Chinese (`README.zh.md`) with cross-links.

## [0.1.0] - 2026-08-25

- Initial release: `/code-review <pr number|url>` runs the multi-agent pull-request review workflow (eligibility check, 5 parallel review lenses, per-finding confidence scoring, `gh` reply).
