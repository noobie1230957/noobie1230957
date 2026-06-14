//+------------------------------------------------------------------+
//|                                                 TickScalperEA.mq5 |
//|                            Ultra-Fast Tick-Based Scalping Expert  |
//|                                                                  |
//|  A production-ready MetaTrader 5 Expert Advisor that trades on    |
//|  live incoming ticks instead of candle-close confirmations. All   |
//|  decision logic runs inside OnTick() and reacts while candles are |
//|  still forming, evaluating every single price update.             |
//|                                                                  |
//|  Subsystems:                                                      |
//|    - Tick momentum / acceleration / order-flow analysis           |
//|    - Micro-trend & market-regime detection                        |
//|    - Volatility expansion, false breakout & liquidity sweep logic |
//|    - Dynamic lot scaling ladder (0.01 -> 0.20)                     |
//|    - Dynamic SL/TP, break-even, tick trailing, profit lock        |
//|    - Partial exits, basket close, rapid re-entry                  |
//|    - Daily loss / equity protection, spread & session filters     |
//|    - News avoidance window                                        |
//|    - On-chart dashboard                                           |
//|                                                                  |
//|  NOTE: This EA is for educational and research purposes. Always   |
//|  test thoroughly on a demo account before any live deployment.    |
//+------------------------------------------------------------------+
#property copyright "TickScalperEA"
#property link      ""
#property version   "1.00"
#property description "Ultra-fast tick-based scalping EA. All logic runs on every tick."

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>
#include <Trade/SymbolInfo.mqh>

//+------------------------------------------------------------------+
//| ENUMERATIONS                                                     |
//+------------------------------------------------------------------+
// High-level market regime classification used to gate entries.
enum ENUM_MARKET_REGIME
  {
   REGIME_TRENDING_UP,    // Strong directional up move
   REGIME_TRENDING_DOWN,  // Strong directional down move
   REGIME_RANGING,        // Sideways / mean-reverting
   REGIME_VOLATILE,       // Expanding volatility, no clear direction
   REGIME_QUIET           // Compressed volatility, low activity
  };

// Directional bias derived from the micro-trend engine.
enum ENUM_TREND_BIAS
  {
   BIAS_BULLISH,
   BIAS_BEARISH,
   BIAS_NEUTRAL
  };

// Lot money-management mode.
enum ENUM_LOT_MODE
  {
   LOT_FIXED,        // Always use base lot
   LOT_LADDER,       // Use the scaling ladder
   LOT_RISK_PERCENT  // Size by % equity risk against the stop
  };

//+------------------------------------------------------------------+
//| INPUT PARAMETERS                                                 |
//+------------------------------------------------------------------+

//--- General ---------------------------------------------------------
input group "=== GENERAL ==="
input long     InpMagicNumber       = 770425001;   // Magic number (unique per chart/strategy)
input string   InpTradeComment      = "TickScalper";// Order comment tag
input bool     InpMultiSymbol       = false;        // Enable multi-symbol trading
input string   InpSymbolList        = "EURUSD,GBPUSD,USDJPY"; // CSV of symbols (multi-symbol mode)
input bool     InpVerboseLog        = false;        // Verbose logging to the Experts journal

//--- Tick Engine -----------------------------------------------------
input group "=== TICK ENGINE ==="
input int      InpTickBufferSize    = 200;          // Tick ring-buffer length (samples)
input int      InpMomentumWindow    = 20;           // Ticks used for momentum measurement
input int      InpAccelWindow       = 10;           // Ticks used for acceleration measurement
input int      InpFlowWindow        = 30;           // Ticks used for order-flow pressure
input int      InpMicroTrendWindow  = 50;           // Ticks used for micro-trend slope
input double   InpMomentumScale     = 100000.0;     // Scaling factor for momentum readability

//--- Signal / Probability -------------------------------------------
input group "=== SIGNAL & PROBABILITY ==="
input double   InpEntryThreshold    = 0.62;         // Probability threshold to open (0..1)
input double   InpBurstFactor       = 1.8;          // Momentum-burst sensitivity (std multiples)
input double   InpExhaustionFactor  = 0.4;          // Exhaustion: momentum fade ratio
input double   InpVolSpikeFactor    = 2.0;          // Volatility-spike sensitivity (std multiples)
input double   InpSweepFactor       = 1.5;          // Liquidity-sweep wick sensitivity
input bool     InpUseFalseBreakout  = true;         // Enable false-breakout fade entries
input bool     InpUseLiquiditySweep = true;         // Enable liquidity-sweep reversal entries
input bool     InpUseExhaustion     = true;         // Enable momentum-exhaustion reversal entries

//--- Risk Management -------------------------------------------------
input group "=== RISK MANAGEMENT ==="
input ENUM_LOT_MODE InpLotMode      = LOT_LADDER;   // Lot sizing mode
input double   InpBaseLot           = 0.01;         // Base lot size
input double   InpRiskPercent       = 0.5;          // Risk % of equity (LOT_RISK_PERCENT mode)
input double   InpLadderResetDD     = 30.0;         // Reset ladder after this drawdown (account ccy)
input int      InpMaxOpenTrades     = 3;            // Max simultaneous open positions (this EA)
input double   InpMaxSpreadPoints   = 25.0;         // Max allowed spread (points)
input double   InpDailyLossLimit    = 100.0;        // Daily loss limit (account ccy, 0=off)
input double   InpDailyProfitTarget = 0.0;          // Daily profit target (account ccy, 0=off)
input double   InpEquityStopPercent = 15.0;         // Equity protection: max equity drawdown %
input double   InpMinEquity         = 0.0;          // Absolute equity floor (0=off)

//--- Profit Management ----------------------------------------------
input group "=== PROFIT MANAGEMENT ==="
input double   InpTakeProfitPoints  = 40.0;         // Base take-profit (points)
input double   InpStopLossPoints    = 60.0;         // Base stop-loss (points)
input bool     InpDynamicTPSL       = true;         // Scale TP/SL by current volatility
input double   InpDynamicTPSLMin    = 0.6;          // Min dynamic multiplier
input double   InpDynamicTPSLMax    = 2.5;          // Max dynamic multiplier
input bool     InpUseBreakEven      = true;         // Enable break-even
input double   InpBreakEvenPoints   = 15.0;         // Profit (points) to arm break-even
input double   InpBreakEvenLock     = 2.0;          // Locked profit at break-even (points)
input bool     InpUseTrailing       = true;         // Enable tick trailing stop
input double   InpTrailStartPoints  = 18.0;         // Profit (points) to start trailing
input double   InpTrailStepPoints   = 8.0;          // Trailing distance (points)
input bool     InpUseProfitLock     = true;         // Enable stepped profit lock
input double   InpProfitLockStep    = 20.0;         // Each lock step (points)
input double   InpProfitLockKeep    = 0.5;          // Fraction of each step to keep locked
input bool     InpUsePartialExit    = true;         // Enable partial exits
input double   InpPartialAtPoints   = 25.0;         // Profit (points) to take partial
input double   InpPartialPercent    = 50.0;         // Percent of volume to close on partial
input bool     InpUseBasketClose    = true;         // Enable basket profit close
input double   InpBasketProfit      = 50.0;         // Close all when basket profit >= (account ccy)
input double   InpBasketLoss        = 0.0;          // Close all when basket loss <= -(account ccy) 0=off

//--- Re-entry / Anti-overtrading ------------------------------------
input group "=== RE-ENTRY & ANTI-OVERTRADING ==="
input bool     InpAllowReEntry      = true;         // Allow rapid re-entry
input int      InpReEntryCooldownMs = 500;          // Cooldown between entries (milliseconds)
input int      InpDuplicateGuardPts = 5;            // Block new entry within N points of an existing one
input double   InpRangeBlockFactor  = 0.5;          // Block entries when range/ATR below this (anti-chop)

//--- Session & News --------------------------------------------------
input group "=== SESSION & NEWS ==="
input bool     InpUseSessionFilter  = true;         // Enable session time filter
input int      InpSessionStartHour  = 7;            // Session start hour (server time)
input int      InpSessionEndHour    = 20;           // Session end hour (server time)
input bool     InpTradeMonday       = true;         // Trade Monday
input bool     InpTradeFriday       = true;         // Trade Friday
input int      InpFridayCloseHour   = 20;           // Force-flat hour on Friday (server time)
input bool     InpUseNewsFilter     = true;         // Enable news avoidance window
input string   InpNewsTimes         = "";           // News times CSV "YYYY.MM.DD HH:MM;..." (server time)
input int      InpNewsBeforeMin     = 15;           // Block N minutes before news
input int      InpNewsAfterMin      = 15;           // Block N minutes after news

//--- Execution -------------------------------------------------------
input group "=== EXECUTION ==="
input int      InpSlippagePoints    = 10;           // Max deviation/slippage (points)
input int      InpMaxRetries        = 3;            // Order send retries
input int      InpRetryDelayMs      = 150;          // Delay between retries (ms)
input bool     InpUseMarketExecGuard = true;        // Re-validate price freshness before sending

