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

const Auth = {
  client: null,
  user: null,
  enabled: false,   // false = no Supabase configured, run local-only

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

  signOut: function () {
    const self = this;
    // Push any pending edits before dropping the session.
    return Store.flush()
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
  show: function () {
    document.getElementById("authGate").hidden = false;
    document.getElementById("authEmail").focus();
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
    document.getElementById("authSignIn").disabled = on;
    document.getElementById("authSignUp").disabled = on;
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
    // Keep an empty box empty, so the "enter a password" check still fires.
    password: typed ? typed + PASSWORD_PAD : ""
  };
}

/* Shared by both buttons: validate, run, then start the app. */
function handleAuth(mode) {
  const form = readAuthForm();
  if (!form.email || !form.password) {
    AuthUI.message("Enter an email and password.", true);
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
    return startApp();
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