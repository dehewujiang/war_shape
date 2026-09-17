/**
 * [INPUT]: 依赖各剧本文件提供的 window.STORY（标题/场景/分数/开关/信件/结局/开场白）
 * [OUTPUT]: 双击即玩的文字选择游戏：读卡开场/进度/选项/承接句/结局判定/通关档案
 * [POS]: war_shape 的引擎文件；各 story-xxx.js 是内容，本文件是玩法。加新剧本只需配新 STORY 数据 + 一个同类 html 壳
 * [PROTOCOL]: 改机制（新分数/新算法/读卡规则）改本文件；改剧情去改对应 story-xxx.js
 * 约定：开场可粘上一局通关档案（没有也能玩）；档案换开场白、名声回响和专属选项，不加分——每局的秤清零重称
 */
(function () {
  var S = window.STORY;
  var state;

  function reset() {
    // 第一局（白身开局）直接进；有存档直接带卡进；只有"换设备来的第二局"才停下来要卡
    if (S.firstStory) { startGame(""); return; }
    var saved = loadSaved();
    if (saved) { startGame(saved); return; }
    showStart();
  }

  function startGame(txt) {
    state = { i: 0, score: { ren: 0, ba: 0, zhi: 0 }, flags: {}, letters: [], lastMainDim: "ren", echo: null, archive: parseCard(txt), bootTxt: txt };
    render();
  }

  function dimName(d) { return d === "ren" ? "仁" : d === "ba" ? "霸" : "智"; }

  // 存卡/读卡：同一台电脑同一浏览器全自动；换设备才需要手动粘（localStorage 够不着的地方）
  function saveCard(txt) { try { window.localStorage.setItem("warshape_card", txt); } catch (e) {} }
  function loadSaved() { try { return window.localStorage.getItem("warshape_card") || ""; } catch (e) { return ""; } }

  // 换设备来的第二局：手动粘卡进场（平时到不了这屏）
  function showStart() {
    var app = document.getElementById("app");
    var html = "<h1>" + S.title + "</h1><div class='sub'>" + S.subtitle + "</div>";
    html += "<div class='scene'><p style='color:#a89880;font-size:14px'>没找到上一局档案——同一台电脑玩过会自动带过来，不用你动手；换设备的话，把档案粘进来再开局。</p>";
    html += "<textarea id='cardin' rows='3' style='width:100%;box-sizing:border-box;background:#1a1512;color:#e8dcc8;border:1px solid #4a3f30;border-radius:8px;padding:10px;font-size:14px' placeholder='【war_shape通关档案】…'></textarea>";
    html += "<div class='row'><button class='big' id='start'>开局</button></div></div>";
    app.innerHTML = html;
    document.getElementById("start").addEventListener("click", function () {
      startGame(document.getElementById("cardin").value || "");
    });
  }

  // 读卡：段式，缺段=空，未知段忽略——老卡新卡互读，永不过期
  // 全格式：【war_shape通关档案】名｜仁n霸n智n(｜名声t1,t2)?(｜仓…)?(｜土…)?(｜季…)?（仓土季将来即插）
  function parseCard(txt) {
    var m = /【war_shape通关档案】(.+?)｜仁(\d+)霸(\d+)智(\d+)/.exec(txt);
    if (!m) return null;
    var card = { name: m[1], ren: +m[2], ba: +m[3], zhi: +m[4], tags: [] };
    var tm = /｜名声([^｜]+)/.exec(txt);
    if (tm) card.tags = tm[1].split(",").filter(function (t) { return t; });
    return card;
  }

  function render() {
    var app = document.getElementById("app");
    if (state.i >= S.scenes.length) { renderEnding(app); return; }
    var sc = S.scenes[state.i];
    var totalActs = 4;
    var html = "<h1>" + S.title + "</h1><div class='sub'>" + S.subtitle + "</div>";
    html += "<div class='bar'><span>第 " + sc.act + " 幕 / 共 " + totalActs + " 幕</span></div>";
    html += "<div class='scene'><h2>" + sc.title + "</h2>";
    // 开场白：第一幕先看档案认人（有卡用专属版，无卡用默认版）
    if (state.i === 0 && S.openings) {
      var op = (state.archive && S.openings[state.archive.name]) || S.openings["default"];
      if (op) html += "<p class='echo'>" + op + "</p>";
    }
    // 条件文本：命中第一条 variant 即用（含其承接句覆盖）；主框只留故事
    // ifTag 认的是上局蒸出来的名声（不是具体事件）：有 tag 才用，无卡无 tag 走默认
    var bodyText = sc.text, echoSet = null;
    (sc.variants || []).forEach(function (v) {
      var hit = (v.ifFlag && state.flags[v.ifFlag]) ||
        (v.ifLetter && state.letters.indexOf(v.ifLetter) >= 0) ||
        (v.ifTag && state.archive && (state.archive.tags || []).indexOf(v.ifTag) >= 0) ||
        (v.ifTagAbsent && state.archive && (state.archive.tags || []).indexOf(v.ifTagAbsent) < 0);
      if (hit && bodyText === sc.text) { bodyText = v.text; echoSet = v.echoes || null; }
    });
    sc._echoes = echoSet;
    if (state.echo) { html += "<p class='echo'>" + state.echo + "</p>"; state.echo = null; }
    html += "<p>" + bodyText + "</p>";
    // 拆信：之前埋的信，到了约定的幕就变成正文里的一段对话
    state.letters.forEach(function (id) {
      var L = S.letters[id];
      if (!state["fired_" + id] && sc.act >= L.fireAct) {
        html += "<p>" + L.text + "</p>";
        state["fired_" + id] = true;
        state.flags["letter_" + id] = true;
      }
    });
    html += "<div id='opts'>";
    sc.options.forEach(function (op, idx) {
      // 专属选项：档案分数不够就不出现（不是灰掉，是当没这回事）
      if (op.need && (!state.archive || (state.archive[op.need.dim] || 0) < op.need.min)) return;
      html += "<button class='opt' data-idx='" + idx + "'>" + op.text + "</button>";
    });
    html += "</div></div>";
    app.innerHTML = html;
    var btns = app.querySelectorAll("button.opt");
    btns.forEach(function (b) {
      b.addEventListener("click", function () { choose(sc, sc.options[+b.getAttribute("data-idx")], +b.getAttribute("data-idx")); });
    });
  }

  function choose(sc, op, idx) {
    Object.keys(op.score).forEach(function (k) { state.score[k] += op.score[k]; });
    if (op.flag) state.flags[op.flag] = true;
    if (op.letter && state.letters.indexOf(op.letter) < 0) state.letters.push(op.letter);
    if (sc.kind === "main") {
      // 记录最后一道主菜的方向，打平用它定归属
      var best = "ren", bestV = -1;
      ["ren", "ba", "zhi"].forEach(function (k) {
        var v = op.score[k] || 0;
        if (v > bestV) { bestV = v; best = k; }
      });
      state.lastMainDim = best;
    }
    // 承接句留给下一幕开头（条件文本自带的覆盖优先）
    var echoList = sc._echoes || [];
    state.echo = (echoList[idx] || op.echo) || null;
    var opts = document.getElementById("opts");
    opts.querySelectorAll("button").forEach(function (b) { b.disabled = true; b.style.opacity = "0.55"; });
    // 点选即走：按钮一沉，下一幕直接展开；节奏在"选哪个"，不在"点几次"
    setTimeout(function () { state.i++; render(); }, 600);
  }

  function renderEnding(app) {
    var s = state.score, dim = "ren", top = s.ren;
    if (s.ba > top) { dim = "ba"; top = s.ba; }
    if (s.zhi > top) { dim = "zhi"; top = s.zhi; }
    // 打平：看最后一道主菜
    var tied = (s.ren === top ? 1 : 0) + (s.ba === top ? 1 : 0) + (s.zhi === top ? 1 : 0) > 1;
    if (tied) dim = state.lastMainDim;
    var ed = S.endings[dim];
    var html = "<h1>结局 · " + ed.name + "</h1>";
    // 最后一幕的承接句变成结局的开头引子
    var lead = state.echo ? "<p class='echo'>" + state.echo + "</p>" : "";
    html += "<div class='card'>" + lead + "<p style='line-height:2'>" + ed.text + "</p><ul>";
    S.flagOrder.forEach(function (f) {
      if (state.flags[f] && S.endingExtras[f]) html += "<li>" + S.endingExtras[f] + "</li>";
    });
    html += "</ul>";
    html += "<p style='color:#a89880;font-size:13px'>通关档案：仁 " + s.ren + " · 霸 " + s.ba + " · 智 " + s.zhi
      + "（" + ed.name + "）——下一剧本开场会读这张卡。</p>";
    html += "<div class='row'><button class='big' id='again'>再走一次</button>"
      + "<button class='big ghost' id='copy'>复制档案</button></div></div>";
    app.innerHTML = html;
    // 通关即存卡：本局大事按 deeds 蒸成名声跟走；无名声不拼段，老卡格式不变
    var tags = [];
    Object.keys(S.deeds || {}).forEach(function (f) {
      if (state.flags[f]) (S.deeds[f] || []).forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); });
    });
    var cardTxt = "【war_shape通关档案】" + ed.name + "｜仁" + s.ren + "霸" + s.ba + "智" + s.zhi
      + (tags.length ? "｜名声" + tags.join(",") : "");
    saveCard(cardTxt);
    document.getElementById("again").addEventListener("click", function () { startGame(state.bootTxt || ""); });
    document.getElementById("copy").addEventListener("click", function () {
      var txt = cardTxt;
      if (navigator.clipboard) navigator.clipboard.writeText(txt);
      this.textContent = "已复制！";
    });
  }

  reset();
})();
