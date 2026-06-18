# TUX S&D Kinetic — Remotion video ad

Minimalist SaaS-style vertical ad (ClickUp vibe) built with [Remotion](https://remotion.dev).

- **Format:** 1080 × 1920, 30 fps, 28 s (840 frames)
- **Style:** white/grey background `#F5F5F5`, black Inter Bold text, red accent
  for "messy", brand green `#10B981` for TUX S&D Kinetic.

## Timeline

| Time | Scene |
|------|-------|
| 0–2s | "TRADING" fades in center |
| 2–4s | "shouldn't be **messy**" — *messy* turns red and pops |
| 4–6s | "Too many indicators" over the real busy XAUUSD chart + floating chips |
| 6–8s | "Too many fake signals" (RGB glitch) over the Dow chart with the red X |
| 8–10s | "Can't identify the move" over the same Dow chart |
| 10–12s | "Trading should be easy" over the green-check chart |
| 12–14s | "It should help you **make money**" over the +14.41k profit dashboard |
| 14–17s | "TUX S&D KINETIC" big, brand color |
| 17–25s | Real screen-recording (`dashboard-clip.mp4`) with feature pills popping in: high-probability reversal zones, breakout zones, confirmation dashboard, trend filters, trail stops |
| 25–28s | End card: TUX S&D KINETIC + "Your trades, organized" + "Start your 3-Day Trial" |

## Run

```bash
npm install
npm run dev      # open Remotion Studio to preview/scrub
npm run build    # render to out/tux-snd-kinetic.mp4
```

## Assets

Real screenshots / recording live in `public/img/`:
`messy-chart.jpg`, `fake-signals.jpg`, `good-chart.jpg`, `profit.jpg`,
`dashboard-clip.mp4` (converted from the original .mov to H.264 so Chromium
can render it). Swap any of them and re-render.

## Notes

- "Kinetic" is used for the brand name (the brief wrote "kentic").
- The 17–25s feature segment is an 8s window; the source clip is ~11s, so it
  plays the first 8s. Say the word to extend the segment to fit the full clip.
