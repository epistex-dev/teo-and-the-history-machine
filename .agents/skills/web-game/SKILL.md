---
name: web-game
description: Web-game build rules. Use before writing or changing any browser-game code, level, art, audio, game UI or game copy, and before shipping one; covers stack, mobile and audio quirks, game feel, level design, tests, and which upstream game skill to fetch.
---

Mobile-first browser games with touch, drag or one-button input. The project's art and audio source of truth is `VISUAL_DESIGN.md` at the repo root; read it before any art, audio, font or UI work. DOM shell: load `modern-web-guidance`. Generic game dev (loops, easing, engines): `game-modding`.

## Process

1. Brief: the core experience in one sentence and the input method, fixed before any extra system.
2. Plan: one row of the level matrix (Level design), palette and layout from `VISUAL_DESIGN.md`, copy. Review the plan against its slop list before writing code.
3. Build one level on the shared core.
4. Verify (Verification), screenshot, open and look at every screenshot, critique against the `VISUAL_DESIGN.md` self-check, fix. Repeat until the ship gate is green.

## Upstream skills

Fetch the named `SKILL.md` for the job instead of rewriting it. Keep the license when copying (abagames MIT, Anthropic Apache-2.0, Phaser MIT). Adapt anything keyboard-, pixel- or arcade-leaning to touch and DOM.

| Job | Fetch |
|---|---|
| Level design, mechanism diversity | abagames `designing-mini-games`, `curating-game-concept-portfolio` |
| Game feel | abagames `maximizing-game-feel` |
| Visual direction, screen readability | abagames `directing-game-visuals`, `auditing-game-screen-readability` |
| Fonts | abagames `styling-web-game-typography` |
| Smoke test | abagames `smoke-testing-web-games` |
| Anti-slop plan, review, critique; copy | https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md (written for web pages) |
| Phaser 4 API (tweens, cameras, scale-and-responsive, input-keyboard-mouse-touch, particles, audio-and-sound, v3-to-v4-migration) | https://github.com/phaserjs/phaser/tree/master/skills ; https://phaser.io/llms.txt |
| Playwright loop with the two hooks, `progress.md` | https://github.com/openai/skills/tree/82d2c5b4/skills/.curated/develop-web-game (deleted from main; use commit 82d2c5b4) |

abagames repo: https://github.com/abagames/agentic-gamedev-skills (skills under `.agents/skills/<name>/`).

## Stack

