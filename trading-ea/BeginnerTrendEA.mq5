//+------------------------------------------------------------------+
//|                                              BeginnerTrendEA.mq5  |
//|                              A beginner-friendly Expert Advisor   |
//|                                                                  |
//|  Strategy : Trend-following moving-average crossover, confirmed   |
//|             by an RSI momentum filter. One trade at a time.       |
//|  Risk     : Every trade carries a stop-loss. Position size starts |
//|             at the broker minimum (0.01) and scales up with the   |
//|             account using a fixed risk-% per trade.               |
//|                                                                  |
//|  >>> EDUCATIONAL TOOL. NOT FINANCIAL ADVICE. <<<                  |
//|  No EA can guarantee profit. Test on a DEMO account for weeks     |
//|  before risking real money, and never risk money you cannot       |
//|  afford to lose.                                                  |
//+------------------------------------------------------------------+
#property copyright "Beginner Trading EA"
#property link      "https://github.com/noobie1230957"
#property version   "1.00"
#property description "Beginner trend-following EA: MA crossover + RSI filter."
#property description "0.01 base lot that scales with the account by risk %."
#property description "Stop-loss on every trade. Demo-test first. Not financial advice."
#property strict

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>

//==================================================================
//  INPUTS  (these are the knobs you change in the EA settings)
//==================================================================

//--- Money management ---------------------------------------------
input group "=== Money Management ==="
input double InpBaseLot       = 0.01;   // Base / minimum lot (the floor)
input bool   InpUseRiskSizing = true;   // Scale lot with account by risk %
input double InpRiskPercent   = 1.0;    // Risk per trade (% of balance)
input double InpMaxLot        = 1.00;   // Hard cap on lot size (safety)

//--- Strategy: trend + momentum -----------------------------------
input group "=== Strategy ==="
input int            InpFastMA   = 20;          // Fast moving-average period
input int            InpSlowMA   = 50;          // Slow moving-average period
input ENUM_MA_METHOD InpMAMethod = MODE_EMA;    // Moving-average method
input int            InpRSIPeriod= 14;          // RSI period
input int            InpRSIUpper = 70;          // RSI overbought (don't chase buys above)
input int            InpRSILower = 30;          // RSI oversold (don't chase sells below)
input bool           InpTradeBuy = true;        // Allow long (buy) trades
input bool           InpTradeSell= true;        // Allow short (sell) trades

//--- Risk controls (stops) ----------------------------------------
input group "=== Stops & Targets ==="
input bool   InpUseATRStops   = true;   // Use ATR-based stops (recommended)
input int    InpATRPeriod     = 14;     // ATR period
input double InpATR_SL_Mult   = 2.0;    // Stop-loss   = this x ATR
input double InpATR_TP_Mult   = 3.0;    // Take-profit = this x ATR
input int    InpStopLossPips  = 30;     // Fixed stop-loss (pips) if ATR off
input int    InpTakeProfitPips= 60;     // Fixed take-profit (pips) if ATR off

//--- Trade management ---------------------------------------------
input group "=== Trade Management ==="
input bool   InpUseTrailing   = true;   // Trail the stop once in profit
input int    InpTrailStartPips = 20;    // Start trailing after this much profit (pips)
input int    InpTrailStepPips  = 10;    // Keep stop this far behind price (pips)
input int    InpMaxSpreadPips  = 3;     // Skip new trade if spread wider than this
input int    InpMaxPositions   = 1;     // Max open trades for this EA at once

//--- Session / housekeeping ---------------------------------------
input group "=== Session & Misc ==="
input bool   InpUseTimeFilter = false;  // Only trade between the hours below
input int    InpStartHour     = 7;      // Trading start hour (server time)
input int    InpEndHour       = 20;     // Trading end hour (server time)
input long   InpMagicNumber   = 990101; // Unique ID so this EA only manages its own trades
input int    InpSlippagePoints= 10;     // Max allowed slippage (points)

//==================================================================
//  GLOBALS
//==================================================================
CTrade        trade;
CPositionInfo posInfo;

int      hFastMA = INVALID_HANDLE;
int      hSlowMA = INVALID_HANDLE;
int      hRSI    = INVALID_HANDLE;
int      hATR    = INVALID_HANDLE;

double   g_pip       = 0.0;   // size of one "pip" in price terms
datetime g_lastBar   = 0;     // time of last processed bar

//==================================================================
//  HELPERS
//==================================================================

//--- One pip in price terms (handles 3/5-digit brokers) -----------
double PipSize()
{
   if(_Digits == 3 || _Digits == 5)
      return 10 * _Point;
   return _Point;
}

//--- Detect the open of a fresh bar -------------------------------
bool IsNewBar()
{
   datetime t = iTime(_Symbol, _Period, 0);
   if(t != g_lastBar)
   {
      g_lastBar = t;
      return true;
   }
   return false;
}