//--- Dashboard -------------------------------------------------------
input group "=== DASHBOARD ==="
input bool     InpShowDashboard     = true;         // Show on-chart dashboard
input int      InpDashX             = 12;           // Dashboard X (pixels)
input int      InpDashY             = 24;           // Dashboard Y (pixels)
input int      InpDashFontSize      = 9;            // Dashboard font size
input color    InpDashTextColor     = clrWhiteSmoke;// Dashboard text color
input color    InpDashTitleColor    = clrGold;      // Dashboard title color
input color    InpDashBullColor     = clrLime;      // Bullish accent
input color    InpDashBearColor     = clrTomato;    // Bearish accent
input color    InpDashPanelColor    = C'18,22,30';  // Panel background color

//+------------------------------------------------------------------+
//| PER-SYMBOL CONTEXT                                               |
//| All mutable state lives here so the EA can manage many symbols.  |
//+------------------------------------------------------------------+
struct SymbolContext
  {
   string            symbol;            // Symbol name
   bool              ready;             // Symbol selected & specs cached

   //--- Cached specs
   double            point;             // Symbol point size
   int               digits;            // Symbol digits
   double            tickValue;         // Tick value (account ccy)
   double            tickSize;          // Tick size
   double            volMin;            // Min volume
   double            volMax;            // Max volume
   double            volStep;           // Volume step
   int               stopLevel;         // Min stop distance (points)
   int               freezeLevel;       // Freeze distance (points)

   //--- Tick ring buffers
   double            bidBuf[];          // Bid history
   double            askBuf[];          // Ask history
   double            midBuf[];          // Mid history
   long              tvBuf[];           // Tick volume proxy (1 per tick)
   long              timeBuf[];         // Tick time (ms since epoch via GetTickCount mapping)
   int               bufCount;          // Valid samples stored
   int               bufHead;           // Ring head index
   double            lastBid;           // Previous bid (for change detection)
   double            lastAsk;           // Previous ask

   //--- Derived analytics
   double            momentum;          // Current tick momentum (signed)
   double            momentumPrev;      // Previous momentum (for acceleration)
   double            acceleration;      // Momentum rate of change
   double            flowPressure;      // Order-flow pressure (-1..+1)
   double            microSlope;        // Micro-trend slope (signed)
   double            volatility;        // Short-term volatility (std of returns)
   double            volBaseline;       // Rolling baseline volatility
   double            momStd;            // Momentum standard deviation baseline
   double            rangeRecent;       // Recent high-low range (points)
   double            atrProxy;          // ATR-like proxy from tick range

   ENUM_TREND_BIAS   bias;              // Current directional bias
   ENUM_MARKET_REGIME regime;          // Current market regime
   double            probLong;          // Long probability (0..1)
   double            probShort;         // Short probability (0..1)
   string            lastSignal;        // Human-readable last signal label

   //--- Trade control
   uint              lastEntryTick;     // GetTickCount() at last entry (cooldown)
   double            lastEntryPrice;    // Price of last entry (duplicate guard)

   //--- Lot ladder
   int               ladderIndex;       // Current index into the lot ladder
   double            ladderPeakEquity;  // Peak equity tracked for ladder reset
  };

//+------------------------------------------------------------------+
//| GLOBALS                                                          |
//+------------------------------------------------------------------+
CTrade         trade;                   // Trade execution helper
CPositionInfo  posInfo;                 // Position inspection helper
CSymbolInfo    symInfo;                 // Symbol info helper

SymbolContext  g_ctx[];                 // Per-symbol contexts
int            g_symCount = 0;          // Number of active symbols

// Lot scaling ladder as specified: 0.01 -> 0.02 -> 0.03 -> 0.05 -> 0.10 -> 0.20
double         g_lotLadder[] = {0.01, 0.02, 0.03, 0.05, 0.10, 0.20};
int            g_lotLadderSize = 6;

// Daily accounting
datetime       g_dayStart        = 0;   // Start of current trading day
double          g_dayStartBalance = 0;  // Balance at day start
double          g_dayStartEquity  = 0;  // Equity at day start
double          g_peakEquity      = 0;  // Session peak equity (equity protection)
bool           g_tradingHalted   = false;// Hard halt flag (daily/equity protection)
string         g_haltReason       = ""; // Why trading was halted

// Win/Loss session stats
int            g_wins   = 0;
int            g_losses = 0;
int            g_tradesToday = 0;

// News schedule (parsed)
datetime       g_newsTimes[];
int            g_newsCount = 0;

// Dashboard object name prefix
string         g_dashPrefix = "TSC_DASH_";

// History scan bookmark for win-rate tracking
datetime       g_lastHistoryScan = 0;

//+------------------------------------------------------------------+
//| UTILITY: logging                                                |
//+------------------------------------------------------------------+
void LogMsg(const string msg)
  {
   if(InpVerboseLog)
      PrintFormat("[%s] %s", TimeToString(TimeCurrent(), TIME_SECONDS), msg);
  }

void LogAlways(const string msg)
  {
   PrintFormat("[%s] %s", TimeToString(TimeCurrent(), TIME_SECONDS), msg);
  }

//+------------------------------------------------------------------+
//| UTILITY: normalize a volume to the symbol's constraints          |
//+------------------------------------------------------------------+
double NormalizeVolume(SymbolContext &c, double vol)
  {
   if(c.volStep <= 0.0)
      return(c.volMin);
   double steps = MathRound((vol - c.volMin) / c.volStep);
   double v = c.volMin + steps * c.volStep;
   v = MathMax(c.volMin, MathMin(c.volMax, v));
   // Round to the precision implied by the volume step.
   int volDigits = (int)MathMax(0, MathCeil(-MathLog10(c.volStep)));
   v = NormalizeDouble(v, volDigits);
   return(v);
  }

//+------------------------------------------------------------------+
//| UTILITY: normalize a price to symbol digits                      |
//+------------------------------------------------------------------+
double NPrice(SymbolContext &c, double price)
  {
   return(NormalizeDouble(price, c.digits));
  }

//+------------------------------------------------------------------+
//| Parse the symbol list (or use the chart symbol)                  |
//+------------------------------------------------------------------+
void BuildSymbolList()
  {
   string symbols[];
   int count = 0;

   if(InpMultiSymbol)
     {
      string raw = InpSymbolList;
      StringReplace(raw, " ", "");
      count = StringSplit(raw, ',', symbols);
      if(count <= 0)
        {
         ArrayResize(symbols, 1);
         symbols[0] = _Symbol;
         count = 1;
        }
     }
   else
     {
      ArrayResize(symbols, 1);
      symbols[0] = _Symbol;
      count = 1;
     }

   ArrayResize(g_ctx, count);
   g_symCount = 0;

   for(int i = 0; i < count; i++)
     {
      string sym = symbols[i];
      if(StringLen(sym) == 0)
         continue;

      if(!SymbolSelect(sym, true))
        {
         LogAlways("WARNING: could not select symbol " + sym + " - skipping.");
         continue;
        }

      InitSymbolContext(g_ctx[g_symCount], sym);
      g_symCount++;
     }

   if(g_symCount == 0)
     {
      // Always fall back to the chart symbol so the EA never sits idle.
      ArrayResize(g_ctx, 1);
      InitSymbolContext(g_ctx[0], _Symbol);
      g_symCount = 1;
     }
  }

//+------------------------------------------------------------------+
//| Initialize a per-symbol context and cache its specs              |
//+------------------------------------------------------------------+
void InitSymbolContext(SymbolContext &c, const string sym)
  {
   c.symbol = sym;
   c.ready  = false;

   c.point      = SymbolInfoDouble(sym, SYMBOL_POINT);
   c.digits     = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   c.tickValue  = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   c.tickSize   = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   c.volMin     = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   c.volMax     = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   c.volStep    = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   c.stopLevel  = (int)SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
   c.freezeLevel= (int)SymbolInfoInteger(sym, SYMBOL_TRADE_FREEZE_LEVEL);

   if(c.point <= 0.0)
      c.point = 0.00001;
   if(c.tickSize <= 0.0)
      c.tickSize = c.point;

   int sz = (int)MathMax(50, InpTickBufferSize);
   ArrayResize(c.bidBuf, sz);
   ArrayResize(c.askBuf, sz);
   ArrayResize(c.midBuf, sz);
   ArrayResize(c.tvBuf, sz);
   ArrayResize(c.timeBuf, sz);
   ArrayInitialize(c.bidBuf, 0.0);
   ArrayInitialize(c.askBuf, 0.0);
   ArrayInitialize(c.midBuf, 0.0);
   ArrayInitialize(c.tvBuf, 0);
   ArrayInitialize(c.timeBuf, 0);

   c.bufCount = 0;
   c.bufHead  = 0;
   c.lastBid  = 0.0;
   c.lastAsk  = 0.0;

   c.momentum     = 0.0;
   c.momentumPrev = 0.0;
   c.acceleration = 0.0;
   c.flowPressure = 0.0;
   c.microSlope   = 0.0;
   c.volatility   = 0.0;
   c.volBaseline  = 0.0;
   c.momStd       = 0.0;
   c.rangeRecent  = 0.0;
   c.atrProxy     = 0.0;

   c.bias       = BIAS_NEUTRAL;
   c.regime     = REGIME_QUIET;
   c.probLong   = 0.0;
   c.probShort  = 0.0;
   c.lastSignal = "init";

   c.lastEntryTick  = 0;
   c.lastEntryPrice = 0.0;

   c.ladderIndex       = 0;
   c.ladderPeakEquity  = AccountInfoDouble(ACCOUNT_EQUITY);

   c.ready = true;
   LogAlways("Initialized symbol: " + sym +
             " point=" + DoubleToString(c.point, c.digits) +
             " volMin=" + DoubleToString(c.volMin, 2));
  }

