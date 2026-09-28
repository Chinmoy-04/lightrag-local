---
name: LightRAG Local
description: Amber-terminal Operate UI for a local LightRAG reproduction
colors:
  background-light: "#f7f1e3"
  foreground-light: "#211a0f"
  card-light: "#fffcf5"
  primary-light: "#b4650f"
  primary-foreground-light: "#fffbef"
  muted-light: "#efe4cb"
  muted-foreground-light: "#7c6e52"
  border-light: "#e3d6b4"
  ring-light: "#c2790f"
  background-dark: "#0d0b08"
  foreground-dark: "#f2ead8"
  card-dark: "#17140f"
  primary-dark: "#f0a93b"
  primary-foreground-dark: "#1a1207"
  muted-dark: "#211c14"
  muted-foreground-dark: "#a89a7c"
  border-dark: "rgba(242, 234, 216, 0.08)"
  ring-dark: "#f0a93b"
  destructive: "#dc2626"
typography:
  sans:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary-light}"
    textColor: "{colors.primary-foreground-light}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  sidebar-rail:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    width: "18rem"
  composer:
    backgroundColor: "{colors.card-light}"
    rounded: "{rounded.lg}"
    padding: "8px"
---

## Overview

LightRAG Local is an **Operate** surface: a warm terminal-adjacent workbench for indexing papers, chatting with graph-aware RAG modes, viewing the GraphML, and reading mode comparisons. The visual world is **amber terminal**: cream/near-black fields, one amber accent, Geist for UI, JetBrains Mono for measurements and model names. No purple AI glow, no dashboard card farm.

## Colors

- **Strategy:** Restrained. Neutrals carry the page; amber (`primary`) is the only brand accent.
- **Light:** Paper cream `#f7f1e3` background, parchment cards `#fffcf5`, ink `#211a0f`, amber `#b4650f`.
- **Dark:** Charcoal `#0d0b08` (never pure black), card `#17140f`, parchment text `#f2ead8`, brighter amber `#f0a93b`.
- **Semantic status** (ok / warn / error dots and latency tones) may use conventional green/amber/rose; those are not brand colors.
- Borders stay warm (`#e3d6b4` light; low-alpha parchment dark). Selection highlight tints amber.

## Typography

- **UI / display:** Geist Variable. Headings use weight 600 and tracking around `-0.03em`, not oversized marketing scale.
- **Body:** 13–14px, relaxed leading, measure ~65ch in chat.
- **Data:** JetBrains Mono for latencies, model IDs, graph counts, judge scores.
- No Inter, no display serifs on this Operate UI.

## Layout

- **Shell:** Left rail (~18rem) + fluid main. Mobile stacks rail above main.
- **Chat:** Asymmetric empty state (copy left, prompts as a vertical list). Active thread centered to `max-w-2xl`.
- **Compare / Graph:** Full main pane; close control returns to chat.
- Prefer `divide-y` / hairline rules over nested cards. Cards only where elevation helps (composer, message bubbles).
- Density sits mid-air (daily app): generous section gaps in the rail, tight rows inside status/data blocks.

## Elevation & Depth

- Soft tinted shadows only (`shadow-sm` / wide low-opacity warm black), never neon outer glow.
- Prefer 1px border + slight inset highlight on interactive surfaces over stacked shadows.
- Optional fixed film grain (`pointer-events-none`) for terminal paper texture; keep opacity low so it never fights text.

## Shapes

- Radius base ~12px (`--radius: 0.75rem`). Message bubbles can soft-square one corner toward the speaker.
- Mode chips and small controls: `rounded-lg` / `rounded-md`, not pill-everything.
- Focus rings use `--ring` amber at low alpha.

## Components

- **Sidebar:** Brand mark `LR`, status strip (not a boxed hero metric), 2×2 mode grid, primary Build action, outline Graph/Compare.
- **Composer:** Bordered parchment field, send icon button, helper line under.
- **Chat:** User bubbles amber fill; assistant parchment with mode + latency mono badges.
- **Compare:** Latency bars, optional paper-judge score bars, human conclusion blurb, answer pane.
- **Motion:** Short springy transitions on mode/buttons (`cubic-bezier(0.16, 1, 0.3, 1)`); staggered empty-state prompts; respect `prefers-reduced-motion`.

## Do's and Don'ts

**Do**

- Keep the amber terminal palette when adding screens.
- Put labels above controls; put numbers in mono.
- Left-align empty states and section titles (no centered marketing hero).
- Write operational copy (what failed, what to do next).

**Don't**

- Introduce purple, indigo, or glow accents.
- Wrap every metric in equal cards.
- Use emoji as icons.
- Add kicker/eyebrow labels above headings.
- Center the first viewport like a landing page.
