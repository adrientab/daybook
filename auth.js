/* ============================================================
   auth.js — sign-in gate + the Supabase persistence backend.

   Two jobs:
     1. Auth            — who is signed in, and the login screen.
     2. SupabaseBackend — loadAll/saveMany against the user_data table.

   SupabaseBackend implements exactly the same two methods as the
   LocalBackend in app.js, which is why nothing else in the app had to
   change to start syncing.

   If config.js still has its placeholders, everything here stays out of
   the way: no login screen, and the app runs on localStorage as before.
   ============================================================ */

/* A password-reset link lands back here with "type=recovery" in the URL hash.
   We read it at load, before supabase-js consumes and clears the hash. */
const RECOVERY_IN_URL = /type=recovery/.test(location.hash);

const Auth = {
  client: null,
  user: null,
  enabled: false,   // false = no Supabase configured, run local-only
  recovering: RECOVERY_IN_URL,

  /* Work out whether we have a project to talk to, and whether the
     browser already holds a valid session from a previous visit. */
  init: function () {
    const configured =
      typeof SUPABASE_URL === "string" && SUPABASE_URL.indexOf("http") === 0 &&
      typeof SUPABASE_KEY === "string" && SUPABASE_KEY.length > 20;

    if (!configured) return Promise.resolve(null);

    if (typeof supabase === "undefined" || !supabase.createClient) {
      // CDN blocked or offline: better to run local-only than show nothing.
      console.warn("Supabase library unavailable — running on local storage.");
      return Promise.resolve(null);
    }

    this.enabled = true;
    this.client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const self = this;
    return this.client.auth.getSession().then(function (res) {
      self.user = (res.data && res.data.session) ? res.data.session.user : null;
      return self.user;
    });
  },

  signIn: function (email, password) {
    const self = this;
    return this.client.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw res.error;
        self.user = res.data.user;
        return self.user;
      });
  },

  signUp: function (email, password) {
    const self = this;
    return this.client.auth.signUp({ email: email, password: password })
      .then(function (res) {
        if (res.error) throw res.error;
        // With email confirmation switched on there's no session yet.
        self.user = res.data.session ? res.data.user : null;
        return { user: res.data.user, needsConfirmation: !res.data.session };
      });
  },

  /* Email a link that lets them set a new password. The link must come back
     to this exact page, and that URL has to be on Supabase's redirect
     allowlist (Authentication -> URL Configuration). */
  requestReset: function (email) {
    return this.client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname
    }).then(function (res) {
      if (res.error) throw res.error;
    });
  },

  /* Set a new password. The same PASSWORD_PAD used at sign-in is applied
     here — otherwise the new password would never match what the login
     screen sends, and they'd be locked out by the thing meant to rescue them. */
  setPassword: function (typed) {
    const self = this;
    return this.client.auth.updateUser({ password: typed + PASSWORD_PAD })
      .then(function (res) {
        if (res.error) throw res.error;
        self.user = res.data.user;
        self.recovering = false;
        // Drop the recovery tokens so a refresh doesn't re-enter this flow.
        history.replaceState(null, "", location.pathname + location.search);

        // The data key is wrapped with the OLD password, so it must be
        // re-wrapped or the entries become unreadable. That's only possible
        // if this device still holds the key; otherwise the unlock screen
        // will ask for the recovery key.
        return Vault.unlockFromCache().then(function (had) {
          if (!had) return self.user;
          return Vault.rewrap(typed + PASSWORD_PAD, self.user.id)
            .then(function () { return self.user; });
        });
      });
  },

  signOut: function () {
    const self = this;
    // Push any pending edits, then drop the encryption key from this device.
    return Store.flush()
      .then(function () { if (typeof Vault !== "undefined") Vault.lock(); })
      .then(function () { return self.client.auth.signOut(); })
      .then(function () { location.reload(); });
  }
};

/* ============================================================
   SupabaseBackend — same shape as LocalBackend in app.js.
   ============================================================ */
const SupabaseBackend = {
  name: "supabase",

  /* Pull every row for this user. Supabase caps a select at 1000 rows,
     and this app accumulates a key per day (journals, wearables), so a
     few years of use will pass that — hence the paging. */
  loadAll: function () {
    const sb = Auth.client;
    const PAGE = 1000;
    const out = {};

    function fetchFrom(start) {
      return sb.from("user_data")
        .select("key,value")
        .range(start, start + PAGE - 1)
        .then(function (res) {
          if (res.error) throw res.error;
          const rows = res.data || [];
          rows.forEach(function (r) { out[r.key] = r.value; });
          if (rows.length === PAGE) return fetchFrom(start + PAGE);
          return out;
        });
    }
    return fetchFrom(0);
  },

  /* changes: [{ key, value }], value === null means delete. */
  saveMany: function (changes) {
    const sb = Auth.client;
    const uid = Auth.user.id;
    const now = new Date().toISOString();

    const deletes = [];
    const upserts = [];
    changes.forEach(function (c) {
      if (c.value === null) deletes.push(c.key);
      else upserts.push({ user_id: uid, key: c.key, value: c.value, updated_at: now });
    });

    const jobs = [];
    if (upserts.length) {
      jobs.push(
        sb.from("user_data").upsert(upserts, { onConflict: "user_id,key" })
          .then(function (res) { if (res.error) throw res.error; })
      );
    }
    if (deletes.length) {
      jobs.push(
        sb.from("user_data").delete().eq("user_id", uid).in("key", deletes)
          .then(function (res) { if (res.error) throw res.error; })
      );
    }
    return Promise.all(jobs);
  }
};

