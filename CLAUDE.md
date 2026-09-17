# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

war_shape: zero-dependency history-rewriting choice game. Double-click an `.html` file and play in a browser. Offline. No build, no packages, no server.

## Files

- `engine.js` — the only mechanism file (scores, echo chaining, letters, endings, archive save/load). Changing rules goes here.
- `story-xxx.js` — one per story, sets `window.STORY`. Changing plot goes here, never in the engine.
- `game.html` / `changban.html` — thin shells: title + CSS + two `<script>` tags (story, then engine). New story = copy shell, swap the two references.
- `玩法说明.txt` — player-facing manual in plain Chinese. Update it whenever mechanics change.
- `check.js` — exhaustive machine judge (`node check.js`, zero deps). Enumerates every path × archive config, fails non-zero on: dead ends, options that move nothing, dangling refs, misaligned echoes, dead code, unreachable endings, cross-story card mismatch. Proves itself by fault injection (break a temp copy → must fail naming it). Engine/story semantics changes must update its simulator + EXPECTED counts.
- `memory/` — project memory (TODO/decisions/project/session). Architecture decisions live in `memory/decisions.md` as ADR entries; check it before overturning past choices.

## STORY contract (story files must follow this)

- `scenes[]`: `{act 1-4, kind: main|side, title, text, options[], variants[]?}`. Main options score +2, side +1. Scores hidden from player (`ren`/`ba`/`zhi`).
- Every option: `text`, `score`, `echo` (one lead-in sentence rendered at the top of the next scene; last scene's echo leads the ending). Options may add `flag`, `letter`, or `need: {dim, min}` (archive-gated special option, hidden unless met).
- `variants[]`: first-match conditional scene text `{ifFlag|ifLetter|ifTag|ifTagAbsent, text, echoes?[]}`. `ifTag` matches reputation tags from the previous run's card; `ifTagAbsent` matches card-present-but-tag-missing (three visible states: tagged / card-without-tag / no-card). Rule: default text must hold under ALL upstream choices; otherwise add a variant. Never fix continuity by editing options/scores.
- `letters{} `: delayed-consequence dialogue `{fireAct, text}`, fired once as plain story paragraph when reached. No highlight boxes.
- `endings{ren,ba,zhi}` + `endingExtras{}` + `flagOrder[]`. Ending = highest score, tie goes to `lastMainDim`. Flags/letters only add ending detail lines, never change the ending.
- `openings{}`: keyed by previous-run ending name + `default`. First scene prepends the matching line based on the parsed archive card.
- Archive format (stable, parse-compatible): `【war_shape通关档案】<ending>｜仁<n>霸<n>智<n>(｜名声<t1,t2>)?`. Stories declare `deeds: {flagName:[tags]}` to distill set flags into reputation tags (current vocabulary, locked: 民望/军望/失信 — adding a 4th doubles checker configs, needs user approval). Engine also persists it to `localStorage["warshape_card"]`; manual paste is the cross-device fallback. Scores reset each story; the card grants openings + special options + tag skins, never points.

## Verify before reporting done

- `node --check` every touched JS file.
- Playwright cannot use `file://`; serve with `python -m http.server <port>` (background), drive with `browser_run_code_unsafe` auto-play scripts, assert: reaches ending, scores match the picked options, letters fire, console has zero errors. Delete `.playwright-mcp/` residue afterwards.
- Regression rule: engine changes require re-walking the previous story; behavior must be identical.
- Final gate is the user's own playthrough ("好不好玩你说了算"). Machine-green but user-untested is NOT done.

## Git

- Commits stay local until the user explicitly says push (`推云端`). End game commits with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- All game text is original. Keep causal consistency ("得符合常识"): each scene must make sense under every upstream path.
