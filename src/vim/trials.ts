/**
 * The Sword-School Curriculum — vim trials for a knight who has never held
 * the blade.
 *
 * Six tiers, ordered like ThePrimeagen's vim-fundamentals: first you walk
 * (hjkl), then you stride (words and counts), then you cut (d/y/p), then you
 * write (insert and change), then you hunt (find and search), and finally you
 * strike at the heart of things (text objects). Every trial carries a lesson
 * card written for a true novice, a three-rung hint ladder, and a parSolution
 * that the tests replay through the real engine.
 *
 * Pure and deterministic throughout: no clocks, no dice. Timestamps and
 * durations arrive from outside in TrialResult.
 */

import type { TrialResult, VimProgress, VimTrial } from '../types.js';

// ── The Trials ───────────────────────────────────────────────────────────────

export const TRIALS: VimTrial[] = [
  // ════ TIER 1 — The Squire's Footwork: h j k l x ═══════════════════════════
  {
    id: 't1-eastward-squire',
    tier: 1,
    title: 'Eastward, Squire',
    lesson: {
      heading: 'l walks right, h walks left',
      body:
        'In normal mode the letter keys ARE your feet. Press l (lowercase L) and the cursor steps one ' +
        'character to the RIGHT. Press h and it steps LEFT. No arrow keys needed — your fingers never ' +
        'leave the home row. Example: on the word "go", pressing l once moves you from the g onto the o. ' +
        'Your task: march the cursor three steps east, onto the e of "east".',
      demoKeys: 'lll',
    },
    keysTaught: ['l', 'h'],
    startLines: ['go east, brave squire'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 0, col: 3 },
    par: 3,
    parSolution: 'lll',
    hints: [
      'Your feet are on the home row: one key moves the cursor one step to the right.',
      'Press l three times: lll.',
      'You start on the g of "go". Press l — cursor on o. Press l — cursor on the space. Press l once more — you stand on the e of "east". Done.',
    ],
  },
  {
    id: 't1-spiral-stair',
    tier: 1,
    title: 'Down the Spiral Stair',
    lesson: {
      heading: 'j goes down, k goes up',
      body:
        'j moves the cursor DOWN one line; k moves it UP one line. A memory trick: the letter j hangs ' +
        'below the line like a hook pointing down. Together with h and l you can reach anywhere: ' +
        'h ← left, j ↓ down, k ↑ up, l → right. ' +
        'Your task: descend from the tower top to the dungeon floor, two lines below.',
      demoKeys: 'jj',
    },
    keysTaught: ['j'],
    startLines: ['the tower top', 'the winding stair', 'the dungeon floor'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 2, col: 0 },
    par: 2,
    parSolution: 'jj',
    hints: [
      'One key takes you down a line. Its letter hangs below the writing line, like a hook pointing down.',
      'Press j twice: jj.',
      'You start on the top line. Press j — you drop to "the winding stair". Press j again — you land on "the dungeon floor". Two keys, two floors.',
    ],
  },
  {
    id: 't1-ramparts-retreat',
    tier: 1,
    title: 'Retreat to the Ramparts',
    lesson: {
      heading: 'k climbs, h falls back — combine your steps',
      body:
        'k is the opposite of j: it moves UP one line. h is the opposite of l: one step LEFT. ' +
        'Real movement mixes them. To go up-and-left you simply press k a few times, then h a few times ' +
        '(or in any order — each press is one independent step). ' +
        'Your task: you stand mid-word on the bottom line. Climb two lines up, then fall back three steps ' +
        'west, to rest on the e of "the".',
      demoKeys: 'kkhhh',
    },
    keysTaught: ['k', 'h'],
    startLines: ['the ramparts', 'the courtyard', 'the front gate'],
    startCursor: { row: 2, col: 5 },
    goal: { kind: 'cursor', row: 0, col: 2 },
    par: 5,
    parSolution: 'kkhhh',
    hints: [
      'You need to go up twice and left three times. One key climbs, its neighbor walks left.',
      'Press k twice, then h three times: kkhhh.',
      'Start on the r of "front" (bottom line). k — up to "the courtyard". k — up to "the ramparts", still in column 5. h, h, h — three steps left lands you on the e of "the". Five keys total.',
    ],
  },
  {
    id: 't1-stray-rune',
    tier: 1,
    title: 'Strike the Stray Rune',
    lesson: {
      heading: 'x deletes the character under the cursor',
      body:
        'x is your first weapon: it deletes exactly the ONE character the cursor is standing on, like ' +
        'crossing out a letter. The cursor stays put and the rest of the line slides left to close the gap. ' +
        'The scribe wrote "draagon" — one a too many. Walk onto the extra a with l, then strike it with x. ' +
        'Walk first, THEN strike: x only hits what you stand on.',
      demoKeys: 'llx',
    },
    keysTaught: ['x'],
    startLines: ['draagon'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['dragon'] },
    par: 3,
    parSolution: 'llx',
    hints: [
      'First walk the cursor onto the extra letter, then press the key that deletes the character under you.',
      'Press l twice to stand on the first a, then x: llx.',
      'You start on the d. l — onto the r. l — onto the first a. Now x deletes that a, and "draagon" becomes "dragon". Three keys.',
    ],
  },
  {
    id: 't1-two-typos',
    tier: 1,
    title: 'Two Typos, One Blade',
    lesson: {
      heading: 'Put it together: walk with hjkl, strike with x',
      body:
        'Everything in vim is "move, then act". Here are two doubled letters on two lines: "hooard" has an ' +
        'extra o, and "ddragon" an extra d. Plan your route: step right onto the first typo, x it, drop a ' +
        'line with j, step onto the second typo, x it. Notice the cursor STAYS where it is after x — ' +
        'so after the first strike you are already in column 1, partway to the second typo.',
      demoKeys: 'lxjlx',
    },
    keysTaught: ['h', 'j', 'k', 'l', 'x'],
    startLines: ['hooard of gold', 'a ddragon dozes'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['hoard of gold', 'a dragon dozes'] },
    par: 5,
    parSolution: 'lxjlx',
    hints: [
      'Each line has one doubled letter. Fix the top one first, then travel down and right to the second.',
      'l x to fix "hooard", then j l x to fix "ddragon": lxjlx.',
      'l — onto the first o of "hooard". x — delete it: "hoard of gold", cursor still in column 1. j — down to line two, column 1 (the space after "a"). l — onto the first d of "ddragon". x — delete it: "a dragon dozes". Five keys.',
    ],
  },

  // ════ TIER 2 — Strides of the Knight: w b e 0 ^ $ gg G + counts ═══════════
  {
    id: 't2-leap-by-words',
    tier: 2,
    title: 'Leap by Words',
    lesson: {
      heading: 'w jumps to the start of the next word',
      body:
        'Walking letter by letter with l is for squires. Press w and the cursor LEAPS to the first ' +
        'character of the next word. On "forge a blade", one w takes you from f straight to a; another ' +
        'w lands on the b of "blade". Punctuation counts as its own little word, so w sometimes stops ' +
        'on a comma — that is normal. Your task: reach the b of "blade" in two leaps.',
      demoKeys: 'ww',
    },
    keysTaught: ['w'],
    startLines: ['forge a blade for the king'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 0, col: 8 },
    par: 2,
    parSolution: 'ww',
    hints: [
      'Do not walk letter by letter — there is a key that leaps a whole word at a time.',
      'Press w twice: ww.',
      'Cursor on the f of "forge". w — leap to the a (the next word). w — leap to the b of "blade". Two leaps instead of eight steps.',
    ],
  },
  {
    id: 't2-count-your-strides',
    tier: 2,
    title: 'Count Your Strides',
    lesson: {
      heading: 'A number before a motion repeats it: 4w = w four times',
      body:
        'Type a number, then a motion, and vim performs the motion that many times. 4w means "leap ' +
        'four words forward" — one command instead of pressing w w w w. This works with nearly every ' +
        'motion you know: 3j drops three lines, 5l walks five steps right. Count the words between you ' +
        'and your target, then say the count out loud as you type it. ' +
        'Your task: from "the", reach the g of "gold" — count the leaps first!',
      demoKeys: '4w',
    },
    keysTaught: ['4w', 'counts'],
    startLines: ['the dragon guards the gold hoard'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 0, col: 22 },
    par: 2,
    parSolution: '4w',
    hints: [
      'Count the word-leaps from "the" to "gold", then put that number BEFORE the w.',
      'Four leaps: type 4w.',
      'The words ahead are: dragon, guards, the, gold — four leaps. Type 4 (nothing visible happens yet — vim is listening), then w. The cursor lands on the g of "gold" in one stroke.',
    ],
  },
  {
    id: 't2-words-end',
    tier: 2,
    title: "To the Word's End",
    lesson: {
      heading: 'e jumps to the END of a word',
      body:
        'Where w lands at the START of the next word, e lands on the LAST letter of a word. From the s ' +
        'of "sharpen", e puts you on the final n. Press e again and you ride to the end of the NEXT ' +
        'word. Counts work too: 3e means "end of the third word from here". ' +
        'Your task: land exactly on the final e of "blade", three word-ends away.',
      demoKeys: '3e',
    },
    keysTaught: ['e'],
    startLines: ['sharpen the blade well'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 0, col: 16 },
    par: 2,
    parSolution: '3e',
    hints: [
      'You need the key that stops at the ends of words, not the starts — with a count in front.',
      'Type 3e — a count of three, then the word-end key.',
      'e from the s of "sharpen" would stop on its final n; a second e on the e of "the"; a third on the e of "blade". Roll all three into one stroke: 3e.',
    ],
  },
  {
    id: 't2-fall-back',
    tier: 2,
    title: 'Fall Back!',
    lesson: {
      heading: 'b leaps BACKWARD to the start of a word',
      body:
        'b is w in retreat: it jumps backward to the beginning of the current word, then to the ' +
        'beginnings of earlier words. If you are mid-word, the first b snaps to that word\'s own first ' +
        'letter. Counts work as always: 4b retreats four word-beginnings. ' +
        'Your task: you stand at the very end of the line, on the last n of "cauldron". Retreat to the ' +
        'b of "brew".',
      demoKeys: '4b',
    },
    keysTaught: ['b'],
    startLines: ['potions brew in the cauldron'],
    startCursor: { row: 0, col: 27 },
    goal: { kind: 'cursor', row: 0, col: 8 },
    par: 2,
    parSolution: '4b',
    hints: [
      'There is a backward twin of w. Count how many word-starts lie between you and "brew".',
      'Type 4b — a count of four, then the backward word key.',
      'From the final n: b snaps to the c of "cauldron" (your own word\'s start), b again to "the", again to "in", and a fourth lands on the b of "brew". As one stroke: 4b.',
    ],
  },
  {
    id: 't2-lines-edge',
    tier: 2,
    title: "The Line's Far Edge",
    lesson: {
      heading: '$ jumps to the end of the line, 0 to the very start',
      body:
        '$ (dollar) throws the cursor to the LAST character of the line, no matter how long it is. ' +
        '0 (zero) snaps back to the very first column. There is also ^ (caret), which goes to the first ' +
        'NON-blank character — handy on indented lines. ' +
        'Your task: drop one line down with j, then ride $ to the final t of "night".',
      demoKeys: 'j$',
    },
    keysTaught: ['$', '0', '^'],
    startLines: ['the moat lies still', 'the drawbridge groans at night'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 1, col: 29 },
    par: 2,
    parSolution: 'j$',
    hints: [
      'Go down one line, then use the key that flies to the end of a line in a single stroke.',
      'Press j then $: j$.',
      'j drops you to the second line, still in column 0. $ hurls the cursor to the line\'s last character — the t of "night". Two keys. (0 would snap you back to the start; ^ to the first non-blank.)',
    ],
  },
  {
    id: 't2-name-the-floor',
    tier: 2,
    title: 'Name the Floor',
    lesson: {
      heading: 'G with a number jumps to that line; gg goes to the top, G alone to the bottom',
      body:
        'G is the long-distance teleport. Alone, G drops you on the LAST line of the file. gg (two g\'s) ' +
        'takes you to the FIRST line. Give G a number and it goes to exactly that line: 4G means ' +
        '"line four, counted from the top". After the jump the cursor parks on the line\'s first ' +
        'non-blank character. Your task: the armory is the fourth floor of the keep — jump straight to it.',
      demoKeys: '4G',
    },
    keysTaught: ['G', 'gg'],
    startLines: ['the watchtower', 'the granary', 'the chapel', '  the armory', 'the stables', 'the crypt'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 3, col: 2 },
    par: 2,
    parSolution: '4G',
    hints: [
      'Do not tap j over and over — name the line number, then use the capital-letter teleport.',
      'Type 4G (capital G).',
      'The armory is on line 4. Type 4, then SHIFT-g for capital G. You land on line 4, and because the line is indented, the cursor parks on the t of "the" — the first non-blank character. (gg would jump to the top, plain G to the bottom.)',
    ],
  },

  // ════ TIER 3 — The Cutting Arts: d y p ════════════════════════════════════
  {
    id: 't3-cut-craven-word',
    tier: 3,
    title: 'Cut the Craven Word',
    lesson: {
      heading: 'd + motion deletes what the motion covers: dw deletes a word',
      body:
        'd means delete, but it never acts alone — it waits for a motion to tell it WHAT to delete. ' +
        'dw = "delete from here to where w would land", i.e. the word under the cursor plus the space ' +
        'after it. This is vim\'s grammar: verb (d) + motion (w) = action. Anything you can move over, ' +
        'you can delete. Your task: leap to "foul" with 2w, then erase it with dw.',
      demoKeys: '2wdw',
    },
    keysTaught: ['d', 'dw'],
    startLines: ['slay the foul dragon'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['slay the dragon'] },
    par: 4,
    parSolution: '2wdw',
    hints: [
      'Travel to the start of the unwanted word, then speak the delete verb followed by the word motion.',
      'Type 2w to reach "foul", then dw: 2wdw.',
      '2w leaps two words: from "slay" past "the" onto the f of "foul". Now d (vim waits — it wants a motion) then w: everything from f up to the d of "dragon" is cut, space included. "slay the dragon" remains. Four keys.',
    ],
  },
  {
    id: 't3-sever-the-line',
    tier: 3,
    title: 'Sever the Line',
    lesson: {
      heading: 'dd deletes the whole line',
      body:
        'Double the verb and it acts on the entire LINE: dd deletes the line the cursor is on, no matter ' +
        'where in the line you stand. The lines below slide up to close the gap, and the deleted line is ' +
        'remembered (more on that soon — you will paste it back in a later trial). ' +
        'Your task: the second step of this potion recipe is a disaster. Go down one line and remove it whole.',
      demoKeys: 'jdd',
    },
    keysTaught: ['dd'],
    startLines: ['brew the potion', 'spill it everywhere', 'serve the queen'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['brew the potion', 'serve the queen'] },
    par: 3,
    parSolution: 'jdd',
    hints: [
      'Move down to the offending line, then strike the delete verb TWICE to take the whole line.',
      'Press j, then dd: jdd.',
      'j drops you onto "spill it everywhere". Then d d — the doubled verb deletes the entire line, and "serve the queen" slides up. Three keys, one ruined step removed.',
    ],
  },
  {
    id: 't3-burn-to-lines-end',
    tier: 3,
    title: "Burn to Line's End",
    lesson: {
      heading: 'd$ deletes from the cursor to the end of the line',
      body:
        'The verb d works with EVERY motion you know — including $. d$ deletes from the cursor through ' +
        'the last character of the line. Stand at the first character you want gone, and everything ' +
        'from there to the edge burns away. ' +
        'Your task: the order "raise the gate, lower the gate" contradicts itself. Leap to the comma ' +
        'with 3w (remember: punctuation is its own word), then burn from there to the end.',
      demoKeys: '3wd$',
    },
    keysTaught: ['d$'],
    startLines: ['raise the gate, lower the gate'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['raise the gate'] },
    par: 4,
    parSolution: '3wd$',
    hints: [
      'Stand on the first character you want gone (the comma), then combine the delete verb with the end-of-line motion.',
      'Type 3w to land on the comma, then d$: 3wd$.',
      '3w leaps: "the", "gate", then the comma — punctuation counts as a word, so w stops on it. Now d then $: everything from the comma to the end of the line is deleted. "raise the gate" survives. Four keys.',
    ],
  },
  {
    id: 't3-echo-the-incantation',
    tier: 3,
    title: 'Echo the Incantation',
    lesson: {
      heading: 'yy copies the line, p pastes it below',
      body:
        'y means yank — vim\'s word for copy. Doubled, yy yanks the whole current line without changing ' +
        'anything. p means put (paste): after a line-yank, p lays the copied line BELOW the cursor ' +
        '(capital P would lay it above). Delete does the same trick: whatever dd removes, p can put back. ' +
        'Your task: the cauldron incantation must be spoken twice. Yank the line and put a copy below it.',
      demoKeys: 'yyp',
    },
    keysTaught: ['yy', 'p', 'P'],
    startLines: ['stir the cauldron thrice'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['stir the cauldron thrice', 'stir the cauldron thrice'] },
    par: 3,
    parSolution: 'yyp',
    hints: [
      'Copy the line with the doubled yank verb, then paste it below with a single key.',
      'Type yy then p: yyp.',
      'yy yanks (copies) the whole line — nothing visible happens, but vim has it memorized. p puts the copy on a new line below. The incantation now appears twice. Three keys.',
    ],
  },
  {
    id: 't3-marching-order',
    tier: 3,
    title: 'Swap the Marching Order',
    lesson: {
      heading: 'ddp moves a line down: delete it, then put it back below',
      body:
        'Here is the classic vim two-step: dd deletes a line AND remembers it; p puts the remembered ' +
        'line below the cursor. Do them back to back and the deleted line leapfrogs the one after it — ' +
        'the two lines swap. ' +
        'Your task: the battle plan is out of order — the beacon must come second. Swap the two lines ' +
        'with ddp.',
      demoKeys: 'ddp',
    },
    keysTaught: ['ddp'],
    startLines: ['second: light the beacon', 'first: climb the tower'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['first: climb the tower', 'second: light the beacon'] },
    par: 3,
    parSolution: 'ddp',
    hints: [
      'Delete the top line — vim remembers it — then immediately put it back below the line you land on.',
      'Type dd then p: ddp.',
      'dd removes "second: light the beacon" and the other line slides up under your cursor. p puts the remembered line below it. The two lines have traded places. This ddp swap is a famous vim move — three keys.',
    ],
  },
  {
    id: 't3-old-switcheroo',
    tier: 3,
    title: 'The Old Switcheroo',
    lesson: {
      heading: 'xp swaps two characters: cut one, paste it after the next',
      body:
        'p pastes CHARACTERS too, not just lines. x cuts the character under the cursor (and remembers ' +
        'it); p then pastes it right AFTER the cursor. So on a typo like "teh", standing on the e: ' +
        'x cuts the e (leaving "th", cursor on the h), p drops the e back after the h — "the". ' +
        'Two transposed letters fixed in two keys. ' +
        'Your task: walk onto the e of "teh", then perform the switcheroo.',
      demoKeys: 'lxp',
    },
    keysTaught: ['xp'],
    startLines: ['teh dragon stirs'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['the dragon stirs'] },
    par: 3,
    parSolution: 'lxp',
    hints: [
      'Stand on the FIRST of the two swapped letters; cut it, then paste it back one position later.',
      'Press l to reach the e, then x, then p: lxp.',
      'l steps onto the e (the letter that is too early). x cuts it — "th dragon stirs", cursor on the h. p pastes the e after the h: "the dragon stirs". The legendary xp swap. Three keys.',
    ],
  },

  // ════ TIER 4 — The Scribe's Arts: i a I A o O, c, <esc> ═══════════════════
  {
    id: 't4-draw-the-quill',
    tier: 4,
    title: 'Draw the Quill',
    lesson: {
      heading: 'i enters insert mode — now you TYPE text; <esc> returns to normal mode',
      body:
        'Until now every key was a command. Press i (insert) and vim switches modes: now the keys you ' +
        'press become TEXT, typed in front of the cursor, exactly like a normal editor. When you finish, ' +
        'press the Escape key to sheathe the quill and return to normal mode, where hjkl are feet again. ' +
        'This rhythm — i, type, Escape — is the heartbeat of vim. ' +
        'Your task: this dragon needs a title. Insert the text "fire " before it.',
      demoKeys: 'ifire <esc>',
    },
    keysTaught: ['i', '<esc>'],
    startLines: ['dragon!'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['fire dragon!'] },
    par: 7,
    parSolution: 'ifire <esc>',
    hints: [
      'One key turns vim into a typewriter; the Escape key turns it back.',
      'Press i, type fire and a space, then press Escape.',
      'i enters insert mode at the cursor (before the d). Type f, i, r, e, then a space — they appear as text. Press Escape: you are back in normal mode and the line reads "fire dragon!". Seven keys including the Escape.',
    ],
  },
  {
    id: 't4-seal-the-letter',
    tier: 4,
    title: 'Seal the Letter',
    lesson: {
      heading: 'A jumps to the end of the line AND enters insert mode',
      body:
        'Lowercase a inserts AFTER the cursor (i inserts before it). Capital A is the long version: it ' +
        'leaps to the very END of the line and starts inserting there, all in one key. Its mirror, ' +
        'capital I, inserts at the start of the line. No need to travel with $ first — A does both at once. ' +
        'Your task: the letter to the dragon ends too abruptly. Append " out" to the end of the line.',
      demoKeys: 'A out<esc>',
    },
    keysTaught: ['A', 'a', 'I'],
    startLines: ['dear dragon, please move'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['dear dragon, please move out'] },
    par: 6,
    parSolution: 'A out<esc>',
    hints: [
      'There is a single capital letter that flies to the end of the line and readies the quill there.',
      'Press capital A, type a space then out, press Escape.',
      'Capital A (SHIFT-a) jumps past the final e of "move" and enters insert mode. Type space, o, u, t. Press Escape to finish. The plea now reads "...please move out". Six keys.',
    ],
  },
  {
    id: 't4-new-ledger-line',
    tier: 4,
    title: 'A New Line in the Ledger',
    lesson: {
      heading: 'o opens a new empty line BELOW and starts inserting',
      body:
        'o (open) creates a fresh empty line below the cursor and drops you straight into insert mode on ' +
        'it — three jobs in one key: move down, make a line, draw the quill. Capital O does the same but ' +
        'opens the line ABOVE. Remember to press Escape when you finish writing. ' +
        'Your task: the quest ledger needs a second entry. Open a line below and write ' +
        '"quest two: fetch fire".',
      demoKeys: 'oquest two: fetch fire<esc>',
    },
    keysTaught: ['o', 'O'],
    startLines: ['quest one: fetch water'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['quest one: fetch water', 'quest two: fetch fire'] },
    par: 23,
    parSolution: 'oquest two: fetch fire<esc>',
    hints: [
      'One lowercase key opens a fresh line below you and readies the quill — no need to move first.',
      'Press o, type quest two: fetch fire, press Escape.',
      'o opens an empty line under "quest one..." and puts you in insert mode at its start. Type the entry exactly: quest two: fetch fire. Press Escape to return to normal mode. (Capital O would have opened the line above instead.)',
    ],
  },
  {
    id: 't4-change-battle-cry',
    tier: 4,
    title: 'Change the Battle Cry',
    lesson: {
      heading: 'c means change: it deletes what the motion covers AND drops you into typing mode',
      body:
        'c is the third great verb, after d and y. cw = "change word": it deletes the word under the ' +
        'cursor and immediately enters insert mode so you can type the replacement — delete and retype ' +
        'in one stroke. (Helpfully, cw eats only the word itself and leaves the space after it, so your ' +
        'spacing survives.) Finish with Escape, as always. ' +
        'Your task: the cry "attack" is wrong — change it to "defend".',
      demoKeys: 'cwdefend<esc>',
    },
    keysTaught: ['c', 'cw'],
    startLines: ['attack the gate at dawn'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['defend the gate at dawn'] },
    par: 9,
    parSolution: 'cwdefend<esc>',
    hints: [
      'There is a verb that deletes AND opens the quill in one motion — pair it with the word motion.',
      'Type cw, then defend, then Escape.',
      'With the cursor on the a of "attack": c, then w. The word vanishes and you are typing. Enter d, e, f, e, n, d — then Escape. The line now reads "defend the gate at dawn", spacing untouched. Nine keys.',
    ],
  },
  {
    id: 't4-rewrite-prophecy',
    tier: 4,
    title: "Rewrite the Prophecy's End",
    lesson: {
      heading: 'c$ changes from the cursor to the end of the line',
      body:
        'Just like d, the change verb c accepts any motion. c$ wipes everything from the cursor to the ' +
        'end of the line and leaves you in insert mode to write the new ending. Travel first, then ' +
        'change: use 3w to stand on the first character you want rewritten. ' +
        'Your task: the password "swordfish" is compromised. Change everything from it onward to ' +
        '"dragonscale".',
      demoKeys: '3wc$dragonscale<esc>',
    },
    keysTaught: ['c$'],
    startLines: ['the password is swordfish'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['the password is dragonscale'] },
    par: 16,
    parSolution: '3wc$dragonscale<esc>',
    hints: [
      'Leap word by word to "swordfish", then use the change verb with the end-of-line motion.',
      'Type 3w, then c$, then dragonscale, then Escape.',
      '3w leaps "password", "is", landing on the s of "swordfish". c$ deletes from there to the line\'s end and opens insert mode. Type dragonscale, press Escape. The prophecy now ends in dragonscale. Sixteen keys.',
    ],
  },
  {
    id: 't4-raze-and-rebuild',
    tier: 4,
    title: 'Raze and Rebuild the Line',
    lesson: {
      heading: 'cc wipes the whole line and lets you retype it',
      body:
        'Doubling the change verb works like doubling d: cc clears the ENTIRE line (wherever you stand ' +
        'on it) and puts you in insert mode on the now-empty line. It is dd and o rolled into one. ' +
        'Your task: the middle order on the provisions list is unfit for a wizard. Go down one line and ' +
        'rewrite it entirely as "water for the wizard".',
      demoKeys: 'jccwater for the wizard<esc>',
    },
    keysTaught: ['cc'],
    startLines: ['ale for the guards', 'mead for the king', 'wine for the queen'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['ale for the guards', 'water for the wizard', 'wine for the queen'] },
    par: 24,
    parSolution: 'jccwater for the wizard<esc>',
    hints: [
      'Move down to the offending line, then double the change verb to raze and rewrite it.',
      'Press j, then cc, type water for the wizard, press Escape.',
      'j drops to "mead for the king". c c — the line empties and the quill is drawn. Type water for the wizard, then Escape. The middle line is reborn; its neighbors are untouched.',
    ],
  },

  // ════ TIER 5 — The Hunter's Arts: f F t T ; , / n N ═══════════════════════
  {
    id: 't5-hunt-the-rune',
    tier: 5,
    title: 'Hunt the Rune',
    lesson: {
      heading: 'f + a character jumps ONTO its next occurrence; ; repeats the hunt',
      body:
        'f (find) takes one more keypress — the character you seek — and leaps the cursor onto the next ' +
        'occurrence of it on this line. fv means "find the next v". Wrong one? Press ; (semicolon) to ' +
        'repeat the same hunt further along, and , (comma) to repeat it backward. ' +
        'Your task: land on the v of "lava". The first fv finds the v in "over" — press ; to leap onward.',
      demoKeys: 'fv;',
    },
    keysTaught: ['f', ';', ','],
    startLines: ['leap over the lava pit'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 0, col: 16 },
    par: 3,
    parSolution: 'fv;',
    hints: [
      'Use the find key with the letter you are hunting; if the first catch is the wrong one, repeat the hunt with the semicolon.',
      'Type fv then ; — fv;.',
      'f then v leaps onto the v of "over" — the first v on the line, but not yours. Press ; to repeat the hunt: the cursor lands on the v of "lava". Three keys, no counting of columns.',
    ],
  },
  {
    id: 't5-cut-until',
    tier: 5,
    title: 'Cut Until the Gate',
    lesson: {
      heading: 't stops just BEFORE a character — perfect for surgical deletes',
      body:
        't (till) is f\'s careful sibling: tg moves to the character just BEFORE the next g, not onto it. ' +
        'Pair it with the delete verb: dtg = "delete up to, but not including, the next g". The target ' +
        'character survives. This is how you trim words without harming what follows. ' +
        'Your task: the order says "open the iron gate" but the iron gate is rusted shut. Leap to "iron" ' +
        'with 2w, then delete until the g of "gate" — sparing the g.',
      demoKeys: '2wdtg',
    },
    keysTaught: ['t', 'dt'],
    startLines: ['open the iron gate'],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'text', lines: ['open the gate'] },
    par: 5,
    parSolution: '2wdtg',
    hints: [
      'Travel to the doomed word, then delete UP TO (but not including) the first letter of the word you keep.',
      'Type 2w, then dtg: 2wdtg.',
      '2w leaps past "the" onto the i of "iron". Now d, t, g: delete till the next g — "iron " vanishes (space and all), and the g of "gate" is spared. "open the gate" remains. Five keys.',
    ],
  },
  {
    id: 't5-look-back',
    tier: 5,
    title: 'Look Back, Knight',
    lesson: {
      heading: 'Capital F hunts BACKWARD; ; repeats in the same direction',
      body:
        'Capital F is f turned around: Fo leaps backward onto the previous o on the line. (Capital T is ' +
        'the backward "till".) The repeat keys still serve you: ; repeats the last hunt in its own ' +
        'direction, , repeats it the opposite way. ' +
        'Your task: you stand at the end of the wall. Hunt backward to the o of "on" — the first Fo ' +
        'catches the o of "swords"... no wait, it catches the closer one. Press ; if your first catch ' +
        'is not the o of "swords".',
      demoKeys: 'Fo;',
    },
    keysTaught: ['F', 'T'],
    startLines: ['seven swords on the wall'],
    startCursor: { row: 0, col: 23 },
    goal: { kind: 'cursor', row: 0, col: 8 },
    par: 3,
    parSolution: 'Fo;',
    hints: [
      'Hunt backward with the capital twin of f, then repeat the hunt with the semicolon.',
      'Type Fo then ; — Fo;.',
      'From the final l of "wall": F then o leaps BACKWARD onto the o of "on" (the nearest o behind you). Press ; to repeat the backward hunt — you land on the o of "swords". Three keys.',
    ],
  },
  {
    id: 't5-seeking-spell',
    tier: 5,
    title: 'Speak the Seeking Spell',
    lesson: {
      heading: '/ searches the whole scroll: type the word, press Enter, and leap to it',
      body:
        'f hunts on one line; / (slash) hunts the whole file. Press /, type the text you seek (you will ' +
        'see it appear), then press Enter. The cursor leaps to the next place that text occurs — across ' +
        'as many lines as needed, wrapping around the end. ' +
        'Your task: somewhere in the armory inventory lies an "ember" blade. Seek it with /ember and Enter.',
      demoKeys: '/ember<cr>',
    },
    keysTaught: ['/'],
    startLines: [
      'the armory holds:',
      'three iron shields',
      'one cracked helm',
      'the ember blade',
      'two oak staves',
    ],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 3, col: 4 },
    par: 7,
    parSolution: '/ember<cr>',
    hints: [
      'The slash key opens a search across every line — type the word you want, then press Enter.',
      'Type /ember and press Enter.',
      'Press / — vim waits for your search text. Type e, m, b, e, r, then press Enter. The cursor leaps to the e of "ember" on the fourth line. Seven keys to cross the whole scroll.',
    ],
  },
  {
    id: 't5-next-and-next',
    tier: 5,
    title: 'Next, and Next Again',
    lesson: {
      heading: 'n repeats the last search forward; N repeats it backward',
      body:
        'After a / search, vim remembers the term. Press n (next) to leap to the following match, again ' +
        'and again; capital N walks the matches in reverse. Searches wrap: past the last match, n circles ' +
        'to the first. ' +
        'Your task: the vault ledger lists gold three times. Search /gold, then press n once to reach the ' +
        'SECOND entry.',
      demoKeys: '/gold<cr>n',
    },
    keysTaught: ['n', 'N'],
    startLines: [
      'the ledger of the vault:',
      'gold in the chest',
      'silver on the shelf',
      'gold under the floor',
      'copper in the cup',
      'gold behind the wall',
    ],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 3, col: 0 },
    par: 7,
    parSolution: '/gold<cr>n',
    hints: [
      'Search once with slash and Enter, then use the single key that hops to the NEXT match.',
      'Type /gold, press Enter, then press n.',
      '/gold and Enter lands on the first "gold" (line 2). Press n — the cursor hops to the next match: "gold under the floor". (N would hop backward; n past the last match wraps to the first.) Seven keys.',
    ],
  },

  // ════ TIER 6 — Strike the Heart: text objects iw aw i" i( i{ ══════════════
  {
    id: 't6-words-heart',
    tier: 6,
    title: "Strike the Word's Heart",
    lesson: {
      heading: 'ciw changes the word you are INSIDE — no need to stand at its start',
      body:
        'Text objects name a THING instead of a direction. iw means "inner word": the whole word the ' +
        'cursor is anywhere inside. So ciw = change inner word — it works even if you are standing on ' +
        'the word\'s middle letter, where cw would only change the rest of it. Verb + object: c + iw. ' +
        'Then type the new word and press Escape. ' +
        'Your task: you stand mid-word in "firebolt". Change the whole word to "icebolt" without moving.',
      demoKeys: 'ciwicebolt<esc>',
    },
    keysTaught: ['iw', 'ciw'],
    startLines: [
      'the war council speaks:',
      'send the knights now,',
      'but the wizard mutters',
      'cast firebolt at the gate',
      'and the king nods once,',
      'so it is decreed',
    ],
    startCursor: { row: 3, col: 9 },
    goal: {
      kind: 'text',
      lines: [
        'the war council speaks:',
        'send the knights now,',
        'but the wizard mutters',
        'cast icebolt at the gate',
        'and the king nods once,',
        'so it is decreed',
      ],
    },
    par: 11,
    parSolution: 'ciwicebolt<esc>',
    hints: [
      'You are already inside the word — use the change verb with the "inner word" object instead of moving to its start.',
      'Type ciw, then icebolt, then Escape.',
      'You stand on the b in the middle of "firebolt". c, i, w — the ENTIRE word vanishes (not just the half after the cursor) and the quill is drawn. Type icebolt, press Escape. Eleven keys, zero travel.',
    ],
  },
  {
    id: 't6-empty-the-words',
    tier: 6,
    title: 'Unsay the Spoken Word',
    lesson: {
      heading: 'di" deletes everything INSIDE the quotes, leaving the quotes standing',
      body:
        'i" means "inner quotes": the text between a pair of double quotes, not the quotes themselves. ' +
        'di" deletes that text and leaves an empty "". You do not even have to stand inside the quotes — ' +
        'anywhere on the line before the closing quote, vim finds the quoted text for you. ' +
        '(a" — "around quotes" — would take the quote marks too.) ' +
        'Your task: take back what was said. Empty the quoted surrender from the start of the line.',
      demoKeys: 'di"',
    },
    keysTaught: ['i"', 'a"'],
    startLines: [
      'the parley terms:',
      'we say "surrender now" boldly',
      'they say nothing back',
      'the wind says little',
      'the crows say less',
      'so much for words',
    ],
    startCursor: { row: 1, col: 0 },
    goal: {
      kind: 'text',
      lines: [
        'the parley terms:',
        'we say "" boldly',
        'they say nothing back',
        'the wind says little',
        'the crows say less',
        'so much for words',
      ],
    },
    par: 3,
    parSolution: 'di"',
    hints: [
      'Use the delete verb with the "inner quotes" object — no need to walk into the quotes first.',
      'Type di" — three keys.',
      'From the w at the start of the line: d, i, " — vim finds the next pair of double quotes and deletes everything between them. The line reads: we say "" boldly. The quotes stand, emptied. Three keys.',
    ],
  },
  {
    id: 't6-gut-the-parens',
    tier: 6,
    title: 'Gut the Parentheses',
    lesson: {
      heading: 'di( deletes everything inside the surrounding ( )',
      body:
        'i( is "inner parentheses": the text between the ( ) pair that surrounds the cursor. di( empties ' +
        'them; ci( empties them and lets you type a replacement; yi( copies their contents. The cursor ' +
        'can be anywhere between the parens — vim finds both ends itself, even matching nested pairs ' +
        'correctly. ' +
        'Your task: the ballista order is too specific for the war log. Stand inside the parens of ' +
        'aimBallista and gut them.',
      demoKeys: 'di(',
    },
    keysTaught: ['i(', 'a('],
    startLines: [
      'castle defense, in order:',
      'raiseGate()',
      'aimBallista(at the wyrm)',
      'lightBeacon()',
      'soundHorn(twice, loudly)',
      'prayHard()',
      'hold fast',
    ],
    startCursor: { row: 2, col: 15 },
    goal: {
      kind: 'text',
      lines: [
        'castle defense, in order:',
        'raiseGate()',
        'aimBallista()',
        'lightBeacon()',
        'soundHorn(twice, loudly)',
        'prayHard()',
        'hold fast',
      ],
    },
    par: 3,
    parSolution: 'di(',
    hints: [
      'You stand inside the parentheses already — use the delete verb with the "inner parentheses" object.',
      'Type di( — three keys.',
      'The cursor sits mid-phrase inside aimBallista\'s parens. d, i, ( — vim walks out to the surrounding ( and ), and deletes everything between them: aimBallista(). Three keys; the other lines never flinch.',
    ],
  },
  {
    id: 't6-hollow-the-keep',
    tier: 6,
    title: 'Hollow the Keep',
    lesson: {
      heading: 'di{ empties a { } block — even across many lines',
      body:
        'i{ is "inner braces": everything between the { and } that enclose the cursor, even when they ' +
        'sit on different lines. di{ deletes the whole block body in one stroke and pulls the braces ' +
        'together. This is the move that makes vim feel like sorcery in real code. ' +
        'Your task: the plan inside the braces is too bold. Stand anywhere in the block and hollow it out.',
      demoKeys: 'di{',
    },
    keysTaught: ['i{', 'a{'],
    startLines: [
      'if (dragonSleeps) {',
      '  steal the gold',
      '  tiptoe away',
      '  brag later',
      '}',
      'else {',
      '}',
    ],
    startCursor: { row: 2, col: 4 },
    goal: {
      kind: 'text',
      lines: ['if (dragonSleeps) {}', 'else {', '}'],
    },
    par: 3,
    parSolution: 'di{',
    hints: [
      'The braces enclose you from lines away — the delete verb plus the "inner braces" object reaches both.',
      'Type di{ — three keys.',
      'You stand on "tiptoe", deep in the block. d, i, { — vim finds the { above and the } below and deletes the three lines between them, pulling the braces together: if (dragonSleeps) {}. Three keys to hollow a keep.',
    ],
  },
  {
    id: 't6-swallow-whole',
    tier: 6,
    title: 'Swallow the Word Whole',
    lesson: {
      heading: 'daw deletes a word AND its trailing space — "around word"',
      body:
        'Where iw is the word alone, aw is the word AROUND: the word plus the space beside it. ' +
        'daw deletes both, so the remaining words close ranks with perfect single spacing — no double ' +
        'space left behind, which is what diw would leave. Use daw to remove a word; use diw or ciw to ' +
        'replace one. ' +
        'Your task: the recipe overstates the peppers. From inside "really", swallow the word whole.',
      demoKeys: 'daw',
    },
    keysTaught: ['aw', 'daw'],
    startLines: [
      'the recipe scroll:',
      'add three really hot peppers',
      'stir once, widdershins',
      'do not breathe the fumes',
      'serve it to the dragon',
      'run',
    ],
    startCursor: { row: 1, col: 12 },
    goal: {
      kind: 'text',
      lines: [
        'the recipe scroll:',
        'add three hot peppers',
        'stir once, widdershins',
        'do not breathe the fumes',
        'serve it to the dragon',
        'run',
      ],
    },
    par: 3,
    parSolution: 'daw',
    hints: [
      'Delete "around" the word, not just inside it — that takes the extra space with it.',
      'Type daw — three keys.',
      'You stand on the a inside "really". d, a, w — the word AND the space after it vanish: "add three hot peppers", single spaces intact. (diw would have left "add three  hot" with two spaces.) Three keys.',
    ],
  },
  {
    id: 't6-thrice-cut',
    tier: 6,
    title: 'Thrice-Cut',
    lesson: {
      heading: 'A count before dd reaps many lines — 3dd is to dd what 4w was to w',
      body:
        'The count you learned in Tier 2 — 4w bounds four words at once — works on line-strikes too. dd ' +
        'reaps one line; 3dd reaps three, 2cc changes two, 3yy yanks three. Count first, then the ' +
        'doubled verb. An overlong count simply clamps to the end of the scroll. ' +
        'Your task: three forged orders sit atop the true command — reap all three at once.',
      demoKeys: '3dd',
    },
    keysTaught: ['dd', 'cc', 'yy'],
    startLines: [
      'the forged orders read:',
      'burn the eastern bridge',
      'poison the well',
      'spare no farmstead',
      'hold the line and wait',
    ],
    startCursor: { row: 1, col: 0 },
    goal: { kind: 'text', lines: ['the forged orders read:', 'hold the line and wait'] },
    par: 3,
    parSolution: '3dd',
    hints: [
      'Put a count in front of the line-reaping verb, the way you once put one in front of w.',
      'Type 3dd — three keys.',
      'From the first forged order: 3, then dd. As 4w leapt four words, 3dd reaps three lines in one breath — the three lies vanish and "hold the line and wait" stands alone. Three keys.',
    ],
  },
  {
    id: 't6-mark-then-strike',
    tier: 6,
    title: 'Mark, Then Strike',
    lesson: {
      heading: 'V marks whole lines first, then d strikes them — select, then act',
      body:
        'Every art so far has been verb-then-target: d, then a motion. Visual-line flips it. Press V to ' +
        'start marking lines, grow the mark with j or k, and only then strike with d (or y, or c). You ' +
        'select first and act second, watching the block grow before the blade falls. ' +
        'Your task: mark the three lines of the broken oath and strike them as one.',
      demoKeys: 'Vjjd',
    },
    keysTaught: ['V', 'j', 'd'],
    startLines: [
      'the broken oath, thrice sworn:',
      'I swore to guard the keep',
      'I swore to keep no secrets',
      'I swore to never flee',
      'and every word was a lie',
    ],
    startCursor: { row: 1, col: 0 },
    goal: { kind: 'text', lines: ['the broken oath, thrice sworn:', 'and every word was a lie'] },
    par: 4,
    parSolution: 'Vjjd',
    hints: [
      'Enter the select-first stance, grow the mark down two lines, then strike.',
      'Type V, then j, then j, then d.',
      'V marks the first oath and the stance reads VISUAL LINE. j, then j, extend the mark down over all three oaths. Now d falls on the whole block, and only the final line remains. Four keys — select, then strike.',
    ],
  },
  {
    id: 't6-grand-trial',
    tier: 6,
    title: 'The Grand Trial of the Blade',
    lesson: {
      heading: 'Chain your arts: search across the scroll, then strike with a text object',
      body:
        'A master strings the arts together: / carries you anywhere in the file; a text object strikes ' +
        'precisely once you arrive. Find a word with /word and Enter, then change it where you land ' +
        'with ciw — the search drops you ON the word, and ciw needs nothing more. ' +
        'Your task: somewhere in the quartermaster\'s list hides a "rusty" torch. Seek it, then change ' +
        'the word to "gleaming". Two arts, one breath.',
      demoKeys: '/rusty<cr>ciwgleaming<esc>',
    },
    keysTaught: ['/', 'ciw'],
    startLines: [
      'the quartermaster reads the list:',
      'ten loaves of bread',
      'two casks of mead',
      'one rusty torch',
      'five coils of rope',
      'three sacks of flour',
      'a spare saddle',
      'nothing else today',
    ],
    startCursor: { row: 0, col: 0 },
    goal: {
      kind: 'text',
      lines: [
        'the quartermaster reads the list:',
        'ten loaves of bread',
        'two casks of mead',
        'one gleaming torch',
        'five coils of rope',
        'three sacks of flour',
        'a spare saddle',
        'nothing else today',
      ],
    },
    par: 19,
    parSolution: '/rusty<cr>ciwgleaming<esc>',
    hints: [
      'First seek the word with the slash spell; the search lands you on it, where a change-inner-word finishes the deed.',
      'Type /rusty and Enter, then ciw, then gleaming, then Escape.',
      'Press / and type rusty, then Enter — the cursor leaps to the r of "rusty" four lines down. Now c, i, w — the word vanishes, quill drawn. Type gleaming, press Escape. The torch gleams. Nineteen keys across eight lines.',
    ],
  },

  // ── Tier 7 · Advanced Arts ───────────────────────────────────────────────
  {
    id: 't7-choose-your-cut',
    tier: 7,
    title: 'Choose Your Cut',
    lesson: {
      heading: 'cw, ciw, diw, daw — four word-strikes, each for a different intent',
      body:
        'You already wield every word-strike; the art now is choosing. cw changes from a word\'s start; ' +
        'ciw changes the whole word from anywhere inside it; daw deletes a word and its trailing space, ' +
        'closing the gap; diw deletes the word but leaves the space. Replacing a word you stand inside ' +
        'is ciw — no walk to the start, no stray gap. ' +
        'Your task: you stand mid-word in "craven". Change the whole word to "valiant" without moving.',
      demoKeys: 'ciwvaliant<esc>',
    },
    keysTaught: ['cw', 'ciw', 'diw', 'daw'],
    startLines: [
      'the herald rehearses the proclamation:',
      'hear ye, the craven prince returns',
      'let the gates be opened',
    ],
    startCursor: { row: 1, col: 15 },
    goal: {
      kind: 'text',
      lines: [
        'the herald rehearses the proclamation:',
        'hear ye, the valiant prince returns',
        'let the gates be opened',
      ],
    },
    par: 11,
    parSolution: 'ciwvaliant<esc>',
    hints: [
      'You stand inside the word and you mean to replace it — reach for the change verb with the "inner word" object, not a deletion and not a start-of-word change.',
      'Type ciw, then valiant, then Escape.',
      'You stand on the a in "craven", mid-word. c, i, w empties the whole word and draws the quill — cw would need the word\'s start, daw would remove it rather than replace it. Type valiant, press Escape: "the valiant prince returns". Eleven keys, no travel.',
    ],
  },
  {
    id: 't7-leap-the-stanzas',
    tier: 7,
    title: 'Leap the Stanzas',
    lesson: {
      heading: '} leaps to the next blank line, { to the one above — w and b for paragraphs',
      body:
        'Just as w and b stride word to word, } and { vault paragraph to paragraph: } leaps down to the ' +
        'next blank line, { leaps up to the previous one. A blank line is the boundary between verses. ' +
        'On a long scroll this clears whole stanzas in a keystroke instead of a hail of j\'s. ' +
        'Your task: from the top of the ballad, vault down two stanzas to the blank line before the last verse.',
      demoKeys: '}}',
    },
    keysTaught: ['}', '{'],
    startLines: [
      'the bard tunes the lute',
      'and clears his throat',
      '',
      'he sings of the long siege',
      'of winters spent in mud',
      '',
      'and then the dragon came',
      'and the song turns to ash',
    ],
    startCursor: { row: 0, col: 0 },
    goal: { kind: 'cursor', row: 5, col: 0 },
    par: 2,
    parSolution: '}}',
    hints: [
      'There is a paragraph-stride that vaults to the next blank line — use it twice.',
      'Press } then } again.',
      'From the first line, } lands on the blank line after "throat", the end of verse one. } again lands on the blank line after "mud". Two stanzas cleared. Two keys.',
    ],
  },
  {
    id: 't7-raze-the-verse',
    tier: 7,
    title: 'Raze the Verse',
    lesson: {
      heading: 'dap deletes a paragraph and its trailing blank — "around paragraph"',
      body:
        'Where ip is the paragraph alone, ap is the paragraph around — the verse plus the blank line ' +
        'beside it. So dap deletes the whole stanza and closes the gap, the way daw did for a single ' +
        'word; dip would leave the blank line stranded. ip and ap join the text-object family: c, d, ' +
        'and y all take them. ' +
        'Your task: the forged middle verse must go — raze it cleanly, blank line and all.',
      demoKeys: 'dap',
    },
    keysTaught: ['ip', 'ap', 'dap'],
    startLines: [
      'true is the first verse',
      'sung in every hall',
      '',
      'false is the forged verse',
      'slipped in by the spy',
      '',
      'true is the last verse',
      'as the elders tell it',
    ],
    startCursor: { row: 3, col: 0 },
    goal: {
      kind: 'text',
      lines: [
        'true is the first verse',
        'sung in every hall',
        '',
        'true is the last verse',
        'as the elders tell it',
      ],
    },
    par: 3,
    parSolution: 'dap',
    hints: [
      'Delete "around" the paragraph, not just inside it — that takes the blank line with it.',
      'Type dap — three keys.',
      'You stand in the forged verse. daw would take a word; dap takes the paragraph and its trailing blank. The two true verses close ranks with one blank between them — dip would have left a stray blank line. Three keys.',
    ],
  },

  // ── Tier 8 · The Macro Arts ──────────────────────────────────────────────
  {
    id: 't8-record-the-art',
    tier: 8,
    title: 'Record the Art',
    lesson: {
      heading: 'q records the keys you press; @ unleashes them again',
      body:
        'A macro is the arts you already know, captured and replayed. qa begins recording into register ' +
        'a; every key you press is remembered until you press q again to stop. Then @a performs the ' +
        'whole take in one stroke. Record an edit that ends by stepping to the next line, and a single ' +
        '@a repeats it there. ' +
        'Your task: record the edit that adds "!" to the first banner and drops a line, then unleash it once on the second.',
      demoKeys: 'qaA!<esc>jq@a',
    },
    keysTaught: ['q', '@'],
    startLines: ['hail the king', 'hail the queen', 'hail the realm'],
    startCursor: { row: 0, col: 0 },
    goal: {
      kind: 'text',
      lines: ['hail the king!', 'hail the queen!', 'hail the realm'],
    },
    par: 9,
    parSolution: 'qaA!<esc>jq@a',
    hints: [
      'Record the edit-and-step into a register, stop the recording, then replay it once.',
      'Type qa, then A!<esc>, then j, then q to stop, then @a.',
      'qa starts recording into a. A jumps to the line\'s end, type !, Escape, then j drops a line — q stops the take. The first banner now reads "hail the king!", and @a replays the whole art on the second: "hail the queen!". The third is left for you. Nine keys.',
    ],
  },
  {
    id: 't8-unleash-the-column',
    tier: 8,
    title: 'Unleash Down the Column',
    lesson: {
      heading: 'A count before @ runs the macro again and again — 3@a',
      body:
        'Once an art is recorded, a count unleashes it many times: 3@a runs register a three times, ' +
        'each replay picking up where the last left off. This is the macro\'s whole purpose — record one ' +
        'repetitive edit, then sweep it down a column of lines that all need the same change. (@@ ' +
        'repeats the last macro once more, if you would rather feel each strike.) ' +
        'Your task: record the full-stop edit on rank 1, then unleash it three times to finish ranks 2 through 4.',
      demoKeys: 'qaA.<esc>jq3@a',
    },
    keysTaught: ['@', '@@'],
    startLines: ['rank 1', 'rank 2', 'rank 3', 'rank 4', 'done'],
    startCursor: { row: 0, col: 0 },
    goal: {
      kind: 'text',
      lines: ['rank 1.', 'rank 2.', 'rank 3.', 'rank 4.', 'done'],
    },
    par: 10,
    parSolution: 'qaA.<esc>jq3@a',
    hints: [
      'Record the edit-and-step once, then put a count of 3 in front of the replay.',
      'Type qaA.<esc>jq to record, then 3@a.',
      'qa records: A appends, type the full stop, Escape, j drops a line — q stops. Rank 1 already ends in a dot. Now 3@a runs the art three more times, dotting ranks 2, 3, and 4 in one breath; "done" is untouched. Everything from the Scribe\'s Arts, recorded once and unleashed. Ten keys.',
    ],
  },
];

// ── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Stars for a completed trial:
 *   3 — par or better, with no hints taken;
 *   2 — within twice par;
 *   1 — completed, however bloodied.
 */
export function starsFor(keystrokes: number, par: number, hintsUsed: number): 1 | 2 | 3 {
  if (keystrokes <= par && hintsUsed === 0) return 3;
  if (keystrokes <= par * 2) return 2;
  return 1;
}

/**
 * XP for a completed trial: deeper tiers and brighter stars pay more.
 * tier × 10 × stars — a 3-star tier-6 trial pays 180 XP.
 */
export function trialXp(stars: 1 | 2 | 3, tier: number): number {
  return tier * 10 * stars;
}

/** Sharpened-blade damage multiplier earned for the next typing battle. */
export function bladeFor(stars: 1 | 2 | 3): number {
  switch (stars) {
    case 3:
      return 1.5;
    case 2:
      return 1.2;
    default:
      return 1.0;
  }
}

// ── Progression ──────────────────────────────────────────────────────────────

/** A fresh scabbard: nothing attempted, only tier 1 open, no blade buff. */
export function newVimProgress(): VimProgress {
  return { results: {}, unlockedTier: 1, bladeBuff: 1 };
}

/** Is `a` a finer showing than `b`? Stars first, then fewer keys, hints, time. */
function outshines(a: TrialResult, b: TrialResult): boolean {
  if (a.stars !== b.stars) return a.stars > b.stars;
  if (a.keystrokes !== b.keystrokes) return a.keystrokes < b.keystrokes;
  if (a.hintsUsed !== b.hintsUsed) return a.hintsUsed < b.hintsUsed;
  return a.durationMs < b.durationMs;
}

