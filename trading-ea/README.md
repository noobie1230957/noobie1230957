# BeginnerTrendEA — a beginner-friendly MetaTrader 5 Expert Advisor

A simple, **conservative** automated trading robot (an "EA") for **MetaTrader 5**,
designed for someone new to trading. It trades a small base lot of **0.01** and
**scales the size up with your account** as it grows, puts a **stop-loss on every
trade**, and only takes trades when the trend and momentum agree.

> ⚠️ **Read this first — honest expectations**
>
> - **No EA can be "super accurate" or guarantee profits.** Any robot (or
>   person) that promises that is lying to you. This one *will* have losing
>   trades.
> - This is an **educational tool, not financial advice.**
> - **Always test on a DEMO account first** — ideally for several weeks — before
>   you ever connect it to real money.
> - Only ever trade money you can afford to lose completely.
>
> The whole point of this EA is **discipline and survival**: small size, a stop
> on every trade, and only one trade at a time. That is what keeps beginners in
> the game.

---

## What it does (the strategy in plain English)

1. **Finds the trend** using two moving averages (a fast one and a slow one).
   - Fast line crosses **above** slow line → uptrend → look to **buy**.
   - Fast line crosses **below** slow line → downtrend → look to **sell**.
2. **Confirms with momentum** using RSI, so it doesn't buy into a stalling move
   or chase a market that is already overbought/oversold.
3. **Sizes the trade by risk.** It starts at **0.01 lots** and, as your balance
   grows, it risks a fixed percentage (default **1%**) of the account per trade —
   so the size grows safely with you instead of all at once.
4. **Protects every trade** with a stop-loss and take-profit (ATR-based by
   default, so the stops adapt to how volatile the market is), plus an optional
   **trailing stop** that locks in profit once a trade moves your way.
5. **Stays calm:** only one trade at a time, decisions made once per closed bar
   (no frantic over-trading), and it skips trades when the spread is too wide.

---

## How position sizing / "scaling with the account" works

You asked for a base lot of `0.01` that scales with the account. Here's the math
the EA uses (with `InpUseRiskSizing = true`):

```
risk money   = balance × RiskPercent%        (default 1%)
loss per lot  = how much 1.00 lot would lose if the stop-loss is hit
lot size      = risk money ÷ loss per lot     (then rounded to a valid lot,
                                               never below 0.01, never above the cap)
```

- On a **small account**, this naturally lands at the **0.01** floor.
- As the **balance grows**, the lot grows in small, safe steps.
- `InpMaxLot` is a hard ceiling so it can never size up wildly.

Prefer a flat size? Set `InpUseRiskSizing = false` and it trades exactly
`InpBaseLot` (0.01) every time.

---

## Installation (MetaTrader 5)

1. Open MetaTrader 5.
2. Menu: **File → Open Data Folder**.
3. Go into `MQL5` → `Experts`.
4. Copy **`BeginnerTrendEA.mq5`** into that `Experts` folder.
5. Back in MT5, open **MetaEditor** (the toolbar button or `F4`), find
   `BeginnerTrendEA.mq5` in the Navigator, and click **Compile** (`F7`).
   You should get **0 errors**.
6. In MT5, open the **Navigator** panel → **Expert Advisors** → drag
   **BeginnerTrendEA** onto a chart.
7. In the dialog, tick **Allow Algo Trading**, set your inputs, click **OK**.
8. Make sure the **Algo Trading** button in the top toolbar is **green/on**.

A little smiley face in the top-right corner of the chart means the EA is running.

---

## Test it BEFORE going live (do not skip this)

1. In MT5 press **`Ctrl+R`** to open the **Strategy Tester**.
2. Choose `BeginnerTrendEA`, pick a symbol (e.g. `EURUSD`), a timeframe
   (e.g. `H1`), and a date range of at least a year.
3. Run the test and look at the report: profit factor, max drawdown, number of
   trades, win rate.
4. Then run it on a **demo account** in real time for a few weeks.
5. Only consider real money once you understand how it behaves and you're
   comfortable with the losing streaks (every strategy has them).

---

## Recommended starting setup for a beginner

| Setting | Suggested value | Why |
|---|---|---|
| Symbol | `EURUSD` | Tight spread, very liquid, beginner-friendly |
| Timeframe | `H1` (1 hour) | Slower, fewer trades, less noise/stress |
| `InpRiskPercent` | `0.5`–`1.0` | Keep risk per trade small while learning |
| `InpUseATRStops` | `true` | Stops adapt to market volatility automatically |
| `InpMaxPositions` | `1` | One trade at a time = easier to follow |

---

## Key settings explained

**Money Management**
- `InpBaseLot` (0.01) — the minimum/floor lot size.
- `InpUseRiskSizing` (true) — scale lot by account risk % (turn off for flat 0.01).
- `InpRiskPercent` (1.0) — % of balance risked per trade.
- `InpMaxLot` (1.00) — safety cap on lot size.

**Strategy**
- `InpFastMA` / `InpSlowMA` (20 / 50) — the two trend lines. Fast must be smaller.
- `InpMAMethod` (EMA) — type of moving average.
- `InpRSIPeriod` / `InpRSIUpper` / `InpRSILower` (14 / 70 / 30) — momentum filter.
- `InpTradeBuy` / `InpTradeSell` — allow longs / shorts.

**Stops & Targets**
- `InpUseATRStops` (true) — volatility-based stops (recommended).
- `InpATR_SL_Mult` / `InpATR_TP_Mult` (2.0 / 3.0) — stop and target sizes in ATRs.
  Default risk:reward is roughly 1:1.5.
- `InpStopLossPips` / `InpTakeProfitPips` — used only when ATR stops are off.

**Trade Management**
- `InpUseTrailing` (true) — trail the stop to lock in profit.
- `InpMaxSpreadPips` (3) — skip trades when the spread is too wide.
- `InpMaxPositions` (1) — max simultaneous trades.

**Session & Misc**
- `InpUseTimeFilter` / `InpStartHour` / `InpEndHour` — optional trading-hours window.
- `InpMagicNumber` — unique ID so the EA only touches its own trades.

---

## Frequently asked beginner questions

**"Will this make me money?"**
Nobody can promise that. It's a disciplined framework, not a money machine. Your
job is to test it, understand it, and manage risk.

**"Why only 0.01 lots?"**
0.01 is the smallest tradable size at most brokers. Starting small is exactly how
a beginner should start. The EA grows the size only as your account grows.

**"It hasn't traded for hours — is it broken?"**
Probably not. A trend-following EA waits for clean signals and can sit idle for a
while. Patience is a feature, not a bug.

**"Can I run it on crypto / gold / indices?"**
You can, but settings tuned for `EURUSD` may not fit. Re-test in the Strategy
Tester for each new symbol.

---

## Disclaimer

This software is provided for **educational purposes only** and is **not
financial advice**. Trading foreign exchange and other leveraged products carries
a high level of risk and can result in the loss of all your capital. Past
performance and backtest results do not guarantee future results. You are solely
responsible for any trades placed using this tool. Test on a demo account and
consult a licensed financial professional if unsure.