- Phaser 4 pinned to exactly 4.2.1, Vite, TypeScript. Shell (menus, calendar, cards, dialogs) is DOM/CSS, never canvas. One Scene and one dynamic `import()` chunk per level.
- Week-1 gate: level 1 runs on real iOS Safari, Android Chrome, and the Zalo and Messenger webviews. Phaser 4 in those webviews is unverified; known issue: black opaque background on transparent `Phaser.Text` on older iOS WebGL (https://github.com/phaserjs/phaser/issues/7392). On a render, audio or budget failure, replace Phaser with a small hand-written Canvas2D core that keeps the two hooks.
- Shared core, written once before level 2: loop, scale with `devicePixelRatio`, pointer input, audio unlock, pause on hidden tab, safe-area, safe storage, `window.render_game_to_text()` (JSON state) and `window.advanceTime(ms)` (deterministic stepping).
- Self-host fonts and assets; no foreign host at runtime.

## Mobile

- Touch targets ≥48 px (hard floor 44).
- Pointer Events; set CSS `touch-action` per element; `user-select: none` on `body`.
- Decide on-screen controls from viewport or a user setting; `ontouchstart` and `maxTouchPoints` misreport on touch laptops.
- `viewport-fit=cover` with `env(safe-area-inset-*)`; canvas pixel size × `devicePixelRatio`.
- Wrap `localStorage` in try/catch (private mode throws).
- First play starts without a menu; teach by picture or animation, not text.
- Code budgets (project targets, not standards): first load (shell + Phaser + level 1) ≤600 KB gzip JS; each level ≤150 KB gzip JS. Asset budgets: `VISUAL_DESIGN.md`. Enforce JS with `size-limit` (https://github.com/ai/size-limit).
- Frames: aim 16 ms; log `long-animation-frame` entries (>50 ms) with `PerformanceObserver`.

## Audio

- Create or `resume()` the `AudioContext` inside a `click` or `touchend` handler. iOS suspends it in the background and `visibilitychange` cannot revive it: call `resume()` again on the next `touchend`.
- Pause loop and audio on `visibilitychange` to hidden.
- iPhone's silent switch mutes Web Audio. Try `navigator.audioSession.type = "playback"` (https://developer.mozilla.org/en-US/docs/Web/API/AudioSession); its effect on the switch is unverified, so test on a device. Fallback library: https://github.com/feross/unmute-ios-audio/

## Game feel

- Every input gets an instant answer on ≥2 channels (motion and sound at least).
- Every value change tweens; no instant jumps.
- A short offset and settle on contact (no squash and stretch: the art is realistic engraving); a sound for every event; particles only for big events.
- Hitstop of a few frames on impact.
- Hero object big and readable; objects leave with an effect and a trace, never vanish.
- Screenshake follows the trauma model (http://www.mathforgameprogrammers.com/gdc2016/GDC2016_Eiserloh_Squirrel_JuicingYourCameras.pdf): `trauma ∈ [0,1]`, linear decay, offset = max × `trauma²` (or `³`) × noise, translation plus rotation.
- Juice fits the material and context; decoration-only juice is cut.
- Win, lose, near-miss and hit each get a distinct answer; a loss from world state differs from a hit.
- `prefers-reduced-motion` turns off shake and flash.
- Talks behind these rules: https://www.youtube.com/watch?v=Fy0aCDmgnxg (Juice it or lose it), https://www.youtube.com/watch?v=AJdEqssNZ-U (Art of Screenshake).

## Level design

- Any mini game where the player thinks (deduction, ordering, source puzzles): read `PUZZLE_DESIGN.md` first; where it conflicts with a rule below, it wins.
- Loss comes from danger or world state, never from "did not tap". Idle, mash and hold-forever strategies must lose to skilled play; test each.
- No-fail mode applies only when the project's spec declares no-fail (story-first games): idle stalls the mini game or leaves a help button the player taps (never a timed hint for a puzzle), and mashing or holding never completes it; test each. Wrong moves get hints, never the solution.
- Score comes from in-game causes, not tap count.
- Each level runs safe → pressure → twist → resolve (kishōtenketsu, https://www.youtube.com/watch?v=dBmIkEvEBtA); no-fail: hint → twist → resolve; puzzles: wrong frame → contradiction → reveal.
- Each level shows one hero, one danger, one reward, readable in a still screenshot without HUD text.
- Keep a matrix, one row per level: main verb, input, win/lose condition, twist. No two rows share a mechanism signature (verb + input + fail condition; no-fail: verb + input + goal); theme and art do not count as variety.
- Between adjacent levels change the verb or the noun, not both (Gingold, "WarioWare", Game Studies 5.1; inference, URL unverified). Exception: no-fail story games where story scenes separate the mini games; there only the mechanism-signature rule above holds.

## Copy

- Jokes come from character and situation; lines are short and cut hard; no repeated line more than 3 times per hour.
- Same verb from button label to toast.
- Every factual claim in copy (dates, history, myth-vs-fact cards) is checked against a reputable source before it is written; keep the source URL beside the text; unverified claims ship nowhere.
- All text is rendered by game fonts. Screenshot the string `Tiếng Việt có dấu` in every font used.

## Verification

- Smoke test per runtime change: load → idle → input; fail on any console error.
- Date-gated content: Playwright `page.clock` (`install({time})`, `fastForward`, `pauseAt`; https://playwright.dev/docs/api/class-clock); test every boundary date.
- Emulate `devices['iPhone 13']` and an Android device; run on WebKit too.
- Visual regression with `toHaveScreenshot()`; generate baselines in the same environment that checks them.
- Readability pass at moments where messages overlap or a warning sits near the background's contrast.

## Ship gate

Every rule above holds, plus, measured on real iPhone and Android:

- Sound plays after the first tap, silent switch on and off.
- Network log shows no foreign host.
- Smoke test: zero console errors; `size-limit` passes.
- `VISUAL_DESIGN.md` self-check passes.
