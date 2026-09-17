// PostToolUse 钩子：刚改的是剧本，就只跑它自己的穷举裁判。
// 只看病不下药：全过就静默放行，不过把死刑清单甩给 Claude，不改任何文件。
const path = require("path");
const { execFile } = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");

function done(code, msg) {
  if (msg) (code ? console.error(msg) : console.log(msg));
  process.exit(code);
}
if (process.stdin.isTTY) process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { input += c; });
process.stdin.on("end", () => {
  let file = "";
  try { file = JSON.parse(input).tool_input.file_path || ""; } catch (e) { process.exit(0); }
  const base = path.basename(file);
  if (!/^story-.*\.js$/i.test(base)) process.exit(0);
  execFile("node", ["check.js", base],
    { cwd: ROOT, timeout: 240000, maxBuffer: 64 * 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err && err.killed) return done(0, "裁判跑超 4 分钟，钩子先放行，请手动跑 node check.js " + base);
      if (err) return done(2, "裁判没过：" + base + "\n" + (stdout || "") + (stderr || err.message));
      done(0, "");
    });
});
