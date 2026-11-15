# NKKAMS — Attendance Management System

NKKAMS is a mobile-friendly attendance app using GitHub Pages for the website and Supabase for authentication and data.

## Live website
https://nkrishnakarthik2007-hash.github.io/NKKAMS/

Every push to `main` automatically starts the GitHub Pages deployment workflow in `.github/workflows/pages.yml`.

## Connected services
- Supabase project: `dggokugqqeddfydcjvpb`
- Browser configuration: `config.js` contains only the public Supabase publishable key. Never put a service-role key in this repository.
- Edge Functions: `nkkams-login` and `admin-users`.

## Current features
- Employee ID and password sign-in
- Role-aware account creation for Teacher and Admin accounts
- Live password strength checks in the account form
- Responsive dashboard and mobile layout
- Live clock and current date
- Daily attendance marking and student search
- Local offline attendance queue with sync when online
- Monthly attendance summary and individual monthly Excel exports
- Theme switch without page reload

## Database
The baseline schema is in `supabase/migrations/001_nkkams_baseline.sql`. Row Level Security is enabled on the application tables. The previous administrator Auth account was retained and linked to the new `profiles` table so the same sign-in can be used.

## Important limitations before production use
- Test login and account creation with real users before relying on the system for official attendance.
- Offline marks are stored in browser local storage on that device. They are not encrypted, and concurrent edits on multiple devices need a conflict policy.
- Excel export uses SheetJS from a CDN, so the export library needs internet access.
- Passwords are never stored in plain text. The system does not compare one user's password with another user's password; each employee must receive and keep a private password.
- This is the first rebuild release. More requested modules (holiday management, full user list/edit screens, audit/history navigation, and richer reporting) still need implementation and testing.