//+------------------------------------------------------------------+
//| Find context index by symbol                                     |
//+------------------------------------------------------------------+
int FindContext(const string sym)
  {
   for(int i = 0; i < g_symCount; i++)
      if(g_ctx[i].symbol == sym)
         return(i);
   return(-1);
  }

//+------------------------------------------------------------------+
//| EXPERT INITIALIZATION                                            |
//+------------------------------------------------------------------+
int OnInit()
  {
   // Configure the trade helper for low-latency scalping.
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints((ulong)InpSlippagePoints);
   trade.SetTypeFillingBySymbol(_Symbol);
   trade.SetAsyncMode(false); // synchronous: we want fills confirmed before re-evaluating
   trade.LogLevel(LOG_LEVEL_ERRORS);

   BuildSymbolList();
   ParseNewsTimes();

   // Establish daily accounting anchors.
   ResetDailyAnchors();
   g_peakEquity = AccountInfoDouble(ACCOUNT_EQUITY);

   // Rebuild win/loss stats from today's history so restarts are seamless.
   RebuildStatsFromHistory();

   if(InpShowDashboard)
      CreateDashboard();

   LogAlways("TickScalperEA initialized. Symbols=" + IntegerToString(g_symCount) +
             " Magic=" + IntegerToString(InpMagicNumber));

   // Drive the dashboard even when ticks are sparse.
   EventSetMillisecondTimer(250);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| EXPERT DEINITIALIZATION                                          |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
   if(InpShowDashboard)
      DestroyDashboard();
   LogAlways("TickScalperEA stopped. Reason=" + IntegerToString(reason));
  }

//+------------------------------------------------------------------+
//| TIMER: keep dashboard & housekeeping alive between ticks         |
//+------------------------------------------------------------------+
void OnTimer()
  {
   CheckDayRollover();
   CheckProtection();
   if(InpShowDashboard && g_symCount > 0)
      UpdateDashboard(g_ctx[0]);
  }

//+------------------------------------------------------------------+
//| MAIN TICK HANDLER                                                |
//| Everything happens here, on every incoming price update.         |
//+------------------------------------------------------------------+
void OnTick()
  {
   // Daily rollover / protection checks run first and cheaply.
   CheckDayRollover();
   CheckProtection();

   // Periodically refresh win-rate from closed deals (not every tick).
   if(TimeCurrent() - g_lastHistoryScan >= 5)
     {
      RebuildStatsFromHistory();
      g_lastHistoryScan = TimeCurrent();
     }

   // Process every managed symbol. In single-symbol mode this is just one.
   // We index the global array directly so each call receives a true
   // reference (MQL5 does not implicitly convert pointers to references).
   for(int i = 0; i < g_symCount; i++)
     {
      if(!g_ctx[i].ready)
         continue;

      // 1) Pull the freshest tick for this symbol.
      MqlTick tick;
      if(!SymbolInfoTick(g_ctx[i].symbol, tick))
         continue;

      // 2) Update the ring buffer & derived analytics with the new tick.
      if(!UpdateTickBuffers(g_ctx[i], tick))
        {
         // Still manage existing positions even if analytics aren't ready.
         ManageOpenPositions(g_ctx[i], tick);
         continue;
        }

      ComputeAnalytics(g_ctx[i]);
      DetectRegime(g_ctx[i]);
      ComputeProbabilities(g_ctx[i]);

      // 3) Manage existing positions tick-by-tick (exits, trailing, partials).
      ManageOpenPositions(g_ctx[i], tick);

      // 4) Basket-level profit / loss management across all positions.
      if(InpUseBasketClose)
         ManageBasket(g_ctx[i]);

      // 5) Consider new entries if trading is allowed.
      if(!g_tradingHalted && TradingAllowed(g_ctx[i], tick))
         EvaluateEntries(g_ctx[i], tick);
     }

   // Refresh the dashboard on the primary symbol after processing.
   if(InpShowDashboard && g_symCount > 0)
      UpdateDashboard(g_ctx[0]);
  }

//+==================================================================+
//|                       TICK BUFFER ENGINE                         |
//+==================================================================+

//+------------------------------------------------------------------+
//| Push a new tick into the ring buffer. Returns true once warmed.  |
//+------------------------------------------------------------------+
bool UpdateTickBuffers(SymbolContext &c, const MqlTick &tick)
  {
   double bid = tick.bid;
   double ask = tick.ask;
   if(bid <= 0.0 || ask <= 0.0)
      return(c.bufCount >= InpMomentumWindow);

   double mid = (bid + ask) * 0.5;

   int sz = ArraySize(c.midBuf);
   // Advance ring head.
   c.bufHead = (c.bufHead + 1) % sz;
   c.bidBuf[c.bufHead]  = bid;
   c.askBuf[c.bufHead]  = ask;
   c.midBuf[c.bufHead]  = mid;
   c.timeBuf[c.bufHead] = (long)tick.time_msc;

   // Order-flow proxy: +1 on up-tick, -1 on down-tick, 0 on no change.
   long flow = 0;
   if(c.lastBid > 0.0)
     {
      if(mid > (c.lastBid + c.lastAsk) * 0.5)
         flow = 1;
      else if(mid < (c.lastBid + c.lastAsk) * 0.5)
         flow = -1;
     }
   c.tvBuf[c.bufHead] = flow;

   c.lastBid = bid;
   c.lastAsk = ask;

   if(c.bufCount < sz)
      c.bufCount++;

   return(c.bufCount >= InpMomentumWindow);
  }

//+------------------------------------------------------------------+
//| Read the i-th most-recent sample (0 = newest) from a double ring |
//+------------------------------------------------------------------+
double RingGet(const double &buf[], int head, int sz, int agoIdx)
  {
   int idx = head - agoIdx;
   while(idx < 0)
      idx += sz;
   return(buf[idx]);
  }

long RingGetL(const long &buf[], int head, int sz, int agoIdx)
  {
   int idx = head - agoIdx;
   while(idx < 0)
      idx += sz;
   return(buf[idx]);
  }

//+------------------------------------------------------------------+
//| Compute all derived analytics from the tick buffer               |
//+------------------------------------------------------------------+
void ComputeAnalytics(SymbolContext &c)
  {
   int sz = ArraySize(c.midBuf);
   int n  = c.bufCount;
   if(n < InpMomentumWindow)
      return;

   //--- 1) Momentum: net mid-price change over the momentum window,
   //       expressed in points and scaled for readability.
   int mw = (int)MathMin(InpMomentumWindow, n - 1);
   double newest = RingGet(c.midBuf, c.bufHead, sz, 0);
   double older  = RingGet(c.midBuf, c.bufHead, sz, mw);
   c.momentumPrev = c.momentum;
   c.momentum = (newest - older) / c.point; // momentum in points

   //--- 2) Acceleration: change of momentum over the accel window.
   int aw = (int)MathMin(InpAccelWindow, n - 1);
   double midNow  = RingGet(c.midBuf, c.bufHead, sz, 0);
   double midMid  = RingGet(c.midBuf, c.bufHead, sz, aw / 2);
   double midOld  = RingGet(c.midBuf, c.bufHead, sz, aw);
   double v1 = (midNow - midMid) / c.point;
   double v2 = (midMid - midOld) / c.point;
   c.acceleration = v1 - v2; // positive => accelerating up

   //--- 3) Order-flow pressure: normalized sum of up/down ticks.
   int fw = (int)MathMin(InpFlowWindow, n);
   long flowSum = 0;
   for(int k = 0; k < fw; k++)
      flowSum += RingGetL(c.tvBuf, c.bufHead, sz, k);
   c.flowPressure = (fw > 0) ? (double)flowSum / (double)fw : 0.0; // -1..+1

   //--- 4) Micro-trend slope via least-squares over mid prices.
   int tw = (int)MathMin(InpMicroTrendWindow, n);
   c.microSlope = LeastSquaresSlope(c, tw) / c.point; // points per tick

   //--- 5) Volatility: standard deviation of per-tick returns (points).
   int vw = (int)MathMin(InpMicroTrendWindow, n - 1);
   double sumR = 0.0, sumR2 = 0.0;
   int cnt = 0;
   for(int k = 0; k < vw; k++)
     {
      double a = RingGet(c.midBuf, c.bufHead, sz, k);
      double b = RingGet(c.midBuf, c.bufHead, sz, k + 1);
      double r = (a - b) / c.point;
      sumR  += r;
      sumR2 += r * r;
      cnt++;
     }
   if(cnt > 1)
     {
      double mean = sumR / cnt;
      double var  = (sumR2 / cnt) - (mean * mean);
      c.volatility = (var > 0.0) ? MathSqrt(var) : 0.0;
     }

   // Exponential baseline of volatility for spike comparison.
   if(c.volBaseline <= 0.0)
      c.volBaseline = c.volatility;
   else
      c.volBaseline = 0.97 * c.volBaseline + 0.03 * c.volatility;

   // Baseline of |momentum| for burst comparison.
   double absMom = MathAbs(c.momentum);
   if(c.momStd <= 0.0)
      c.momStd = absMom;
   else
      c.momStd = 0.95 * c.momStd + 0.05 * absMom;

   //--- 6) Recent range & ATR-like proxy (points).
   int rw = (int)MathMin(InpMicroTrendWindow, n);
   double hi = -DBL_MAX, lo = DBL_MAX;
   for(int k = 0; k < rw; k++)
     {
      double m = RingGet(c.midBuf, c.bufHead, sz, k);
      if(m > hi) hi = m;
      if(m < lo) lo = m;
     }
   c.rangeRecent = (hi - lo) / c.point;
   if(c.atrProxy <= 0.0)
      c.atrProxy = c.rangeRecent;
   else
      c.atrProxy = 0.9 * c.atrProxy + 0.1 * c.rangeRecent;

   //--- 7) Bias from slope + flow.
   double biasScore = (c.microSlope * 50.0) + (c.flowPressure * 1.0) + (c.momentum / MathMax(1.0, c.momStd)) * 0.5;
   if(biasScore > 0.5)
      c.bias = BIAS_BULLISH;
   else if(biasScore < -0.5)
      c.bias = BIAS_BEARISH;
   else
      c.bias = BIAS_NEUTRAL;
  }

