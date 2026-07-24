/* ============================================================
   config.js — your Supabase project details.

   Fill both in from: Supabase dashboard -> Project Settings -> API.

   These two values are PUBLIC by design. They ship in the browser and
   anyone can read them — that's expected. They don't grant access to
   anything on their own: the Row Level Security policies in
   supabase-setup.sql are what stop one account reading another's data.
   The key to never put here is the *service role* key, which bypasses
   RLS entirely. That one stays on a server, never in this file.

   Leave these as-is and the app keeps running exactly as before, on
   this browser's local storage with no login. That's handy while you
   set the project up.
   ============================================================ */

const SUPABASE_URL = "https://pasaatxeylzrycsqkddu.supabase.co";   // e.g. https://abcdefgh.supabase.co
const SUPABASE_KEY = "sb_publishable_oGgUHoKG7wVoMpXgcfA8dQ_3KuE2m4b";