//--- Round a raw lot to the broker's volume rules -----------------
double NormalizeLot(double lot)
{
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step   = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0.0) step = 0.01;

   lot = MathFloor(lot / step) * step;          // snap down to a valid step
   if(lot < minLot) lot = minLot;
   if(lot > maxLot) lot = maxLot;

   // Round to the precision implied by the volume step
   int digits = (int)MathRound(-MathLog10(step));
   if(digits < 0) digits = 0;
   return NormalizeDouble(lot, digits);
}

//--- Position size: risk % of balance, with a 0.01 floor ----------
double CalcLot(double slDistancePrice)
{
   double floorLot = NormalizeLot(InpBaseLot);

   // If risk sizing is off, or we have no stop distance, use the floor.
   if(!InpUseRiskSizing || slDistancePrice <= 0.0)
      return floorLot;

   double balance   = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskMoney = balance * InpRiskPercent / 100.0;

   double tickValue = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   if(tickValue <= 0.0 || tickSize <= 0.0)
      return floorLot;

   // Money lost on ONE lot if the stop is hit:
   double lossPerLot = (slDistancePrice / tickSize) * tickValue;
   if(lossPerLot <= 0.0)
      return floorLot;

   double lots = riskMoney / lossPerLot;
   lots = NormalizeLot(lots);

   if(lots < floorLot)    lots = floorLot;        // never go below the base lot
   if(lots > InpMaxLot)   lots = NormalizeLot(InpMaxLot);  // never exceed the cap
   return lots;
}

//--- Count this EA's open positions on this symbol ----------------
int CountMyPositions()
{
   int n = 0;
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(posInfo.SelectByIndex(i))
      {
         if(posInfo.Symbol() == _Symbol && posInfo.Magic() == InpMagicNumber)
            n++;
      }
   }
   return n;
}

//--- Are we allowed to trade right now? ---------------------------
bool TradingAllowed()
{
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED)) return false;
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))           return false;
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))   return false;
   if((ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_MODE)
        == SYMBOL_TRADE_MODE_DISABLED) return false;

   if(InpUseTimeFilter)
   {
      MqlDateTime now;
      TimeToStruct(TimeCurrent(), now);
      if(now.hour < InpStartHour || now.hour >= InpEndHour)
         return false;
   }
   return true;
}

//--- Current spread in pips ---------------------------------------
double SpreadPips()
{
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(g_pip <= 0) return 0;
   return (ask - bid) / g_pip;
}

//==================================================================
//  INIT / DEINIT
//==================================================================
int OnInit()
{
   g_pip = PipSize();

   hFastMA = iMA(_Symbol, _Period, InpFastMA, 0, InpMAMethod, PRICE_CLOSE);
   hSlowMA = iMA(_Symbol, _Period, InpSlowMA, 0, InpMAMethod, PRICE_CLOSE);
   hRSI    = iRSI(_Symbol, _Period, InpRSIPeriod, PRICE_CLOSE);
   hATR    = iATR(_Symbol, _Period, InpATRPeriod);

   if(hFastMA == INVALID_HANDLE || hSlowMA == INVALID_HANDLE ||
      hRSI    == INVALID_HANDLE || hATR    == INVALID_HANDLE)
   {
      Print("ERROR: could not create one or more indicator handles.");
      return INIT_FAILED;
   }

   if(InpFastMA >= InpSlowMA)
      Print("WARNING: Fast MA period should be smaller than Slow MA period.");

   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpSlippagePoints);
   trade.SetTypeFillingBySymbol(_Symbol);

   Print("BeginnerTrendEA started on ", _Symbol, " ", EnumToString(_Period),
         ".  Base lot=", InpBaseLot, "  Risk%=", InpRiskPercent,
         "  (DEMO-test before going live!)");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(hFastMA != INVALID_HANDLE) IndicatorRelease(hFastMA);
   if(hSlowMA != INVALID_HANDLE) IndicatorRelease(hSlowMA);
   if(hRSI    != INVALID_HANDLE) IndicatorRelease(hRSI);
   if(hATR    != INVALID_HANDLE) IndicatorRelease(hATR);
}

//==================================================================
//  MAIN LOOP
//==================================================================
void OnTick()
{
   // Manage open trades on every tick (trailing stop reacts fast).
   if(InpUseTrailing)
      ManageTrailing();

   // Decisions to OPEN trades are made once per new bar — this keeps
   // the EA calm and avoids over-trading on every price flicker.
   if(!IsNewBar())
      return;

   if(!TradingAllowed())
      return;

   if(CountMyPositions() >= InpMaxPositions)
      return;

   if(SpreadPips() > InpMaxSpreadPips)
   {
      Print("Spread too wide (", DoubleToString(SpreadPips(), 1),
            " pips). Skipping this bar.");
      return;
   }

   CheckForEntry();
}

