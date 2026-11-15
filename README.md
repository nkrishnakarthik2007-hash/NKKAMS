# NKKAMS — Attendance Management System

**Live site:** https://nkrishnakarthik2007-hash.github.io/NKKAMS/

NKKAMS uses GitHub Pages for its static website and Supabase for authentication, PostgreSQL data and protected server-side actions.

## Current architecture
- Frontend: HTML, CSS and JavaScript.
- Authentication: Supabase Auth, with Employee ID mapped server-side to a synthetic login identity (EMPLOYEEID@login.nkkams.invalid). No password is stored in the frontend or profiles table.
- Database: PostgreSQL with Row Level Security.
- Privileged actions: Supabase Edge Function admin-users.
- Hosting: GitHub Pages; pushes to main run the deployment workflow.

## Supabase
- Project ref: atwteqdsfhsxebwxrrjs
- Region: Singapore (ap-southeast-1)
- Frontend config: config.js contains only the public publishable key.
- Never add a service-role or secret key to this repository.

## Implemented modules
- Welcome page and authenticated workspace.
- Responsive left sidebar navigation.
- Employee ID + password login and one-time first-admin setup check.
- Daily attendance for past, current and future dates.
- Draft Present/Absent selections, Mark All Present and explicit Save Attendance.
- Saved status vs Not Marked status.
- Attendance completion counts.
- Student add/edit, joining date, leaving date, Left and Reactivate actions.
- Soft-left workflow preserves attendance history; app users cannot hard-delete students.
- Holiday management for Admin and Super Admin.
- Database policies enforce staff access, student date eligibility and no attendance on holidays.
- Monthly summary and individual Excel exports; daily CSV export.
- Change password, public Forgot Password contacts and reset request submission.
- Admin/Super Admin reset-request queue, account list, activate/deactivate and protected password reset.
- Admin contact details management.
- Service worker cache versioning and JavaScript syntax validation before deployment.

## Database migrations
1. 001_nkkams_baseline.sql — core profiles, students, attendance, holidays, contacts and audit tables.
2. 002_student_lifecycle_and_reset_requests.sql — staff student editing, reset request table, Super Admin contact.
3. 003_unique_pending_reset_requests.sql — one pending reset request per account.
4. 004_enforce_attendance_eligibility.sql — server-side student date eligibility and holiday checks.

Migrations 002–004 have been applied to the NKKAMS Supabase project. Existing student and attendance rows are not deleted by these migrations.

## Roles
- **Super Admin:** create Admin and Teacher accounts, manage accounts, contacts, reset requests, holidays and students.
- **Admin:** create Teacher accounts, manage students, attendance, reports and reset requests.
- **Teacher:** add/edit students, record attendance and view reports. Teachers cannot manage user accounts or holidays.

Permissions are enforced with database RLS and protected Edge Function checks, not only by hiding interface controls.

## Student lifecycle rules
- Joining date is required when creating or editing a student.
- Existing imported students with no known joining date remain visible for historical attendance until an administrator/staff member fills the correct date.
- Leaving is a soft status change: set a leaving date and mark the student Left.
- Historical attendance is preserved.
- Attendance is eligible from joining date through leaving date inclusive.
- Future dates are allowed; no future attendance is saved automatically.

## Password help
- Users can submit a reset request from the sign-in screen.
- The request page does not reveal whether an Employee ID exists.
- Admins can review requests and set a new temporary password through the protected Edge Function.
- Passwords are handled by Supabase Auth; admins cannot view existing passwords.
- Share temporary passwords privately and ask users to change them after sign-in.

## Known limitations / next work
- Full year/month calendar navigation and richer individual attendance calendar views remain to be built.
- Daily print register and copy-to-clipboard exports remain to be built.
- Offline queue from the first prototype needs a proper conflict review before being relied on; avoid marking official attendance offline.
- Browser end-to-end tests with Teacher and Admin accounts still need to be performed.
- Student records imported without joining dates need their real joining dates entered. Do not guess dates.

## Deployment
GitHub Actions checks JavaScript syntax, then publishes the repository to GitHub Pages. After updates, wait for the Pages workflow to succeed and hard-refresh the browser (Ctrl+Shift+R). The service worker cache is versioned to avoid stale frontend files.