//+------------------------------------------------------------------+
//| Least-squares slope of mid prices over the last 'w' samples      |
//| Returns slope in price units per tick (index 0 = oldest).        |
//+------------------------------------------------------------------+
double LeastSquaresSlope(SymbolContext &c, int w)
  {
   if(w < 2)
      return(0.0);
   int sz = ArraySize(c.midBuf);
   double sumX = 0.0, sumY = 0.0, sumXY = 0.0, sumX2 = 0.0;
   for(int k = 0; k < w; k++)
     {
      // x increases with time: oldest sample gets smallest x.
      double x = (double)(w - 1 - k);
      double y = RingGet(c.midBuf, c.bufHead, sz, k);
      sumX  += x;
      sumY  += y;
      sumXY += x * y;
      sumX2 += x * x;
     }
   double denom = (w * sumX2 - sumX * sumX);
   if(MathAbs(denom) < 1e-12)
      return(0.0);
   return((w * sumXY - sumX * sumY) / denom);
  }

//+==================================================================+
//|                     MARKET REGIME DETECTION                      |
//+==================================================================+
void DetectRegime(SymbolContext &c)
  {
   double slopePts = MathAbs(c.microSlope);
   double volRatio = (c.volBaseline > 0.0) ? c.volatility / c.volBaseline : 1.0;

   // Directional strength: large slope + aligned flow = trend.
   bool strongDir = (slopePts > 0.02) && (MathAbs(c.flowPressure) > 0.25);

   if(volRatio >= InpVolSpikeFactor)
     {
      c.regime = REGIME_VOLATILE;
     }
   else if(strongDir && c.microSlope > 0.0)
     {
      c.regime = REGIME_TRENDING_UP;
     }
   else if(strongDir && c.microSlope < 0.0)
     {
      c.regime = REGIME_TRENDING_DOWN;
     }
   else if(c.atrProxy > 0.0 && c.rangeRecent < c.atrProxy * InpRangeBlockFactor)
     {
      c.regime = REGIME_QUIET;
     }
   else
     {
      c.regime = REGIME_RANGING;
     }
  }

//+==================================================================+
//|                    PROBABILITY / SIGNAL ENGINE                   |
//+==================================================================+

//+------------------------------------------------------------------+
//| Convert the raw analytics into long/short probabilities and a    |
//| descriptive signal label. Probabilities are bounded in [0,1].    |
//+------------------------------------------------------------------+
void ComputeProbabilities(SymbolContext &c)
  {
   double scoreLong  = 0.0;
   double scoreShort = 0.0;
   string sig = "none";

   double momRef = MathMax(0.5, c.momStd);     // avoid divide-by-zero
   double momZ   = c.momentum / momRef;        // z-like momentum
   double volRatio = (c.volBaseline > 0.0) ? c.volatility / c.volBaseline : 1.0;

   //--- (A) Bullish / bearish momentum bursts -----------------------
   bool bullBurst = (momZ >  InpBurstFactor) && (c.acceleration > 0.0) && (c.flowPressure > 0.1);
   bool bearBurst = (momZ < -InpBurstFactor) && (c.acceleration < 0.0) && (c.flowPressure < -0.1);
   if(bullBurst)
     {
      scoreLong += 0.40;
      sig = "BullBurst";
     }
   if(bearBurst)
     {
      scoreShort += 0.40;
      sig = "BearBurst";
     }

   //--- (B) Micro-trend alignment -----------------------------------
   if(c.bias == BIAS_BULLISH)
      scoreLong  += 0.15;
   else if(c.bias == BIAS_BEARISH)
      scoreShort += 0.15;

   //--- (C) Order-flow pressure -------------------------------------
   scoreLong  += MathMax(0.0,  c.flowPressure) * 0.20;
   scoreShort += MathMax(0.0, -c.flowPressure) * 0.20;

   //--- (D) Acceleration confirmation -------------------------------
   if(c.acceleration > 0.0)
      scoreLong  += MathMin(0.15, c.acceleration / (momRef * 4.0));
   else if(c.acceleration < 0.0)
      scoreShort += MathMin(0.15, -c.acceleration / (momRef * 4.0));

   //--- (E) Momentum exhaustion (reversal fade) ---------------------
   // Momentum was strong but is now fading against an over-extended move.
   if(InpUseExhaustion)
     {
      bool fadingUp   = (c.momentumPrev > momRef * InpBurstFactor) &&
                        (c.momentum < c.momentumPrev * InpExhaustionFactor) &&
                        (c.acceleration < 0.0);
      bool fadingDown = (c.momentumPrev < -momRef * InpBurstFactor) &&
                        (c.momentum > c.momentumPrev * InpExhaustionFactor) &&
                        (c.acceleration > 0.0);
      if(fadingUp)
        {
         scoreShort += 0.30;  // fade the exhausted up move
         sig = "ExhaustUp";
        }
      if(fadingDown)
        {
         scoreLong += 0.30;   // fade the exhausted down move
         sig = "ExhaustDown";
        }
     }

   //--- (F) Micro reversal (flow flips against recent momentum) ------
   bool microRevUp   = (c.momentum < 0.0) && (c.flowPressure > 0.3) && (c.acceleration > 0.0);
   bool microRevDown = (c.momentum > 0.0) && (c.flowPressure < -0.3) && (c.acceleration < 0.0);
   if(microRevUp)
     {
      scoreLong += 0.20;
      if(sig == "none") sig = "MicroRevUp";
     }
   if(microRevDown)
     {
      scoreShort += 0.20;
      if(sig == "none") sig = "MicroRevDown";
     }

   //--- (G) Volatility spike participation --------------------------
   if(volRatio >= InpVolSpikeFactor)
     {
      // In a spike, trade with the dominant flow direction.
      if(c.flowPressure > 0.0)
         scoreLong += 0.15;
      else if(c.flowPressure < 0.0)
         scoreShort += 0.15;
      if(sig == "none") sig = "VolSpike";
     }

   //--- (H) False breakout fade -------------------------------------
   // Price pokes beyond the recent range then snaps back against it.
   if(InpUseFalseBreakout)
     {
      int sz = ArraySize(c.midBuf);
      int n  = c.bufCount;
      int rw = (int)MathMin(InpMicroTrendWindow, n);
      double hi = -DBL_MAX, lo = DBL_MAX;
      // Range excluding the last few ticks.
      for(int k = 3; k < rw; k++)
        {
         double m = RingGet(c.midBuf, c.bufHead, sz, k);
         if(m > hi) hi = m;
         if(m < lo) lo = m;
        }
      double cur  = RingGet(c.midBuf, c.bufHead, sz, 0);
      double peak = RingGet(c.midBuf, c.bufHead, sz, 1);
      // Bullish false breakout: spiked below range, snapping back up.
      if(peak < lo && cur > lo && c.acceleration > 0.0)
        {
         scoreLong += 0.25;
         sig = "FalseBreakDn";
        }
      // Bearish false breakout: spiked above range, snapping back down.
      if(peak > hi && cur < hi && c.acceleration < 0.0)
        {
         scoreShort += 0.25;
         sig = "FalseBreakUp";
        }
     }

   //--- (I) Liquidity sweep -----------------------------------------
   // A sharp wick beyond recent extremes that immediately reverses,
   // implying stops were swept and price is reverting.
   if(InpUseLiquiditySweep)
     {
      int sz = ArraySize(c.midBuf);
      int n  = c.bufCount;
      int rw = (int)MathMin(InpMicroTrendWindow, n);
      double hi = -DBL_MAX, lo = DBL_MAX;
      for(int k = 4; k < rw; k++)
        {
         double m = RingGet(c.midBuf, c.bufHead, sz, k);
         if(m > hi) hi = m;
         if(m < lo) lo = m;
        }
      double cur   = RingGet(c.midBuf, c.bufHead, sz, 0);
      double wick1 = RingGet(c.midBuf, c.bufHead, sz, 1);
      double wick2 = RingGet(c.midBuf, c.bufHead, sz, 2);
      // Down-sweep then reclaim => long.
      if(wick2 < lo && wick1 < lo && cur > lo && (cur - wick1) / c.point > c.atrProxy * 0.2 * InpSweepFactor)
        {
         scoreLong += 0.30;
         sig = "SweepLong";
        }
      // Up-sweep then reject => short.
      if(wick2 > hi && wick1 > hi && cur < hi && (wick1 - cur) / c.point > c.atrProxy * 0.2 * InpSweepFactor)
        {
         scoreShort += 0.30;
         sig = "SweepShort";
        }
     }

   //--- Normalize to probabilities ----------------------------------
   // Squash with a soft cap so a single confluence can't exceed 1.
   c.probLong  = 1.0 - 1.0 / (1.0 + MathMax(0.0, scoreLong)  * 3.0);
   c.probShort = 1.0 - 1.0 / (1.0 + MathMax(0.0, scoreShort) * 3.0);
   c.lastSignal = sig;
  }