//==================================================================
//  ENTRY LOGIC
//==================================================================
void CheckForEntry()
{
   // Read indicator values from the last two CLOSED bars (index 1 = last
   // closed bar, index 2 = the one before it). Using closed bars makes
   // the crossover signal reliable instead of flickering intrabar.
   double fast[2], slow[2], rsiBuf[1], atrBuf[1];

   ArraySetAsSeries(fast,   true);
   ArraySetAsSeries(slow,   true);
   ArraySetAsSeries(rsiBuf, true);
   ArraySetAsSeries(atrBuf, true);

   if(CopyBuffer(hFastMA, 0, 1, 2, fast)   < 2) return;
   if(CopyBuffer(hSlowMA, 0, 1, 2, slow)   < 2) return;
   if(CopyBuffer(hRSI,    0, 1, 1, rsiBuf) < 1) return;
   if(CopyBuffer(hATR,    0, 1, 1, atrBuf) < 1) return;

   double fastNow = fast[0],  fastPrev = fast[1];   // [0]=bar1, [1]=bar2
   double slowNow = slow[0],  slowPrev = slow[1];
   double rsi     = rsiBuf[0];
   double atr     = atrBuf[0];

   bool crossUp   = (fastPrev <= slowPrev) && (fastNow > slowNow);
   bool crossDown = (fastPrev >= slowPrev) && (fastNow < slowNow);

   // BUY: trend turns up, momentum confirms (RSI above midline) but the
   //      market is not already overbought.
   if(InpTradeBuy && crossUp && rsi > 50.0 && rsi < InpRSIUpper)
   {
      OpenTrade(ORDER_TYPE_BUY, atr);
      return;
   }

   // SELL: trend turns down, momentum confirms (RSI below midline) but the
   //       market is not already oversold.
   if(InpTradeSell && crossDown && rsi < 50.0 && rsi > InpRSILower)
   {
      OpenTrade(ORDER_TYPE_SELL, atr);
      return;
   }
}

//--- Work out stop distance in price terms ------------------------
double StopDistance(double atr)
{
   if(InpUseATRStops && atr > 0)
      return atr * InpATR_SL_Mult;
   return InpStopLossPips * g_pip;
}

double TargetDistance(double atr)
{
   if(InpUseATRStops && atr > 0)
      return atr * InpATR_TP_Mult;
   return InpTakeProfitPips * g_pip;
}

//--- Place the order with SL/TP and a risk-based lot --------------
void OpenTrade(ENUM_ORDER_TYPE type, double atr)
{
   double slDist = StopDistance(atr);
   double tpDist = TargetDistance(atr);

   // Respect the broker's minimum stop distance.
   double minStop = (double)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL) * _Point;
   if(slDist < minStop) slDist = minStop;
   if(tpDist < minStop) tpDist = minStop;

   double lot = CalcLot(slDist);

   double price, sl, tp;
   if(type == ORDER_TYPE_BUY)
   {
      price = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      sl    = NormalizeDouble(price - slDist, _Digits);
      tp    = NormalizeDouble(price + tpDist, _Digits);
   }
   else
   {
      price = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      sl    = NormalizeDouble(price + slDist, _Digits);
      tp    = NormalizeDouble(price - tpDist, _Digits);
   }

   bool ok;
   if(type == ORDER_TYPE_BUY)
      ok = trade.Buy(lot, _Symbol, price, sl, tp, "BeginnerTrendEA");
   else
      ok = trade.Sell(lot, _Symbol, price, sl, tp, "BeginnerTrendEA");

   if(ok)
      PrintFormat("%s %.2f lots @ %s  SL=%s TP=%s",
                  (type == ORDER_TYPE_BUY ? "BUY" : "SELL"),
                  lot, DoubleToString(price, _Digits),
                  DoubleToString(sl, _Digits), DoubleToString(tp, _Digits));
   else
      PrintFormat("Order failed: %d - %s", trade.ResultRetcode(),
                  trade.ResultRetcodeDescription());
}

//==================================================================
//  TRAILING STOP
//==================================================================
void ManageTrailing()
{
   double startDist = InpTrailStartPips * g_pip;
   double stepDist  = InpTrailStepPips  * g_pip;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      if(!posInfo.SelectByIndex(i)) continue;
      if(posInfo.Symbol() != _Symbol || posInfo.Magic() != InpMagicNumber) continue;

      double open    = posInfo.PriceOpen();
      double curSL   = posInfo.StopLoss();
      double curTP   = posInfo.TakeProfit();
      ulong  ticket  = posInfo.Ticket();

      if(posInfo.PositionType() == POSITION_TYPE_BUY)
      {
         double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
         if(bid - open > startDist)                       // enough profit?
         {
            double newSL = NormalizeDouble(bid - stepDist, _Digits);
            if(newSL > open && (curSL == 0 || newSL > curSL))
               trade.PositionModify(ticket, newSL, curTP);
         }
      }
      else // SELL
      {
         double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         if(open - ask > startDist)
         {
            double newSL = NormalizeDouble(ask + stepDist, _Digits);
            if(newSL < open && (curSL == 0 || newSL < curSL))
               trade.PositionModify(ticket, newSL, curTP);
         }
      }
   }
}
//+------------------------------------------------------------------+
