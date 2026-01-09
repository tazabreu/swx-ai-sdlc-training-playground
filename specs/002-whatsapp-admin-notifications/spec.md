# Feature Specification: WhatsApp Admin Notifications

**Feature Branch**: `002-whatsapp-admin-notifications`
**Created**: 2026-01-04
**Status**: Draft
**Input**: User description: "WhatsApp integration for admin notifications on card events (payments and requests) with interactive approval workflow via wpp-connect server"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Card Request Approval via WhatsApp (Priority: P1)

When a customer requests a new credit card, both whitelisted admin phone numbers receive a WhatsApp notification asking for approval. The admin can reply with "y"/"yes" to approve or "n"/"no" to reject the request, and the system processes the decision accordingly.

**Why this priority**: This is the core value proposition - enabling remote, mobile-first approval workflows for card requests without requiring admins to access a dashboard or portal. It directly impacts card issuance speed and admin convenience.

**Independent Test**: Can be fully tested by creating a card request and verifying both admins receive the WhatsApp message, then replying with approval/rejection and confirming the card request status updates correctly.

**Acceptance Scenarios**:

1. **Given** a customer submits a new card request, **When** the request is created in the system, **Then** both whitelisted admin phone numbers receive a WhatsApp message containing the request details and approval instructions.

2. **Given** an admin receives a card request notification with request ID, **When** the admin replies with "y [ID]" or "yes [ID]" (case-insensitive), **Then** the card request is approved and the requesting customer can proceed.

3. **Given** an admin receives a card request notification with request ID, **When** the admin replies with "n [ID]" or "no [ID]" (case-insensitive), **Then** the card request is rejected and the customer is informed.

4. **Given** a card request is pending approval, **When** any one of the two admins responds, **Then** that decision is applied (first response wins).

---

### User Story 2 - Payment Notification to Admins (Priority: P2)

When a card payment is successfully processed, both whitelisted admin phone numbers receive a WhatsApp notification with payment details for awareness and record-keeping purposes.

**Why this priority**: Payment notifications are informational (no action required), making them secondary to the approval workflow. They provide visibility into financial activity but don't block customer actions.

**Independent Test**: Can be fully tested by processing a card payment and verifying both admins receive the WhatsApp notification with correct payment details.

**Acceptance Scenarios**:

1. **Given** a customer makes a payment on their credit card, **When** the payment is successfully processed, **Then** both whitelisted admin phone numbers receive a WhatsApp message with payment details (amount, card identifier, timestamp).

2. **Given** a payment notification is sent, **When** the admin receives it, **Then** the message clearly indicates this is informational only (no response required).

---

### User Story 3 - Webhook Message Reception (Priority: P3)

The system receives incoming WhatsApp messages from admins via a webhook endpoint and processes approval/rejection commands for pending card requests.

**Why this priority**: This is the technical enabler for the approval workflow. While essential, it's a supporting capability rather than direct user value.

**Independent Test**: Can be fully tested by sending a simulated webhook payload with an admin reply and verifying the system correctly parses and routes the message.

**Acceptance Scenarios**:

1. **Given** the wpp-connect server receives an admin reply, **When** the webhook is triggered with message data, **Then** the system receives and acknowledges the webhook within 5 seconds.

2. **Given** an incoming webhook message contains "y [ID]", "yes [ID]", "n [ID]", or "no [ID]", **When** the ID matches a pending card request, **Then** the system executes the appropriate approval or rejection action.

3. **Given** an incoming message doesn't match any pending request or contains invalid content, **When** processed by the system, **Then** the message is logged and no action is taken (fail-safe behavior).

---

### Edge Cases

