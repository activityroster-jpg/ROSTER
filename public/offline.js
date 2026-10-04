(function () {
  var KEY = "ar.offline.week";
  var data = null;
  try { data = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { data = null; }
  if (!data || !Array.isArray(data.sessions)) return;
  var saved = document.getElementById("saved");
  var when = new Date(data.savedAt);
  saved.textContent = (data.centre ? data.centre + " · " : "") + "saved " + when.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + ". Changes since then won't show until you're back online.";
  var box = document.getElementById("week");
  box.textContent = "";
  if (data.sessions.length === 0) {
    var p = document.createElement("p"); p.className = "empty"; p.textContent = "No sessions in the next 7 days."; box.appendChild(p); return;
  }
  var lastDay = "";
  data.sessions.forEach(function (s) {
    if (s.day !== lastDay) {
      var h = document.createElement("h2"); h.textContent = s.dayLabel; box.appendChild(h); lastDay = s.day;
    }
    var card = document.createElement("div"); card.className = "card";
    var t = document.createElement("div"); t.className = "t"; t.textContent = s.time; card.appendChild(t);
    var c = document.createElement("div"); c.className = "c"; c.textContent = s.course + (s.place ? " · " + s.place : ""); card.appendChild(c);
    if (s.note) { var n = document.createElement("div"); n.className = "s"; n.textContent = s.note; card.appendChild(n); }
    box.appendChild(card);
  });
})();
