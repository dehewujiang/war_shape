/**
 * [INPUT]: 各 story-xxx.js（读其 window.STORY）
 * [OUTPUT]: 穷举报告 + exit code（0 全过，非零列死刑清单）
 * [POS]: war_shape 的机器裁判；engine.js 是玩法，本文件是独立的第二实现，只判结构不判文字
 * [PROTOCOL]: engine 玩法语义变了必须同步改 SIM；加新剧本在 STORIES 加一行，并同步改 EXPECTED
 */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

// 改剧本（增删选项/场景）后，同步改这里；数字对不上即失败，逼人确认是预期变化还是意外断裂
const EXPECTED = {
  "story-sangu.js": 4374,
  "story-changban.js": 78732,
};

function loadStory(file) {
  const code = fs.readFileSync(path.join(ROOT, file), "utf8");
  const window = {};
  eval(code); // 剧本文件只做 window.STORY = {...} 一件事
  if (!window.STORY) throw new Error(file + ": 没有 window.STORY");
  return window.STORY;
}

// 与 engine.js 同语义的微型模拟器（刻意独立实现：两边打架时由人判谁错）
function visibleOptions(sc, archive) {
  return sc.options.filter(function (op) {
    if (!op.need) return true;
    if (!archive) return false;
    return (archive[op.need.dim] || 0) >= op.need.min;
  });
}

function pickVariant(sc, flags, letters) {
  for (const v of (sc.variants || [])) {
    const hit = (v.ifFlag && flags[v.ifFlag]) || (v.ifLetter && letters.indexOf(v.ifLetter) >= 0);
    if (hit) return v;
  }
  return null;
}

const failures = [];
function condemn(msg) { failures.push(msg); }

// 对一条完整路径做单步模拟；hits 收集覆盖率
function walk(S, file, picks, archive, hits) {
  const score = { ren: 0, ba: 0, zhi: 0 };
  const flags = {}, letters = [];
  let lastMainDim = "ren";
  const fired = {};

  if (S.openings) {
    const key = (archive && S.openings[archive.name]) ? archive.name : "default";
    if (!S.openings[key]) condemn(file + ": openings 缺键 " + key);
    else if (key !== "default") hits.openings.add(key);
  }

  for (let i = 0; i < S.scenes.length; i++) {
    const sc = S.scenes[i];
    if (typeof sc.text !== "string" || !sc.text) condemn(file + " S" + (i + 1) + ": 正文空");
    const v = pickVariant(sc, flags, letters);
    if (v) {
      hits.variants.add(file + "#" + (i + 1) + ":" + (v.ifFlag || v.ifLetter));
      if (v.echoes && v.echoes.length !== sc.options.length)
        condemn(file + " S" + (i + 1) + ": variant echoes 长度 " + v.echoes.length + " ≠ 选项数 " + sc.options.length);
    }
    const vis = visibleOptions(sc, archive);
    const op = vis[picks[i]];
    if (!op) { condemn(file + " S" + (i + 1) + ": 第" + picks[i] + "个可见选项不存在"); return null; }
    // 铁律：每个选项至少动一样东西
    const gain = Object.values(op.score || {}).reduce((a, b) => a + b, 0);
    if (!(gain > 0 || op.flag || op.letter))
      condemn(file + " S" + (i + 1) + " [" + op.text + "]: 选了个寂寞（无分无旗无信）");
    if (typeof op.echo !== "string" || !op.echo)
      condemn(file + " S" + (i + 1) + " [" + op.text + "]: 缺承接句 echo");
    Object.keys(op.score || {}).forEach(k => { score[k] += op.score[k]; });
    if (op.flag) flags[op.flag] = true;
    if (op.letter) {
      if (letters.indexOf(op.letter) < 0) letters.push(op.letter);
      hits.buried.add(file + ":" + op.letter);
    }
    if (sc.kind === "main") {
      let best = "ren", bestV = -1;
      ["ren", "ba", "zhi"].forEach(k => { const vv = (op.score || {})[k] || 0; if (vv > bestV) { bestV = vv; best = k; } });
      lastMainDim = best;
    }
    // 拆信
    letters.forEach(id => {
      const L = (S.letters || {})[id];
      if (!L) { condemn(file + ": 信 " + id + " 在 letters 里不存在"); return; }
      if (!fired[id] && sc.act >= L.fireAct) {
        fired[id] = true;
        flags["letter_" + id] = true;
        hits.fired.add(file + ":" + id);
        if (typeof L.text !== "string" || !L.text) condemn(file + ": 信 " + id + " 正文空");
      }
    });
    // need 门两面都要见过
    sc.options.forEach(op2 => {
      if (!op2.need) return;
      const open = archive && (archive[op2.need.dim] || 0) >= op2.need.min;
      hits.gates.add(file + ":" + op2.need.dim + op2.need.min + (open ? "=开" : "=关"));
    });
  }

  let dim = "ren", top = score.ren;
  if (score.ba > top) { dim = "ba"; top = score.ba; }
  if (score.zhi > top) { dim = "zhi"; top = score.zhi; }
  const tied = (score.ren === top ? 1 : 0) + (score.ba === top ? 1 : 0) + (score.zhi === top ? 1 : 0) > 1;
  if (tied) dim = lastMainDim;
  if (!S.endings[dim]) { condemn(file + ": 结局缺维度 " + dim); return null; }
  hits.endings.add(file + ":" + dim);
  hits.ranges[file + ":" + dim] = hits.ranges[file + ":" + dim] || [];
  hits.ranges[file + ":" + dim].push([score.ren, score.ba, score.zhi]);
  return { name: S.endings[dim].name, ren: score.ren, ba: score.ba, zhi: score.zhi };
}

