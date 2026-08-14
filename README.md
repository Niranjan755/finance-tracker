# Finance Tracker

A personal finance tracker built with React, TypeScript, Vite, and IndexedDB.

## Cloud sync setup (optional)

The app works fully offline out of the box. To sync your data across devices:

1. Create a project at https://supabase.com
2. Open the SQL Editor and run the contents of `supabase/schema.sql`
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key:
   ```bash
   cp .env.example .env
   ```
4. In Supabase, go to Authentication → Settings and disable "Enable email confirmations" (email
   sending isn't set up, so confirmation emails would otherwise block sign-up)
5. Run `npm install && npm run dev`
6. In the app, go to Settings → Account & Cloud Sync and create an account (any email + a
   password of at least 6 characters — the email isn't verified)

Once signed in, changes sync automatically across every device signed into the same account. Each
account's data is private to that account (enforced by Postgres row-level security), so multiple
people can use the same deployment with their own separate accounts. If you edit on two devices
while both are offline at once, the device that syncs last wins — there's no merge across offline
edits.
