# NKKAMS — Attendance Management System

A lightweight, mobile-friendly attendance app designed for GitHub Pages with Supabase for authentication and data.

## Deployment
1. Repository → **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main**, folder **/(root)**, then Save.
4. Your website URL will be: https://nkrishnakarthik2007-hash.github.io/NKKAMS/

## Supabase setup
The site is configured to use your Supabase project. The browser receives only the public publishable key. Never place a service-role key in this repository.

**Important:** the old public tables were reset. The database must be rebuilt and its security policies tested before this app can be used with real employee or attendance records. Do not create production users until the secure sign-in function, role checks, and RLS policies are in place.

## Current starter capabilities
- Responsive login shell and dashboard
- Theme switch without page reload
- Live clock and current date
- Daily attendance marking
- Local queue for offline marks, with online sync attempt
- Monthly summary and individual Excel export
- Mobile-friendly student list and search

## Important implementation notes
- This repository is a starter frontend, not a production-ready deployment.
- The SQL migration and secure account provisioning / sign-in Edge Function must be installed and tested before enabling user accounts.
- Offline changes are stored in this browser's local storage. They are not encrypted and should not be used on shared devices. Resolve conflicts and test sync reliability before operational use.
- The password strength indicator and admin user-management screens need to be implemented alongside server-side account controls.
- Excel exports use SheetJS from a CDN; an internet connection is required to load the workbook library unless it is bundled locally.