// 引用闭合：静态检查，不跑路
function checkRefs(file, S) {
  const flagSet = new Set();
  S.scenes.forEach(sc => sc.options.forEach(op => { if (op.flag) flagSet.add(op.flag); }));
  const letterIds = new Set(Object.keys(S.letters || {}));
  (S.letters || {}) && Object.entries(S.letters).forEach(([id, L]) => {
    if (typeof L.fireAct !== "number") condemn(file + ": 信 " + id + " 缺 fireAct");
  });
  const buried = new Set();
  S.scenes.forEach(sc => sc.options.forEach(op => { if (op.letter) buried.add(op.letter); }));
  buried.forEach(id => { if (!letterIds.has(id)) condemn(file + ": 埋了不存在的信 " + id); });
  letterIds.forEach(id => { if (!buried.has(id)) condemn(file + ": 信 " + id + " 无人埋"); });
  S.scenes.forEach((sc, i) => (sc.variants || []).forEach(v => {
    if (v.ifFlag && !flagSet.has(v.ifFlag) && v.ifFlag.indexOf("letter_") !== 0)
      condemn(file + " S" + (i + 1) + ": variant 引了不存在的旗 " + v.ifFlag);
    if (v.ifLetter && !letterIds.has(v.ifLetter))
      condemn(file + " S" + (i + 1) + ": variant 引了不存在的信 " + v.ifLetter);
  }));
  S.scenes.forEach((sc, i) => sc.options.forEach(op => {
    if (op.need && ["ren", "ba", "zhi"].indexOf(op.need.dim) < 0)
      condemn(file + " S" + (i + 1) + ": need 门维度非法 " + op.need.dim);
  }));
  if (S.openings) Object.keys(S.openings).forEach(k => {
    if (k !== "default" && !Object.values(S.endings).concat([{ name: "" }]).some(e => e.name === k)
      && !["人和之主", "立威之主", "谋定之主"].includes(k))
      condemn(file + ": openings 有上局认不出的键 " + k);
  });
  const ek = Object.keys(S.endingExtras || {}), fo = S.flagOrder || [];
  if (ek.length !== fo.length || ek.some(k => fo.indexOf(k) < 0))
    condemn(file + ": endingExtras 与 flagOrder 不对齐");
  fo.forEach(f => {
    if (!flagSet.has(f) && f.indexOf("letter_") !== 0)
      condemn(file + ": flagOrder 有无处可设的旗 " + f);
  });
}

function freshHits() {
  return { variants: new Set(), buried: new Set(), fired: new Set(), gates: new Set(), endings: new Set(), openings: new Set(), ranges: {} };
}

// DFS 枚举全部可见路径
function enumerate(S, file, archive) {
  const hits = freshHits();
  const cards = [];
  let count = 0;
  const picks = [];
  (function dfs(i) {
    if (i >= S.scenes.length) {
      const card = walk(S, file, picks.slice(), archive, hits);
      if (card) cards.push(card);
      count++;
      return;
    }
    const n = visibleOptions(S.scenes[i], archive).length;
    for (let j = 0; j < n; j++) { picks.push(j); dfs(i + 1); picks.pop(); }
  })(0);
  return { count, hits, cards };
}

function mergeHits(dst, src) {
  ["variants", "buried", "fired", "gates", "endings", "openings"].forEach(k => src[k].forEach(v => dst[k].add(v)));
  Object.entries(src.ranges).forEach(([k, v]) => { dst.ranges[k] = (dst.ranges[k] || []).concat(v); });
}

