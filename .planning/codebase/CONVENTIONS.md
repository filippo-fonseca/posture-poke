# Coding Conventions

**Analysis Date:** 2026-03-28

## Overview

SpineSync is a hackathon project (YHack 2026) with a Next.js frontend, FastAPI Python backends, and Arduino C++ firmware. The codebase has no explicit formatting or linting configuration beyond the default `eslint-config-next`. Conventions are informal and inferred from existing code patterns. There are no `.prettierrc`, `.editorconfig`, or custom ESLint configs at the project root level.

## Naming Patterns

**Files (TypeScript/React):**
- Components: PascalCase `.tsx` files in `web/components/` (e.g., `AngleGauge.tsx`, `StatusBanner.tsx`, `CoachTip.tsx`)
- Hooks: camelCase with `use` prefix in `web/hooks/` (e.g., `usePostureStream.ts`, `usePostureSession.ts`, `useVoiceAlert.ts`)
- Type definitions: camelCase `.ts` in `web/lib/` (e.g., `types.ts`, `constants.ts`)
- App routes: lowercase `page.tsx`, `layout.tsx` in `web/app/` (Next.js convention)

**Files (Python):**
- snake_case `.py` files (e.g., `posture_detector.py`, `servo_trigger.py`, `see_devices.py`)
- Entry point pattern: `main.py` for the web server, standalone scripts with `if __name__ == "__main__"` guard

**Files (Arduino):**
- Descriptive lowercase names with `.ino` extension (e.g., `serial.ino`, `uno.ino`)

**Functions (TypeScript):**
- Use camelCase for all functions: `formatTime()`, `formatDuration()`, `formatStreak()`
- React components use PascalCase: `Header()`, `StatusBanner()`, `StatCard()`
- Helper/sub-components are defined as plain functions in the same file, not exported: `ConnectionStatus()` in `web/components/Header.tsx`, `EmptyState()` in `web/components/HistoryChart.tsx`

**Functions (Python):**
- snake_case for all functions: `find_arduino()`, `serial_loop()`, `on_tilt_notify()`
- Async functions prefixed naturally: `stream_data()`, `ble_loop()`, `websocket_endpoint()`

**Variables (TypeScript):**
- camelCase for local variables and state: `isConnected`, `currentDelta`, `sessionDuration`
- Boolean state variables use `is` prefix: `isSlouchingNow`, `isConnected`, `isFetchingTip`
- Refs use `Ref` suffix: `wsRef`, `reconnectTimeoutRef`, `allSessionDataRef`, `deltaBufferRef`
- Constants use UPPER_SNAKE_CASE: `SLOUCH_THRESHOLD`, `WS_URL`, `RECONNECT_DELAY`

**Variables (Python):**
- snake_case for locals and globals: `latest_reading`, `baseline_pitch`, `active_connections`
- Constants use UPPER_SNAKE_CASE: `PITCH_THRESHOLD`, `ROLL_THRESHOLD`, `SERVICE_UUID`

**Types/Interfaces (TypeScript):**
- PascalCase for interfaces and types: `PostureMessage`, `ChartDataPoint`, `MinuteBucket`, `PostureSession`
- Component props interfaces use `[ComponentName]Props` suffix: `HeaderProps`, `StatusBannerProps`, `AngleGaugeProps`
- Hook return types use `Use[HookName]` pattern: `UsePostureStream`

## Code Style

**Formatting:**
- No Prettier configured. Code relies on developer/AI-generated formatting.
- Indentation: 2 spaces for TypeScript/JSX, 4 spaces for Python
- Double quotes for TypeScript string literals consistently
- Double quotes for Python string literals (with some inconsistency -- e.g., `'ok'` vs `"ok"`)
- Trailing commas used in TypeScript multi-line constructs

**Linting:**
- ESLint via `eslint-config-next@14.1.0` (configured in `web/package.json`)
- No custom ESLint rules or overrides detected
- Run with: `npm run lint` (alias for `next lint`)
- No Python linting tools (no `ruff`, `flake8`, `pylint`, `mypy` configs)

**TypeScript Strictness:**
- `strict: true` in `web/tsconfig.json`
- `noEmit: true` -- type-checking only, Next.js handles compilation
- `isolatedModules: true`
- Target: ES2017, Module: ESNext with bundler resolution

## Import Organization

**Order (TypeScript):**
1. `"use client"` directive (always first line in client components/hooks)
2. React/Next.js imports (`react`, `next/font/google`, `next`)
3. Third-party libraries (`framer-motion`, `recharts`)
4. Internal imports using `@/` path alias (`@/components/`, `@/hooks/`, `@/lib/`)
5. Relative imports for closely related files (`./usePostureStream`)

**Path Aliases:**
- `@/*` maps to `web/*` root -- configured in `web/tsconfig.json`
- Used consistently for cross-directory imports
- Relative imports (`./`) used only within the same directory (e.g., `web/hooks/usePostureSession.ts` imports `./usePostureStream`)

**Export Patterns (TypeScript):**
- Components use named exports: `export function Header(...)`, `export function LiveChart(...)`
- No default exports on components -- only `web/app/page.tsx` and `web/app/layout.tsx` use `export default`
- Types use named exports: `export interface PostureMessage`, `export interface ChartDataPoint`
- Constants use named exports: `export const SLOUCH_THRESHOLD = 20`
- No barrel files (no `index.ts` re-exports)

**Import Patterns (Python):**
1. Standard library imports first (`asyncio`, `json`, `math`, `time`, `threading`)
2. Third-party imports second (`serial`, `uvicorn`, `bleak`, `fastapi`)
3. No relative imports in Python files

## Error Handling

