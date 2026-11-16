# NKKAMS Project Status

Last updated: 2026-11-16

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

- `admin-users`: version 23.
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