//+==================================================================+
//|                          FILTERS / GATES                         |
//+==================================================================+

//+------------------------------------------------------------------+
//| Master gate: is trading allowed for this symbol right now?       |
//+------------------------------------------------------------------+
bool TradingAllowed(SymbolContext &c, const MqlTick &tick)
  {
   // Global terminal / account permissions.
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      return(false);
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
      return(false);
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
      return(false);
   if(!AccountInfoInteger(ACCOUNT_TRADE_EXPERT))
      return(false);

   // Spread filter.
   double spreadPts = (tick.ask - tick.bid) / c.point;
   if(spreadPts > InpMaxSpreadPoints)
     {
      c.lastSignal = "spread";
      return(false);
     }

   // Session filter.
   if(!SessionOpen())
      return(false);

   // News filter.
   if(InpUseNewsFilter && InNewsWindow())
     {
      c.lastSignal = "news";
      return(false);
     }

   // Anti-overtrading: skip dead/sideways markets.
   if(c.regime == REGIME_QUIET)
     {
      c.lastSignal = "quiet";
      return(false);
     }
   if(c.atrProxy > 0.0 && c.rangeRecent < c.atrProxy * InpRangeBlockFactor)
     {
      c.lastSignal = "chop";
      return(false);
     }

   // Max open trades for this EA across all symbols.
   if(CountEAPositions() >= InpMaxOpenTrades)
      return(false);

   return(true);
  }

//+------------------------------------------------------------------+
//| Session time filter (server time)                                |
//+------------------------------------------------------------------+
bool SessionOpen()
  {
   if(!InpUseSessionFilter)
      return(true);

   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);

   // Day-of-week gating.
   if(dt.day_of_week == 0 || dt.day_of_week == 6) // Sunday / Saturday
      return(false);
   if(dt.day_of_week == 1 && !InpTradeMonday)
      return(false);
   if(dt.day_of_week == 5)
     {
      if(!InpTradeFriday)
         return(false);
      if(dt.hour >= InpFridayCloseHour)
         return(false);
     }

   // Intraday window, supports windows that wrap past midnight.
   int h = dt.hour;
   if(InpSessionStartHour <= InpSessionEndHour)
     {
      if(h < InpSessionStartHour || h >= InpSessionEndHour)
         return(false);
     }
   else
     {
      // Wrapping window (e.g. 22 -> 6).
      if(h < InpSessionStartHour && h >= InpSessionEndHour)
         return(false);
     }
   return(true);
  }

//+------------------------------------------------------------------+
//| Parse the news-times input string into datetime array            |
//+------------------------------------------------------------------+
void ParseNewsTimes()
  {
   g_newsCount = 0;
   ArrayResize(g_newsTimes, 0);
   if(StringLen(InpNewsTimes) == 0)
      return;

   string items[];
   int cnt = StringSplit(InpNewsTimes, ';', items);
   for(int i = 0; i < cnt; i++)
     {
      string s = items[i];
      StringTrimLeft(s);
      StringTrimRight(s);
      if(StringLen(s) == 0)
         continue;
      datetime t = StringToTime(s);
      if(t > 0)
        {
         int n = ArraySize(g_newsTimes);
         ArrayResize(g_newsTimes, n + 1);
         g_newsTimes[n] = t;
         g_newsCount++;
        }
     }
   if(g_newsCount > 0)
      LogAlways("Parsed " + IntegerToString(g_newsCount) + " news events.");
  }

//+------------------------------------------------------------------+
//| Are we inside a news avoidance window?                           |
//+------------------------------------------------------------------+
bool InNewsWindow()
  {
   if(g_newsCount == 0)
      return(false);
   datetime now = TimeCurrent();
   for(int i = 0; i < g_newsCount; i++)
     {
      datetime before = g_newsTimes[i] - InpNewsBeforeMin * 60;
      datetime after  = g_newsTimes[i] + InpNewsAfterMin  * 60;
      if(now >= before && now <= after)
         return(true);
     }
   return(false);
  }

//+==================================================================+
//|                       ENTRY EVALUATION                           |
//+==================================================================+
void EvaluateEntries(SymbolContext &c, const MqlTick &tick)
  {
   // Re-entry cooldown (millisecond precision for tick scalping).
   uint nowMs = GetTickCount();
   if(c.lastEntryTick != 0)
     {
      uint elapsed = nowMs - c.lastEntryTick;
      if((int)elapsed < InpReEntryCooldownMs)
         return;
     }
   if(!InpAllowReEntry && CountSymbolPositions(c.symbol) > 0)
      return;

   bool wantLong  = (c.probLong  >= InpEntryThreshold) && (c.probLong > c.probShort);
   bool wantShort = (c.probShort >= InpEntryThreshold) && (c.probShort > c.probLong);

   if(!wantLong && !wantShort)
      return;

   // Duplicate-entry guard: do not stack orders at nearly the same price/direction.
   if(IsDuplicateEntry(c, wantLong ? ORDER_TYPE_BUY : ORDER_TYPE_SELL, tick))
      return;

   // Compute dynamic SL/TP in points.
   double slPts, tpPts;
   ComputeDynamicSLTP(c, slPts, tpPts);

   // Lot sizing.
   double lot = ComputeLotSize(c, slPts);

   if(wantLong)
      OpenTrade(c, ORDER_TYPE_BUY, lot, slPts, tpPts, tick);
   else if(wantShort)
      OpenTrade(c, ORDER_TYPE_SELL, lot, slPts, tpPts, tick);
  }

//+------------------------------------------------------------------+
//| Duplicate-entry guard                                            |
//+------------------------------------------------------------------+
bool IsDuplicateEntry(SymbolContext &c, ENUM_ORDER_TYPE type, const MqlTick &tick)
  {
   double price = (type == ORDER_TYPE_BUY) ? tick.ask : tick.bid;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!posInfo.SelectByTicket(ticket))
         continue;
      if(posInfo.Symbol() != c.symbol)
         continue;
      if(posInfo.Magic() != InpMagicNumber)
         continue;

      // Same direction within the duplicate guard distance => block.
      bool sameDir = ((type == ORDER_TYPE_BUY  && posInfo.PositionType() == POSITION_TYPE_BUY) ||
                      (type == ORDER_TYPE_SELL && posInfo.PositionType() == POSITION_TYPE_SELL));
      if(sameDir)
        {
         double dist = MathAbs(posInfo.PriceOpen() - price) / c.point;
         if(dist < InpDuplicateGuardPts)
            return(true);
        }
     }
   return(false);
  }

//+------------------------------------------------------------------+
//| Dynamic SL/TP: scale the base distances by current volatility.   |
//+------------------------------------------------------------------+
void ComputeDynamicSLTP(SymbolContext &c, double &slPts, double &tpPts)
  {
   double mult = 1.0;
   if(InpDynamicTPSL && c.volBaseline > 0.0)
     {
      mult = c.volatility / c.volBaseline;
      mult = MathMax(InpDynamicTPSLMin, MathMin(InpDynamicTPSLMax, mult));
     }
   slPts = InpStopLossPoints   * mult;
   tpPts = InpTakeProfitPoints * mult;

   // Respect the broker's minimum stop distance.
   double minStop = (double)c.stopLevel + 1.0;
   slPts = MathMax(slPts, minStop);
   tpPts = MathMax(tpPts, minStop);
  }

