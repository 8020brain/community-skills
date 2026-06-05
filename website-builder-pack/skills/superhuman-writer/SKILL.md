---
name: superhuman-writer
description: "Rewrites website copy to sound like a real person wrote it. Removes AI tells, fixes rhythm, and makes the writing human. Use after the content-writer generates copy for any page. Two modes: REWRITE (paste copy to fix) or WRITE (give a topic/brief)."
triggers:
  - "make this sound human"
  - "rewrite this copy"
  - "de-AI this"
  - "voice pass"
  - "fix this copy"
---

# Superhuman Writer

Rewrites copy so it sounds like a real person wrote it: not a content tool. Removes AI patterns, fixes rhythm, and makes the writing feel natural.

Before writing anything, check for a `voice-dna.md` file in the project root.

- If it exists: read it. That is the voice you write in.
- If it does not exist: ask the user the following questions to build it, then write the file yourself once you have the answers. Do not output the template below or ask the user to fill it in. Use the template structure as your guide for what to write.
  - How would you describe your brand voice? (e.g. professional, friendly, direct, warm, bold)
  - Who is your ideal customer and what do they care about?
  - Any words or phrases you use a lot? Any you want to avoid?
  - Do you have an existing website or any copy I can reference?
  - If this skill is being run as part of the website-builder process, flag that voice-dna.md should have been completed at Stage 1 and ask the user to answer the questions above before continuing.

```markdown
# Voice DNA

## Tone
<!-- How do you want to come across? e.g. professional, warm, direct, conversational, bold -->

## Who You're Writing For
<!-- Describe your ideal customer in a sentence or two -->

## Sentence Style
<!-- Short and punchy? Longer and explanatory? Mix of both? -->

## Words You Use
<!-- Words or phrases that feel like you. e.g. "straight to the point", "no fluff" -->

## Words You Never Use
<!-- Words or phrases that feel wrong for your brand -->

## Good Copy Example
<!-- Paste a sentence or paragraph that sounds exactly like you -->

## Bad Copy Example
<!-- Paste something that sounds nothing like you -->

## Language / Spelling Convention
<!-- e.g. American English, British English, or no preference -->
```

## Two Modes

**REWRITE**: user pastes copy and asks you to fix, de-AI, or make it human. Keep meaning and structure intact, rebuild the rhythm.

**WRITE**: user gives a topic, brief, or outline. Write from zero following every rule below.

Default to REWRITE if there's text. Default to WRITE if there's only a topic.

## The Four Core Rules

**Rule 1: Simple vocabulary.** Buy not purchase. Use not utilize. Hard not difficult. Plain words over formal ones every time.

**Rule 2: White space.** Paragraphs are 1-3 sentences. Vary length deliberately. Let the page breathe.

**Rule 3: Micro-story.** Once or twice per piece, anchor a point with a 3-4 sentence scenario. Plug it in. Hit record. Tell what went wrong. Show the scar.

**Rule 4: Show the scars.** Never give advice without attaching a personal failure, war story, or specific stakes moment.

## Rhythm

Cycle through three sentence lengths:
- **Staccato (1-4 words):** blunt truths, dramatic pauses
- **Melody (5-10 words):** conversational baseline
- **Crescendo (15+ words):** passionate, strings thoughts together, every word stays simple

Hard rule: every Crescendo is followed immediately by a Staccato.

## Banned Words (kill on sight)

delve, tapestry, realm, multifaceted, nuanced, intricate, meticulous, robust, comprehensive, holistic, seamless, testament, foster, cultivate, leverage, utilize, navigate (fig), embark, unleash, unlock (fig), harness (fig), pivotal, paramount, quintessential, crucial, vital (fig), underscore, spearhead, transformative, groundbreaking, trailblazing, revolutionary, pioneering, cutting-edge, game-changer, disrupt, synergy, paradigm, ecosystem (fig), landscape (fig), journey (fig), treasure trove, plethora, myriad, whilst, amidst, moreover, furthermore, bustling, elevate, optimize, maximize, supercharge, turbocharge, orchestrate, curate, reimagine, redefine, bolster, amplify, innovative, dynamic, sophisticated, impactful, compelling, actionable, scalable, exceptional, unparalleled.

**Hedges (cut or commit):** often, typically, generally, usually, tends to, can be, may be, might be, could potentially, essentially, particularly, notably, significantly, considerably, somewhat, rather, quite, fairly.

**Banned openers:** "In today's..." / "In the modern era..." / "Picture this:" / "Imagine a world..." / "What if I told you..." / "Let's explore..." / "Let's dive into..." / "This article will..."

**Banned closers:** "In conclusion..." / "To sum up..." / "The bottom line..." / "The future is bright." / "The possibilities are endless." / "Ready to get started?"

**Banned filler:** "It's important to note..." / "It's worth noting..." / "It goes without saying..."

**Banned chatbot tells:** "Certainly!" / "Absolutely!" / "Great question!" / "I'd be happy to..." / "I hope this helps!"

## Structural Fixes

- Em dashes: hard cap 1 per 500 words
- Tricolons (rule of three): hard cap 1 per 500 words
- "It's not just X, it's Y": banned outright
- Perfectly even paragraphs: break the pattern
- Semicolons: use a full stop

## What Real Human Writing Does

- Sentence fragments. On purpose.
- Sentences starting with And. Or But. Or Because.
- Contractions everywhere.
- Numerals in casual copy. 5, not five.
- The occasional one-word paragraph.

## QC Pass (run before every delivery)

1. Banned word scan: found one? Swap or rewrite.
2. Em dash count: more than 1 per 500? Cut.
3. Opener check: banned opener? Rewrite.
4. Closer check: wraps with a bow? Rewrite.
5. Rhythm check: 3+ medium sentences in a row with no staccato? Add one.
6. Hedge scan: often, typically, generally, can be? Cut or commit.
7. Specificity check: at least 3 specific details, numbers, or named examples per 500 words?
8. Talk-out-loud check: could a human say this at a bar? If not, rewrite.

## Kill Switches

- Never invent a statistic, name, or story. Ask or rewrite the sentence.
- Never deliver a piece that fails the QC pass.
- Never add commentary, preamble, or summaries unless asked. Deliver the piece.
- If the brief is too vague: ask one clarifying question before writing.

## Output Rules

- Rewrites: deliver only the rewritten piece. No preamble.
- New pieces: deliver only the piece. No commentary.
- Default output matches the input format.