/** Trials of `tier` whose best result has earned at least 2 stars. */
function masteredCount(results: Record<string, TrialResult>, tier: number): number {
  return TRIALS.filter((t) => t.tier === tier && (results[t.id]?.stars ?? 0) >= 2).length;
}

const MAX_TIER = 8;
/** ≥ this many 2-star-or-better trials in a tier flings open the next gate. */
const UNLOCK_THRESHOLD = 3;

/**
 * Record a finished trial. Keeps the best result per trial (stars, then fewer
 * keystrokes/hints/time), never re-locks a tier, unlocks tier N+1 once at
 * least 3 trials of tier N hold 2+ stars, and keeps the brightest blade buff
 * earned so far this session (a battle resets it to 1 when consumed).
 */
export function applyTrial(progress: VimProgress | undefined, result: TrialResult): VimProgress {
  const base = progress ?? newVimProgress();
  const prev = base.results[result.trialId];
  const best = prev && !outshines(result, prev) ? prev : result;
  const results = { ...base.results, [result.trialId]: best };

  let unlockedTier = Math.max(1, base.unlockedTier);
  for (let tier = 1; tier < MAX_TIER; tier++) {
    if (unlockedTier >= tier && masteredCount(results, tier) >= UNLOCK_THRESHOLD) {
      unlockedTier = Math.max(unlockedTier, tier + 1);
    }
  }

  return {
    ...base,
    results,
    unlockedTier,
    bladeBuff: Math.max(base.bladeBuff, result.blade),
  };
}

/**
 * The next trial worth attempting: the first unlocked trial never completed,
 * else the first unlocked trial still short of 3 stars, else null — the
 * sword-school has nothing left to teach.
 */
export function nextTrial(progress: VimProgress | undefined): VimTrial | null {
  const p = progress ?? newVimProgress();
  const unlocked = TRIALS.filter((t) => t.tier <= p.unlockedTier);
  const unattempted = unlocked.find((t) => !p.results[t.id]);
  if (unattempted) return unattempted;
  return unlocked.find((t) => (p.results[t.id]?.stars ?? 0) < 3) ?? null;
}
