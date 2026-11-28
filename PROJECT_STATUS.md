# NKKAMS Project Status

Last updated: 2026-11-29

## Live project

- Website: https://nkrishnakarthik2007-hash.github.io/NKKAMS/
- Repository: https://github.com/nkrishnakarthik2007-hash/NKKAMS
- GitHub reports Pages enabled. The live page could not be independently fetched from this review environment, so current visitor availability is unverified.

## Implemented and deployed

- Multi-organisation data model and organisation-specific batches.
- Super Admin and Website Admin global access, with organisation-scoped access for Organisation Heads, Organisation Admins and Teachers.
- Organisation listing, status controls, workspace switching, organisation registration requests and approval.
- Direct organisation-head appointment by a Website Admin or Super Admin.
- Two-step head transfer: the proposed Organisation Admin accepts first; a Website Admin or Super Admin approves the transfer.
- Organisation Head can create Organisation Admins and Teachers. Organisation Admin can create and manage Teachers only.
- Account activation/deactivation, profile updates and password resets with role and organisation checks.
- Tenant-aware student, attendance, batch, holiday, reset-request and student-left-request access policies.
- Global administrators can open an organisation workspace without losing global permissions.
- Reports, exports, holidays and student-left requests are filtered to the selected organisation.
- Employee ID login lockout after five failed attempts, with a 30-minute lockout and administrator notifications.
- Login rejects inactive accounts and accounts belonging to suspended organisations.
- Public organisation request form is connected to the backend.
- Soft-left workflow preserves student history by design; current historical attendance availability still needs to be verified.

## Current backend and data-integrity review

- Supabase project status: `ACTIVE_HEALTHY`.
- The current `public.attendance` table returned no rows in the aggregate check. Do not infer that historical attendance was intentionally cleared or restore anything automatically.
- The previous project status and the current live database do not agree. Confirm whether the source of truth changed, a migration/reset occurred, or data is missing before using NKKAMS for official attendance.
- No production data was changed during this review.

## Migration-history drift — important

- Supabase's migration ledger contains 25 applied versions.
- The repository's `supabase/migrations` directory contains 18 SQL files.
- Ten applied multi-organisation migration versions between `20261116044821` and `20261116052734` are absent from the repository.
- Two later migration files have names/timestamps that do not match the corresponding ledger versions: the organisation-leadership audit migration and organisation-profile-fields migration.
- Two repository migration files (`20261117070000_global_organization_creation_toggle` and `20261117131000_add_super_admin_hetero_head_membership`) were not present in the live migration ledger at review time.
- Do not run `db reset`, replay migrations, restore old SQL from guesses, or apply a schema change until the exact source SQL and live schema have been reconciled. Recover the original files from trusted Git history/backup or reconstruct and review a forward-only migration from the live schema.

## Deployment and CI

- Draft PR #9: https://github.com/nkrishnakarthik2007-hash/NKKAMS/pull/9
- PR validation run [45877909377](https://github.com/nkrishnakarthik2007-hash/NKKAMS/actions/runs/45877909377) passed JavaScript syntax and frontend smoke checks. It is PR-only validation and does not deploy Pages.
- The last observed custom Pages deployment workflow on main failed on 2026-11-20 before its deploy step. GitHub's dynamic Pages build/deploy workflow for the same commit completed successfully. No newer main Pages run was visible.
- Direct live URL fetch was blocked in the review environment; do not label the site down or fully verified.

## Supabase security and performance

- Health advisor: no health lints.
- Auth leaked-password protection is disabled; enable it in Supabase Auth settings after review.
- Performance advisor: 21 unindexed foreign keys, 2 RLS auth-initplan warnings, 5 unused indexes and 17 multiple-permissive-policy warnings. Review query plans and policy intent before changing indexes or RLS.
- No database migration, policy change or production data mutation was performed.

## Feedback and support

- No in-app Report a Problem form was found.
- A public GitHub issue form is not appropriate for student/employee reports. Use a private support channel or an explicitly consented, access-controlled backend before collecting free text or diagnostics.

## Exact next steps

1. Reconcile the attendance table with trusted backups, historical exports and migration records. Preserve all existing student and attendance history; do not restore blindly.
2. Recover the missing applied migration SQL from trusted source history/backup and reconcile the two timestamp mismatches and two unapplied repository files.
3. Review PR #9; after merge, verify the actual Pages deployment.
4. Test Super Admin, Organisation Head, Organisation Admin and Teacher roles, then test a second organisation with isolated data.
5. Enable leaked-password protection in Supabase Auth after owner approval.
6. Add a private feedback/report channel only after its access control and retention policy are defined.
