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

/* ---- Optional demo account ----
   Fill these in and a "Try the demo" button appears on the login screen, so
   someone can look around without signing up. Create the account first in
   Supabase (Authentication -> Users -> Add user).

   These credentials are visible to anyone who views the page source — that's
   the point of a demo login, but it means everyone shares one account and can
   see and edit the same data. Put nothing private in it, and never reuse this
   for your own account. Leave blank to hide the button. */
const DEMO_EMAIL = "";      // e.g. "demo@daybook.app"
const DEMO_PASSWORD = "";

/* ---- Email shortcuts ----
   Type the short name in the email box and it expands on submit, so you don't
   have to type a long address every time. Case doesn't matter. This is just
   typing convenience — no password is stored, so it's safe to keep here. */
const EMAIL_SHORTCUTS = {
  "adrien": "adrien.tabor@tufts.edu"
};