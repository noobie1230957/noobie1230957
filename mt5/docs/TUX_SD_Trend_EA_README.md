# TUX-S&D + Trend × EMA Cloud — MT5 Expert Advisor

A faithful MT5 port of the TradingView Pine v6 indicator
**"TUX-S&D+trend × EMA Cloud"**, wrapped with professional trade
management, dynamic risk, auto lot scaling, trailing, and filters.

> **The Pine Script is the source of truth.** Every signal calculation
> (AI Supertrend ML engine, S&D power zones, zone-TRUE validity, RSI gating,
> kinetic-line bounces, EMA-cloud) is converted directly from the script,
> on **closed bars only** (no repaint).

---

## ⚠️ Read this first — honest limits of the conversion

Your "AI Trend" is **not** a normal indicator. It is a *stateful machine
learning pipeline*:

- 6 engineered features × 4 price sources (O/H/L/C)
- A **KNN analog-memory** bank (`memoryDepth`, `kNeighbors`, Fisher-weighted gaps)
- An **online neural net trained every bar with the Adam optimizer**
- **Fisher auto feature-weighting** (`wAuto`, EMA-smoothed)
- which selects the "best" price source → smooths it → builds an
  **adaptive-multiplier SuperTrend** whose band width depends on KNN
  confidence (`aiDrive`).

Every one of those formulas is ported **exactly**, and the EA processes bars
**strictly left-to-right** (like Pine) so the banks, neural weights, Fisher
weights, and SuperTrend evolve the same way.

**But:** a *literal bar-for-bar identical* output to TradingView is
mathematically impossible for **any** stateful ML indicator across platforms,
because:

1. The banks/neural weights accumulate from the **first chart bar**. MT5 only
   has finite history (`InpMaxBars`, default 4000), so the warm-up start point
   differs from TradingView's.
2. Floating-point rounding and tick/bar timing differ between platforms.
3. Pine's `request.security` (HTF confluence) resolves differently in MT5.

So this is the **closest faithful reproduction**, not a pixel clone. The
trend direction, flips, and bounces **converge** to the indicator; expect the
occasional borderline bar to differ. Anyone who promises identical output for
an ML indicator is guessing.

To **eliminate repainting**, the EA only evaluates signals on the **last fully
closed bar**, recomputing the whole ML pass once per new bar.

---

## How the four entries map to your Pine

| EA entry | Pine source | Condition |
|---|---|---|
| **Long Power** | `lo_true and not lo_true[1]` (LONG Zone TRUE alert) | Support-zone rejection/predict **AND** `RSI ≤ InpRsiBuyLevel` (49) |
| **Short Power** | `sh_true and not sh_true[1]` (SHORT Zone TRUE alert) | Resistance-zone rejection/predict **AND** `RSI ≥ InpRsiSellLevel` (55) |
| **AI Trend Flip** | `stFlipUp` / `stFlipDn` | SuperTrend `stDir` flips → close opposite, open one in new direction |
| **Kinetic Bounce** | `trailBounceUp` / `trailBounceDn` | Price taps the AI SuperTrend line (`stLine ± 0.25·ATR`) and closes back on the trend side |

**The "Kinetic / trailing line" = your AI SuperTrend line (`stLine`).** That is
exactly what your Pine uses for the bounce alerts, so the EA uses the same line
for the Kinetic SL/trailing/exit modes.

**EMA Cloud is a filter only.** In your Pine the cloud does **not** gate the
zone/flip/bounce alerts (it has its own separate, unused cross signal), so the
cloud filter defaults **OFF**. Turn `InpCloudFilter` to `CLOUD_SLOW` or
`CLOUD_FASTSLOW` only if you *want* an extra directional gate.

### Zone-TRUE validity (ported exactly)
- **Chasing** detection (`sh_rise`/`lo_fall` counters, `InpChaseBars`)
- **Predictive TRUE** (`InpTruePredict`): price enters zone + RSI stretched
  (`InpRsiStretch` 68 → long needs RSI ≤ 32, short needs RSI ≥ 68)
- **Rejection candle** (`InpRejWick` 0.4 of bar)
- **Confirm-on-close** (`InpTrueConfirm`): `true_raw OR true_raw[1]`

The per-entry `InpRsiBuyLevel`/`InpRsiSellLevel` (49 / 55) are an **additional**
gate on top of zone-TRUE, exactly as you specified.

---

## Position management

- **One position per symbol** (by magic number). No stacking.
- **Reverse on opposite signal** (`InpAllowReverse`): close current → open new.
- **Trend flip is top priority** and always closes the opposite trade first.

