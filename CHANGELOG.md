# Changelog

Notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- A settings file naming a typeface this Mac cannot draw with is refused, with
  the reason. The photograph used to be stamped in whatever face the renderer
  picked instead, and the run reported as a complete success.
- Your remembered settings survive a typeface going away. A font removed since
  the last run used to reset the size, the colours, the position and the margin
  along with it.

## [1.0.0] - 2026-09-14

- First release.
