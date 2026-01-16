# Feature Specification: Cancel Credit Card

**Feature Branch**: `001-cancel-card`  
**Created**: 2026-01-14  
**Status**: Draft  
**Input**: User description: "Allow the user to cancel a credit card; backend should soft-delete the card and the frontend should use the new capability."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Cancel a Credit Card (Priority: P1)

As a signed-in user, I can cancel one of my active credit cards so that it can no longer be used, while my past card activity remains available for reference.

**Why this priority**: Prevents unwanted use (lost card, fraud concern, user no longer needs the card) and is the core value of the feature.

**Independent Test**: Can be fully tested by cancelling a card and verifying the card becomes "cancelled" and cannot be used for new activity.

**Acceptance Scenarios**:

1. **Given** a user has an active card they own, **When** they confirm cancellation, **Then** the card is marked cancelled and is no longer treated as active.
2. **Given** a card is cancelled, **When** the user attempts to cancel it again, **Then** the system indicates it is already cancelled and does not create a duplicate cancellation.
3. **Given** a user tries to cancel a card they do not own, **When** they attempt cancellation, **Then** the system denies the action.

---

### User Story 2 - Understand Card Status After Cancellation (Priority: P2)

As a signed-in user, I can clearly see that a cancelled card is cancelled (including when it was cancelled), so I understand why it can’t be used and I don’t contact support unnecessarily.

**Why this priority**: Reduces confusion and improves trust; makes the cancellation action “stick” from a user perspective.

**Independent Test**: Can be fully tested by viewing a cancelled card in the UI and verifying status and timestamp are displayed consistently.

**Acceptance Scenarios**:

1. **Given** a card was cancelled, **When** the user views their cards list, **Then** the cancelled card is clearly labeled as cancelled.
2. **Given** a card was cancelled, **When** the user opens the card details view, **Then** the cancellation status and cancellation time are visible.

---

### User Story 3 - Cancellation Safety Confirmation (Priority: P3)

As a signed-in user, I get a clear confirmation step before cancelling a card to prevent accidental cancellations.

**Why this priority**: Prevents irreversible mistakes and improves UX confidence.

**Independent Test**: Can be fully tested by attempting cancellation, declining confirmation, and ensuring no cancellation occurs.

**Acceptance Scenarios**:

1. **Given** a user is about to cancel an active card, **When** they do not confirm the cancellation, **Then** the card remains active.

---

### User Story 4 - Card List UX Improvements (Priority: P4)

As a signed-in user, I can easily navigate my cards list, filter out cancelled cards, and collapse card details so I can quickly find and manage the cards I care about.

**Why this priority**: Improves usability when users have multiple cards, especially after cancellations accumulate over time.

**Independent Test**: Can be tested by scrolling through a list of cards, toggling the cancelled filter, and collapsing/expanding individual cards.

**Acceptance Scenarios**:

1. **Given** a user has multiple cards, **When** they view the cards list, **Then** they can scroll through all cards smoothly within the mobile viewport.
2. **Given** a user has cancelled cards, **When** they toggle the filter, **Then** cancelled cards are hidden from the list and a count of hidden cards is displayed.
3. **Given** a user views a card, **When** they tap the card header, **Then** the card details collapse/expand to show a compact or full view.
4. **Given** all cards are filtered out, **When** the user sees an empty state, **Then** they have a clear option to show hidden cancelled cards.

---

### Edge Cases

- Attempting to cancel a card that is already cancelled.
- Attempting to cancel a card that does not exist.
- Attempting to cancel a card owned by a different user.
- Temporary failures while saving the cancellation (user should receive a clear failure message and the card should remain active).
- UI refresh/race conditions (user cancels, then quickly navigates; status should still resolve correctly).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a signed-in user to cancel a credit card that they own.
- **FR-002**: System MUST implement cancellation as a reversible, non-destructive change (soft-delete), preserving the card record and historical activity.
- **FR-003**: System MUST treat cancelled cards as inactive for any operation that requires an active card.
- **FR-004**: System MUST prevent creation of new card activity (e.g., authorizations/transactions) for cancelled cards.
- **FR-005**: System MUST maintain visibility of historical card activity (e.g., past transactions) after cancellation.
- **FR-006**: System MUST record the cancellation timestamp for each cancelled card.
- **FR-007**: System MUST ensure cancellation is idempotent (repeating the request does not change the outcome or create duplicates).
- **FR-008**: System MUST restrict cancellation to authorized actors (card owner; administrative overrides, if any, must be explicitly permissioned).
- **FR-009**: System MUST provide the frontend enough information to display a card’s lifecycle state (at minimum: active vs cancelled, and cancellation timestamp when applicable).
- **FR-010**: Users MUST be presented with a confirmation step before finalizing cancellation.
- **FR-011**: System MUST surface clear user-facing errors when cancellation fails (e.g., not found, not authorized, already cancelled, temporary failure).
- **FR-012**: System MUST capture an auditable record of the cancellation action (who initiated, which card, when).
- **FR-013**: System MUST provide proper scrolling within the mobile container when displaying multiple cards.
- **FR-014**: System SHOULD allow users to filter/hide cancelled cards from the cards list.
- **FR-015**: System SHOULD allow users to collapse individual cards to a compact header view for easier navigation.

### Constitution Constraints *(mandatory)*

<!--
  ACTION REQUIRED: Capture any constraints imposed by the project constitution.
  These are non-negotiable unless an explicit exception is requested.
-->

- **CC-001**: Package management and scripts MUST use Bun (`bun install`, `bun run <script>`)
- **CC-002**: Backend (if any) MUST be TypeScript + Express deployed as Firebase Functions
- **CC-003**: Frontend (if any) MUST be Next.js (TypeScript), installed/run via Bun
- **CC-004**: Events (if any) MUST be emitted via a transactional outbox to Redpanda/Kafka

### Assumptions

- Users are already authenticated and can only manage cards they own.
- Card cancellation is allowed at any time for an active card.
- Cancellation is not intended to remove data; it disables future use while preserving historical activity.
- If the product includes an admin role, admin-only actions (e.g., reactivation) are not part of this feature unless explicitly added later.

### Out of Scope

- Re-issuing or replacing a cancelled card.
- Refund/dispute workflows.
- Changing historical transaction data.

### Key Entities *(include if feature involves data)*

- **Card**: Represents a credit card, including current lifecycle state (active/cancelled) and (when cancelled) a cancellation timestamp.
- **CardCancellation Audit Record**: Represents an auditable record of the cancellation action (actor identity, time, and target card).

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 95% of users can successfully cancel a card on the first attempt without needing support.
- **SC-002**: A cancelled card is consistently shown as cancelled to the user within 5 seconds of completing the cancellation flow.
- **SC-003**: 100% of attempts to create new card activity on a cancelled card are blocked.
- **SC-004**: Cancellation flow can be completed by a typical user in under 60 seconds end-to-end.
