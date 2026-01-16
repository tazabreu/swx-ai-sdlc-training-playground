# Tasks: Cancel Credit Card

**Input**: Design documents from `/specs/003-cancel-card/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tooling note**: Use Bun for installs and scripts (e.g., `bun install`, `bun run test`).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/src/`, `backend/tests/`
- **Frontend**: `frontend/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new setup required - this feature extends existing card infrastructure

- [X] T001 Verify existing Card entity supports `status: 'cancelled'` and `cancelledAt?: Date` fields in `backend/src/domain/entities/card.entity.ts`
- [X] T002 Verify existing `canTransitionTo()` function handles `active → cancelled` transition in `backend/src/domain/entities/card.entity.ts`
- [X] T003 Verify existing `ICardRepository.updateStatus()` method in `backend/src/infrastructure/persistence/interfaces/card.repository.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend command/handler infrastructure and API endpoint that ALL user stories depend on

**⚠️ CRITICAL**: No frontend work can begin until backend cancellation endpoint is functional

### Backend Command & Handler

- [X] T004 [P] Create `CancelCardCommand` interface in `backend/src/application/commands/cancel-card.command.ts`
- [X] T005 [P] Create `CancelCardHandler` with validation, state transition, audit logging, and event emission in `backend/src/application/handlers/cancel-card.handler.ts`
- [X] T006 Export command and handler from `backend/src/application/commands/index.ts` and `backend/src/application/handlers/index.ts`

### Backend API Route

- [X] T007 Add `POST /v1/cards/:cardId/cancel` route in `backend/src/api/routes/cards.ts` that:
  - Validates card ownership (ecosystemId from auth token)
  - Requires `Idempotency-Key` header
  - Calls `CancelCardHandler`
  - Returns updated card with `cancelledAt` timestamp
- [X] T008 Add `CancelCardResponse` DTO in `backend/src/api/dto/cards.dto.ts`

### Backend DTO Updates

- [X] T009 Add `cancelledAt?: string` field to `CardDetailDTO` in `backend/src/api/dto/cards.dto.ts`
- [X] T010 Update `cardToDetailDTO()` mapper in `backend/src/api/routes/cards.ts` to include `cancelledAt`

**Checkpoint**: Backend cancellation endpoint is functional and can be tested via curl/Postman

---

## Phase 3: User Story 1 - Cancel a Credit Card (Priority: P1) 🎯 MVP

**Goal**: Allow a signed-in user to cancel their own active credit card via API and UI

**Independent Test**: Call `POST /v1/cards/:cardId/cancel` and verify card status changes to `cancelled`

### Backend Implementation for US1

- [X] T011 [US1] Add idempotency check in `CancelCardHandler` - if card already cancelled, return success without re-processing in `backend/src/application/handlers/cancel-card.handler.ts`
- [X] T012 [US1] Add ownership validation in `CancelCardHandler` - reject if `ecosystemId` doesn't match card owner in `backend/src/application/handlers/cancel-card.handler.ts`
- [X] T013 [US1] Emit `card.cancelled` domain event via outbox in `CancelCardHandler` using existing `createCardCancelledEvent()` from `backend/src/domain/events/event.factory.ts`
- [X] T014 [US1] Create audit log entry for cancellation using existing `createAuditLog()` with action `'card.cancelled'` in `backend/src/application/handlers/cancel-card.handler.ts`

### Frontend API Client for US1