### Stop Loss (`InpSlMode`)
- `SL_ATR` — `ATR × InpAtrSlMult`
- `SL_KINETIC` — the AI SuperTrend line (`stLine`)
- `SL_SWING` — recent swing high/low (`InpSwingLookback`)

### Take Profit (`InpTpMode`)
- `TP_RR2 / TP_RR3 / TP_RR4` — 1:2 / 1:3 / 1:4 risk-reward
- `TP_SWING` — previous swing high/low
- `TP_TRAIL` — no fixed TP; ride the trend, exit on reversal/trail

### Break Even / Profit Lock / Trailing
- **Break Even** at `InpBeTriggerR` R (+ optional buffer)
- **Profit Lock** — tiered $ locks (`+$20→lock $5`, `+$40→$15`, `+$60→$30`,
  `+$100→$60`, all customizable). SL never moves backward.
- **Trailing** (`InpTrailMode`): `ATR`, `KINETIC` (AI line), `SWING`, or `FIXED` pips.
- **Partials** (`InpUsePartials`): close % at `InpPartial1R` / `InpPartial2R`
  (each tier fires once per position).

---

## Risk & auto lot scaling

`InpRiskMode`:
- `RISK_FIXED_MONEY` — risk `$InpRiskMoney` per trade; lot auto-computed from
  SL distance (`lot = risk$ / (SL_points × $-per-point-per-lot)`).
- `RISK_PERCENT` — risk `InpRiskPercent`% of balance (naturally scales).
- `RISK_FIXED_LOT` — fixed lot, optionally auto-scaled.

**Auto lot scaling** (`InpAutoLotScale`): as balance grows past
`InpScaleBaseBalance`, every `+$InpScaleStep` adds `InpScaleAddPct` of the base
lot. Capped at `InpMaxLot`.

### Suggested starting points per instrument
Risk-based sizing already adapts the lot to each symbol's point value, so you
usually only set the **risk $** and the EA does the rest. If you prefer fixed
lots (`RISK_FIXED_LOT`):

| Symbol | Suggested base lot |
|---|---|
| XAUUSD (Gold) | 0.01 |
| US30 / NAS100 | 0.05 |
| BTCUSD / ETHUSD | 0.05 (broker-dependent) |
| Forex (EURUSD, GBPUSD, USDJPY, …) | 0.01 |

> Always verify against your broker's min/step/margin. The EA normalizes to
> the symbol's `VOLUME_MIN/STEP/MAX` automatically.

---

## Filters

- **Chop filter** (`InpUseChopFilter`): ADX floor + ATR compression + range/ATR
  detection. Blocks entries in consolidation. (Trend-flip events bypass chop.)
- **Max spread**, **min ATR (volatility)**, **trading session**, **manual news
  blackout** window.
- **Daily protection**: max daily loss $, max daily trades, max equity
  drawdown %.

> **News filter:** MT5 has no built-in economic-calendar feed for EAs, so this
> is a **manual time-blackout** window. A real auto-news filter needs an
> external calendar source — tell me if you want that wired in.

---

## Install & run

1. Copy `TUX_SD_Trend_EA.mq5` into
   `<MT5 Data Folder>/MQL5/Experts/`.
2. Open it in **MetaEditor** (F4) and **Compile** (F7). Fix nothing — it should
   compile clean; if your build flags a warning/error, paste it to me.
3. Drag the EA onto the **same symbol + timeframe** you run the indicator on in
   TradingView (timeframe matters — the ML engine is timeframe-specific).
4. Enable **Algo Trading**. Start on a **demo** account and compare the EA's
   trend flips / zone TRUEs against your TradingView chart for a few days
   before going live.

### Recommended first-run settings
- `InpRiskMode = RISK_FIXED_MONEY`, `InpRiskMoney = 20`
- `InpSlMode = SL_ATR`, `InpTpMode = TP_RR2`
- `InpTrailMode = TRAIL_KINETIC` (rides your AI line), `InpUseBreakEven = true`
- `InpUseChopFilter = true`
- `InpMaxBars = 4000` (raise toward your TradingView history for closer ML
  convergence; higher = slower per-bar recompute)

---

## Validation checklist (do this before trusting it live)

1. On a demo, mark each TradingView **AI Trend Flip / Trail Bounce / Zone TRUE**
   alert and confirm the EA reacted on the same closed bar.
2. Increase `InpMaxBars` if the AI trend disagrees often — more warm-up history
   = closer convergence.
3. Confirm lot size matches your intended `$` risk on your broker.
4. Stress-test the trailing/profit-lock on a winning trade in the Strategy
   Tester (visual mode).

If anything diverges from your indicator, send me the bar/screenshot and I'll
tune the specific calculation.
