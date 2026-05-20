# Phase 5 Validation Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify Stage 4 actual completion against the roadmap, then ship a minimum viable Stage 5 validation module with runnable backend validation, summary/report persistence, and fact snapshot browsing.

**Architecture:** Add a focused validation application service backed by `AppDbContext` and existing chapter/content storage, expose it through a dedicated API controller, then add a frontend validation workbench under `/validate`. The first release uses static consistency checks and existing tracking/design tables instead of pulling the full legacy validation engine.

**Status 2026-05-20:** Stage 4 code path is connected and builds. Stage 5 MVP is implemented and builds: validation run/list/report/status APIs, `/validate` workbench, summary/report persistence, chapter fix-state update, and 12-dimension fact snapshot browsing. Backend test execution remains blocked by the current sandbox denying VSTest local socket communication (`SocketException (13): Permission denied`), while backend build and frontend type-check/build pass.

**Tech Stack:** ASP.NET Core 8, EF Core 8, SQLite, xUnit, Vue 3.5, TypeScript, Element Plus

---

### Task 1: Backend tests for validation service and API DTO shape

- [x] Write tests for project/volume validation summary generation and fact snapshot aggregation.
- [x] Add tests for chapter fix-state update and illegal chapter status handling.

### Task 2: Backend validation service and controller

- [x] Implement DTOs + service interface for validation summary, reports, and fact snapshot.
- [x] Implement static validation checks over projects/volumes/chapters and persist `ValidationSummary` / `ValidationReport`.
- [x] Expose endpoints for run/list summary/list reports/fact snapshot/status update.
- [x] Expand fact snapshot browsing to 12 dimensions: character state/description, conflict, faction, plot, location state/description, world constraints, timeline, character location, item state, foreshadowing.

### Task 3: Frontend validation workbench

- [x] Add API module for validation endpoints.
- [x] Add `/validate` page to trigger validation and browse summaries, reports, and fact snapshots.
- [x] Add layout/router entry points.

### Task 4: Verification

- [x] Run backend build: `dotnet build web/backend/TM.Web.sln --no-restore -v:minimal -m:1`.
- [ ] Run backend tests: blocked in this sandbox by VSTest local socket permission.
- [x] Run frontend type-check/build for touched code.
- [x] Report Stage 4 status vs roadmap and Stage 5 delivered scope with explicit remaining gaps.
