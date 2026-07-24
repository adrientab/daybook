/* ============================================================
   crypto.js — end-to-end encryption.

   The server stores ciphertext. The keys are derived in your browser and
   never sent anywhere, so Supabase (and anyone who reaches the database)
   sees scrambled values rather than your journal.

   TWO KEYS, on purpose:

     DEK  the data key. Random, generated once, encrypts everything.
     KEK  derived from your password. Its only job is to encrypt the DEK.

   The wrapped DEK is stored on the server as a normal row. Changing your
   password re-wraps the DEK — the data itself is never touched. One random
   key doing the encrypting also means a "recovery key" is possible: it's
   just the DEK, written out for you to keep somewhere safe.

   WHAT IS STILL VISIBLE TO THE SERVER: row keys ("daily-2026-07-14"),
   and when rows were written. So someone with database access can tell
   which days you journaled, but not a word of what you wrote. Hiding the
   key names too is possible; it's not done here.

   A WARNING ABOUT EMPTY PASSWORDS: the KEK comes from your password. With
   an empty one, the key is derived from a value anyone can guess, so the
   encryption protects nothing. Fine while testing, not for real entries.
   ============================================================ */

const CRYPTO_PREFIX = "v1:";      // marks a value as encrypted by this scheme
const KEY_BUNDLE_KEY = "__keybundle";
const DEK_CACHE_KEY = "__dek";    // device-local cache, so return visits don't re-prompt
const PBKDF2_ITERATIONS = 250000; // deliberately slow, to blunt guessing

/* ---- small helpers ---- */
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