/* ============================================================
   Login screen
   ============================================================ */
const AuthUI = {
  /* The card has three faces: signing in, asking for a reset link, and
     choosing a new password. Only one shows at a time. */
  panels: {
    main:  ["authMain", "authMainActions"],
    reset: ["authReset", "authResetActions"],
    fresh: ["authNew", "authNewActions"],
    unlock: ["authUnlock", "authUnlockActions"]
  },
  subtitles: {
    main:  "Your week, and how it actually felt.",
    reset: "Enter your email and we'll send you a reset link.",
    fresh: "Choose a new password for your account.",
    unlock: "Unlock your entries to continue."
  },

  panel: function (name) {
    const self = this;
    Object.keys(this.panels).forEach(function (key) {
      self.panels[key].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.hidden = (key !== name);
      });
    });
    document.getElementById("authSub").textContent = this.subtitles[name];
    // The demo button belongs to the sign-in face only.
    const demo = document.getElementById("authDemo");
    if (demo && name !== "main") demo.hidden = true;
    this.message("");
  },

  show: function () {
    document.getElementById("authGate").hidden = false;
    const first = document.getElementById("authEmail");
    if (first && !first.hidden) first.focus();
  },
  hide: function () {
    document.getElementById("authGate").hidden = true;
  },
  message: function (text, isError) {
    const el = document.getElementById("authMsg");
    el.textContent = text || "";
    el.className = "auth-msg" + (isError ? " error" : "");
  },
  busy: function (on) {
    ["authSignIn", "authSignUp", "resetSend", "newSave"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.disabled = on;
    });
  }
};

/* "ADRIEN" -> "adrien.tabor@tufts.edu". Anything not in the map is used as-is. */
function expandEmail(raw) {
  const typed = (raw || "").trim();
  if (typeof EMAIL_SHORTCUTS === "object" && EMAIL_SHORTCUTS) {
    const hit = EMAIL_SHORTCUTS[typed.toLowerCase()];
    if (hit) return hit;
  }
  return typed;
}

/* ---- Temporary: password padding ----
   Supabase enforces a minimum password length (6 by default). Appending
   this to every password lets you type a short one while testing without
   touching that setting.

   It's applied on sign-up and sign-in alike, so the two always match.
   Set it to "" to switch this off — but note that doing so, or changing
   the value, locks out any account created under the old setting. */
const PASSWORD_PAD = "000000";

function readAuthForm() {
  const typed = document.getElementById("authPassword").value;
  return {
    email: expandEmail(document.getElementById("authEmail").value),
    // An empty box is allowed for now: the padding alone clears Supabase's
    // minimum length. See the warning in crypto.js about what that costs.
    password: typed + PASSWORD_PAD,
    typed: typed
  };
}

/* Shared by both buttons: validate, run, then start the app. */
function handleAuth(mode) {
  const form = readAuthForm();
  if (!form.email) {
    AuthUI.message("Enter an email.", true);
    return;
  }
  // Password rules live in Supabase (Authentication -> Providers -> Email), so
  // there's no second copy of them here to drift out of sync. If a password is
  // rejected, Supabase's own message is what gets shown below.

  AuthUI.busy(true);
  AuthUI.message(mode === "signup" ? "Creating your account\u2026" : "Signing in\u2026");

  const run = (mode === "signup")
    ? Auth.signUp(form.email, form.password)
    : Auth.signIn(form.email, form.password);

  run.then(function (result) {
    if (mode === "signup" && result && result.needsConfirmation) {
      AuthUI.busy(false);
      AuthUI.message("Check your email to confirm, then sign in.");
      return;
    }
    AuthUI.hide();
    return startApp(form.password);
  }).catch(function (e) {
    AuthUI.busy(false);
    AuthUI.message(e && e.message ? e.message : "Something went wrong.", true);
  });
}

document.getElementById("authSignIn").addEventListener("click", function () { handleAuth("signin"); });
document.getElementById("authSignUp").addEventListener("click", function () { handleAuth("signup"); });
document.getElementById("authPassword").addEventListener("keydown", function (e) {
  if (e.key === "Enter") handleAuth("signin");
});

