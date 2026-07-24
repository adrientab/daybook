/* ============================================================
   boot.js — starts the app. Loaded LAST, after every other script.

   Startup order:
     1. Auth.init()   who's signed in? (or: no Supabase configured at all)
     2. login screen  only if a project is configured and nobody's signed in
     3. Store.load()  pull the data down
     4. runAppReady() release the renders every view registered

   Nothing draws before step 4, which is why each view registered its
   first render with onAppReady() instead of calling it directly.
   ============================================================ */

function startApp() {
  // Signed in -> talk to the server. Otherwise stay on this browser.
  if (Auth.enabled && Auth.user) {
    Store._backend = SupabaseBackend;
  }

  // No migration from local storage: a new account always starts empty.
  // To bring old data across, use Settings -> export a backup, then import
  // it once signed in.
  return Store.load()
    .then(function () {
      runAppReady();
      updateAccountUI();
    })
    .catch(function (e) {
      console.error("Couldn't load your data:", e);
      alert("Couldn't load your data, so the app is starting empty.\n\n" +
            "Don't make changes until this is sorted out, or you may overwrite what's saved.");
      Store.ready = true;
      runAppReady();
      updateAccountUI();
    });
}

/* Show who's signed in, over in Settings. */
function updateAccountUI() {
  const card = document.getElementById("accountCard");
  const who = document.getElementById("accountWho");
  const btn = document.getElementById("signOutBtn");
  if (!card || !who) return;

  card.hidden = false;
  if (Auth.enabled && Auth.user) {
    who.textContent = "Signed in as " + Auth.user.email + " \u2014 your data syncs to your account.";
    if (btn) btn.hidden = false;
  } else {
    who.textContent = "No account connected \u2014 everything is saved in this browser only.";
    if (btn) btn.hidden = true;
  }
}

Auth.init()
  .then(function (user) {
    // A project is configured but nobody's signed in: wait at the login
    // screen. startApp() runs from there once they're through.
    if (Auth.enabled && !user) {
      AuthUI.show();
      return;
    }
    return startApp();
  })
  .catch(function (e) {
    console.error("Auth failed, falling back to local storage:", e);
    Auth.enabled = false;
    return startApp();
  });