const Vault = {
  dek: null,

  isUnlocked: function () { return !!this.dek; },

  /* Turn a password into an AES key. The salt is the user's id: it doesn't
     need to be secret, only unique per account, and a UUID is both. */
  deriveKek: function (password, userId) {
    const enc = new TextEncoder();
    return crypto.subtle
      .importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (material) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: enc.encode("daybook:" + userId),
            iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
          material,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      });
  },

  /* ---- the wrapped data key, stored server-side as a normal row ---- */
  fetchBundle: function () {
    return Auth.client.from("user_data")
      .select("value").eq("key", KEY_BUNDLE_KEY).maybeSingle()
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data ? res.data.value : null;
      });
  },
  saveBundle: function (value) {
    return Auth.client.from("user_data")
      .upsert({ user_id: Auth.user.id, key: KEY_BUNDLE_KEY, value: value,
                updated_at: new Date().toISOString() }, { onConflict: "user_id,key" })
      .then(function (res) { if (res.error) throw res.error; });
  },

  wrapDek: function (kek, rawDek) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, kek, rawDek)
      .then(function (ct) { return bufToB64(iv) + "." + bufToB64(ct); });
  },
  unwrapDek: function (kek, bundle) {
    const parts = String(bundle).split(".");
    const iv = new Uint8Array(b64ToBuf(parts[0]));
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, kek, b64ToBuf(parts[1]));
  },

  importDek: function (rawDek) {
    const self = this;
    return crypto.subtle
      .importKey("raw", rawDek, { name: "AES-GCM" }, true, ["encrypt", "decrypt"])
      .then(function (key) {
        self.dek = key;
        try { localStorage.setItem(DEK_CACHE_KEY, bufToB64(rawDek)); } catch (e) { /* ignore */ }
        return key;
      });
  },

  /* Reuse the key cached on this device, so a returning visit with a live
     session doesn't have to ask for the password again. */
  unlockFromCache: function () {
    let cached = null;
    try { cached = localStorage.getItem(DEK_CACHE_KEY); } catch (e) { /* ignore */ }
    if (!cached) return Promise.resolve(false);
    const self = this;
    return this.importDek(b64ToBuf(cached))
      .then(function () { return true; })
      .catch(function () { self.forgetCache(); return false; });
  },

  /* Normal path: unlock with the password. Creates the key on first use. */
  unlock: function (password, userId) {
    const self = this;
    let kek;
    return this.deriveKek(password, userId)
      .then(function (k) { kek = k; return self.fetchBundle(); })
      .then(function (bundle) {
        if (!bundle) {
          // First time on this account: make a data key and wrap it.
          const rawDek = crypto.getRandomValues(new Uint8Array(32));
          return self.wrapDek(kek, rawDek)
            .then(function (wrapped) { return self.saveBundle(wrapped); })
            .then(function () { return self.importDek(rawDek.buffer); })
            .then(function () { return "created"; });
        }
        return self.unwrapDek(kek, bundle)
          .then(function (rawDek) { return self.importDek(rawDek); })
          .then(function () { return "unlocked"; })
          .catch(function () { return "wrong-password"; });
      });
  },

  /* After a password reset the old password is gone, so the DEK can't be
     unwrapped. The recovery key is the DEK itself — this re-wraps it under
     the new password. */
  unlockWithRecovery: function (recoveryB64, newPassword, userId) {
    const self = this;
    let rawDek;
    try { rawDek = b64ToBuf(recoveryB64.trim()); }
    catch (e) { return Promise.reject(new Error("That doesn't look like a recovery key.")); }
    if (rawDek.byteLength !== 32) {
      return Promise.reject(new Error("That doesn't look like a recovery key."));
    }
    return this.deriveKek(newPassword, userId)
      .then(function (kek) { return self.wrapDek(kek, rawDek); })
      .then(function (wrapped) { return self.saveBundle(wrapped); })
      .then(function () { return self.importDek(rawDek); });
  },

  /* Re-wrap the existing data key under a new password. Used after a
     password change so the data stays readable. */
  rewrap: function (newPassword, userId) {
    if (!this.dek) return Promise.reject(new Error("Nothing to re-wrap."));
    const self = this;
    return crypto.subtle.exportKey("raw", this.dek)
      .then(function (rawDek) {
        return self.deriveKek(newPassword, userId)
          .then(function (kek) { return self.wrapDek(kek, rawDek); });
      })
      .then(function (wrapped) { return self.saveBundle(wrapped); });
  },

  recoveryKey: function () {
    if (!this.dek) return Promise.resolve(null);
    return crypto.subtle.exportKey("raw", this.dek).then(bufToB64);
  },

  forgetCache: function () {
    try { localStorage.removeItem(DEK_CACHE_KEY); } catch (e) { /* ignore */ }
  },
  lock: function () { this.dek = null; this.forgetCache(); },

  /* ---- per-value encryption ---- */
  encrypt: function (plain) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle
      .encrypt({ name: "AES-GCM", iv: iv }, this.dek, new TextEncoder().encode(plain))
      .then(function (ct) { return CRYPTO_PREFIX + bufToB64(iv) + "." + bufToB64(ct); });
  },

  decrypt: function (stored) {
    // Rows written before encryption was switched on aren't prefixed. Pass
    // them through untouched; they get encrypted the next time they're saved.
    if (typeof stored !== "string" || stored.indexOf(CRYPTO_PREFIX) !== 0) {
      return Promise.resolve(stored);
    }
    const parts = stored.slice(CRYPTO_PREFIX.length).split(".");
    const iv = new Uint8Array(b64ToBuf(parts[0]));
    return crypto.subtle
      .decrypt({ name: "AES-GCM", iv: iv }, this.dek, b64ToBuf(parts[1]))
      .then(function (buf) { return new TextDecoder().decode(buf); });
  }
};

/* ============================================================
   encrypted(backend) — wraps any backend so values are encrypted on the
   way out and decrypted on the way in. Because it has the same two
   methods, the rest of the app can't tell the difference.
   ============================================================ */
function encrypted(inner) {
  return {
    name: inner.name + "+encrypted",

    loadAll: function () {
      return inner.loadAll().then(function (raw) {
        const keys = Object.keys(raw).filter(function (k) { return k !== KEY_BUNDLE_KEY; });
        const out = {};
        return Promise.all(keys.map(function (k) {
          return Vault.decrypt(raw[k])
            .then(function (plain) { out[k] = plain; })
            .catch(function () {
              // One unreadable row shouldn't take down the whole app.
              console.warn("Couldn't decrypt", k, "— skipping it.");
            });
        })).then(function () { return out; });
      });
    },

    saveMany: function (changes) {
      return Promise.all(changes.map(function (c) {
        if (c.value === null) return Promise.resolve(c);   // deletes need no key
        return Vault.encrypt(c.value).then(function (ct) {
          return { key: c.key, value: ct };
        });
      })).then(inner.saveMany);
    }
  };
}