- [X] T015 [US1] Add `cancel` method to `api.cards` in `frontend/src/lib/api/client.ts`:
  ```typescript
  cancel: (cardId: string, token: string) =>
    apiClient<{ card: Card }>(`/v1/cards/${cardId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
      token,
      idempotencyKey: generateIdempotencyKey('cancel'),
    })
  ```

### Frontend Types for US1

- [X] T016 [US1] Add `cancelledAt?: string` to `Card` interface in `frontend/src/types/index.ts`

### Frontend UI for US1

- [X] T017 [US1] Add "Cancel Card" button to card display in `frontend/src/app/(user)/cards/page.tsx` (visible only for `status === 'active'`)
- [X] T018 [US1] Implement `handleCancelCard(cardId)` function in `frontend/src/app/(user)/cards/page.tsx` that calls `api.cards.cancel()` and refreshes card list
- [X] T019 [US1] Show toast notification on successful cancellation in `frontend/src/app/(user)/cards/page.tsx`
- [X] T020 [US1] Show error toast if cancellation fails (not found, not authorized, already cancelled) in `frontend/src/app/(user)/cards/page.tsx`

**Checkpoint**: User can click "Cancel Card" button, card becomes cancelled, UI updates

---

## Phase 4: User Story 2 - Understand Card Status After Cancellation (Priority: P2)

**Goal**: Display cancelled status and cancellation timestamp clearly in the UI

**Independent Test**: View a cancelled card in the UI and verify status badge and timestamp are visible

### Frontend UI Updates for US2

- [X] T021 [P] [US2] Add status badge component showing "Cancelled" with distinct styling (e.g., red/gray) in `frontend/src/app/(user)/cards/page.tsx`
- [X] T022 [P] [US2] Display `cancelledAt` timestamp formatted as human-readable date in card details section of `frontend/src/app/(user)/cards/page.tsx`
- [X] T023 [US2] Update card visual (CreditCard component) to show cancelled state differently (e.g., grayed out, strikethrough, or "CANCELLED" overlay) in `frontend/src/app/(user)/cards/page.tsx`
- [X] T024 [US2] Hide action buttons (Purchase, Payment) for cancelled cards in `frontend/src/app/(user)/cards/page.tsx`

**Checkpoint**: Cancelled cards are visually distinct and show when they were cancelled

---

## Phase 5: User Story 3 - Cancellation Safety Confirmation (Priority: P3)

**Goal**: Require explicit user confirmation before cancelling a card

**Independent Test**: Click "Cancel Card", dismiss confirmation dialog, verify card remains active

### Frontend Confirmation Dialog for US3

- [X] T025 [US3] Create confirmation dialog state (`cancelDialogOpen`, `cardToCancel`) in `frontend/src/app/(user)/cards/page.tsx`
- [X] T026 [US3] Add AlertDialog component for cancel confirmation with warning text in `frontend/src/app/(user)/cards/page.tsx`:
  - Title: "Cancel Card"
  - Description: "Are you sure you want to cancel this card? This action cannot be undone."
  - Actions: "Keep Card" (cancel), "Yes, Cancel Card" (confirm)
- [X] T027 [US3] Update "Cancel Card" button to open confirmation dialog instead of calling API directly in `frontend/src/app/(user)/cards/page.tsx`
- [X] T028 [US3] Add loading state to confirmation dialog during API call in `frontend/src/app/(user)/cards/page.tsx`

**Checkpoint**: User must confirm before card is cancelled; dismissing dialog keeps card active

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, edge cases, and code quality

### Error Handling

- [X] T029 [P] Return appropriate HTTP status codes from cancel endpoint:
  - `200` - Success
  - `400` - Card already cancelled (idempotent success with message)
  - `403` - Not authorized (wrong owner)
  - `404` - Card not found
  in `backend/src/api/routes/cards.ts`
- [X] T030 [P] Add user-friendly error messages in frontend for each error case in `frontend/src/app/(user)/cards/page.tsx`

### Transaction Blocking

- [X] T031 Verify purchase endpoint rejects transactions on cancelled cards - existing `validatePurchase()` in `backend/src/domain/services/payment.service.ts` already checks `cardStatus !== 'active'`
- [X] T032 Verify payment endpoint rejects payments on cancelled cards - existing logic in payment handler

### Documentation

- [X] T033 [P] Update `LOCAL_TESTING_GUIDE.md` with cancel card curl example
- [X] T034 Run quickstart validation to ensure feature works end-to-end

---

## Phase 7: User Story 4 - Card List UX Improvements (Priority: P4)

**Goal**: Improve card list usability with proper scrolling, filtering, and collapsible cards

**Independent Test**: Scroll through cards, toggle cancelled filter, collapse/expand individual cards

### Scroll Fix

- [X] T035 [US4] Fix cards page scroll by adding `flex-1 overflow-y-auto` to main container in `frontend/src/app/(user)/cards/page.tsx`
- [X] T036 [US4] Add bottom padding (`pb-6`) to ensure content isn't cut off by bottom nav in `frontend/src/app/(user)/cards/page.tsx`

### Filter Cancelled Cards

- [X] T037 [US4] Add `hideCancelled` state and `cancelledCount` computed value in `frontend/src/app/(user)/cards/page.tsx`
- [X] T038 [US4] Add filter toggle button (Filter icon) that appears when cancelled cards exist in `frontend/src/app/(user)/cards/page.tsx`
- [X] T039 [US4] Update cards list to use `filteredCards` based on filter state in `frontend/src/app/(user)/cards/page.tsx`
- [X] T040 [US4] Update empty state to show "No active cards" message with count of hidden cancelled cards when filtering in `frontend/src/app/(user)/cards/page.tsx`

### Collapsible Cards

- [X] T041 [US4] Add `collapsedCards` state (Set<string>) and `toggleCardCollapse()` function in `frontend/src/app/(user)/cards/page.tsx`
- [X] T042 [US4] Add compact card header showing card type, last 4 digits, and status badge in `frontend/src/app/(user)/cards/page.tsx`
- [X] T043 [US4] Add chevron icon (ChevronUp/ChevronDown) to indicate expand/collapse state in `frontend/src/app/(user)/cards/page.tsx`
- [X] T044 [US4] Wrap card visual and details in collapsible section that respects `isCollapsed` state in `frontend/src/app/(user)/cards/page.tsx`

**Checkpoint**: Cards page scrolls properly, cancelled cards can be filtered, individual cards can be collapsed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - verification only
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 - Core cancellation flow
- **Phase 4 (US2)**: Depends on Phase 2 - Can run in parallel with US1
- **Phase 5 (US3)**: Depends on Phase 3 (needs cancel button to exist) - Adds confirmation layer
- **Phase 6 (Polish)**: Depends on US1-US3 completion
- **Phase 7 (US4)**: Depends on Phase 4 (needs cancelled cards to exist) - UX improvements

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1
- **User Story 3 (P3)**: Depends on US1 (needs the cancel button to wrap with confirmation)
- **User Story 4 (P4)**: Depends on US2 (needs cancelled status display) - Can run after US2

### Within Each User Story

- Backend before frontend
- API client before UI components
- Core implementation before polish

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T004 (command) and T005 (handler) can run in parallel
- T009 (DTO field) can run in parallel with T004-T005

**Phase 3 (US1)**:
- T011-T014 (backend) must complete before T015-T020 (frontend)
- T015 (API client) and T016 (types) can run in parallel
- T17-T20 (UI) depend on T15-T16

**Phase 4 (US2)**:
- T021, T022, T023, T024 can all run in parallel (different UI concerns)

**Phase 6 (Polish)**:
- T029, T030, T033 can all run in parallel

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch backend command and handler together:
Task T004: "Create CancelCardCommand interface in backend/src/application/commands/cancel-card.command.ts"
Task T005: "Create CancelCardHandler in backend/src/application/handlers/cancel-card.handler.ts"

# Then sequentially:
Task T006: "Export from index files"
Task T007: "Add POST route"
Task T008-T010: "DTO updates"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 2: Foundational (backend endpoint)
3. Complete Phase 3: User Story 1 (cancel flow)
4. **STOP and VALIDATE**: Test cancellation via UI
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + 2 → Backend endpoint ready
2. Add US1 → Test independently → Deploy (MVP!)
3. Add US2 → Test independently → Deploy (visual improvements)
4. Add US3 → Test independently → Deploy (safety confirmation)
5. Each story adds value without breaking previous stories

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | T001-T003 | Verify existing infrastructure |
| Phase 2: Foundational | T004-T010 | Backend command, handler, route, DTOs |
| Phase 3: US1 (P1) | T011-T020 | Core cancel flow (backend + frontend) |
| Phase 4: US2 (P2) | T021-T024 | Status display improvements |
| Phase 5: US3 (P3) | T025-T028 | Confirmation dialog |
| Phase 6: Polish | T029-T034 | Error handling, docs, validation |
| Phase 7: US4 (P4) | T035-T044 | Card list UX (scroll, filter, collapse) |

**Total Tasks**: 44
- **Phase 1**: 3 tasks (verification)
- **Phase 2**: 7 tasks (foundational)
- **US1**: 10 tasks (MVP)
- **US2**: 4 tasks (display)
- **US3**: 4 tasks (confirmation)
- **Polish**: 6 tasks
- **US4**: 10 tasks (UX improvements)

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US1) = 20 tasks
