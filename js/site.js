/* =====================================================================
   Faith Based Pilot — shared site behaviour
   - Theme (light default / optional dark) with localStorage
   - Mobile navigation drawer
   - Footer year
   - The Hangar: search + article modal + deep links + share
   - The Logbook: builds file library from source list, search + filter
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- Copyright year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- ATC (site admin) link in the footer ---------- */
  document.querySelectorAll(".footer-bottom p").forEach(function (p) {
    if (p.querySelector('a[href^="https://atc.faithbasedpilot.org"]')) return;
    var a = document.createElement("a");
    a.href = "https://atc.faithbasedpilot.org/";
    a.textContent = "ATC";
    a.title = "Site admin";
    a.rel = "nofollow";
    p.appendChild(document.createTextNode(" · "));
    p.appendChild(a);
  });

  /* ---------- Valiant Faith initiative navigation ---------- */
  document.querySelectorAll("#primary-nav, .footer-nav").forEach(function (nav) {
    if (nav.querySelector('a[href="valiant-faith.html"]')) return;
    var link = document.createElement("a");
    link.href = "valiant-faith.html";
    link.textContent = "Valiant Faith";
    if (window.location.pathname.endsWith("/valiant-faith.html")) link.setAttribute("aria-current", "page");
    var contact = nav.querySelector('a[href="fbp.html#contact"]');
    nav.insertBefore(link, contact);
  });

  /* ---------- Mobile nav ---------- */
  (function nav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var menu = document.getElementById("primary-nav");
    var backdrop = document.querySelector("[data-nav-backdrop]");
    if (!toggle || !menu) return;
    function close() {
      menu.classList.remove("open");
      if (backdrop) backdrop.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    function open() {
      menu.classList.add("open");
      if (backdrop) backdrop.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
    toggle.addEventListener("click", function () {
      menu.classList.contains("open") ? close() : open();
    });
    if (backdrop) backdrop.addEventListener("click", close);
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) close();
    });
    window.matchMedia("(min-width: 1101px)").addEventListener("change", function (m) {
      if (m.matches) close();
    });
  })();

  /* ---------- The Hangar: modal reader + search + share ---------- */
  /* ---------- Listen: narrated audio for Hangar posts and Logbook papers ----------
     audio/manifest.json (published from ATC) lists each recording and its MP3 part(s).
     One player bar at the bottom of the screen keeps playing while you scroll, and
     shows on the phone lock screen (Media Session), so it works for listening on the road. */
  var FBPListen = (function () {
    var manifestP = fetch("audio/manifest.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : { items: {} }; })
      .catch(function () { return { items: {} }; });
    var bar = null, audio = null, nowKey = null, parts = [], partIdx = 0;

    // Same rule as ATC and the narration engine (keys must match).
    function slugify(s) { return String(s).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80); }
    function mins(sec) { var m = Math.max(1, Math.round((sec || 0) / 60)); return m + " min"; }
    var playSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
    var headSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';

    var SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.85];
    var speed = 1;
    try { speed = parseFloat(localStorage.getItem("fbpListenSpeed")) || 1; } catch (e) {}
    function fmt(t) { t = Math.max(0, Math.floor(t || 0)); var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); }
    var ICON = {
      play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></svg>',
      pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/></svg>',
      back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>',
      fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/></svg>',
    };

    // Big, thumb-friendly controls (usable on the road): play/pause, back 15 s, ahead 30 s,
    // a thick seek bar, and playback speed. Lock-screen / car controls via Media Session.
    function ensureBar() {
      if (bar) return;
      bar = document.createElement("div");
      bar.className = "listen-bar";
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Audio player");
      bar.innerHTML =
        '<div class="listen-bar__top">' +
          '<span class="listen-bar__icon">' + headSVG + '</span>' +
          '<div class="listen-bar__info"><div class="listen-bar__label">Now playing</div><div class="listen-bar__title"></div></div>' +
          '<button type="button" class="listen-bar__close" aria-label="Close player">&times;</button>' +
        '</div>' +
        '<div class="listen-bar__seek">' +
          '<span class="listen-bar__time" data-now>0:00</span>' +
          '<input type="range" class="listen-bar__range" min="0" max="1000" step="1" value="0" aria-label="Seek" />' +
          '<span class="listen-bar__time" data-left>-0:00</span>' +
        '</div>' +
        '<div class="listen-bar__controls">' +
          '<button type="button" class="listen-bar__btn" data-act="back" aria-label="Back 15 seconds">' + ICON.back + '<span>15</span></button>' +
          '<button type="button" class="listen-bar__btn listen-bar__play" data-act="play" aria-label="Play">' + ICON.play + '</button>' +
          '<button type="button" class="listen-bar__btn" data-act="fwd" aria-label="Ahead 30 seconds">' + ICON.fwd + '<span>30</span></button>' +
          '<button type="button" class="listen-bar__speed" data-act="speed" aria-label="Playback speed">1×</button>' +
        '</div>' +
        '<audio preload="metadata"></audio>';
      document.body.appendChild(bar);
      audio = bar.querySelector("audio");
      var range = bar.querySelector(".listen-bar__range"), dragging = false;
      var playBtn = bar.querySelector(".listen-bar__play"), speedBtn = bar.querySelector(".listen-bar__speed");

      function skip(d) { if (audio.duration) audio.currentTime = Math.min(Math.max(0, audio.currentTime + d), audio.duration - 0.25); }
      function sync() {
        var d = audio.duration || 0, t = audio.currentTime || 0;
        if (!dragging) range.value = d ? Math.round(t / d * 1000) : 0;
        range.style.setProperty("--pct", (d ? t / d * 100 : 0) + "%");
        bar.querySelector("[data-now]").textContent = fmt(t);
        bar.querySelector("[data-left]").textContent = "-" + fmt(d - t);
        if ("mediaSession" in navigator && navigator.mediaSession.setPositionState && d) {
          try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(t, d), playbackRate: audio.playbackRate }); } catch (e) {}
        }
      }
      function paint() {
        var on = !audio.paused;
        playBtn.innerHTML = on ? ICON.pause : ICON.play;
        playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = on ? "playing" : "paused";
      }
      function setSpeed(v) {
        speed = v; audio.playbackRate = v; audio.defaultPlaybackRate = v;
        speedBtn.textContent = (v % 1 ? v : v.toFixed(0)) + "×";
        try { localStorage.setItem("fbpListenSpeed", String(v)); } catch (e) {}
      }
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var act = b.getAttribute("data-act");
        if (act === "play") { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); }
        else if (act === "back") skip(-15);
        else if (act === "fwd") skip(30);
        else if (act === "speed") setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
      });
      range.addEventListener("input", function () { dragging = true; var d = audio.duration || 0; bar.querySelector("[data-now]").textContent = fmt(range.value / 1000 * d); range.style.setProperty("--pct", range.value / 10 + "%"); });
      range.addEventListener("change", function () { dragging = false; if (audio.duration) audio.currentTime = range.value / 1000 * audio.duration; });
      ["timeupdate", "durationchange", "loadedmetadata", "seeked"].forEach(function (ev) { audio.addEventListener(ev, sync); });
      ["play", "pause", "ended"].forEach(function (ev) { audio.addEventListener(ev, paint); });
      audio.addEventListener("loadedmetadata", function () { audio.playbackRate = speed; });
      audio.addEventListener("ended", function () {
        if (partIdx + 1 < parts.length) { partIdx++; setPart(); audio.play().catch(function () {}); }
      });
      bar.querySelector(".listen-bar__close").addEventListener("click", function () {
        audio.pause(); audio.removeAttribute("src"); audio.load();
        bar.classList.remove("open"); document.body.classList.remove("has-listen-bar"); nowKey = null;
      });
      if ("mediaSession" in navigator) {
        var ms = navigator.mediaSession, h = function (a, f) { try { ms.setActionHandler(a, f); } catch (e) {} };
        h("play", function () { audio.play(); });
        h("pause", function () { audio.pause(); });
        h("seekbackward", function (d) { skip(-((d && d.seekOffset) || 15)); });
        h("seekforward", function (d) { skip((d && d.seekOffset) || 30); });
        h("seekto", function (d) { if (d && d.seekTime != null) audio.currentTime = d.seekTime; });
        h("previoustrack", function () { if (partIdx > 0) { partIdx--; setPart(); audio.play(); } else audio.currentTime = 0; });
        h("nexttrack", function () { if (partIdx + 1 < parts.length) { partIdx++; setPart(); audio.play(); } });
      }
      setSpeed(speed);
    }
    function setPart() {
      audio.src = parts[partIdx];
      audio.playbackRate = speed;
      var t = bar.querySelector(".listen-bar__title");
      bar.querySelector(".listen-bar__label").textContent = parts.length > 1 ? "Now playing · part " + (partIdx + 1) + " of " + parts.length : "Now playing";
      if ("mediaSession" in navigator && window.MediaMetadata) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: t.textContent, artist: "Faith Based Pilot", album: nowKey.indexOf("logbook/") === 0 ? "The Logbook" : "The Hangar",
          artwork: [{ src: "images/compasslogo.png", sizes: "512x512", type: "image/png" }],
        });
      }
    }
    function play(key, title, entry) {
      ensureBar();
      if (nowKey === key) { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); return; }
      nowKey = key; partIdx = 0;
      parts = entry.parts.map(function (p) { return p.file + "?v=" + (entry.v || ""); });
      bar.querySelector(".listen-bar__title").textContent = title || entry.title;
      setPart();
      bar.classList.add("open"); document.body.classList.add("has-listen-bar");
      audio.play().catch(function () {});
    }
    function button(key, title, entry, extraClass) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "listen-btn" + (extraClass ? " " + extraClass : "");
      b.innerHTML = playSVG + '<span>Listen</span><span class="listen-btn__len">' + mins(entry.seconds) + "</span>";
      b.setAttribute("aria-label", "Listen to " + (title || entry.title) + ", " + mins(entry.seconds));
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); play(key, title, entry); });
      b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); });
      return b;
    }
    return {
      slugify: slugify,
      // Put a Listen button at the top of `container` if `key` has audio.
      prepend: function (container, key, title) {
        manifestP.then(function (m) {
          var entry = m.items && m.items[key];
          if (!entry || !container || container.querySelector(".listen-btn")) return;
          container.insertBefore(button(key, title, entry, "listen-btn--lead"), container.firstChild);
        });
      },
      // Put a Listen button on a card, right after `afterEl` (e.g. its date line).
      card: function (afterEl, key, title) {
        manifestP.then(function (m) {
          var entry = m.items && m.items[key];
          if (!entry || !afterEl || !afterEl.parentNode) return;
          if (afterEl.parentNode.querySelector(":scope > .listen-btn")) return;
          afterEl.parentNode.insertBefore(button(key, title, entry, "listen-btn--card"), afterEl.nextSibling);
        });
      },
    };
  })();

  // Home page post cards (link to thehangar.html?post=<slug>): Listen on the card.
  document.querySelectorAll('a.post-card[href*="post="]').forEach(function (a) {
    var slug = (a.getAttribute("href").match(/[?&]post=([^&#]+)/) || [])[1];
    var meta = a.querySelector(".post-card__meta");
    var title = (a.querySelector(".post-card__title") || {}).textContent || "";
    if (slug && meta) FBPListen.card(meta, "hangar/" + decodeURIComponent(slug), title.trim());
  });

  (function hangar() {
    var grid = document.getElementById("article-grid");
    var modal = document.getElementById("postModal");
    if (!grid || !modal) return;

    var mTitle = document.getElementById("modalTitle");
    var mMeta = document.getElementById("modalMeta");
    var mBody = document.getElementById("modalBody");
    var closeBtn = modal.querySelector(".modal__close");
    var backdrop = modal.querySelector(".modal__backdrop");
    var copyStatus = document.getElementById("copyStatus");
    var lastTrigger = null, currentSlug = null;

    function shareURL(slug) {
      // used for in-page history state so the modal + back/forward keep working
      var u = new URL(window.location.href);
      u.searchParams.set("post", slug);
      u.hash = "";
      return u.toString();
    }
    function canonicalURL(slug) {
      // the real, shareable page whose static meta tags drive link previews
      return new URL(slug + ".html", window.location.href).toString();
    }

    function wireShare(title, date, slug) {
      var url = canonicalURL(slug);
      var text = title + (date ? " — " + date : "");
      var byId = function (id) { return document.getElementById(id); };
      var web = byId("btnWebShare"), copy = byId("btnCopyLink"),
          fb = byId("btnFacebook"), x = byId("btnX"),
          email = byId("btnEmail"), sms = byId("btnSMS");
      if (web) web.onclick = function () {
        if (navigator.share) { navigator.share({ title: title, text: text, url: url }).catch(function(){}); }
        else copyToClip(url);
      };
      if (copy) copy.onclick = function (e) { e.preventDefault(); copyToClip(url); };
      if (fb) fb.href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url);
      if (x) x.href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url);
      if (email) email.href = "mailto:?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(text + "\n\n" + url);
      if (sms) sms.href = "sms:?&body=" + encodeURIComponent(text + " " + url);
    }
    function copyToClip(url) {
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () {
        if (copyStatus) { copyStatus.textContent = "Link copied"; setTimeout(function () { copyStatus.textContent = ""; }, 2000); }
      });
    }

    function openCard(card, push) {
      var summary = card.querySelector("summary");
      var title = (card.getAttribute("data-title") || (summary.querySelector(".title") || {}).textContent || "").trim();
      var date = (card.getAttribute("data-date") || "").trim();
      var slug = card.getAttribute("data-slug") || "";
      mTitle.textContent = title;
      mMeta.textContent = date;
      mBody.innerHTML = card.querySelector(".content") ? card.querySelector(".content").innerHTML : "";
      modal.classList.add("open");
      document.body.style.overflow = "hidden";
      lastTrigger = summary; currentSlug = slug;
      modal.querySelector(".modal__sheet").scrollTop = 0;
      if (push !== false) history.pushState({ post: slug }, "", shareURL(slug));
      wireShare(title, date, slug);
      closeBtn.focus();
    }
    function closeModal(pop) {
      modal.classList.remove("open");
      document.body.style.overflow = "";
      mBody.innerHTML = "";
      if (lastTrigger) lastTrigger.focus();
      if (pop) {
        var u = new URL(window.location.href);
        u.searchParams.delete("post");
        history.pushState(null, "", u.toString());
      }
      currentSlug = null;
    }

    grid.querySelectorAll("details.card").forEach(function (card) {
      var summary = card.querySelector("summary");
      FBPListen.card(summary.querySelector(".meta"), "hangar/" + card.getAttribute("data-slug"), card.getAttribute("data-title"));
      // Keep native <details> from toggling; we use the modal instead.
      card.addEventListener("toggle", function () { if (card.open) card.removeAttribute("open"); });
      summary.setAttribute("role", "button");
      summary.setAttribute("tabindex", "0");
      summary.addEventListener("click", function (e) { e.preventDefault(); openCard(card, true); });
      summary.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(card, true); }
      });
    });

    closeBtn.addEventListener("click", function () { closeModal(true); });
    if (backdrop) backdrop.addEventListener("click", function () { closeModal(true); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("open")) closeModal(true);
    });
    window.addEventListener("popstate", function () {
      var slug = new URLSearchParams(window.location.search).get("post");
      if (slug) {
        if (!modal.classList.contains("open") || slug !== currentSlug) {
          var card = grid.querySelector('details.card[data-slug="' + slug + '"]');
          if (card) openCard(card, false);
        }
      } else if (modal.classList.contains("open")) closeModal(false);
    });

    // Search
    var search = document.getElementById("hangarSearch");
    var count = document.getElementById("hangarCount");
    var none = document.getElementById("hangarNoResults");
    var cards = Array.prototype.slice.call(grid.querySelectorAll("details.card"));
    function filter() {
      var q = (search.value || "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var hay = ((card.getAttribute("data-title") || "") + " " +
                   (card.querySelector(".content") ? card.querySelector(".content").textContent : "")).toLowerCase();
        var match = !q || hay.indexOf(q) !== -1;
        card.style.display = match ? "" : "none";
        if (match) shown++;
      });
      if (count) count.textContent = shown + (shown === 1 ? " teaching" : " teachings");
      if (none) none.style.display = shown ? "none" : "block";
    }
    if (search) { search.addEventListener("input", filter); filter(); }

    // Deep link on load
    var initial = new URLSearchParams(window.location.search).get("post");
    if (initial) {
      var card = grid.querySelector('details.card[data-slug="' + initial + '"]');
      if (card) openCard(card, false);
    }
  })();

  /* ---------- The Logbook: build library, search + filter ---------- */
  (function logbook() {
    var raw = document.getElementById("raw");
    var out = document.getElementById("logbook");
    if (!raw || !out) return;

    // Parse the source list into categories -> resources
    var cats = [];
    var current = null;
    Array.prototype.forEach.call(raw.childNodes, function (node) {
      if (node.nodeType === 1 && node.tagName === "H2") {
        current = { title: node.textContent.trim(), items: [] };
        cats.push(current);
      } else if (node.nodeType === 1 && node.tagName === "A" && current) {
        var file = (node.getAttribute("data-filename") || "").trim();
        if (!file) return;
        // Trailing text sibling may carry "(date, pdf)" metadata
        var trailing = "";
        var sib = node.nextSibling;
        while (sib && !(sib.nodeType === 1 && (sib.tagName === "A" || sib.tagName === "H2"))) {
          if (sib.nodeType === 3) trailing += sib.textContent;
          sib = sib.nextSibling;
        }
        var ext = (file.split(".").pop() || "").toLowerCase();
        current.items.push({
          title: node.textContent.trim(),
          file: file,
          summary: (node.getAttribute("data-summary") || "").trim(),
          ext: ext,
          meta: trailing.replace(/[-–|]/g, " ").replace(/[()]/g, " ").replace(/\s+/g, " ").trim()
        });
      }
    });

    function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    var downloadSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>';
    var openSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

    function render(cat) {
      var sec = document.createElement("section");
      sec.className = "logbook-section";
      sec.setAttribute("data-cat", cat.title);
      var dateMatch = cat.title.match(/\(([^)]+)\)\s*$/);
      var name = cat.title.replace(/\s*\([^)]*\)\s*$/, "");
      // Anchor id so links like logbook.html#spirit-of-elijah land on this section
      sec.id = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      sec.innerHTML =
        '<h2>' + esc(name) + (dateMatch ? ' <span class="date">' + esc(dateMatch[1]) + '</span>' : '') + '</h2>' +
        '<div class="logbook-grid"></div>';
      var g = sec.querySelector(".logbook-grid");
      cat.items.forEach(function (it) {
        var href = "logbook-files/" + encodeURI(it.file);
        var isPdf = it.ext === "pdf";
        var a = document.createElement("a");
        a.className = "file-card";
        a.href = href;
        a.setAttribute("data-title", (it.title + " " + it.summary).toLowerCase());
        if (isPdf) a.setAttribute("download", "");
        else { a.target = "_blank"; a.rel = "noopener"; }
        a.innerHTML =
          '<span class="file-card__icon ' + it.ext + '">' + it.ext.toUpperCase() + '</span>' +
          '<span><span class="file-card__title">' + esc(it.title) + '</span>' +
          (it.summary ? '<span class="file-card__summary">' + esc(it.summary) + '</span>' : '') +
          '<span class="file-card__meta">' + (it.meta ? esc(it.meta) : (isPdf ? "PDF study" : "Image")) + '</span></span>' +
          '<span class="file-card__action" aria-hidden="true">' + (isPdf ? downloadSVG : openSVG) + '</span>';
        if (isPdf) FBPListen.card(a.querySelector(".file-card__meta"), "logbook/" + FBPListen.slugify(it.file.replace(/\.[^.]+$/, "")), it.title);
        g.appendChild(a);
      });
      return sec;
    }

    cats.forEach(function (c) { out.appendChild(render(c)); });
    raw.style.display = "none";

    // Sections are built after the page loads, so the browser can't jump to #section on its own
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }

    // Category chips
    var chipbar = document.getElementById("logbookCats");
    if (chipbar) {
      var mkChip = function (label, val) {
        var b = document.createElement("button");
        b.className = "chip"; b.type = "button"; b.textContent = label;
        b.setAttribute("data-filter", val);
        b.setAttribute("aria-pressed", val === "all" ? "true" : "false");
        return b;
      };
      chipbar.appendChild(mkChip("All", "all"));
      cats.forEach(function (c) {
        var name = c.title.replace(/\s*\([^)]*\)\s*$/, "");
        chipbar.appendChild(mkChip(name, c.title));
      });
      chipbar.addEventListener("click", function (e) {
        var btn = e.target.closest(".chip"); if (!btn) return;
        chipbar.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        var val = btn.getAttribute("data-filter");
        out.querySelectorAll(".logbook-section").forEach(function (s) {
          s.style.display = (val === "all" || s.getAttribute("data-cat") === val) ? "" : "none";
        });
        if (lbSearch) lbSearch.value = "";
        applySearch();
      });
    }

    // Search across all resources
    var lbSearch = document.getElementById("logbookSearch");
    var lbCount = document.getElementById("logbookCount");
    var lbNone = document.getElementById("logbookNoResults");
    function applySearch() {
      var q = (lbSearch ? lbSearch.value : "").trim().toLowerCase();
      var shown = 0;
      out.querySelectorAll(".logbook-section").forEach(function (sec) {
        if (!q) {
          var selected = chipbar && chipbar.querySelector('.chip[aria-pressed="true"]');
          var category = selected ? selected.getAttribute("data-filter") : "all";
          sec.style.display = category === "all" || sec.getAttribute("data-cat") === category ? "" : "none";
          if (sec.style.display === "none") return;
        }
        var secVisible = false;
        sec.querySelectorAll(".file-card").forEach(function (card) {
          var match = !q || (card.getAttribute("data-title") || "").indexOf(q) !== -1;
          card.style.display = match ? "" : "none";
          if (match) { shown++; secVisible = true; }
        });
        if (q) sec.style.display = secVisible ? "" : "none";
      });
      if (lbCount) lbCount.textContent = shown + (shown === 1 ? " resource" : " resources");
      if (lbNone) lbNone.style.display = shown ? "none" : "block";
    }
    if (lbSearch) lbSearch.addEventListener("input", function () {
      if (chipbar && lbSearch.value.trim()) {
        chipbar.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-filter") === "all" ? "true" : "false"); });
      }
      applySearch();
    });
    applySearch();
  })();

})();
