# NKKAMS Project Status

Last updated: 2026-11-27

## Live project

- Website: https://nkrishnakarthik2007-hash.github.io/NKKAMS/
- Repository: https://github.com/nkrishnakarthik2007-hash/NKKAMS
- The website configuration points to the live Supabase project. Changes in this milestone were applied to that project, not a separate test database.

## Verified live data

| Item | Live value |
|---|---:|
| Active organisations | 1 — Hetero |
| Batches | 2 — SMT-01 and SMT-02 |
| Students | 105 |
| Unique student Employee IDs | 105 |
| Attendance records | 105 |
| Attendance on 2026-11-15 | 102 Present, 3 Absent |
| Active user profiles | 2 |
| Active administrator contacts | 2 |
| Password reset requests | 0 |
| Student-left requests | 0 |
| Holidays / non-working days | 0 |

Current live roles:
- Employee ID 241536 — Super Admin.
- Employee ID 135175 — Hetero Organisation Head.
- The Hetero Organisation Head assignment was already present in the live database; this milestone did not change it.

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
- Existing Hetero students and attendance were preserved.

## Current deployed backend versions

- `admin-users`: version 28.
- `nkkams-login`: version 6.

## Remaining validation

- Complete a live role-by-role test with an Organisation Admin and a Teacher account. The live database currently has a Super Admin and an Organisation Head, but no separate Organisation Admin or Teacher account.
- Restore the original SQL files for the already-applied multi-organisation migrations (20261116044821–20261116052734) into the repository. Their applied versions are present in Supabase, but their original SQL files were not present in the GitHub repository when audited; the new migration files in this change match the later live versions.
- Verify a second organisation end-to-end after a real organisation request is submitted and approved.
- Enable Supabase Auth leaked-password protection. The security check currently reports this setting as disabled; it is an Auth dashboard setting not exposed by the connected project tools.

## Data safety

- No existing student or attendance records were deleted.
- No existing organisation head was promoted or replaced during this milestone.
- No production test accounts were created.


## Engineering review snapshot — 2026-11-27

### Verified live backend snapshot
- Supabase project status: `ACTIVE_HEALTHY`.
- Organisations: 1.
- Students: 129.
- Attendance records: 0.
- Active profiles: 2.
- Holidays: 0.
- Pending organisation requests: 0.
- Pending password-reset requests: 0.

**Important data discrepancy:** the 2026-11-16 snapshot above recorded 105 attendance rows. The current database count is 0. This review did not modify or delete attendance data. Confirm whether this is an intentional reset, a data migration, or an unexpected loss before relying on NKKAMS for official attendance.

### Deployment and CI
- The latest observed custom Pages workflow run (2026-11-20 15:41 UTC) failed in `tests/smoke.mjs` before the deploy step.
- The failure came from a duplicate, obsolete organisation-registration handler left in `app.js` after the form moved to `register-organisation.html`. Its DOM IDs are not part of `index.html`.
- The repository's latest observed push is 2026-11-22. No later successful custom Pages workflow was visible during this review.
- GitHub reports Pages enabled, but the live page response could not be independently verified in this review. A successful source build is not proof that the latest commit is live.

### Supabase review
- Auth leaked-password protection is disabled; enable it in Supabase Auth settings.
- Performance advisor reports 21 unindexed foreign keys, 2 RLS auth-initplan warnings and 17 multiple-permissive-policy warnings. These are scale/performance follow-ups; review query plans and policy intent before changing indexes or RLS.
- No database migration or production data mutation was performed during this review.

### Work in progress
- Draft PR #9 removes the obsolete registration handler, checks the public registration page independently, and adds PR-only smoke CI. The PR validation passed on 2026-11-26: JavaScript syntax and frontend smoke checks both succeeded. It does not deploy to production.
- No user-facing bug/feedback form was found; consider a privacy-safe form after the attendance data discrepancy and deployment are resolved.
- Next: review and approve PR #9, then verify the Pages deployment; separately investigate the attendance-count discrepancy and complete Admin/Teacher role tests.
