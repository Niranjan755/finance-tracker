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
4. Run `npm install && npm run dev`
5. In the app, go to Settings → Account & Cloud Sync and sign in with a magic link

Once signed in, changes sync automatically across every device you're signed into on the same
account. If you edit on two devices while both are offline at once, the device that syncs last
wins — there's no merge across offline edits.