- What happens when both admins respond simultaneously with conflicting decisions? (First response wins)
- What happens when an admin responds to an already-processed request? (System acknowledges but takes no action)
- What happens when the wpp-connect server is unavailable? (Notifications are queued for retry)
- What happens when an admin phone number is not reachable? (Notification is attempted to the other admin)
- What happens when an admin replies with unrecognized text? (Message is logged, no action taken, no error sent to admin)
- What happens when an admin replies with a non-existent or invalid request ID? (Message is logged, no action taken)
- What happens when a card request expires before approval? (Request is auto-rejected after timeout)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to an external wpp-connect server endpoint to send WhatsApp messages
- **FR-002**: System MUST send notifications to exactly two pre-configured (whitelisted) admin phone numbers
- **FR-003**: System MUST send a card request notification when a new card request is created, including request ID, customer identifier, and approval instructions
- **FR-004**: System MUST send a payment notification when a card payment is successfully processed, including payment amount, card identifier, and timestamp
- **FR-005**: System MUST expose a webhook endpoint to receive incoming WhatsApp messages from the wpp-connect server
- **FR-005a**: System MUST validate incoming webhook requests using a shared secret token in the X-Webhook-Secret HTTP header
- **FR-006**: System MUST parse incoming messages and recognize approval commands ("y", "yes") and rejection commands ("n", "no") followed by the request ID (e.g., "y 12345", "no 12345"), in a case-insensitive manner
- **FR-007**: System MUST apply the first admin response to a pending card request (first-response-wins policy)
- **FR-008**: System MUST update the card request status to "approved" or "rejected" based on the admin's response
- **FR-009**: System MUST ignore duplicate or late responses to already-processed requests
- **FR-010**: System MUST log all outgoing notifications and incoming webhook messages for audit purposes
- **FR-011**: System MUST retry failed message deliveries up to 3 times with exponential backoff

### Constitution Constraints *(mandatory)*

- **CC-001**: Package management and scripts MUST use Bun (`bun install`, `bun run <script>`)
- **CC-002**: Backend MUST be TypeScript + Express deployed as Firebase Functions
- **CC-003**: Events MUST be emitted via a transactional outbox to Redpanda/Kafka (for card request status changes)

### Key Entities

- **AdminPhoneNumber**: Represents a whitelisted admin contact. Attributes: phone number (international format), display name for logging.
- **WhatsAppNotification**: Represents an outbound message to admins. Attributes: recipient phone, message content, notification type (request/payment), related entity ID, delivery status, sent timestamp, retry count.
- **WebhookMessage**: Represents an inbound message from wpp-connect. Attributes: sender phone, message content, received timestamp, processed status, related action taken.
- **PendingApproval**: Links a card request to its notification state. Attributes: card request ID, notification ID, approval status (pending/approved/rejected), responding admin, response timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins receive WhatsApp notifications within 30 seconds of card request creation or payment completion
- **SC-002**: 95% of admin approval/rejection responses are processed and reflected in the system within 10 seconds
- **SC-003**: Admin approval workflow reduces card request processing time by 50% compared to manual dashboard approval
- **SC-004**: System successfully delivers 99% of notifications to at least one admin within 3 retry attempts
- **SC-005**: Zero card requests are incorrectly approved or rejected due to message parsing errors (100% parsing accuracy for y/yes/n/no variants)

## Security Considerations *(sandbox limitations)*

**Current Implementation (Sandbox/Dev):**
- Webhook authentication via shared secret token (X-Webhook-Secret header)
- wpp-connect server uses `secretKey` for bearer token generation (API authentication)

**Not Yet Covered (Production Hardening):**
- IP allowlisting for webhook endpoint (blocked by ephemeral VM IPs in sandbox)
- HMAC signature validation on webhook payloads
- Rate limiting on webhook endpoint
- VPC/Cloud Armor protection for wpp-connect server
- Audit trail encryption at rest

**wpp-connect Server Research Notes:**
- Runs on GCE VM with Container-Optimized OS at `http://<external-ip>:21465`
- Uses `secretKey` CLI flag for API authentication (generates session-scoped bearer tokens)
- Default firewall allows all IPs (`0.0.0.0/0`) - not restricted in sandbox
- Webhook handler sidecar on port 3100 does NOT sign outgoing webhook calls (requires our own auth)

## Clarifications

### Session 2026-01-04

- Q: How should the system correlate an admin's WhatsApp reply to the specific card request being approved/rejected? → A: Include request ID in notification; admin must reply with ID (e.g., "y 12345")
- Q: How should the webhook endpoint authenticate requests from the wpp-connect server? → A: Shared secret token in HTTP header (e.g., X-Webhook-Secret). Note: IP allowlisting deferred due to ephemeral IPs in sandbox environment.

## Assumptions

- The wpp-connect server is externally managed and provides a stable endpoint for sending messages and a webhook callback mechanism for receiving replies
- The wpp-connect server session name will be configured via environment variable (e.g., "tazco-admin-session")
- Admin phone numbers are pre-configured in environment/configuration and do not change frequently
- The wpp-connect server handles WhatsApp authentication and session management
- International phone number format (E.164) is used for all phone numbers
- Card request and payment events are already emitted by the existing Financial API (feature 001)
- The timeout period for card request approval is 24 hours (auto-reject after this period)
