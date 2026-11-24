(() => {
  "use strict";

  // ---------- Storage (wrapped: private mode can throw) ----------
  const STORE_KEY = "spa101-progress-v1";
  const DIR_KEY = "spa101-direction";
  const load = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

  // progress[spanish] = { lvl: 0-5, r: timesRight, w: timesWrong }
  let progress = load(STORE_KEY, {});
  let direction = load(DIR_KEY, "mix");
  const session = { right: 0, wrong: 0 };

  // ---------- Weighted random picking ----------
  // Level goes up by 1 when you get a card right and drops to 0 when you get it wrong.
  // Lower level = higher weight = more likely to come back.
  const LEVEL_WEIGHT = [12, 6, 3, 1.5, 0.6, 0.25];
  const UNSEEN_WEIGHT = 3;
  const MASTERED_LEVEL = 4;
  const RECENT_SIZE = 12; // never repeat one of the last N cards

  const cards = VOCAB.map(([es, en, note]) => ({ es, en, note }));
  const recent = [];

  function weightOf(card) {
    const p = progress[card.es];
    return p ? LEVEL_WEIGHT[p.lvl] : UNSEEN_WEIGHT;
  }

  function pickCard() {
    const blocked = new Set(recent);
    const pool = cards.filter(c => !blocked.has(c.es));
    let total = 0;
    for (const c of pool) total += weightOf(c);
    let r = Math.random() * total;
    for (const c of pool) {
      r -= weightOf(c);
      if (r <= 0) return c;
    }
    return pool[pool.length - 1];
  }

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const cardEl = $("card");
  const el = {
    frontLang: $("front-lang"), frontWord: $("front-word"),
    backLang: $("back-lang"), backWord: $("back-word"), backSub: $("back-sub"), backNote: $("back-note"),
    stampR: cardEl.querySelector(".stamp-right"), stampL: cardEl.querySelector(".stamp-left"),
    btnRight: $("btn-right"), btnWrong: $("btn-wrong"), btnFlip: $("btn-flip"),
  };

  let current = null;
  let showSpanishFirst = true;
  let flipped = false;
  let busy = false;

  function render() {
    const spanishFirst = direction === "es" || (direction === "mix" && Math.random() < 0.5);
    showSpanishFirst = spanishFirst;
    const front = spanishFirst ? current.es : current.en;
    const back = spanishFirst ? current.en : current.es;
    el.frontLang.textContent = spanishFirst ? "ESPAÑOL" : "ENGLISH";
    el.backLang.textContent = spanishFirst ? "ENGLISH" : "ESPAÑOL";
    el.frontWord.textContent = front;
    el.backWord.textContent = back;
    el.backSub.textContent = front;
    el.backNote.hidden = !current.note;
    el.backNote.textContent = current.note ? "Note: " + current.note : "";
    setFlipped(false);
  }

  function setFlipped(v) {
    flipped = v;
    cardEl.classList.toggle("flipped", v);
    el.btnRight.disabled = !v;
    el.btnWrong.disabled = !v;
    el.btnFlip.textContent = v ? "Flip back" : "Flip";
  }

  // Cards you just missed are guaranteed to come back within a few cards.
  const comebacks = []; // { card, due }
  function next() {
    comebacks.forEach(cb => cb.due--);
    const i = comebacks.findIndex(cb => cb.due <= 0);
    current = i >= 0 ? comebacks.splice(i, 1)[0].card : pickCard();
    recent.push(current.es);
    if (recent.length > Math.min(RECENT_SIZE, cards.length - 1)) recent.shift();
    render();
  }

  function updateStats() {
    const seen = Object.keys(progress).filter(k => cards.some(c => c.es === k));
    const mastered = seen.filter(k => progress[k].lvl >= MASTERED_LEVEL).length;
    $("stat-right").textContent = session.right;
    $("stat-wrong").textContent = session.wrong;
    $("stat-mastered").textContent = mastered;
    $("stat-seen").textContent = seen.length;
    $("stat-total").textContent = "seen of " + cards.length;
  }

  function grade(gotIt) {
    const p = progress[current.es] || { lvl: 1, r: 0, w: 0 };
    if (gotIt) { p.lvl = Math.min(p.lvl + 1, LEVEL_WEIGHT.length - 1); p.r++; session.right++; }
    else {
      p.lvl = 0; p.w++; session.wrong++;
      if (!comebacks.some(cb => cb.card === current)) {
        comebacks.push({ card: current, due: 5 + Math.floor(Math.random() * 5) });
      }
    }
    progress[current.es] = p;
    save(STORE_KEY, progress);
    updateStats();
  }

  // ---------- Swipe / fly-off ----------
  const THRESHOLD = 90;

  function setDrag(dx) {
    cardEl.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    const amt = Math.min(Math.abs(dx) / THRESHOLD, 1);
    el.stampR.style.opacity = dx > 0 ? amt : 0;
    el.stampL.style.opacity = dx < 0 ? amt : 0;
  }

  function resetDrag(animate) {
    if (animate) cardEl.classList.add("animating");
    setDrag(0);
    cardEl.style.opacity = "";
    if (animate) setTimeout(() => cardEl.classList.remove("animating"), 300);
  }

  function commit(gotIt) {
    if (busy || !flipped) return;
    busy = true;
    grade(gotIt);
    const dir = gotIt ? 1 : -1;
    cardEl.classList.add("animating");
    setDrag(dir * (window.innerWidth * 0.9 + 200));
    cardEl.style.opacity = "0";
    setTimeout(() => {
      cardEl.classList.remove("animating");
      // Hide the old card while the new one is placed, so the flip-back isn't visible.
      cardEl.querySelector(".card-inner").style.transition = "none";
      next();
      setDrag(0);
      cardEl.style.transform = "translateY(16px) scale(0.96)";
      void cardEl.offsetWidth;
      cardEl.querySelector(".card-inner").style.transition = "";
      cardEl.classList.add("animating");
      cardEl.style.opacity = "";
      cardEl.style.transform = "";
      setTimeout(() => { cardEl.classList.remove("animating"); busy = false; }, 300);
    }, 280);
  }

  let drag = null;
  cardEl.addEventListener("pointerdown", e => {
    if (busy || e.target.closest(".speak")) return;
    drag = { x: e.clientX, y: e.clientY, dx: 0, moved: false, id: e.pointerId };
    cardEl.setPointerCapture(e.pointerId);
  });
  cardEl.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    if (Math.abs(drag.dx) > 8) drag.moved = true;
    if (drag.moved) setDrag(flipped ? drag.dx : drag.dx * 0.15); // resist until flipped
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const { dx, moved } = drag;
    drag = null;
    if (!moved) { setFlipped(!flipped); return; }
    if (flipped && Math.abs(dx) >= THRESHOLD) commit(dx > 0);
    else resetDrag(true);
  };
  cardEl.addEventListener("pointerup", endDrag);
  cardEl.addEventListener("pointercancel", e => { if (drag) { drag = null; resetDrag(true); } });

  // ---------- Buttons & keys ----------
  el.btnFlip.addEventListener("click", () => !busy && setFlipped(!flipped));
  el.btnRight.addEventListener("click", () => commit(true));
  el.btnWrong.addEventListener("click", () => commit(false));

  // After a mouse/touch click, drop focus so Space/arrows go to the card, not the button.
  document.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b && e.detail > 0) b.blur();
  });

  document.addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
    if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault(); if (!busy) setFlipped(!flipped);
    } else if (e.key === "ArrowRight") { commit(true); }
    else if (e.key === "ArrowLeft") { commit(false); }
  });

  document.querySelectorAll(".direction button").forEach(b => {
    b.classList.toggle("active", b.dataset.dir === direction);
    b.addEventListener("click", () => {
      direction = b.dataset.dir;
      save(DIR_KEY, direction);
      document.querySelectorAll(".direction button").forEach(x => x.classList.toggle("active", x === b));
      render();
    });
  });

  $("reset").addEventListener("click", () => {
    if (!confirm("Reset all progress? Every card goes back to unseen.")) return;
    progress = {};
    session.right = session.wrong = 0;
    save(STORE_KEY, progress);
    updateStats();
    next();
  });

  // ---------- Pronunciation ----------
  const speakBtn = $("speak");
  if (!("speechSynthesis" in window)) speakBtn.hidden = true;
  speakBtn.addEventListener("click", e => {
    e.stopPropagation();
    const text = current.es
      .replace(/\/-?(a|as|os)\b/g, "")   // argentino/a -> argentino
      .replace(/\(([^)]*)\)/g, "$1")
      .replace(/\.\.\./g, "");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-MX";
    const voice = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith("es"));
    if (voice) u.voice = voice;
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });

  // ---------- Start ----------
  updateStats();
  next();
})();
