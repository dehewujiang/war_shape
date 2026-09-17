---
name: new-story
description: 加一个新剧本：复制页面壳、换引用、按剧本契约搭 story 文件、自检跑通。说“加新剧本/新关/新篇章”时用。
---

# 加新剧本（$ARGUMENTS 为新剧本名，如“长坂坡”）

大白话：新剧本 = 一个新页面壳 + 一个新剧情文件，玩法不用动。

## 步骤

1. 复制 `game.html` 为新壳（如 `changban.html`），只换两处：标题 + 两个 `<script>` 引用里的剧本文件名。
2. 新建 `story-xxx.js`，只做 `window.STORY = {...}` 一件事，遵守剧本契约：
   - `scenes[]`：`{act 1-4, kind: main|side, title, text, options[]}`；主选项 +2 分，支线 +1 分；分数不对玩家显示。
   - 每个选项必有 `text`、`score`、`echo`（下一幕开头的承接句）；分/旗/信至少动一样，否则是“选了个寂寞”。
   - 可选：`flag`（埋旗）、`letter`（拆信，`letters{}` 里必须有对应 `{fireAct, text}`）、`need: {dim, min}`（档案门控专属选项）。
   - `variants[]` 先到先得：`ifFlag|ifLetter|ifTag|ifTagAbsent` + `text`（+`echoes[]`，长度必须等于选项数）。默认正文在所有走法下都得通顺，通顺不了就加 variant，绝不动选项和分数去凑。
   - `endings{ren,ba,zhi}` + `endingExtras{}` + `flagOrder[]`（两者 key 必须对齐）；`openings{}` 必须有 `default`。
   - 非首局不写 `firstStory`；`deeds` 把本局旗蒸成名声（只能用 民望/军望/失信，加第 4 个要用户点头）。
3. `check.js` 的 `EXPECTED` 加一行新剧本：先跑 `node check.js story-xxx.js` 看报出的条数，把真实数字填进去（数字对不上就失败，逼你确认是预期变化还是断裂）。
4. 跑 `/verify-game` 全套验货。

## 禁区

- 绝不动 `engine.js` 来迁就剧情。
- 档案格式一个字都不许动（老卡永不过期）。
