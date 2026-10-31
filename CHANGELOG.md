# Changelog: CSIR-NET Chemistry Advanced Study Management System

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-10-30

### Added
- **Data Protection & Schema Versioning** (`data-protection.js`): Implemented JSON backup/restore, checksum validation, migration framework, and auto-backup history.
- **Undo System** (`undo-system.js`): Added action history tracking, visual undo notifications, and keyboard shortcut support (`Ctrl+Z`).
- **Study Sessions & Daily Tracking** (`study-sessions.js`): Track daily study duration, streaks, weekly summaries, and monthly stats.
- **Smart Study Planner** (`study-planner.js`): Intelligent priority scoring, weak-topic identification, and weekly study plan generation.
- **Analytics & Performance** (`analytics.js`): Weekly/monthly completion reporting and study consistency metrics.
- **Exam Readiness Assessment** (`exam-readiness.js`): Dynamic readiness level evaluation with transparent scoring breakdown and actionable recommendations.
- **Focus Mode & Pomodoro** (`focus-tools.js`): Built-in 25-minute Pomodoro timer and distraction-free UI mode.
- **Documentation**: Created `ENHANCEMENT_AUDIT.md`, `IMPLEMENTATION_PLAN.md`, and `CHANGELOG.md`.

### Maintained
- Preserved all existing topic IDs, names, categories, marks, notes, and user progress.
- Retained CSV import/export functionality and Electron desktop integration (`main.js`, `preload.js`).
- Preserved light and dark themes with glassmorphism styling.
