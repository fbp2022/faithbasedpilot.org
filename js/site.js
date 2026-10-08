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
    window.matchMedia("(min-width: 861px)").addEventListener("change", function (m) {
      if (m.matches) close();
    });
  })();

  /* ---------- The Hangar: modal reader + search + share ---------- */
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
        a.setAttribute("data-title", it.title.toLowerCase());
        if (isPdf) a.setAttribute("download", "");
        else { a.target = "_blank"; a.rel = "noopener"; }
        a.innerHTML =
          '<span class="file-card__icon ' + it.ext + '">' + it.ext.toUpperCase() + '</span>' +
          '<span><span class="file-card__title">' + esc(it.title) + '</span>' +
          '<span class="file-card__meta">' + (it.meta ? esc(it.meta) : (isPdf ? "PDF study" : "Image")) + '</span></span>' +
          '<span class="file-card__action" aria-hidden="true">' + (isPdf ? downloadSVG : openSVG) + '</span>';
        g.appendChild(a);
      });
      return sec;
    }

    cats.forEach(function (c) { out.appendChild(render(c)); });
    raw.style.display = "none";

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
        if (sec.style.display === "none" && !q) return;
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
