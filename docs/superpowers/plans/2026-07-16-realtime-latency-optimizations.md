# Realtime Latency Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce room interaction latency by sending incremental updates, avoiding redundant HTML persistence, applying safe optimistic updates, and narrowing Zustand subscriptions.

**Architecture:** Keep `RoomState` snapshots for initial connection and recovery, but use typed patch events for routine mutations. Preserve server authority with request IDs, acknowledgements, snapshot versions, and correction events. Keep each implementation isolated in a dedicated worktree, then integrate in protocol-to-client dependency order.

**Tech Stack:** TypeScript, React 19, Zustand 5, Cloudflare Workers and Durable Objects, WebSockets, Vitest, Vite.

---

### Task 1: Incremental WebSocket protocol

**Files:**
- Modify: `packages/shared/src/protocol.ts`
- Modify: `apps/realtime/src/index.ts`
- Test: `apps/realtime/src/__tests__/room-commit.test.ts`

- [ ] Add typed server patch messages that include the changed entity identifiers, changed value, reason, and authoritative `snapshot_version`.
- [ ] Keep `room.snapshot` for connection/reconnection and full recovery.
- [ ] Broadcast patches for routine resource, fear, countdown, dice, drawing, X-card, settings, player-presence, and ordering mutations; reserve full-state broadcasts for explicit recovery/import cases.
- [ ] Add regression tests proving a small resource update does not broadcast a full `RoomState`.
- [ ] Run `npm --workspace apps/realtime run typecheck` and relevant tests.
- [ ] Commit the isolated task.

### Task 2: Dirty HTML persistence

**Files:**
- Modify: `apps/realtime/src/index.ts`
- Test: `apps/realtime/src/__tests__/room-commit.test.ts`

- [ ] Add explicit HTML persistence modes or dirty sheet tracking to `save()`.
- [ ] Write/list/delete HTML keys only for import, replace, delete, and full room import operations.
- [ ] Ensure ordinary resource, dice, countdown, drawing, settings, and presence saves write only the stripped room snapshot.
- [ ] Add storage-spy regression tests proving ordinary commits do not write or list HTML keys and HTML mutations still persist correctly.
- [ ] Run realtime typecheck and relevant tests.
- [ ] Commit the isolated task.

### Task 3: Optimistic frontend updates

**Files:**
- Modify: `packages/shared/src/protocol.ts`
- Modify: `fronted/src/store/useStore.ts`
- Modify: `fronted/src/lib/realtime.ts` if required
- Test: add focused store/protocol tests where practical

- [ ] Optimistically update high-frequency resource, fear, countdown, dice, and drawing actions before the network round trip.
- [ ] Correlate server acknowledgements with `requestId`; retain the last authoritative version and ignore stale events.
- [ ] Apply authoritative patch/correction events and recover from rejection without leaving speculative state behind.
- [ ] Do not optimistically apply destructive imports or permission-sensitive operations whose rollback is unsafe.
- [ ] Run frontend build, lint, and relevant tests.
- [ ] Commit the isolated task.

### Task 4: Precise Zustand selectors

**Files:**
- Modify: `fronted/src/pages/*.tsx`
- Modify: `fronted/src/components/**/*.tsx`

- [ ] Replace bare `useStore()` subscriptions with focused selectors.
- [ ] Use `useShallow` only where selecting multiple values whose identity would otherwise change.
- [ ] Ensure components subscribe only to the room subtrees and actions they render.
- [ ] Confirm no bare `useStore()` call remains in production components or pages.
- [ ] Run frontend lint and build.
- [ ] Commit the isolated task.

### Task 5: Integration, review, and delivery

**Files:**
- Integrate all modified files on `codex/realtime-latency-optimizations`.

- [ ] Integrate protocol changes first, persistence changes second, optimistic client behavior third, and selector changes last.
- [ ] Resolve overlapping protocol and backend changes without weakening request correlation or persistence correctness.
- [ ] Run an independent whole-change code review subagent; fix all critical and important findings and request re-review.
- [ ] Run shared tests, realtime tests/typecheck, frontend lint, frontend build, and root build.
- [ ] Commit the integrated result and push `codex/realtime-latency-optimizations` to `origin`.