//+------------------------------------------------------------------+
//| Lot sizing: fixed, ladder, or risk-percent.                      |
//+------------------------------------------------------------------+
double ComputeLotSize(SymbolContext &c, double slPts)
  {
   double lot = InpBaseLot;

   switch(InpLotMode)
     {
      case LOT_FIXED:
         lot = InpBaseLot;
         break;

      case LOT_LADDER:
        {
         int idx = c.ladderIndex;
         if(idx < 0) idx = 0;
         if(idx >= g_lotLadderSize) idx = g_lotLadderSize - 1;
         lot = g_lotLadder[idx];
         // Honor the configured base lot as the floor of the ladder.
         if(lot < InpBaseLot) lot = InpBaseLot;
         break;
        }

      case LOT_RISK_PERCENT:
        {
         double equity = AccountInfoDouble(ACCOUNT_EQUITY);
         double riskMoney = equity * (InpRiskPercent / 100.0);
         double tickVal = (c.tickValue > 0.0) ? c.tickValue : 1.0;
         double ticksAtRisk = (slPts * c.point) / c.tickSize;
         double moneyPerLot = ticksAtRisk * tickVal;
         if(moneyPerLot > 0.0)
            lot = riskMoney / moneyPerLot;
         else
            lot = InpBaseLot;
         break;
        }
     }

   return(NormalizeVolume(c, lot));
  }

//+==================================================================+
//|                        ORDER EXECUTION                           |
//+==================================================================+
bool OpenTrade(SymbolContext &c, ENUM_ORDER_TYPE type, double lot,
               double slPts, double tpPts, const MqlTick &tick)
  {
   if(lot <= 0.0)
      return(false);

   // Re-validate price freshness for low-latency safety.
   MqlTick fresh = tick;
   if(InpUseMarketExecGuard)
     {
      if(!SymbolInfoTick(c.symbol, fresh))
         fresh = tick;
     }

   double price = (type == ORDER_TYPE_BUY) ? fresh.ask : fresh.bid;
   double sl, tp;
   if(type == ORDER_TYPE_BUY)
     {
      sl = NPrice(c, price - slPts * c.point);
      tp = NPrice(c, price + tpPts * c.point);
     }
   else
     {
      sl = NPrice(c, price + slPts * c.point);
      tp = NPrice(c, price - tpPts * c.point);
     }

   trade.SetTypeFillingBySymbol(c.symbol);

   bool ok = false;
   for(int attempt = 0; attempt < InpMaxRetries && !ok; attempt++)
     {
      if(type == ORDER_TYPE_BUY)
         ok = trade.Buy(lot, c.symbol, 0.0, sl, tp, InpTradeComment);
      else
         ok = trade.Sell(lot, c.symbol, 0.0, sl, tp, InpTradeComment);

      if(ok)
         break;

      uint rc = trade.ResultRetcode();
      // Retry only on transient conditions.
      if(rc == TRADE_RETCODE_REQUOTE || rc == TRADE_RETCODE_PRICE_OFF ||
         rc == TRADE_RETCODE_PRICE_CHANGED || rc == TRADE_RETCODE_REJECT ||
         rc == TRADE_RETCODE_CONNECTION || rc == TRADE_RETCODE_TIMEOUT)
        {
         Sleep(InpRetryDelayMs);
         // Refresh price for the next attempt.
         if(SymbolInfoTick(c.symbol, fresh))
           {
            price = (type == ORDER_TYPE_BUY) ? fresh.ask : fresh.bid;
            if(type == ORDER_TYPE_BUY)
              {
               sl = NPrice(c, price - slPts * c.point);
               tp = NPrice(c, price + tpPts * c.point);
              }
            else
              {
               sl = NPrice(c, price + slPts * c.point);
               tp = NPrice(c, price - tpPts * c.point);
              }
           }
        }
      else
        {
         break; // non-transient failure
        }
     }

   if(ok)
     {
      c.lastEntryTick  = GetTickCount();
      c.lastEntryPrice = price;
      g_tradesToday++;
      LogMsg(StringFormat("OPEN %s %s lot=%.2f @ %.5f sl=%.5f tp=%.5f [%s] pL=%.2f pS=%.2f",
                          c.symbol,
                          (type == ORDER_TYPE_BUY ? "BUY" : "SELL"),
                          lot, price, sl, tp, c.lastSignal, c.probLong, c.probShort));
     }
   else
     {
      LogMsg(StringFormat("OPEN FAILED %s rc=%d %s",
                          c.symbol, trade.ResultRetcode(), trade.ResultRetcodeDescription()));
     }
   return(ok);
  }

//+==================================================================+
//|                     POSITION MANAGEMENT                          |
//+==================================================================+

//+------------------------------------------------------------------+
//| Manage all open positions for a symbol on every tick.            |
//+------------------------------------------------------------------+
void ManageOpenPositions(SymbolContext &c, const MqlTick &tick)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(!posInfo.SelectByTicket(ticket))
         continue;
      if(posInfo.Symbol() != c.symbol)
         continue;
      if(posInfo.Magic() != InpMagicNumber)
         continue;

      ENUM_POSITION_TYPE ptype = posInfo.PositionType();
      double openPrice = posInfo.PriceOpen();
      double curSL     = posInfo.StopLoss();
      double curTP     = posInfo.TakeProfit();
      double volume    = posInfo.Volume();

      double bid = tick.bid;
      double ask = tick.ask;

      // Current price relevant for the position's profit.
      double curPrice = (ptype == POSITION_TYPE_BUY) ? bid : ask;
      double profitPts = (ptype == POSITION_TYPE_BUY)
                         ? (bid - openPrice) / c.point
                         : (openPrice - ask) / c.point;

      //--- 1) Immediate profit-target close (tick-based take-profit).
      //       Close the moment the target is hit instead of waiting
      //       for the broker-side TP, reducing slippage on exit.
      double tpPts;
      double slPtsTmp;
      ComputeDynamicSLTP(c, slPtsTmp, tpPts);
      if(profitPts >= tpPts)
        {
         ClosePosition(c, ticket, "tp-hit");
         OnTradeClosedProfit(c, true);
         continue;
        }

      //--- 2) Partial exit.
      if(InpUsePartialExit && profitPts >= InpPartialAtPoints)
        {
         if(!PartialDone(ticket))
           {
            double closeVol = NormalizeVolume(c, volume * (InpPartialPercent / 100.0));
            if(closeVol >= c.volMin && (volume - closeVol) >= c.volMin)
              {
               if(trade.PositionClosePartial(ticket, closeVol))
                 {
                  MarkPartialDone(ticket);
                  LogMsg(StringFormat("PARTIAL %s ticket=%I64u vol=%.2f @+%.1fpts",
                                      c.symbol, ticket, closeVol, profitPts));
                 }
              }
           }
        }

      //--- 3) Break-even.
      if(InpUseBreakEven && profitPts >= InpBreakEvenPoints)
        {
         double bePrice = (ptype == POSITION_TYPE_BUY)
                          ? NPrice(c, openPrice + InpBreakEvenLock * c.point)
                          : NPrice(c, openPrice - InpBreakEvenLock * c.point);
         bool improves = (ptype == POSITION_TYPE_BUY)
                         ? (curSL < bePrice - c.point * 0.5)
                         : (curSL > bePrice + c.point * 0.5 || curSL == 0.0);
         if(improves && StopDistanceValid(c, ptype, bePrice, curPrice))
            ModifyStop(c, ticket, bePrice, curTP);
        }

      //--- 4) Profit-lock ladder.
      if(InpUseProfitLock && profitPts >= InpProfitLockStep)
        {
         int steps = (int)MathFloor(profitPts / InpProfitLockStep);
         double lockPts = steps * InpProfitLockStep * InpProfitLockKeep;
         double lockPrice = (ptype == POSITION_TYPE_BUY)
                            ? NPrice(c, openPrice + lockPts * c.point)
                            : NPrice(c, openPrice - lockPts * c.point);
         bool improves = (ptype == POSITION_TYPE_BUY)
                         ? (lockPrice > curSL + c.point * 0.5)
                         : (lockPrice < curSL - c.point * 0.5 || curSL == 0.0);
         if(improves && StopDistanceValid(c, ptype, lockPrice, curPrice))
            ModifyStop(c, ticket, lockPrice, curTP);
        }

      //--- 5) Tick-based trailing stop.
      if(InpUseTrailing && profitPts >= InpTrailStartPoints)
        {
         double trailPrice = (ptype == POSITION_TYPE_BUY)
                             ? NPrice(c, curPrice - InpTrailStepPoints * c.point)
                             : NPrice(c, curPrice + InpTrailStepPoints * c.point);
         bool improves = (ptype == POSITION_TYPE_BUY)
                         ? (trailPrice > curSL + c.point * 0.5)
                         : (trailPrice < curSL - c.point * 0.5 || curSL == 0.0);
         if(improves && StopDistanceValid(c, ptype, trailPrice, curPrice))
            ModifyStop(c, ticket, trailPrice, curTP);
        }

      //--- 6) Momentum-reversal protective exit.
      //       If strong opposite momentum develops, bail early.
      bool reverseLong  = (ptype == POSITION_TYPE_SELL) && (c.probLong  >= InpEntryThreshold) && (profitPts > 0.0);
      bool reverseShort = (ptype == POSITION_TYPE_BUY)  && (c.probShort >= InpEntryThreshold) && (profitPts > 0.0);
      if(reverseLong || reverseShort)
        {
         ClosePositionReverse(c, ticket, profitPts);
        }
     }
  }

//+------------------------------------------------------------------+
//| Validate a prospective stop level against broker stop distance.  |
//+------------------------------------------------------------------+
bool StopDistanceValid(SymbolContext &c, ENUM_POSITION_TYPE ptype, double stopPrice, double curPrice)
  {
   double minDist = (double)c.stopLevel * c.point;
   if(minDist <= 0.0)
      minDist = c.point; // at least 1 point
   double dist = MathAbs(curPrice - stopPrice);
   return(dist >= minDist);
  }