**TypeScript Patterns:**
- Silent catch blocks with empty `catch {}` (no error variable): `web/hooks/usePostureStream.ts` line 42, `web/hooks/useVoiceAlert.ts` line 93
- WebSocket errors trigger close: `ws.onerror = () => { ws.close(); }`
- API call failures fall back to defaults: `setCurrentTip(DEFAULT_TIP)` on fetch failure
- Audio playback failures silently swallowed: `.play().catch(() => {})` in `web/hooks/useVoiceAlert.ts`
- Pattern: try/catch with graceful degradation, no error boundaries

**Python Patterns:**
- `serial.SerialException` caught with retry logic: `serial/posture_detector.py` line 115
- `json.JSONDecodeError` caught and silently passed: `web/server/main.py` line 159
- `ValueError` caught for malformed serial data: `serial/posture_detector.py` line 93
- Broad `except Exception` used for BLE connection: `ble/reader.py` line 110

## Logging

**TypeScript:** No logging framework. No `console.log` statements in production code. Errors are silently caught.

**Python:** Uses `print()` for all output. No logging framework (`logging` module not used). Status messages include emoji indicators in terminal output: `ble/reader.py` line 72-77, `serial/posture_detector.py` line 108-113.

## Comments

**TypeScript:**
- JSX section comments with `{/* ... */}` delimiters for major UI sections: `{/* Hero Status Banner */}`, `{/* Gauge + Live Chart Row */}`, `{/* Stats Row */}`
- Inline comments for complex logic: `// Buffer delta for chart (we downsample to 1/sec)`, `// Average the buffered readings`
- No JSDoc or TSDoc comments on any function or interface
- No file-level module comments

**Python:**
- Triple-quote module-level docstrings on every file describing purpose and usage: `web/server/main.py`, `serial/posture_detector.py`, `ble/reader.py`
- Section separator comments using Unicode box-drawing style: `# -- BLE UUIDs ------`, `# -- Shared state ------`
- Inline comments for non-obvious behavior: `# wait for Arduino to reset after serial connect`
- Class docstrings present on `IMUSimulator` in `web/server/main.py`

**Arduino:**
- Block comments at file top with firmware description and BLE UUIDs
- Section comments: `// -- BLE objects --`, `// -- Config --`

## Function Design

**Component functions:**
- Accept a single destructured props object typed by an interface
- Example: `export function Header({ isConnected, sessionDuration }: HeaderProps)`
- No spread props patterns used

**Hook functions:**
- Return an object with named properties (not arrays)
- Example: `usePostureStream()` returns `{ isConnected, currentDelta, lastTimestamp, sendCalibrate }`
- Use `useCallback` for functions returned to consumers
- Use `useRef` for mutable values that should not trigger re-renders

**Helper functions:**
- Defined as standalone functions above the component in the same file
- Not exported -- scoped to the module
- Example: `formatTime()`, `formatDuration()`, `formatStreak()` duplicated across files rather than shared

**Python functions:**
- Main entry points follow `def main(): ... if __name__ == "__main__": main()` pattern
- `argparse` used for CLI argument parsing in all standalone scripts
- Async functions used for WebSocket handlers and BLE loops

## Module Design

**React Components:**
- One primary exported component per file
- Sub-components (e.g., `ConnectionStatus`, `StatCard`, `EmptyState`) kept in the same file as private (non-exported) functions
- All client components explicitly marked with `"use client"` directive

**Types and Constants:**
- All shared types centralized in `web/lib/types.ts`
- All shared constants centralized in `web/lib/constants.ts`
- No per-feature type files

## CSS/Styling Conventions

**Approach:** Tailwind CSS utility classes exclusively. No CSS modules, no styled-components.

**Custom theme tokens:** Defined in both `web/tailwind.config.ts` and `web/app/globals.css` CSS variables. Use semantic names:
- Colors: `bg-base`, `bg-surface`, `bg-card`, `accent-green`, `accent-amber`, `accent-red`, `text-primary`, `text-secondary`, `text-tertiary`
- Typography: `font-display` (Space Grotesk), `font-mono` (DM Mono)
- Shadows: `green-glow`, `amber-glow`, `red-glow`

**Class organization:** Responsive modifiers at end (`sm:text-3xl`, `lg:grid-cols-3`)

**Animations:** Custom CSS keyframes in `web/app/globals.css` for glow effects (`pulse-green`, `pulse-red`, `shimmer`) plus Framer Motion for component transitions.

## Git Conventions

**Commit Messages:**
- Imperative mood, lowercase, no period
- Short single-line descriptions
- Examples from `git log`:
  - `initial server with serial`
  - `proper push for the web app`
  - `fix the folders`
  - `Create serial.ino`
  - `Add posture detector with FastAPI and serial support`
  - `Refactor BLE initialization and connection handling`
  - `Add posture detector BLE reader with FastAPI`
- Mixed casing (some capitalized, some lowercase) -- no strict convention enforced

**Branch Strategy:**
- `main` and `dev` branches present
- Active development on `dev`

## Notes

- No `.prettierrc`, `.editorconfig`, or custom ESLint config exists. When adding new code, follow the patterns described above rather than relying on auto-formatting.
- `formatDuration()` and `formatStreak()` helper functions are duplicated across `web/components/StatusBanner.tsx` and `web/components/StatsRow.tsx` -- extract to `web/lib/utils.ts` if adding more formatting helpers.
- The `web/.vscode/settings.json` references a Python path from a different developer's machine (`/Users/filippofonseca/...`) which will not work for other contributors.
- All API keys are exposed as `NEXT_PUBLIC_*` environment variables, meaning they ship to the browser. This is intentional for the hackathon demo but not suitable for production.

---

*Convention analysis: 2026-03-28*
