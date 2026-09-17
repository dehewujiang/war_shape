// PostToolUse 钩子：刚改的 JS 过一下语法，非 JS 直接放行。
// 只看病不下药：过了静默放行，不过把报错甩给 Claude，不改任何文件。
if (process.stdin.isTTY) process.exit(0);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { input += c; });
process.stdin.on("end", () => {
  let file = "";
  try { file = JSON.parse(input).tool_input.file_path || ""; } catch (e) { process.exit(0); }
  if (!/\.js$/i.test(file)) process.exit(0);
  require("child_process").execFile("node", ["--check", file], (err, stdout, stderr) => {
    if (err) {
      console.error("语法没过：" + file + "\n" + (stderr || err.message));
      process.exit(2);
    }
    process.exit(0);
  });
});