//+------------------------------------------------------------------+
//| Modify a position's stop / take levels.                          |
//+------------------------------------------------------------------+
bool ModifyStop(SymbolContext &c, ulong ticket, double sl, double tp)
  {
   bool ok = trade.PositionModify(ticket, sl, tp);
   if(!ok)
      LogMsg(StringFormat("MODIFY FAILED %s ticket=%I64u rc=%d",
                          c.symbol, ticket, trade.ResultRetcode()));
   return(ok);
  }

//+------------------------------------------------------------------+
//| Close an entire position with retry handling.                    |
//+------------------------------------------------------------------+
bool ClosePosition(SymbolContext &c, ulong ticket, const string why)
  {
   bool ok = false;
   for(int attempt = 0; attempt < InpMaxRetries && !ok; attempt++)
     {
      ok = trade.PositionClose(ticket, (ulong)InpSlippagePoints);
      if(ok)
         break;
      uint rc = trade.ResultRetcode();
      if(rc == TRADE_RETCODE_REQUOTE || rc == TRADE_RETCODE_PRICE_OFF ||
         rc == TRADE_RETCODE_PRICE_CHANGED || rc == TRADE_RETCODE_CONNECTION ||
         rc == TRADE_RETCODE_TIMEOUT)
         Sleep(InpRetryDelayMs);
      else
         break;
     }
   if(ok)
      LogMsg(StringFormat("CLOSE %s ticket=%I64u (%s)", c.symbol, ticket, why));
   else
      LogMsg(StringFormat("CLOSE FAILED %s ticket=%I64u rc=%d", c.symbol, ticket, trade.ResultRetcode()));
   return(ok);
  }

//+------------------------------------------------------------------+
//| Close a position because momentum reversed against it while it   |
//| is still in profit (protective early exit).                      |
//+------------------------------------------------------------------+
void ClosePositionReverse(SymbolContext &c, ulong ticket, double profitPts)
  {
   if(ClosePosition(c, ticket, "reverse-exit"))
      OnTradeClosedProfit(c, profitPts > 0.0);
  }

//+==================================================================+
//|                     BASKET MANAGEMENT                            |
//+==================================================================+

//+------------------------------------------------------------------+
//| Close all EA positions when aggregate profit/loss crosses a band |
//+------------------------------------------------------------------+
void ManageBasket(SymbolContext &c)
  {
   double basket = EAOpenProfit();

   bool hitProfit = (InpBasketProfit > 0.0 && basket >= InpBasketProfit);
   bool hitLoss   = (InpBasketLoss   > 0.0 && basket <= -InpBasketLoss);

   if(hitProfit || hitLoss)
     {
      CloseAllEAPositions(hitProfit ? "basket-profit" : "basket-loss");
      if(hitProfit)
        {
         AdvanceLadder(c);   // good outcome -> scale up
        }
      else
        {
         ResetLadder(c);     // bad outcome -> scale down
        }
     }
  }

//+------------------------------------------------------------------+
//| Aggregate floating profit of this EA's positions.                |
//+------------------------------------------------------------------+
double EAOpenProfit()
  {
   double sum = 0.0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Magic() != InpMagicNumber) continue;
      sum += posInfo.Profit() + posInfo.Swap() + posInfo.Commission();
     }
   return(sum);
  }

//+------------------------------------------------------------------+
//| Close every position owned by this EA.                           |
//+------------------------------------------------------------------+
void CloseAllEAPositions(const string why)
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Magic() != InpMagicNumber) continue;
      string sym = posInfo.Symbol();
      int idx = FindContext(sym);
      if(idx >= 0)
         ClosePosition(g_ctx[idx], ticket, why);
      else
         trade.PositionClose(ticket, (ulong)InpSlippagePoints);
     }
  }

//+==================================================================+
//|                   COUNTERS / POSITION QUERIES                    |
//+==================================================================+
int CountEAPositions()
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Magic() == InpMagicNumber)
         n++;
     }
   return(n);
  }

int CountSymbolPositions(const string sym)
  {
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(!posInfo.SelectByTicket(ticket)) continue;
      if(posInfo.Magic() == InpMagicNumber && posInfo.Symbol() == sym)
         n++;
     }
   return(n);
  }

//+==================================================================+
//|                      LOT LADDER MANAGEMENT                       |
//+==================================================================+
void AdvanceLadder(SymbolContext &c)
  {
   if(c.ladderIndex < g_lotLadderSize - 1)
      c.ladderIndex++;
   c.ladderPeakEquity = MathMax(c.ladderPeakEquity, AccountInfoDouble(ACCOUNT_EQUITY));
   LogMsg(StringFormat("Ladder advanced -> idx=%d lot=%.2f", c.ladderIndex, g_lotLadder[c.ladderIndex]));
  }

void ResetLadder(SymbolContext &c)
  {
   c.ladderIndex = 0;
   c.ladderPeakEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   LogMsg("Ladder reset -> base lot");
  }

//+------------------------------------------------------------------+
//| Called after a position closes; advances/resets ladder and       |
//| updates win/loss counters using realized outcome direction.      |
//+------------------------------------------------------------------+
void OnTradeClosedProfit(SymbolContext &c, bool won)
  {
   if(won)
     {
      g_wins++;
      AdvanceLadder(c);
     }
   else
     {
      g_losses++;
     }

   // Ladder drawdown reset: if equity fell from its tracked peak by the
   // configured amount, snap the ladder back to the base lot.
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(c.ladderPeakEquity - equity >= InpLadderResetDD && InpLadderResetDD > 0.0)
      ResetLadder(c);
  }

//+==================================================================+
//|              PARTIAL-EXIT BOOKKEEPING (per ticket)               |
//+==================================================================+
ulong g_partialTickets[];

bool PartialDone(ulong ticket)
  {
   for(int i = 0; i < ArraySize(g_partialTickets); i++)
      if(g_partialTickets[i] == ticket)
         return(true);
   return(false);
  }

void MarkPartialDone(ulong ticket)
  {
   int n = ArraySize(g_partialTickets);
   ArrayResize(g_partialTickets, n + 1);
   g_partialTickets[n] = ticket;
   // Keep the list bounded.
   if(n + 1 > 200)
     {
      for(int i = 0; i < n; i++)
         g_partialTickets[i] = g_partialTickets[i + 1];
      ArrayResize(g_partialTickets, n);
     }
  }

//+==================================================================+
//|                 DAILY ACCOUNTING & PROTECTION                    |
//+==================================================================+
void ResetDailyAnchors()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   g_dayStart        = StructToTime(dt);
   g_dayStartBalance = AccountInfoDouble(ACCOUNT_BALANCE);
   g_dayStartEquity  = AccountInfoDouble(ACCOUNT_EQUITY);
   g_tradesToday     = 0;
   g_wins            = 0;
   g_losses          = 0;
   g_tradingHalted   = false;
   g_haltReason      = "";
   LogAlways("Daily anchors reset. StartBalance=" + DoubleToString(g_dayStartBalance, 2));
  }

void CheckDayRollover()
  {
   MqlDateTime dt;
   TimeToStruct(TimeCurrent(), dt);
   dt.hour = 0; dt.min = 0; dt.sec = 0;
   datetime today = StructToTime(dt);
   if(today != g_dayStart)
      ResetDailyAnchors();
  }

//+------------------------------------------------------------------+
//| Daily P/L = realized (balance delta) + floating equity delta.    |
//+------------------------------------------------------------------+
double DailyPL()
  {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   double realized = balance - g_dayStartBalance;
   double floating = equity - balance;
   return(realized + floating);
  }

//+------------------------------------------------------------------+
//| Equity / daily-loss protection. Halts trading & flattens if hit. |
//+------------------------------------------------------------------+
void CheckProtection()
  {
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   if(equity > g_peakEquity)
      g_peakEquity = equity;

   double dailyPL = DailyPL();

   // Daily loss limit.
   if(InpDailyLossLimit > 0.0 && dailyPL <= -InpDailyLossLimit)
     {
      HaltTrading("Daily loss limit reached (" + DoubleToString(dailyPL, 2) + ")");
      return;
     }

   // Daily profit target.
   if(InpDailyProfitTarget > 0.0 && dailyPL >= InpDailyProfitTarget)
     {
      HaltTrading("Daily profit target reached (" + DoubleToString(dailyPL, 2) + ")");
      return;
     }

   // Equity drawdown protection (from session peak).
   if(InpEquityStopPercent > 0.0 && g_peakEquity > 0.0)
     {
      double ddPct = (g_peakEquity - equity) / g_peakEquity * 100.0;
      if(ddPct >= InpEquityStopPercent)
        {
         HaltTrading("Equity drawdown protection (" + DoubleToString(ddPct, 1) + "%)");
         return;
        }
     }

   // Absolute equity floor.
   if(InpMinEquity > 0.0 && equity <= InpMinEquity)
     {
      HaltTrading("Equity floor breached (" + DoubleToString(equity, 2) + ")");
      return;
     }
  }

