# Humor HQ

A Google-protected admin workspace connected to the existing **Humor Project** database (`radhglktttyanjgtkddw`). Built with React, the Next.js App Router APIs, Vinext, and Supabase. It uses the project's existing profiles, caption/photo generations, votes, and `caption-memes` storage bucket.

## Run

Requires Node 22.13 or later.

```sh
npm ci
npm run dev
```

The default local URL is `http://127.0.0.1:5173`. Only the public Supabase URL and publishable key are used; no service-role key is required or exposed.

## Features

- `/admin`: live totals, 7/30/90-day creation/vote charts, approval rate, net-score leaderboard, divisive content, unrated content, recent creations. Date ranges use America/New_York.
- `/admin/media`: search, filter and paginate captions/photo memes; inspect, create, edit and delete. Upload existing AI-generated photo media; this admin tool does not call an AI generation provider. Images respect the database's ownership path, 5 MB size, minimum dimensions and 25 MP limits. Deleting media cascades its votes and attempts storage cleanup, reporting cleanup failure.
- `/admin/profiles`: searchable, paginated, read-only profiles and role details.
- `/admin/ratings`: searchable, filtered, paginated, read-only individual upvotes/downvotes. The existing schema contains binary votes, so the dashboard derives the approval rating from their ratio.
- `/admin/access`: current account and access rules.

## Access

Every admin page and API handler independently checks the Supabase-verified Google user and `admin_access()`. Database policies separately enforce permissions. The database verifies signed Google OAuth claims, an active session and `profiles.is_superadmin=true`. Private results use no-store responses. Writes also require a matching Origin header.

`is_superadmin` defaults to false. A trigger blocks application users from inserting or changing an elevated role, including through the original profile editor or direct REST requests. There is no role-grant endpoint. Private, guarded database functions preserve the original photo feed's column-level restrictions. Existing public feeds keep their original access policies.

The schema and grants were applied to the connected database using Supabase migrations `humor_hq_admin_access`, `humor_hq_scoped_media_privileges`, and `humor_hq_dashboard_dates`. `db/admin-access.sql` records the consolidated DDL for review; do not reapply it to the same database.

## First-admin bootstrap

Use trusted Supabase SQL administration after the intended user has signed in with Google to the Humor Project. Grant the role to an explicitly chosen, verified account; the application cannot assign it:

```sql
update public.profiles p
set is_superadmin = true
from auth.users u
where p.user_id = u.id
  and lower(u.email) = lower('REPLACE_WITH_VERIFIED_GOOGLE_EMAIL')
  and u.email_confirmed_at is not null
  and exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'google'
  )
returning p.id, p.is_superadmin;
```

The user-selected initial account has already been granted access through the connected Supabase administration tool. Additional roles require the same trusted process. Revoke a role by setting it to false through trusted database administration; it is rechecked on every request.

Google OAuth is already enabled in the Humor Project. Supabase Authentication → URL Configuration must allow these exact callback URLs (the owner confirmed adding them):

- `http://127.0.0.1:5173/auth/callback`
- `https://humor-hq-admin.plumaphid38.chatgpt.site/auth/callback`

## Validation

```sh
npm test
npx tsc --noEmit
npm run build
```

Validation tests cover field allowlists, ownership, photo IDs, upload signatures, constraints, and pagination. Database tests were run as `authenticated` with transaction-local claims: allowed admin queries and CRUD, denied nonadmins and non-Google sessions, denied self-role changes. Temporary mutation data was rolled back. HTTP checks verify protected page redirects and anonymous API denial. Browser Google authentication requires the user's sign-in; automated access to the Google origin was declined, so the full browser login and authenticated visual flows remain unverified.

Sites deployment preserves owner-private hosting access in addition to the app's Google and superadmin checks. The production Worker uses HTTP Supabase APIs and needs no persistent database connection.
