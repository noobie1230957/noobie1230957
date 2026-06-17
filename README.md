# TUX S&D Kinetic — Remotion video ad

Minimalist SaaS-style vertical ad (ClickUp vibe) built with [Remotion](https://remotion.dev).

- **Format:** 1080 × 1920, 30 fps, 28 s (840 frames)
- **Style:** white/grey background `#F5F5F5`, black Inter Bold text, red accent
  for "messy", brand green `#10B981` for TUX S&D Kinetic.

## Timeline

| Time | Scene |
|------|-------|
| 0–2s | "Charts" fades in center |
| 2–4s | "shouldn't be **messy**" — *messy* turns red and pops |
| 4–6s | "Too many indicators" + floating RSI / MACD / BB / EMA / STOCH chips |
| 6–8s | Black screen, "Too many fake signals" with RGB glitch |
| 8–10s | "Can't identify the move" |
| 10–12s | "Trading should be easy" |
| 12–14s | "It should help you make money" |
| 14–17s | "TUX S&D KINETIC" big, brand color |
| 17–21s | Mock chart background + "Identifies true market structure" |
| 21–25s | Mock chart + "High probability setups / Only real zones" |
| 25–28s | End card: TUX S&D KINETIC + "Your trades, organized" + "Start your 3-Day Trial" |

## Run

```bash
npm install
npm run dev      # open Remotion Studio to preview/scrub
npm run build    # render to out/tux-snd-kinetic.mp4
```

## Notes

- The two "screenshot" scenes use a generated SVG candlestick chart with
  supply/demand zones so the video renders with no external assets. To use your
  real app screenshots, see `public/README.md`.
- "Kinetic" is used for the brand name (the brief wrote "kentic").