/* ---- Forgot password ---- */
document.getElementById("authForgot").addEventListener("click", function () {
  AuthUI.panel("reset");
  // Carry over whatever they already typed, so they don't retype it.
  const typed = document.getElementById("authEmail").value.trim();
  if (typed) document.getElementById("resetEmail").value = typed;
  document.getElementById("resetEmail").focus();
});

document.getElementById("resetCancel").addEventListener("click", function () {
  AuthUI.panel("main");
});

document.getElementById("resetSend").addEventListener("click", function () {
  const email = expandEmail(document.getElementById("resetEmail").value);
  if (!email) { AuthUI.message("Enter the email for your account.", true); return; }

  AuthUI.busy(true);
  AuthUI.message("Sending\u2026");
  Auth.requestReset(email).then(function () {
    AuthUI.busy(false);
    // Deliberately not "we found your account" — that would confirm to a
    // stranger whether an address is registered here.
    AuthUI.message("If that email has an account, a reset link is on its way.");
  }).catch(function (e) {
    AuthUI.busy(false);
    AuthUI.message(e && e.message ? e.message : "Couldn't send the link.", true);
  });
});

document.getElementById("resetEmail").addEventListener("keydown", function (e) {
  if (e.key === "Enter") document.getElementById("resetSend").click();
});

/* ---- Set a new password (arrived via the emailed link) ---- */
document.getElementById("newSave").addEventListener("click", function () {
  const typed = document.getElementById("newPassword").value;
  if (!typed) { AuthUI.message("Enter a new password.", true); return; }

  AuthUI.busy(true);
  AuthUI.message("Saving\u2026");
  Auth.setPassword(typed).then(function () {
    AuthUI.hide();
    AuthUI.panel("main");
    return startApp();
  }).catch(function (e) {
    AuthUI.busy(false);
    AuthUI.message(e && e.message ? e.message : "Couldn't save that password.", true);
  });
});

document.getElementById("newPassword").addEventListener("keydown", function (e) {
  if (e.key === "Enter") document.getElementById("newSave").click();
});

/* ---- Unlock (return visit, or after a password reset) ---- */
document.getElementById("useRecovery").addEventListener("click", function () {
  document.getElementById("recoveryField").hidden = false;
  document.getElementById("recoveryKey").focus();
});

document.getElementById("unlockGo").addEventListener("click", function () {
  const typed = document.getElementById("unlockPassword").value;
  const recovery = document.getElementById("recoveryKey").value.trim();
  const password = typed + PASSWORD_PAD;

  AuthUI.busy(true);
  AuthUI.message("Unlocking\u2026");

  // A recovery key replaces the password entirely: it re-wraps the data key
  // under whatever password is in the box now.
  const run = recovery
    ? Vault.unlockWithRecovery(recovery, password, Auth.user.id).then(function () { return "unlocked"; })
    : Vault.unlock(password, Auth.user.id);

  run.then(function (result) {
    if (result === "wrong-password") {
      AuthUI.busy(false);
      AuthUI.message("That password can't unlock your entries. Use your recovery key.", true);
      document.getElementById("recoveryField").hidden = false;
      return;
    }
    AuthUI.hide();
    Store._backend = encrypted(SupabaseBackend);
    return loadAndRun();
  }).catch(function (e) {
    AuthUI.busy(false);
    AuthUI.message(e && e.message ? e.message : "Couldn't unlock.", true);
  });
});

document.getElementById("unlockPassword").addEventListener("keydown", function (e) {
  if (e.key === "Enter") document.getElementById("unlockGo").click();
});

/* ---- Settings: reveal the recovery key ---- */
const showRecoveryBtn = document.getElementById("showRecoveryBtn");
if (showRecoveryBtn) {
  showRecoveryBtn.addEventListener("click", function () {
    Vault.recoveryKey().then(function (key) {
      const out = document.getElementById("recoveryOut");
      if (!key) { out.textContent = "No key loaded."; out.hidden = false; return; }
      out.textContent = key;
      out.hidden = false;
      showRecoveryBtn.textContent = "Hide";
      showRecoveryBtn.onclick = function () {
        out.hidden = true;
        location.reload();   // simplest way back to the original button state
      };
    });
  });
}

/* "Try the demo" — only appears if config.js has demo credentials. */
const demoBtn = document.getElementById("authDemo");
if (demoBtn) {
  const hasDemo =
    typeof DEMO_EMAIL === "string" && DEMO_EMAIL.indexOf("@") > 0 &&
    typeof DEMO_PASSWORD === "string" && DEMO_PASSWORD.length > 0;

  demoBtn.hidden = !hasDemo;
  demoBtn.addEventListener("click", function () {
    document.getElementById("authEmail").value = DEMO_EMAIL;
    document.getElementById("authPassword").value = DEMO_PASSWORD;
    handleAuth("signin");
  });
}

const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", function () {
    Auth.signOut().catch(function (e) { alert("Couldn't sign out: " + e.message); });
  });
}