//+------------------------------------------------------------------+
//| Halt trading: flatten everything and block new entries.          |
//+------------------------------------------------------------------+
void HaltTrading(const string reason)
  {
   if(g_tradingHalted)
      return;
   g_tradingHalted = true;
   g_haltReason    = reason;
   LogAlways("TRADING HALTED: " + reason);
   CloseAllEAPositions("protection-halt");
  }

//+==================================================================+
//|              WIN-RATE FROM TRADE HISTORY (today)                 |
//+==================================================================+
void RebuildStatsFromHistory()
  {
   if(!HistorySelect(g_dayStart, TimeCurrent() + 60))
      return;

   int wins = 0, losses = 0, trades = 0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0) continue;
      if((long)HistoryDealGetInteger(ticket, DEAL_MAGIC) != InpMagicNumber) continue;
      if((ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;

      double pl = HistoryDealGetDouble(ticket, DEAL_PROFIT) +
                  HistoryDealGetDouble(ticket, DEAL_SWAP) +
                  HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      trades++;
      if(pl >= 0.0) wins++; else losses++;
     }
   g_wins   = wins;
   g_losses = losses;
  }

//+==================================================================+
//|                          DASHBOARD                               |
//+==================================================================+
string DashName(const string id) { return(g_dashPrefix + id); }

void CreateDashboard()
  {
   // Background panel.
   string bg = DashName("BG");
   if(ObjectFind(0, bg) < 0)
     {
      ObjectCreate(0, bg, OBJ_RECTANGLE_LABEL, 0, 0, 0);
      ObjectSetInteger(0, bg, OBJPROP_XDISTANCE, InpDashX - 6);
      ObjectSetInteger(0, bg, OBJPROP_YDISTANCE, InpDashY - 6);
      ObjectSetInteger(0, bg, OBJPROP_XSIZE, 270);
      ObjectSetInteger(0, bg, OBJPROP_YSIZE, 340);
      ObjectSetInteger(0, bg, OBJPROP_BGCOLOR, InpDashPanelColor);
      ObjectSetInteger(0, bg, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, bg, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, bg, OBJPROP_COLOR, C'40,48,60');
      ObjectSetInteger(0, bg, OBJPROP_BACK, false);
      ObjectSetInteger(0, bg, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, bg, OBJPROP_HIDDEN, true);
     }

   // Title + rows.
   CreateLabel("TITLE", InpDashX, InpDashY, "TICK SCALPER EA", InpDashTitleColor, InpDashFontSize + 2);
   string rows[] = {"R_STATUS","R_REGIME","R_BIAS","R_MOM","R_VOL","R_LOT",
                    "R_OPL","R_DPL","R_TRADES","R_WR","R_SPREAD","R_PROB"};
   int y = InpDashY + 24;
   for(int i = 0; i < ArraySize(rows); i++)
     {
      CreateLabel(rows[i], InpDashX, y, "", InpDashTextColor, InpDashFontSize);
      y += 24;
     }
  }

void CreateLabel(const string id, int x, int y, const string text, color clr, int fontSize)
  {
   string nm = DashName(id);
   if(ObjectFind(0, nm) < 0)
      ObjectCreate(0, nm, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, nm, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, nm, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, nm, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, clr);
   ObjectSetInteger(0, nm, OBJPROP_FONTSIZE, fontSize);
   ObjectSetString(0, nm, OBJPROP_FONT, "Consolas");
   ObjectSetString(0, nm, OBJPROP_TEXT, text);
   ObjectSetInteger(0, nm, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, nm, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, nm, OBJPROP_BACK, false);
  }

void SetRow(const string id, const string text, color clr)
  {
   string nm = DashName(id);
   ObjectSetString(0, nm, OBJPROP_TEXT, text);
   ObjectSetInteger(0, nm, OBJPROP_COLOR, clr);
  }

void UpdateDashboard(SymbolContext &c)
  {
   string regimeStr;
   color  regimeClr = InpDashTextColor;
   switch(c.regime)
     {
      case REGIME_TRENDING_UP:   regimeStr = "Trending Up";   regimeClr = InpDashBullColor; break;
      case REGIME_TRENDING_DOWN: regimeStr = "Trending Down"; regimeClr = InpDashBearColor; break;
      case REGIME_RANGING:       regimeStr = "Ranging";       regimeClr = clrSilver;        break;
      case REGIME_VOLATILE:      regimeStr = "Volatile";      regimeClr = clrOrange;        break;
      default:                   regimeStr = "Quiet";         regimeClr = clrGray;          break;
     }

   string biasStr;
   color  biasClr;
   switch(c.bias)
     {
      case BIAS_BULLISH: biasStr = "BULLISH"; biasClr = InpDashBullColor; break;
      case BIAS_BEARISH: biasStr = "BEARISH"; biasClr = InpDashBearColor; break;
      default:           biasStr = "NEUTRAL"; biasClr = clrSilver;        break;
     }

   // Momentum strength bar (text based).
   double momRef = MathMax(0.5, c.momStd);
   double momN   = c.momentum / momRef;
   string momBar = BuildBar(momN, 5.0);
   color  momClr = (c.momentum >= 0) ? InpDashBullColor : InpDashBearColor;

   // Volatility strength relative to baseline.
   double volRatio = (c.volBaseline > 0.0) ? c.volatility / c.volBaseline : 1.0;
   string volBar = BuildBar(volRatio - 1.0, 2.0);
   color  volClr = (volRatio >= InpVolSpikeFactor) ? clrOrange : clrSilver;

   double openPL  = EAOpenProfit();
   double dailyPL = DailyPL();
   double spreadPts = SymbolInfoInteger(c.symbol, SYMBOL_SPREAD);

   int totalClosed = g_wins + g_losses;
   double winRate = (totalClosed > 0) ? (100.0 * g_wins / totalClosed) : 0.0;

   double activeLot = (InpLotMode == LOT_LADDER)
                      ? g_lotLadder[MathMin(c.ladderIndex, g_lotLadderSize - 1)]
                      : InpBaseLot;

   MqlTick statusTick = GetLastTick(c);
   string statusStr = g_tradingHalted ? ("HALTED: " + g_haltReason)
                      : (TradingAllowed(c, statusTick) ? "ACTIVE" : ("WAIT:" + c.lastSignal));
   color  statusClr = g_tradingHalted ? InpDashBearColor : InpDashBullColor;

   SetRow("R_STATUS", "Status : " + statusStr, statusClr);
   SetRow("R_REGIME", "Regime : " + regimeStr, regimeClr);
   SetRow("R_BIAS",   "Bias   : " + biasStr,   biasClr);
   SetRow("R_MOM",    "Momentum: " + DoubleToString(c.momentum, 1) + " " + momBar, momClr);
   SetRow("R_VOL",    "Volatility: " + DoubleToString(volRatio, 2) + "x " + volBar, volClr);
   SetRow("R_LOT",    "Active Lot: " + DoubleToString(activeLot, 2) +
                      "  (idx " + IntegerToString(c.ladderIndex) + ")", InpDashTextColor);
   SetRow("R_OPL",    "Open P/L : " + DoubleToString(openPL, 2), (openPL >= 0 ? InpDashBullColor : InpDashBearColor));
   SetRow("R_DPL",    "Daily P/L: " + DoubleToString(dailyPL, 2), (dailyPL >= 0 ? InpDashBullColor : InpDashBearColor));
   SetRow("R_TRADES", "Trades   : " + IntegerToString(g_tradesToday) +
                      "  Open: " + IntegerToString(CountEAPositions()), InpDashTextColor);
   SetRow("R_WR",     "Win Rate : " + DoubleToString(winRate, 1) + "%  (" +
                      IntegerToString(g_wins) + "/" + IntegerToString(totalClosed) + ")", InpDashTextColor);
   SetRow("R_SPREAD", "Spread   : " + DoubleToString(spreadPts, 0) + " pts", InpDashTextColor);
   SetRow("R_PROB",   "Prob L/S : " + DoubleToString(c.probLong, 2) + " / " +
                      DoubleToString(c.probShort, 2) + "  [" + c.lastSignal + "]", InpDashTitleColor);

   ChartRedraw(0);
  }

//+------------------------------------------------------------------+
//| Build a small ASCII strength bar from a normalized value.        |
//+------------------------------------------------------------------+
string BuildBar(double value, double scale)
  {
   int filled = (int)MathRound(MathAbs(value) / scale * 8.0);
   filled = MathMax(0, MathMin(8, filled));
   string bar = "";
   for(int i = 0; i < filled; i++)
      bar += "|";
   for(int i = filled; i < 8; i++)
      bar += ".";
   return((value >= 0 ? "+[" : "-[") + bar + "]");
  }

//+------------------------------------------------------------------+
//| Fetch the latest tick for dashboard status evaluation.           |
//+------------------------------------------------------------------+
MqlTick GetLastTick(SymbolContext &c)
  {
   MqlTick t;
   if(!SymbolInfoTick(c.symbol, t))
     {
      t.bid = 0; t.ask = 0;
     }
   return(t);
  }

void DestroyDashboard()
  {
   ObjectsDeleteAll(0, g_dashPrefix);
   ChartRedraw(0);
  }
//+------------------------------------------------------------------+
