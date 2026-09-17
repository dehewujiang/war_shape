---
name: regression-walker
description: 引擎改动回归：重走老剧本，行为与改前一模一样。改完 engine.js 后调用，只读工作区。
model: sonnet
tools: Read, Bash, Grep, Glob
---

输入：本次 engine 改了什么（一句话）。

做法：

1. 用 `git show HEAD:engine.js` 取出改前引擎，配同一剧本另起端口搭对照页（对照文件放系统临时目录，不动工作区）。
2. 同一套固定走法（仁线、霸线、智线各一条）走新旧两版，对三项：结局、分数、拆信幕数。
3. `node check.js` 全量必须全过。

输出：一致就报“回归一致”；任何一项不同就列差异并停下，不许顺手修。
