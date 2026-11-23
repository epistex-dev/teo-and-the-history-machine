# Puzzle design

Rules for every mini game that asks the player to think. Players are adults: a reflex toy, a follow-the-hand demo or a tap-the-glowing-thing task is not a puzzle. `SKILL.md` (Level design) points here.

## Aha

- One puzzle, one insight. The designer writes it as one sentence; a blind solver asked "why is this right?" states it.
- Build the insight on a wrong frame: a plausible assumption (a rumour card, or the player's natural guess) that two named clues contradict. The player reaches the contradiction; nothing announces it.
- Blind control: the board a solver builds with the card list hidden (from piece wording, structure and general knowledge) must fail the checker, ideally as the wrong-frame board. Design the wrong frame around what a well-read adult assumes without the cards.
- Every puzzle states its wrong frame and the clue pair that breaks it in its data (`wrongFrame.do`); only the intro tutorial may give a stated reason instead.
- Outside the tutorial, every puzzle also holds a classification decision that matters (which piece is a record, a retelling or a decoy) and a trap where intuition misleads.

## History is the key

- The sourced fact is what unlocks the answer, not the skin. Replace the history cards with neutral nouns and a blind solver must fail.
- The derived answer is the puzzle's own claim and carries that claim's status: Fact, Legend ("người ta kể rằng") or Disputed. It may differ from the chapter stamp; the UI never presents it as the chapter stamp.
- A clue card is an attributed statement: speaker, date, kind (record = a source document, modern = a modern historian's statement, retelling, hypothesis), source id, status. Legend appears only as a "people say" card and never fills a fact slot of the solution; the UI never refuses a placement because of a piece's status, so the check runs on the solution only. Game rules are labelled "luật chơi"; an inference the game computes is labelled as inference. No invented clue.
- Source links stay in the puzzle data, beside each card.
- Years and dates never show on the cards or pieces of an ordering puzzle unless the order cannot be derived from them; the order comes from what the sources say.
- Surface cues alone never solve it: the checker's surface-cue solver (printed numbers including Roman numerals, keyword overlap between card and piece) must fail.

## Fair, open book

- Class comes from cards: a sourced card that names the piece carries its class (fact, legend, hypothesis, decoy, not a record). Piece text, rules, question, title, slot labels and hints 1-3 never state or imply it, and none singles out a piece, by name or by form. A conclusion-bank text carries no label: the label is the player's answer.
- Every fact needed is on screen as a card; no outside knowledge. At every state a correct move follows from the cards without guessing (Tatham: https://www.chiark.greenend.org.uk/~sgtatham/puzzles/devel/writing.html).
- Each card is needed by a human solver, not only by the checker's solver, or is a tagged decoy. Dropping a needed card makes the solution ambiguous.
- Honest encoding: a card's `do` encodes everything its text asserts, and its text asserts nothing beyond its `do`. The checker never reads card text, so author and reviewer compare text with `do` card by card.
- Structural leaks: a decoy is not worded like the wrong frame or like a rumour card's line; slot-nonempty rules plus the piece count never force the grouping (pieces may stay unplaced, so count what the rules leave free); a card never names a slot outright, unless that forced move is the intended entry point and the rest still needs deduction; the order of well-known events is general knowledge, so it is never the only way to order them.
- One solution, or a declared solution set when the history is underdetermined (an honest "chưa có nguồn" is then a valid fill).
- Budget: ≤5 clue cards, ≤6 tokens, ≤3 chained inferences; difficulty comes from chaining and decoys, never hidden knowledge. Median solve 90-180 s, P90 ≤240 s with hints.
- Input: tokens from a bank, no typing or free drawing; tap-select then tap-slot works as well as drag; ≤6 tokens per row at 320 px.

## No-fail, brute-force-proof

- Nothing ends the puzzle in failure. Feedback covers the whole answer or a group of slots; it never marks one slot wrong and never shows distance to the answer. A board in the wrong frame gets the same reply as any other wrong board; a card is pointed at only by a hint rung the player presses. An empty board is "incomplete" and never a check; the incomplete count depends on slot minimums and on how many pieces are placed (`minPlaced`, default 1), never on which pieces. Even a group lock leaks ("a third for free"), so test the rule as built (Pope: https://dukope.com/devlogs/obra-dinn/tig-30/).
- A refused move names the broken rule ("clue 3 conflicts with your marks"), not the answer.
- Answer space ≥ `LIMITS.minSpace` states, counted over every placement the UI allows. When tapping every pair also solves it, the win needs a composed claim.

## Hints

- The player opens hints; idle never triggers one. Idle is thinking, not being stuck; no timer, ghost hand or glow pushes a hint.
- Ladder, one rung per tap: (1) restate the question, (2) point at the relevant card, (3) name the assumption to question, (4) show the first inference, (5) "Nhờ Cúc Cu soi tỏ" solves it.
- Rungs 1-3 never reveal a deduction. The first demo of the controls uses a throwaway example, never the solution.

## Curiosity and reveal

- Open with one concrete question the player can half-answer, plus one tap to commit a prediction. The reveal then lands on a gap.
- Reveal: ≤2 sentences, built from the player's own answer, showing what it changes (the rumour falls, the gap shows) plus the claim's label. No lecture.
- A later puzzle may consume earlier Notebook cards.

## Variety

- Variety is by format (assign, order, mark, transform, attribute, sort), not by skin. Over the full set one format appears ≤3 times, never in adjacent puzzles; alternate heavy and light.
- The mechanism-signature rule of `SKILL.md` still holds; for puzzles the signature is format + input + goal.

## Verification

Puzzle data is one file per puzzle; the UI and every check below read it. Mechanics, thresholds and answer syntax: the header of `scripts/puzzles.mjs`.

- Matrix (`story/minigames.json`): each row has `l2`, a hypothesis step that counts only if it survives honest encoding; when no honest L2 exists within the sources, the puzzle records the checker's explicit exemption with a reason. A row not yet authored is backed by `story/puzzles/stubs/<id>.json`, checked in stub mode; a full row keeps no stub.

- Solver (Node, runs in CI): solution count equals the declared count; removing any non-decoy card raises it; a propagation-only pass (eliminate, force single) reaches the solution with no branching; the first state has ≥1 forced move (a piece a card puts into a slot); every stub piece is named by a card or is a labelled decoy; no two puzzles share a card shape; every card has a source id and status; no Legend piece sits in a fact slot of a solution; the surface-cue solver fails.
- Class check (same script): the solver ignores piece status; with the rule constraints that are not symmetric under swapping two pieces dropped, the cards alone give exactly the declared solutions; for every legend, decoy or disputed piece, dropping the cards that name it admits a board that uses it elsewhere; a card that only classifies a piece never sits beside piece text that says its class; no text the Class bullet lists carries a class phrase or repeats a legend, decoy or disputed piece's words.
- Bots using only the feedback the UI gives: random restart, hill-climber, tap-everything, idle, hold. Pass: P(solve within 12 checks) <5%; idle, mash and hold never complete it. Stub mode runs them too, and a probe applies every card but one to prove the reply does not leak the distance.
- Blind agent playtest, 3 runs per puzzle: it gets only the built page, never the puzzle data, `story/`, `research/` or the solver, and thinks aloud with a hypothesis before each check. Afterwards it states the claim, its label and what stays unknown; a Legend stated as fact fails. Re-run with names masked and with history cards removed; the second run must fail, and its trace must cite cards, not memory.
- Read agent playtests as fairness and ambiguity checks, not as difficulty calibration: no evidence says they predict human difficulty. Two runs reading a card differently is a card-text bug.
