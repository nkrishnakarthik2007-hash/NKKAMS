# NKKAMS Project Status

Last updated: 2026-11-15

## Current milestone: Attendance and student lifecycle rebuild

### Completed
- [x] Existing repository inspected; original useful code retained.
- [x] Dedicated Attendance page added; Overview no longer doubles as Attendance.
- [x] Left-side desktop navigation and mobile horizontal navigation.
- [x] 104 supplied students stored in the new Supabase project with unique Employee IDs.
- [x] Super Admin profile verified: Employee ID 241536, role super_admin, active.
- [x] Database setup prompt is conditional on zero profiles; existing Super Admin prevents first-time setup.
- [x] Student create/edit, joining date, leaving date, Left and Reactivate workflow.
- [x] Teachers, Admins and Super Admins may add/edit student records through RLS.
- [x] Student removal is soft-only; historical attendance is retained.
- [x] Attendance supports past/current/future dates, draft status, Mark All Present and explicit Save.
- [x] Not Marked is separate from Present/Absent.
- [x] Holiday creation/removal for Admin and Super Admin.
- [x] Database enforces attendance eligibility and rejects attendance on holidays.
- [x] Password reset request table and unique pending-request constraint.
- [x] Forgot Password contacts and public request submission through Edge Function.
- [x] Admin/Super Admin reset-request list, status changes and protected password reset.
- [x] Registered account list; Admin view restricted to Teacher accounts.
- [x] Super Admin contact details form.
- [x] Supabase Edge Function admin-users deployed (version 7).
- [x] SQL migrations 002, 003, 004 and 005 applied and saved in repository.
- [x] RLS helper functions moved to a non-exposed private schema; security advisor no longer reports those public SECURITY DEFINER functions.
- [x] Added warning for imported students with missing joining dates.
- [x] Added unsaved attendance change warning before changing page/date or signing out.
- [x] GitHub Pages workflow now runs node --check app.js before publishing.

### Verified database state
- Students: 104 records, 104 unique Employee IDs.
- Profiles: one active Super Admin (241536).
- Active admin contacts: one Super Admin contact.
- Password reset requests: table exists; no requests submitted yet.
- Student RLS: authenticated active staff may insert/update; no app hard-delete policy.
- Attendance RLS: authenticated active staff may insert/update only when student date is eligible and date is not a holiday.

### Still requires end-to-end testing
- [ ] Login on the live GitHub Pages site with the existing Super Admin account.
- [ ] Create and test a Teacher account.
- [ ] Create and test a second Admin account as Super Admin.
- [ ] Verify Admin cannot create Admin accounts.
- [ ] Verify Teacher can add/edit/mark students Left.
- [ ] Save and correct attendance for a past date and a future date.
- [ ] Confirm holiday blocks attendance at the database level.
- [ ] Submit a forgot-password request and process it from the admin queue.
- [ ] Test on Android browser.
- [ ] Build year/month calendar, individual calendar, print and copy features.

### Safety notes
- The old student-attendance Supabase project is untouched.
- Do not hard-delete student records or attendance history.
- Do not put service-role keys or passwords in GitHub.
- Existing imported students have blank joining dates because no joining dates were supplied; fill the correct dates before relying on date-specific historical attendance.
