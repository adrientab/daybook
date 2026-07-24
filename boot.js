/* ============================================================
   boot.js — starts the app. Loaded LAST, after every other script.

   Startup order:
     1. Auth.init()     who's signed in? (or: no Supabase configured)
     2. demo / login    short-circuits, or waits at the sign-in screen
     3. Vault.unlock()  derive the encryption key BEFORE any data arrives
     4. Store.load()    pull the data down and decrypt it
     5. runAppReady()   release the renders every view registered

   Step 3 is the reason startApp takes a password: the key comes from it
   and is never sent anywhere. On a return visit there's no password to
   hand over, so the key cached on this device is used instead, and if
   that's missing the unlock screen asks for one.
   ============================================================ */

function loadAndRun() {
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

/* Get the encryption key ready. Resolves true when the app can proceed,
   false when the unlock screen is now waiting on the person. */
function openVault(password) {
  const uid = Auth.user.id;

  const attempt = (typeof password === "string")
    ? Vault.unlock(password, uid)
    : Vault.unlockFromCache().then(function (ok) { return ok ? "unlocked" : "need-password"; });

  return attempt.then(function (result) {
    if (result === "unlocked" || result === "created") return true;

    // Either no password was available, or the one given can't unwrap the
    // key — which is what a password reset looks like from here.
    AuthUI.show();
    AuthUI.panel("unlock");
    if (result === "wrong-password") {
      AuthUI.message("That password can't unlock your entries. If you reset it, use your recovery key.", true);
      document.getElementById("recoveryField").hidden = false;
    }
    document.getElementById("unlockPassword").focus();
    return false;
  });
}

function startApp(password) {
  // Signed in -> encrypted server storage. Otherwise stay on this browser.
  if (Auth.enabled && Auth.user) {
    return openVault(password).then(function (ready) {
      if (!ready) return;                 // unlock screen is showing
      AuthUI.hide();
      Store._backend = encrypted(SupabaseBackend);
      return loadAndRun();
    });
  }
  return loadAndRun();
}

/* Show who's signed in, over in Settings. */
function updateAccountUI() {
  const card = document.getElementById("accountCard");
  const who = document.getElementById("accountWho");
  const btn = document.getElementById("signOutBtn");
  const rec = document.getElementById("recoveryCard");
  if (!card || !who) return;

  card.hidden = false;
  if (Auth.enabled && Auth.user) {
    who.textContent = "Signed in as " + Auth.user.email +
                      " \u2014 your data syncs to your account, encrypted.";
    if (btn) btn.hidden = false;
    if (rec) rec.hidden = !Vault.isUnlocked();
  } else {
    who.textContent = "No account connected \u2014 everything is saved in this browser only.";
    if (btn) btn.hidden = true;
    if (rec) rec.hidden = true;
  }
}

Auth.init()
  .then(function (user) {
    // Demo mode short-circuits everything: no account, nothing saved.
    if (typeof isDemoMode === "function" && isDemoMode()) {
      Store._backend = DemoBackend;
      const exit = document.getElementById("exitDemo");
      if (exit) exit.hidden = false;
      return Store.load().then(function () {
        runAppReady();
        const card = document.getElementById("accountCard");
        const who = document.getElementById("accountWho");
        if (card && who) {
          card.hidden = false;
          who.textContent = "Demo \u2014 changes aren't saved. Create an account to keep your own.";
        }
      });
    }

    // Arrived from a password-reset email: set a new password first.
    if (Auth.enabled && Auth.recovering) {
      AuthUI.show();
      AuthUI.panel("fresh");
      document.getElementById("newPassword").focus();
      return;
    }

    // Configured but nobody's signed in: wait at the login screen.
    if (Auth.enabled && !user) {
      AuthUI.show();
      return;
    }
    return startApp();   // no password to hand over; the cached key is tried
  })
  .catch(function (e) {
    console.error("Auth failed, falling back to local storage:", e);
    Auth.enabled = false;
    return startApp();
  });
