/* Bible Gateway daily verse. JSONP is their documented cross-origin embed API. */
(function () {
  "use strict";
  var host = document.getElementById("daily-verse");
  if (!host) return;
  var quote = document.getElementById("daily-verse-text");
  var reference = document.getElementById("daily-verse-reference");
  var date = document.getElementById("daily-verse-date");
  var status = document.getElementById("daily-verse-status");
  var active = false;
  var serial = 0;
  function decode(value) {
    var doc = new DOMParser().parseFromString(String(value), "text/html");
    return doc.body.textContent || "";
  }
  function loadVerse() {
    if (active) return;
    active = true;
    var callback = "fbpDailyVerse" + (++serial);
    var script = document.createElement("script");
    var timer;
    function cleanup() {
      clearTimeout(timer);
      script.remove();
      active = false;
      // Leave a harmless callback for a response arriving after the timeout.
      window[callback] = function () {};
    }
    function fail() {
      quote.hidden = true;
      reference.hidden = true;
      date.textContent = "";
      status.hidden = false;
      status.textContent = "The daily verse is temporarily unavailable. Read Scripture in the LSB on Bible Gateway.";
      cleanup();
    }
    window[callback] = function (data) {
      var verse = data && data.votd;
      if (!verse || verse.version_id !== "LSB" || !verse.rawtext || !verse.reference) {
        fail();
        return;
      }
      quote.textContent = decode(verse.rawtext);
      quote.hidden = false;
      reference.textContent = verse.reference + " (LSB)";
      reference.href = "https://www.biblegateway.com/passage/?search=" + encodeURIComponent(verse.reference) + "&version=LSB";
      reference.hidden = false;
      var stamp = new Date(Date.UTC(Number(verse.year), Number(verse.month) - 1, Number(verse.day)));
      date.textContent = Number.isNaN(stamp.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {month:"long",day:"numeric",year:"numeric",timeZone:"UTC"}).format(stamp);
      status.hidden = true;
      cleanup();
    };
    script.src = "https://www.biblegateway.com/votd/get/?format=json&version=LSB&callback=" + callback;
    script.async = true;
    script.onerror = fail;
    timer = setTimeout(fail, 12000);
    document.head.appendChild(script);
  }
  loadVerse();
  // Refresh long-lived tabs as well as newly opened visits.
  setInterval(loadVerse, 60 * 60 * 1000);
})();
