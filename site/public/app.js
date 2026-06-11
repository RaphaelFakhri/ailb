/* ailb — chat + WhatsApp-code login. No deps, no build. */
(function () {
  "use strict";

  var TOKEN_KEY = "ailb_token";
  var PHONE_KEY = "ailb_phone";

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setSession(token, phone) {
    localStorage.setItem(TOKEN_KEY, token);
    if (phone) localStorage.setItem(PHONE_KEY, phone);
    renderAuth();
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PHONE_KEY);
    renderAuth();
  }

  // Normalize Lebanese / international numbers to digits like "96178720415".
  function normalizePhone(raw) {
    var d = String(raw || "").replace(/\D/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    if (d.indexOf("961") === 0 && d.length >= 10) return d;
    if (d.charAt(0) === "0" && d.length === 8) return "961" + d.slice(1);
    if (d.length === 7 || d.length === 8) return "961" + d;
    if (d.length >= 10 && d.length <= 15) return d;
    return null;
  }

  function maskPhone(phone) {
    // "96178720415" -> "+961 •• ••• 415"
    var p = String(phone || "").replace(/\D/g, "");
    var last = p.slice(-3);
    if (p.indexOf("961") === 0) return "+961 •• ••• " + last;
    return "+" + p.slice(0, 3) + " ••• " + last;
  }

  // fetch wrapper that never throws on bad JSON
  function api(path, opts) {
    opts = opts || {};
    var headers = { "content-type": "application/json" };
    var token = getToken();
    if (token) headers["authorization"] = "Bearer " + token;
    return fetch(path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = JSON.parse(text); } catch (e) { /* non-JSON body */ }
        return { status: res.status, ok: res.ok, data: data || {} };
      });
    });
  }

  // ---------- auth UI ----------
  var authBtn = $("auth-btn");
  var logoutBtn = $("logout-btn");

  function renderAuth() {
    var token = getToken();
    var phone = localStorage.getItem(PHONE_KEY);
    if (token && phone) {
      authBtn.textContent = maskPhone(phone);
      authBtn.title = "Logged in via WhatsApp";
      logoutBtn.classList.remove("hidden");
    } else {
      authBtn.textContent = "Log in";
      authBtn.title = "";
      logoutBtn.classList.add("hidden");
    }
  }

  authBtn.addEventListener("click", function () {
    if (!getToken()) openLogin();
  });
  logoutBtn.addEventListener("click", function () {
    clearSession();
    addMsg("system", "Logged out. Your chat history on WhatsApp is untouched.");
  });

  // validate token quietly on load
  if (getToken()) {
    api("/api/me").then(function (r) {
      if (r.status === 401) clearSession();
      else if (r.ok && r.data.phone) localStorage.setItem(PHONE_KEY, r.data.phone);
      renderAuth();
    }).catch(function () { /* offline — keep optimistic */ });
  }

  // ---------- chat panel ----------
  var chatPanel = $("chat-panel");
  var chatMessages = $("chat-messages");
  var chatForm = $("chat-form");
  var chatInput = $("chat-input");
  var chatFab = $("chat-fab");
  var pendingMessage = null; // message waiting for login
  var greeted = false;

  function openChat() {
    chatPanel.classList.remove("hidden");
    chatFab.classList.add("hidden");
    if (!greeted) {
      greeted = true;
      addMsg("agent", "Ahla! I'm ailb — same agent as on WhatsApp.\nSell something, find someone, or start a paperwork file. Shu badak?");
    }
    chatInput.focus();
  }
  function closeChat() {
    chatPanel.classList.add("hidden");
    chatFab.classList.remove("hidden");
  }

  document.querySelectorAll("[data-open-chat]").forEach(function (el) {
    el.addEventListener("click", openChat);
  });
  $("chat-close").addEventListener("click", closeChat);

  function addMsg(kind, text) {
    var div = document.createElement("div");
    div.className = "msg msg-" + kind;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function showTyping() {
    var div = document.createElement("div");
    div.className = "msg msg-typing";
    div.innerHTML = 'ailb is working<span class="dots"></span>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    var slowTimer = setTimeout(function () {
      div.innerHTML = 'still working — the agent actually does things<span class="dots"></span>';
    }, 5000);
    return function remove() {
      clearTimeout(slowTimer);
      if (div.parentNode) div.parentNode.removeChild(div);
    };
  }

  function sendMessage(text) {
    if (!getToken()) {
      pendingMessage = text;
      openLogin();
      return;
    }
    addMsg("user", text);
    var stopTyping = showTyping();
    api("/api/chat", { body: { message: text } }).then(function (r) {
      stopTyping();
      if (r.status === 401) {
        clearSession();
        pendingMessage = text;
        addMsg("system", "Your session expired — log in again and I'll resend that.");
        openLogin();
        return;
      }
      if (r.ok && r.data.reply) {
        addMsg("agent", String(r.data.reply));
      } else {
        addMsg("system", "Couldn't reach the agent (" + (r.data.error || r.status) + "). It might be mid-errand — try sending again.");
      }
    }).catch(function () {
      stopTyping();
      addMsg("system", "Network hiccup — check your connection and try again.");
    });
  }

  chatForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    chatInput.style.height = "auto";
    sendMessage(text);
  });

  // Enter sends, Shift+Enter = newline; textarea auto-grows
  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
  chatInput.addEventListener("input", function () {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  });

  // ---------- login modal ----------
  var loginModal = $("login-modal");
  var stepPhone = $("login-step-phone");
  var stepCode = $("login-step-code");
  var phoneForm = $("phone-form");
  var phoneInput = $("phone-input");
  var phoneError = $("phone-error");
  var codeForm = $("code-form");
  var codeInput = $("code-input");
  var codeError = $("code-error");
  var codePhoneLabel = $("code-phone-label");
  var currentPhone = null; // normalized digits

  function openLogin() {
    loginModal.classList.remove("hidden");
    stepPhone.classList.remove("hidden");
    stepCode.classList.add("hidden");
    phoneError.textContent = "";
    codeError.textContent = "";
    phoneInput.focus();
  }
  function closeLogin() {
    loginModal.classList.add("hidden");
    pendingMessage = null;
  }

  $("login-close").addEventListener("click", closeLogin);
  loginModal.addEventListener("click", function (e) {
    if (e.target === loginModal) closeLogin();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !loginModal.classList.contains("hidden")) closeLogin();
  });

  $("code-back").addEventListener("click", function () {
    stepCode.classList.add("hidden");
    stepPhone.classList.remove("hidden");
    phoneInput.focus();
  });

  phoneForm.addEventListener("submit", function (e) {
    e.preventDefault();
    phoneError.textContent = "";
    var normalized = normalizePhone(phoneInput.value);
    if (!normalized) {
      phoneError.textContent = "That doesn't look like a phone number — try 03 123 456 or +961 71 881 367.";
      return;
    }
    var btn = phoneForm.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Sending…";
    api("/api/login/request", { body: { phone: normalized } }).then(function (r) {
      btn.disabled = false;
      btn.textContent = "Send me a code on WhatsApp";
      if (r.ok) {
        currentPhone = normalized;
        codePhoneLabel.textContent = "+" + normalized;
        stepPhone.classList.add("hidden");
        stepCode.classList.remove("hidden");
        codeInput.value = "";
        codeInput.focus();
      } else if (r.status === 429) {
        phoneError.textContent = "Easy — a code was just sent. Wait a minute, then try again.";
      } else if (r.data.error === "invalid_phone") {
        phoneError.textContent = "We couldn't use that number. Lebanese or international formats work.";
      } else {
        phoneError.textContent = "Couldn't send the code right now — try again in a moment.";
      }
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = "Send me a code on WhatsApp";
      phoneError.textContent = "Network hiccup — check your connection and try again.";
    });
  });

  codeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    codeError.textContent = "";
    var code = codeInput.value.replace(/\D/g, "");
    if (code.length !== 6) {
      codeError.textContent = "The code is 6 digits.";
      return;
    }
    var btn = codeForm.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Verifying…";
    api("/api/login/verify", { body: { phone: currentPhone, code: code } }).then(function (r) {
      btn.disabled = false;
      btn.textContent = "Verify & log in";
      if (r.ok && r.data.token) {
        setSession(r.data.token, r.data.phone || "+" + currentPhone);
        loginModal.classList.add("hidden");
        var retry = pendingMessage;
        pendingMessage = null;
        if (retry) {
          openChat();
          sendMessage(retry);
        }
      } else if (r.data.error === "wrong_code") {
        codeError.textContent = "Wrong code — check the WhatsApp message and try again.";
      } else if (r.data.error === "expired") {
        codeError.textContent = "That code expired. Go back and request a new one.";
      } else if (r.status === 429) {
        codeError.textContent = "Too many tries. Wait a bit, then request a fresh code.";
      } else {
        codeError.textContent = "Couldn't verify right now — try again.";
      }
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = "Verify & log in";
      codeError.textContent = "Network hiccup — try again.";
    });
  });

  renderAuth();
})();
