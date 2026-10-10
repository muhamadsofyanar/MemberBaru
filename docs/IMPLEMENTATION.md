# Membership completion

Approved scope: complete the missing membership, LMS and affiliate features identified in the conversation, then test and package deployment instructions. Keep existing visual design and manual bank payments.

1. Accounts: profile, password change with old password, email reset with expiring single-use token and session invalidation.
2. Membership: admin plan editor, archive plans without deleting historical orders, member account status, entitlement checks across all currently active plans.
3. LMS: course/module/lesson CRUD, explicit plan access, ordering, publishing and safe embed URLs. Preserve existing progress on edits.
4. Affiliate: reserve all currently available approved commissions in one request; admin approves, rejects (releases funds), or marks paid with transfer reference. Serializable transaction prevents double spending.
5. Security/operations: origin check, database rate limits, atomic order approval, fail-closed production secrets, health check, idempotent seed and deployment/backups documentation.
6. Validation: business-rule tests, schema validation, typecheck/build and database integration if runtime permits. Record unverified external integrations honestly.

Work allocation: LMS implementation delegated under Subagent-Driven Development; parent owns shared schema, account/membership/affiliate and integration. ZIP is isolated working copy. No live deployment or actual email/financial transfers during verification.
