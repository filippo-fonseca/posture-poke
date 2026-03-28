# Testing Patterns

**Analysis Date:** 2026-03-28

## Overview

The SpineSync codebase has zero tests. No test files, no test frameworks, no test configuration, and no CI/CD pipeline exist. This is consistent with the project being a hackathon prototype (YHack 2026). All validation is done manually through the running application.

## Test Framework

**Runner:** Not configured

**Assertion Library:** Not configured

**Run Commands:**
```bash
npm run lint              # Only available "quality" command (runs next lint)
# No test commands exist in package.json scripts
```

The `web/package.json` defines only four scripts: `dev`, `build`, `start`, `lint`. There is no `test` script.

## Test File Organization

**Location:** No test files exist anywhere in the project.

**Search results:**
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` files outside `node_modules/`
- No `__tests__/` directories outside `node_modules/`
- No `jest.config.*`, `vitest.config.*`, `pytest.ini`, or `pyproject.toml` files
- No Python test files (`test_*.py`, `*_test.py`)

## Test Structure

Not applicable -- no tests exist.

## Mocking

Not applicable -- no tests exist.

## Fixtures and Factories

Not applicable -- no tests exist. However, the `IMUSimulator` class in `web/server/main.py` serves as a realistic data fixture for manual testing. It simulates:
- Baseline sensor noise (+/-1-2 degrees)
- Good posture ranges (0-8 degrees)
- Slouch transitions (3-6 second gradual increase to 25-42 degrees)
- Recovery patterns (1-3 second correction)
- Breathing oscillation (~0.5 degree amplitude at 0.25Hz)

This simulator could be extracted into a test helper if tests are added.

## Coverage

**Requirements:** None enforced

**Current Coverage:** 0% -- no tests exist

## Test Types

**Unit Tests:** None

**Integration Tests:** None

**E2E Tests:** None

## CI/CD Testing Configuration

**CI Pipeline:** None. No `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Makefile`.

**Pre-commit Hooks:** None. No `.husky/`, no `lint-staged`, no `pre-commit` config.

## If Tests Are Added

When introducing tests to this codebase, follow these recommendations based on the existing architecture:

### Recommended Setup (TypeScript/Frontend)

**Framework:** Vitest (pairs well with Next.js and Vite ecosystem)

**Install:**
```bash
cd web && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Config file:** Create `web/vitest.config.ts`

**Test file location:** Co-located with source files using `.test.ts`/`.test.tsx` suffix:
```
web/
  components/
    Header.tsx
    Header.test.tsx
  hooks/
    usePostureStream.ts
    usePostureStream.test.ts
  lib/
    constants.ts
    constants.test.ts
```

**Package.json scripts to add:**
```json
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

### Recommended Setup (Python/Backend)

**Framework:** pytest

**Install:**
```bash
cd web/server && pip install pytest pytest-asyncio httpx
```

**Test file location:**
```
web/server/
  main.py
  test_main.py
serial/
  posture_detector.py
  test_posture_detector.py
```

### Priority Test Targets

**High priority -- complex logic with no safety net:**
1. `web/hooks/usePostureSession.ts` -- the core state machine managing session data, minute buckets, chart downsampling, streak tracking, and tip fetching triggers. 261 lines of intertwined state logic.
2. `web/server/main.py` `IMUSimulator` class -- state machine with phase transitions, math-heavy angle calculations
3. `web/hooks/usePostureStream.ts` -- WebSocket connection lifecycle with reconnect logic

**Medium priority -- rendering correctness:**
4. `web/components/AngleGauge.tsx` -- SVG arc math calculations (trigonometry)
5. `web/components/HistoryChart.tsx` -- conditional rendering based on data state
6. `web/lib/constants.ts` -- threshold values used throughout (snapshot tests)

**Low priority -- simple presentational components:**
7. `web/components/Header.tsx`, `web/components/StatsRow.tsx`, `web/components/StatusBanner.tsx` -- mainly prop-to-UI mapping

### Testable Patterns in Current Code

**Pure functions that can be unit tested immediately (no mocking needed):**
- `formatTime()` in `web/components/Header.tsx`
- `formatDuration()` in `web/components/StatusBanner.tsx`
- `formatStreak()` and `formatSession()` in `web/components/StatsRow.tsx`
- `IMUSimulator.tick()` and `IMUSimulator.calibrate()` in `web/server/main.py`
- `find_arduino()` in `serial/posture_detector.py` (with mocked `serial.tools.list_ports`)

**What would need mocking:**
- WebSocket connections in `usePostureStream` tests
- `fetch()` calls to Anthropic API in `usePostureSession` tests
- `fetch()` calls to ElevenLabs API in `useVoiceAlert` tests
- `AudioContext` and `Audio` in `useVoiceAlert` tests
- Serial port access in Python backend tests

## Notes

- The complete absence of tests is expected for a hackathon project. However, the `usePostureSession` hook at 261 lines contains significant complexity (state machine, timers, data aggregation, API calls) that would benefit from testing if the project continues.
- The `IMUSimulator` in `web/server/main.py` is well-structured and highly testable -- its `tick()` method is a pure-ish function (uses random, but is deterministic with a seed). Consider seeding `random` in tests.
- Several format helper functions (`formatTime`, `formatDuration`, `formatStreak`, `formatSession`) are duplicated across components and are pure functions -- ideal first test targets that would also motivate extracting them to `web/lib/utils.ts`.

---

*Testing analysis: 2026-03-28*
