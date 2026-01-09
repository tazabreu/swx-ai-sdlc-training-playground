<!--
SYNC IMPACT REPORT
==================
Version Change: 1.0.0 → 1.0.1 (PATCH - Remove Kubernetes-specific references)
Ratified: 2026-01-03
Focus: Testing & Verification for GCP/OpenTofu infrastructure and deployment
Principles: 5 core principles (Verification-First, IaC Immutability, Cross-Project
Integration, Deployment Automation, Testing Standards)
Templates Updated:
  - ✅ plan-template.md (Constitution Check gate already present)
  - ✅ spec-template.md (Verification-driven requirements)
  - ✅ tasks-template.md (Test-first task organization)
Runtime Docs Reviewed: ✅ README.md, ✅ AGENTS.md
Deferred TODOs: None
-->

# Tazco Sample Financial Ecosystem Product Constitution

## Core Principles

### I. Verification-First Development

Every change to infrastructure or application behavior MUST have corresponding automated tests
in the test suite BEFORE deployment to any environment. Tests validate:
- Deployment artifacts apply without errors
- Services reach ready state within expected timeframe
- Service endpoints are accessible and respond correctly
- Health endpoints return expected payload and status

Non-negotiable: No code path is considered complete until its verification test
passes. Proof of passing tests MUST be included in all PR descriptions.

### II. Infrastructure-as-Code Immutability

All GCP infrastructure state MUST be managed exclusively through OpenTofu
configuration files in the `infra/gcp/` directory. Direct GCP console
modifications are prohibited. State is persisted in the product's GCS state
bucket and versioned in Git.

Non-negotiables:
- Terraform/OpenTofu files are the source of truth
- State bucket must be protected from direct writes
- All resource creation/deletion flows through `tf plan` + `tf apply`

Rationale: Enables reproducible deployments, audit trails, and team-wide
consistency. Infrastructure changes are reviewable and reversible.

### III. Cross-Project Integration Transparency

This product integrates with the Tazco platform across two GCP projects
(product project + platform project). All integration points MUST be
explicitly documented:
- Workload Identity Federation configuration
- IAM bindings and role assignments
- Runtime access paths and access procedures
- Service account permissions and fallback procedures

Access is granted by principle of least privilege. Ownership of each
integration point must be clearly stated.

Rationale: Prevents hidden dependencies and enables rapid incident response.

### IV. Deployment Automation & Repeatability

All deployments MUST be fully automated via GitHub Actions golden workflows.
No manual deploy or infrastructure apply commands in production. Environments
(dev, staging, prod) must be identically configured except for parameterized
variables (project IDs, regions, replica counts).

Manual intervention is only acceptable in break-glass emergencies. When
undertaken, a post-incident review MUST document the issue and close the
automation gap.

### V. Testing & Observability Standards

The automated test suite (`bun test`) MUST cover the complete deployment lifecycle:
- Deployment rollout success (service readiness, startup completion)
- Service connectivity and response validation
- Health endpoint functionality and payload correctness
- Configuration validation before deployment

Tests MUST be runnable locally and in CI with identical results. Test
environment setup MUST be documented in the quickstart guides.

Rationale: Detects configuration drift and deployment issues before
production impact.

## Deployment Workflow & Quality Gates

### Code Review & Merge Requirements

Every PR is subject to these automated checks:

1. **OpenTofu Plan** (if `infra/gcp/` changed)
   - Validates HCL syntax and resource references
   - Shows drift from current state
   - Outputs plan for review

2. **Test Suite** (if application or test files changed)
   - Runs `bun run typecheck`, `bun run lint`, and `bun test`
   - Failures block merges

3. **Manual Review**
   - Reviewer confirms "Constitution Check: PASS"
   - Reviewer validates changes align with principles
   - For exceptions: explicit written justification required

Only after all three gates pass may code be merged to main. Merging to main
automatically triggers deployment to the target runtime environment and post-
deployment verification.

### Testing Gates & Checkpoints

Three checkpoints enforce testing discipline:

1. **On PR creation**: Full test suite must pass before review begins
2. **Before merge**: Verify no new test failures introduced
3. **Post-merge**: Automatic deployment followed by verification test run

Breaking tests block all merges. Skipping tests requires:
- Explicit exception (documented in PR)
- Written justification (why skip is necessary)
- Expiration date (when skip expires)
- Approver sign-off

## Governance

### Amendment Procedure

Constitution amendments require:
1. **Documented rationale**: Why is this change needed?
2. **Impact analysis**: Which artifacts, workflows, and team practices
   are affected?
3. **Approval**: Consensus or designated approver
4. **Version bump**: Follows semantic versioning (see Versioning Policy)
5. **Propagation**: All dependent templates updated in same PR

### Versioning Policy

This constitution follows semantic versioning:

- **MAJOR** (e.g., 1.0.0 → 2.0.0): Principle removals, backward-
  incompatible governance changes, fundamental workflow restructuring
- **MINOR** (e.g., 1.0.0 → 1.1.0): New principle/section added,
  materially expanded guidance or requirements
- **PATCH** (e.g., 1.0.0 → 1.0.1): Clarifications, wording refinements,
  typo fixes, non-semantic adjustments

### Compliance Review Expectations

- **Quarterly**: Review principle adherence across merged PRs
- **On violation**: Blocking issue created, violating PR reverted or
  amended before merge
- **On merge**: Reviewer must explicitly confirm "Constitution Check: PASS"
- **On exception**: Exception logged in PR with business justification
  and expiration date

### Dependent Templates & Synchronization

This constitution governs the following templates. When this document is
amended, all dependent artifacts MUST be reviewed and updated:

- `.specify/templates/plan-template.md` - Constitution Check gate required
  in Phase 0 research
- `.specify/templates/spec-template.md` - User stories must align with
  verification-first principle and cross-project integration concerns
- `.specify/templates/tasks-template.md` - Task organization must reflect
  testing gates and test-first discipline
- `README.md` - Quick start guide must document test execution and gates

**Version**: 1.0.1 | **Ratified**: 2026-01-03 | **Last Amended**: 2026-01-04
