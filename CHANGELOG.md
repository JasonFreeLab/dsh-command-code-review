# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/), and versioning follows [Semantic Versioning](https://semver.org/).

## [0.1.3] - unreleased

- Empty `/code-review` now auto-detects the current branch's open PR and reviews it before falling back to local review.

## [0.1.2] - 2026-08-25

- Set `readme` to `README.md` so npm shows the English readme.

## [0.1.1] - 2026-08-25

- Added a local-review mode: `/code-review [request]` (or empty) reviews the requested scope or the current uncommitted changes and reports directly in chat, with no `gh` dependency.
- Split the README into English (`README.md`) and Chinese (`README.zh.md`) with cross-links.

## [0.1.0] - 2026-08-25

- Initial release: `/code-review <pr number|url>` runs the multi-agent pull-request review workflow (eligibility check, 5 parallel review lenses, per-finding confidence scoring, `gh` reply).
