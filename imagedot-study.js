/* ============================================================
   imagedot-study.js — image-with-dots deck editor + quiz.

   An image deck is a normal deck with type "imagedot". It stores one image
   (a downscaled base64 data URL) and cards { id, x, y, def } where x/y are
   PERCENTAGES (0-100) of the image, so dots stay correct at any display size.

   Two study directions:
     - "name" : a dot is shown on the image -> recall/reveal its answer text.
     - "find" : the answer text is shown -> click the right spot on the image
                (counted correct if the click lands near the dot).
   ============================================================ */
(function (global) {
  "use strict";

  const HIT_RADIUS_PCT = 6;   // how close a "find" click must be to count (in % of image)

  /* Downscale + compress an uploaded image to a data URL, so decks stay small. */
  function fileToScaledDataURL(file, maxDim) {
    maxDim = maxDim || 1400;
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const img = new Image();
        img.onload = function () {
          let w = img.naturalWidth, h = img.naturalHeight;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          w = Math.round(w * scale); h = Math.round(h * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          // JPEG keeps size down; quality 0.82 is a good balance.
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------------- editor ---------------- */
  let imgEd = null;   // { id, name, image, dots:[{x,y,def}], isNew }

  function openImageEditor(deckId) {
    const existing = deckId ? getDeck(deckId) : null;
    imgEd = existing
      ? { id: existing.id, name: existing.name || "", image: existing.image || "",
          dots: (existing.cards || []).map(function (c) { return { x: c.x, y: c.y, def: c.def }; }),
          isNew: false }
      : { id: uid("deck"), name: "", image: "", dots: [], isNew: true };

    document.getElementById("imgDeckName").value = imgEd.name;
    document.getElementById("imgEditorTitle").textContent = existing ? "Edit image deck" : "Image deck";
    showOverlay("imgEditor");

    if (imgEd.image) showEditorImage();
    else hideEditorImage();
    renderEditorDots();
    renderImgPicked();
  }

  function hideEditorImage() {
    document.getElementById("imgEditorSplit").hidden = true;
    document.getElementById("imgEditorHint").hidden = true;
    document.getElementById("imgUploadRow").hidden = false;
  }
  function showEditorImage() {
    document.getElementById("imgEditorImg").src = imgEd.image;
    document.getElementById("imgEditorSplit").hidden = false;
    document.getElementById("imgEditorHint").hidden = false;
    document.getElementById("imgUploadRow").hidden = false; // allow replacing
    document.getElementById("imgUploadBtn").textContent = "Replace image";
  }

  function onEditorStageClick(e) {
    if (!imgEd.image) return;
    const stage = document.getElementById("imgEditorStage");
    const img = document.getElementById("imgEditorImg");
    const rect = img.getBoundingClientRect();
    // Ignore clicks outside the actual image area.
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    const x = (e.clientX - rect.left) / rect.width * 100;
    const y = (e.clientY - rect.top) / rect.height * 100;
    imgEd.dots.push({ x: x, y: y, def: "" });
    renderEditorDots();
    renderImgPicked(imgEd.dots.length - 1); // focus the new answer field
  }

  function renderEditorDots() {
    const layer = document.getElementById("imgEditorDots");
    if (!layer) return;
    layer.innerHTML = "";
    imgEd.dots.forEach(function (d, i) {
      const dot = document.createElement("div");
      dot.className = "img-dot";
      dot.style.left = d.x + "%";
      dot.style.top = d.y + "%";
      dot.textContent = (i + 1);
      layer.appendChild(dot);
    });
  }

  function renderImgPicked(focusIdx) {
    const box = document.getElementById("imgPicked");
    if (!box) return;
    if (!imgEd.dots.length) {
      box.innerHTML = '<p class="wm-empty">No points yet. Click the image to add one.</p>';
      return;
    }
    box.innerHTML = '<div class="wm-picked-head">' + imgEd.dots.length + " point" +
      (imgEd.dots.length === 1 ? "" : "s") + "</div>";
    imgEd.dots.forEach(function (d, idx) {
      const row = document.createElement("div");
      row.className = "wm-pick-row";
      row.innerHTML =
        '<span class="img-pick-num">' + (idx + 1) + "</span>" +
        '<input class="wm-pick-def" type="text" value="' + escapeHtml(d.def) + '" placeholder="Answer for this point">' +
        '<button class="wm-pick-del" title="Remove">&times;</button>';
      row.querySelector(".wm-pick-def").addEventListener("input", function () { d.def = this.value; });
      row.querySelector(".wm-pick-del").addEventListener("click", function () {
        imgEd.dots.splice(idx, 1); renderEditorDots(); renderImgPicked();
      });
      box.appendChild(row);
      if (idx === focusIdx) row.querySelector(".wm-pick-def").focus();
    });
  }

  function saveImageDeck() {
    const name = document.getElementById("imgDeckName").value.trim() || "Image deck";
    if (!imgEd.image) { alert("Upload an image first."); return; }
    if (!imgEd.dots.length) { alert("Add at least one point by clicking the image."); return; }
    const deck = {
      id: imgEd.id, type: "imagedot", name: name,
      image: imgEd.image,
      description: imgEd.dots.length + " points",
      category: "", subcategory: "",
      cards: imgEd.dots.map(function (d) {
        return { id: uid("card"), x: d.x, y: d.y, def: (d.def || "").trim() || "(no answer)" };
      })
    };
    upsertDeck(deck);
    hideOverlay("imgEditor");
    renderStudy();
  }

  /* ---------------- quiz ---------------- */
  let imgQ = null;   // { deckId, image, queue, idx, dir, correct, total, answered }

  function openImageQuiz(deckId) {
    const deck = getDeck(deckId);
    if (!deck || !deck.cards || !deck.cards.length) return;
    imgQ = {
      deckId: deckId, image: deck.image,
      queue: shuffle(deck.cards.slice()), idx: 0,
      dir: "name", correct: 0, total: deck.cards.length, answered: false
    };
    document.getElementById("imgQuizTitle").textContent = deck.name || "Image deck";
    document.getElementById("imgQuizImg").src = deck.image;
    showOverlay("imgQuiz");
    updateImgDirButton();
    renderImgQuizCard();
  }

  function updateImgDirButton() {
    const btn = document.getElementById("imgDirBtn");
    if (btn) btn.textContent = imgQ.dir === "name" ? "Find the point" : "Name the point";
  }

  function imgCurrent() { return imgQ.queue[imgQ.idx]; }

  function renderImgQuizCard() {
    const card = imgCurrent();
    const prompt = document.getElementById("imgPrompt");
    const controls = document.getElementById("imgQuizControls");
    const dots = document.getElementById("imgQuizDots");
    imgQ.answered = false;
    dots.innerHTML = "";

    if (!card) {
      prompt.textContent = "";
      document.getElementById("imgQuizStage").style.visibility = "hidden";
      controls.innerHTML =
        '<div class="wm-done"><h3>Done!</h3><p>You got ' + imgQ.correct + " of " + imgQ.total +
        ' right.</p><button class="btn btn-primary" id="imgRestart">Study again</button></div>';
      document.getElementById("imgRestart").addEventListener("click", function () {
        imgQ.queue = shuffle(imgQ.queue); imgQ.idx = 0; imgQ.correct = 0;
        document.getElementById("imgQuizStage").style.visibility = "";
        renderImgQuizCard();
      });
      updateImgProgress();
      return;
    }

    if (imgQ.dir === "name") {
      prompt.textContent = "What is this point?";
      const dot = document.createElement("div");
      dot.className = "img-dot img-dot--quiz";
      dot.style.left = card.x + "%"; dot.style.top = card.y + "%";
      dots.appendChild(dot);
      controls.innerHTML =
        '<button class="btn" id="imgReveal">Reveal answer</button>' +
        '<div class="wm-answer" id="imgAnswer" hidden></div>';
      document.getElementById("imgReveal").addEventListener("click", revealImgName);
    } else {
      prompt.textContent = "Find: " + card.def;
      controls.innerHTML = '<div class="wm-hint-line">Click the spot on the image.</div>';
    }
    updateImgProgress();
  }

  function revealImgName() {
    if (imgQ.answered) return;
    imgQ.answered = true;
    const card = imgCurrent();
    const box = document.getElementById("imgAnswer");
    box.hidden = false;
    box.innerHTML =
      "<strong>" + escapeHtml(card.def) + "</strong>" +
      '<div class="wm-selfgrade">' +
        '<button class="btn" data-ok="0">Got it wrong</button>' +
        '<button class="btn btn-primary" data-ok="1">Got it right</button>' +
      "</div>";
    box.querySelectorAll("[data-ok]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.ok === "1") imgQ.correct++;
        imgAdvance();
      });
    });
  }

  function onImgQuizClick(e) {
    if (!imgQ || imgQ.dir !== "find" || imgQ.answered) return;
    const card = imgCurrent();
    if (!card) return;
    const img = document.getElementById("imgQuizImg");
    const rect = img.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    const x = (e.clientX - rect.left) / rect.width * 100;
    const y = (e.clientY - rect.top) / rect.height * 100;
    imgQ.answered = true;
    const dist = Math.hypot(x - card.x, y - card.y);
    const right = dist <= HIT_RADIUS_PCT;
    if (right) imgQ.correct++;

    // Show where the answer was, and where they clicked.
    const dots = document.getElementById("imgQuizDots");
    const answer = document.createElement("div");
    answer.className = "img-dot img-dot--quiz"; answer.style.left = card.x + "%"; answer.style.top = card.y + "%";
    dots.appendChild(answer);
    const guess = document.createElement("div");
    guess.className = "img-dot img-dot--guess " + (right ? "img-guess-right" : "img-guess-wrong");
    guess.style.left = x + "%"; guess.style.top = y + "%";
    dots.appendChild(guess);

    const controls = document.getElementById("imgQuizControls");
    controls.innerHTML =
      '<div class="wm-result ' + (right ? "wm-right" : "wm-wrong") + '">' +
        (right ? "Correct!" : "Not quite \u2014 the answer was here.") +
      "</div><button class=\"btn btn-primary\" id=\"imgNext\">Next</button>";
    document.getElementById("imgNext").addEventListener("click", imgAdvance);
  }

  function imgAdvance() { imgQ.idx++; renderImgQuizCard(); }

  function updateImgProgress() {
    const fill = document.getElementById("imgProgressFill");
    const label = document.getElementById("imgProgressLabel");
    const done = Math.min(imgQ.idx, imgQ.total);
    if (fill) fill.style.width = (imgQ.total ? done / imgQ.total * 100 : 0) + "%";
    if (label) label.textContent = done + " / " + imgQ.total;
  }

  /* ---------------- wiring ---------------- */
  function initImageDot() {
    const newBtn = document.getElementById("studyNewImageBtn");
    if (newBtn) newBtn.addEventListener("click", function () { openImageEditor(null); });

    const upBtn = document.getElementById("imgUploadBtn");
    const upFile = document.getElementById("imgFile");
    if (upBtn && upFile) {
      upBtn.addEventListener("click", function () { upFile.click(); });
      upFile.addEventListener("change", function () {
        const f = upFile.files && upFile.files[0];
        upFile.value = "";
        if (!f) return;
        fileToScaledDataURL(f).then(function (url) {
          imgEd.image = url;
          showEditorImage();
          renderEditorDots();
        }).catch(function () { alert("Couldn't read that image. Try a different file."); });
      });
    }
    const stage = document.getElementById("imgEditorStage");
    if (stage) stage.addEventListener("click", onEditorStageClick);
    const eExit = document.getElementById("imgEditorExit");
    if (eExit) eExit.addEventListener("click", function () { hideOverlay("imgEditor"); });
    const save = document.getElementById("imgSaveBtn");
    if (save) save.addEventListener("click", saveImageDeck);

    const qStage = document.getElementById("imgQuizStage");
    if (qStage) qStage.addEventListener("click", onImgQuizClick);
    const qExit = document.getElementById("imgQuizExit");
    if (qExit) qExit.addEventListener("click", function () { hideOverlay("imgQuiz"); });
    const dirBtn = document.getElementById("imgDirBtn");
    if (dirBtn) dirBtn.addEventListener("click", function () {
      imgQ.dir = imgQ.dir === "name" ? "find" : "name";
      updateImgDirButton();
      renderImgQuizCard();
    });
  }

  global.ImageDotStudy = {
    init: initImageDot,
    openEditor: openImageEditor,
    openQuiz: openImageQuiz,
    isImageDeck: function (deck) { return deck && deck.type === "imagedot"; }
  };
})(typeof window !== "undefined" ? window : globalThis);