const onlyFiles = process.argv.slice(2);
const STORIES = [
  { file: "story-sangu.js", archives: [null] },
  {
    file: "story-changban.js",
    archives: [null]
      .concat(["人和之主", "立威之主", "谋定之主"].flatMap(name =>
        [{ dim: "ren", min: 0 }, { dim: "ren", min: 8 }, { dim: "ba", min: 8 }].map(g =>
          ({ name, ren: g.dim === "ren" ? g.min : 0, ba: g.dim === "ba" ? g.min : 0, zhi: 0 })))
      ),
  },
];

const allCards = [];
STORIES.filter(s => !onlyFiles.length || onlyFiles.includes(s.file)).forEach(({ file, archives }) => {
  const S = loadStory(file);
  checkRefs(file, S);
  const total = freshHits();
  let sum = 0;
  archives.forEach(a => {
    const r = enumerate(S, file, a);
    sum += r.count;
    mergeHits(total, r.hits);
    if (file === "story-sangu.js") r.cards.forEach(c => allCards.push(c));
  });
  console.log(file + ": " + sum + " 条 (期望 " + EXPECTED[file] + ")");
  if (sum !== EXPECTED[file]) condemn(file + ": 路数 " + sum + " ≠ 期望 " + EXPECTED[file] + "（剧本改了就同步改 EXPECTED）");
  // 覆盖率死刑
  S.scenes.forEach((sc, i) => (sc.variants || []).forEach(v => {
    const key = file + "#" + (i + 1) + ":" + (v.ifFlag || v.ifLetter);
    if (!total.variants.has(key)) condemn(file + " S" + (i + 1) + ": variant 从没命中，是死代码");
  }));
  Object.keys(S.letters || {}).forEach(id => {
    if (!total.buried.has(file + ":" + id)) condemn(file + ": 信 " + id + " 从没被埋过");
    if (!total.fired.has(file + ":" + id)) condemn(file + ": 信 " + id + " 从没拆开过");
  });
  S.scenes.forEach(sc => sc.options.forEach(op => {
    if (!op.need) return;
    const k = file + ":" + op.need.dim + op.need.min;
    if (!total.gates.has(k + "=开")) condemn(file + " [" + op.text + "]: 专属选项从没开过");
    if (!total.gates.has(k + "=关")) condemn(file + " [" + op.text + "]: 专属选项从没关过");
  }));
  ["ren", "ba", "zhi"].forEach(d => {
    if (!total.endings.has(file + ":" + d)) condemn(file + ": 结局 " + d + " 不可达");
  });
  // 人看的清单
  console.log("  结局: " + ["ren", "ba", "zhi"].map(d => {
    const rs = total.ranges[file + ":" + d] || [];
    const mins = [0, 1, 2].map(k => Math.min(...rs.map(r => r[k])));
    const maxs = [0, 1, 2].map(k => Math.max(...rs.map(r => r[k])));
    return d + "×" + rs.length + "路(仁" + mins[0] + "-" + maxs[0] + "/霸" + mins[1] + "-" + maxs[1] + "/智" + mins[2] + "-" + maxs[2] + ")";
  }).join(" "));
  const rewritten = new Set([...total.variants].map(k => k.split(":")[0]));
  const iron = S.scenes.map((sc, i) => file + "#" + (i + 1)).filter(k => !rewritten.has(k));
  console.log("  铁板一块(从没被改写): " + (iron.join(" ") || "无"));
});

// 跨局：三顾真实产出卡必须全部落在已测配置里（开口认得 + 门状态不超标）
if (!onlyFiles.length) {
  const seen = new Map();
  allCards.forEach(c => {
    const k = c.name + "|仁" + c.ren + "霸" + c.ba + "智" + c.zhi;
    seen.set(k, (seen.get(k) || 0) + 1);
  });
  console.log("三顾真实产出卡去重: " + seen.size + " 种");
  let bad = 0;
  seen.forEach((n, k) => {
    const m = /(.+)\|仁(\d+)霸(\d+)智(\d+)/.exec(k);
    if (!["人和之主", "立威之主", "谋定之主"].includes(m[1])) { condemn("跨局: 未知结局名 " + m[1]); bad++; }
    if (+m[2] >= 8 && +m[3] >= 8) { condemn("跨局: 出现双开卡 " + k + "（配置空间要+1）"); bad++; }
  });
  if (!bad) console.log("  全部落在 10 配置内，无双开卡");
}

if (failures.length) {
  const grouped = new Map();
  failures.forEach(f => grouped.set(f, (grouped.get(f) || 0) + 1));
  console.log("\n死刑清单 (" + grouped.size + " 类，共 " + failures.length + " 条路径命中):");
  grouped.forEach((n, f) => console.log("  ✗ " + f + (n > 1 ? "  [×" + n + "条路]" : "")));
  process.exit(1);
} else {
  console.log("\n全过：结构无死路、无死代码、无断裂。文字顺不顺，请人看。");
}
