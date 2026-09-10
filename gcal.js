/* ============================================================
   gcal.js — front-end for Google Calendar connection (Phase 1).

   Drives the Connect / Disconnect buttons in Settings. It calls our own
   serverless endpoints under /api/, authenticating with the user's Supabase
   access token. The browser never handles Google tokens — those live only on
   the server. Phase 2 will add the actual event pull.
   ============================================================ */
(function () {
  "use strict";

  // Get the current Supabase access token to authenticate API calls.
  async function accessToken() {
    try {
      if (typeof Auth !== "undefined" && Auth.client) {
        const { data } = await Auth.client.auth.getSession();
        return data && data.session ? data.session.access_token : null;
      }
    } catch (_) {}
    return null;
  }

  async function apiFetch(path, opts) {
    const token = await accessToken();
    if (!token) throw new Error("not-signed-in");
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { Authorization: "Bearer " + token });
    return fetch(path, opts);
  }

  const connectBtn = document.getElementById("gcalConnectBtn");
  const disconnectBtn = document.getElementById("gcalDisconnectBtn");
  const desc = document.getElementById("gcalSyncDesc");

  function setConnectedUI(connected, email) {
    if (!connectBtn || !disconnectBtn) return;
    connectBtn.hidden = connected;
    disconnectBtn.hidden = !connected;
    if (connected && desc) {
      desc.textContent = "Connected" + (email ? " as " + email : "") +
        ". Your Google Calendar is linked to Dayrant.";
    }
  }

  // Check current status on load.
  async function refreshStatus() {
    try {
      const res = await apiFetch("/api/google-status", { method: "GET" });
      if (!res.ok) return;
      const j = await res.json();
      setConnectedUI(!!j.connected, j.email);
    } catch (_) { /* not signed in yet, or backend not deployed — leave default */ }
  }

  if (connectBtn) {
    connectBtn.addEventListener("click", async function () {
      const token = await accessToken();
      if (!token) { alert("Please sign in first."); return; }
      // Navigate to the connect endpoint; it redirects to Google. We pass the
      // token via a short-lived query so the top-level navigation is authed
      // (a plain link can't send an Authorization header).
      window.location.href = "/api/google-connect?token=" + encodeURIComponent(token);
    });
  }
  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", async function () {
      if (!confirm("Disconnect Google Calendar? Your synced events stay, but will no longer update.")) return;
      try {
        await apiFetch("/api/google-status", { method: "DELETE" });
      } catch (_) {}
      setConnectedUI(false);
      if (desc) desc.textContent = "Connect your Google account to sync your calendar with Dayrant. Your events become readable to enable syncing; your journal stays end-to-end encrypted.";
    });
  }

  // If we just came back from Google, show a message based on ?gcal=...
  function handleReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("gcal");
    if (!status) return;
    if (status === "connected") { /* refreshStatus will show it */ }
    else if (status === "denied") alert("Google connection was cancelled.");
    else if (status === "error") alert("Something went wrong connecting to Google. Please try again.");
    // Clean the URL so the message doesn't reappear on refresh.
    const clean = window.location.pathname;
    window.history.replaceState({}, "", clean);
  }

  // Run once the app is ready (Auth available).
  function init() {
    handleReturn();
    refreshStatus();
  }
  if (typeof onAppReady === "function") onAppReady(init);
  else if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
