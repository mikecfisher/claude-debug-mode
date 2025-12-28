# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-28

### Added
- Initial release of Debug Mode plugin for Claude Code
- Hypothesis-driven debugging workflow with 9 steps
- Log collector HTTP server on port 7777
- Browser logger variant (fetch-based for React, Next.js client)
- Server logger variant (file-based for Node.js, Bun)
- Slash commands: `/debug-mode:start`, `/debug-mode:stop`, `/debug-mode:clear`, `/debug-mode:analyze`, `/debug-mode:tail`
- Real-time log viewer with ANSI color coding
- Log analysis grouped by hypothesis ID
- NDJSON log format for easy parsing
- Example instrumentation patterns
