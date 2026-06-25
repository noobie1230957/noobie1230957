//+------------------------------------------------------------------+
//|                                            TUX_SD_Trend_EA.mq5    |
//|        Faithful MT5 port of "TUX-S&D+trend x EMA Cloud" Pine v6   |
//|                                                                  |
//|  This Expert Advisor reproduces the SIGNALS of the TradingView   |
//|  indicator and adds professional trade management. The strategy  |
//|  logic (AI Supertrend ML engine, S&D power zones, zone-TRUE       |
//|  validity, RSI gating, EMA-cloud filter, kinetic-line bounces)    |
//|  is converted directly from the Pine Script, calculation for     |
//|  calculation, on CLOSED bars only (no repaint).                  |
//|                                                                  |
//|  NOTE ON THE AI ENGINE:                                          |
//|  The AI Supertrend is fed by a stateful KNN + online-neural +    |
//|  Fisher-weighting engine. Every formula is ported exactly and    |
//|  the bars are processed strictly left-to-right (like Pine) so    |
//|  the trend/flip/bounce signals converge to the indicator's.      |
//|  A literal bar-for-bar identical output to TradingView is not    |
//|  achievable for any stateful ML indicator across platforms       |
//|  (finite history, float rounding, tick timing) -- this is the    |
//|  closest faithful reproduction, not a pixel clone.               |
//+------------------------------------------------------------------+
#property copyright "TUX EA"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>
#include <Trade/PositionInfo.mqh>
#include <Trade/SymbolInfo.mqh>

CTrade        trade;
CPositionInfo posinfo;
CSymbolInfo   syminfo;

//====================================================================
//  ENUMS
//====================================================================
enum ENUM_SL_MODE
  {
   SL_ATR        = 0,   // ATR Stop Loss
   SL_KINETIC    = 1,   // Kinetic (AI Supertrend) line as SL
   SL_SWING      = 2    // Swing High / Low
  };

enum ENUM_TP_MODE
  {
   TP_RR2        = 0,   // 1:2 Risk-Reward
   TP_RR3        = 1,   // 1:3 Risk-Reward
   TP_RR4        = 2,   // 1:4 Risk-Reward
   TP_SWING      = 3,   // Dynamic - previous swing high/low
   TP_TRAIL      = 4    // No fixed TP - trail until reversal signal
  };

enum ENUM_TRAIL_MODE
  {
   TRAIL_NONE    = 0,   // Off
   TRAIL_ATR     = 1,   // ATR Trailing
   TRAIL_KINETIC = 2,   // Kinetic Line Trailing (AI Supertrend)
   TRAIL_SWING   = 3,   // Swing High/Low Trailing
   TRAIL_FIXED   = 4    // Fixed Pip Trailing
  };

enum ENUM_RISK_MODE
  {
   RISK_FIXED_MONEY = 0, // Fixed $ risk per trade
   RISK_PERCENT     = 1, // % of balance risk per trade
   RISK_FIXED_LOT   = 2  // Fixed lot (with optional auto-scale)
  };

enum ENUM_CLOUD_FILTER
  {
   CLOUD_OFF      = 0,  // EMA cloud filter off
   CLOUD_SLOW     = 1,  // Price vs slow cloud (Pine trend gate)
   CLOUD_FASTSLOW = 2   // Fast EMA vs slow EMA
  };

//====================================================================
//  INPUTS  --  STRATEGY (mirrors Pine inputs that affect signals)
//====================================================================
input group "===== AI Supertrend / ML engine (from Pine) ====="
input int    InpMaLen          = 50;     // MA Length (aiMA, visual only)
input int    InpSrcSmoothLen   = 3;      // AI Source Smoothing
input int    InpMemoryDepth    = 40;     // Memory Depth
input int    InpKNeighbors     = 9;      // Analog Count (k)
input int    InpHorizonBars    = 4;      // Learning Horizon
input int    InpSpacingBars    = 4;      // Analog Spacing
input double InpLearnAtrFactor = 0.45;   // Learning Sensitivity x ATR
input bool   InpUseNeural      = true;   // Use Neural Online Training
input double InpNeuralInfluence= 0.35;   // Neural Influence
input double InpLearnRate      = 0.01;   // Learning Rate
input double InpHuberD         = 0.02;   // Huber Delta
input bool   InpUseFisher      = true;   // Auto Optimize Feature Weights
input double InpFisherSpeed    = 0.20;   // Fisher Adaptation Speed
input double InpFisherFloor    = 0.40;   // Fisher Weight Floor
input int    InpMinRows        = 80;     // Fisher Minimum Rows
input int    InpStLen          = 10;     // Supertrend ATR Length
input double InpStMult         = 1.7;    // Supertrend ATR Multiplier
input double InpStAdapt        = 0.80;   // AI Band Adaptivity

input group "===== EMA Cloud (filter) ====="
input int    InpEmaSlowLen     = 200;    // Slow EMA Length
input int    InpEmaFastLen     = 8;      // Fast EMA Length
input ENUM_CLOUD_FILTER InpCloudFilter = CLOUD_OFF; // EMA cloud filter (Pine: cloud does NOT gate alerts; opt-in)

input group "===== S&D Power Zones (from Pine) ====="
input int    InpZoneLength     = 130;    // Lookback Length
input bool   InpUsePivotZones  = true;   // Pivot Fixed Zones (false = Rolling)
input int    InpPivLeft        = 10;     // Pivot Left Bars
input int    InpPivRight       = 10;     // Pivot Right Bars

input group "===== Zone Validity (from Pine) ====="
input double InpRsiStretch     = 68.0;   // RSI Stretch Threshold
input int    InpChaseBars      = 3;      // Bars Re-rising = Chasing
input double InpRejWick        = 0.4;    // Rejection Wick (% of bar)
input bool   InpTruePredict    = true;   // Predictive TRUE
input bool   InpTrueConfirm    = true;   // TRUE only on bar close

input group "===== Entry RSI gates (per spec) ====="
input double InpRsiBuyLevel    = 49.0;   // LONG power: RSI must be <= this
input double InpRsiSellLevel   = 55.0;   // SHORT power: RSI must be >= this

input group "===== Which entries are enabled ====="
input bool   InpEnableLongPower  = true; // Long Power zone entries
input bool   InpEnableShortPower = true; // Short Power zone entries
input bool   InpEnableTrendFlip  = true; // AI Trend flip entries
input bool   InpEnableBounce     = true; // Kinetic line bounce entries

input group "===== HTF confluence (optional confirmation) ====="
input bool   InpUseHtfConfluence = false;// Require HTF confluence for zone entries
input string InpHtf1           = "60";   // HTF #1
input string InpHtf2           = "240";  // HTF #2
input int    InpHtfLookback    = 20;     // HTF Lookback
input double InpConfAtr        = 1.0;    // Confluence Range (ATR)

//====================================================================
//  INPUTS  --  RISK / LOTS
//====================================================================
input group "===== Risk & Lot Sizing ====="
input ENUM_RISK_MODE InpRiskMode = RISK_FIXED_MONEY; // Risk mode
input double InpRiskMoney      = 20.0;   // Risk per trade ($)
input double InpRiskPercent    = 1.0;    // Risk per trade (% balance)
input double InpFixedLot       = 0.01;   // Fixed lot (RISK_FIXED_LOT)
input bool   InpAutoLotScale   = true;   // Auto-scale lots as balance grows
input double InpScaleBaseBalance = 100.0;// Balance where scaling starts
input double InpScaleStep      = 100.0;  // Every +$ of balance...
input double InpScaleAddPct    = 0.10;   // ...add this fraction of base lot
input double InpMaxLot         = 50.0;   // Hard lot cap

input group "===== Stop Loss ====="
input ENUM_SL_MODE InpSlMode   = SL_ATR; // Stop loss mode
input double InpAtrSlMult      = 1.5;    // ATR SL multiplier
input int    InpSwingLookback  = 20;     // Swing lookback for SL/TP
input double InpSlBufferPts    = 0.0;    // Extra SL buffer (points)

input group "===== Take Profit ====="
input ENUM_TP_MODE InpTpMode   = TP_RR2; // Take profit mode

input group "===== Break Even ====="
input bool   InpUseBreakEven   = true;   // Enable break even
input double InpBeTriggerR     = 1.0;    // Move to BE at this many R
input double InpBeBufferPts    = 0.0;    // BE buffer (points beyond entry)

input group "===== Profit Lock (tiered, $) ====="
input bool   InpUseProfitLock  = true;   // Enable dynamic profit lock
input double InpLockT1Profit   = 20.0;   // +$ profit tier 1
input double InpLockT1Lock     = 5.0;    // ...lock $
input double InpLockT2Profit   = 40.0;   // +$ profit tier 2
input double InpLockT2Lock     = 15.0;   // ...lock $
input double InpLockT3Profit   = 60.0;   // +$ profit tier 3
input double InpLockT3Lock     = 30.0;   // ...lock $
input double InpLockT4Profit   = 100.0;  // +$ profit tier 4
input double InpLockT4Lock     = 60.0;   // ...lock $

input group "===== Trailing Stop ====="
input ENUM_TRAIL_MODE InpTrailMode = TRAIL_KINETIC; // Trailing mode
input double InpTrailAtrMult   = 2.0;    // ATR trailing multiplier
input double InpTrailFixedPts  = 0.0;    // Fixed pip trail (points)
input double InpTrailStartR    = 0.5;    // Start trailing after this many R

input group "===== Partial Take Profit ====="
input bool   InpUsePartials    = false;  // Enable partial closes
input double InpPartial1R      = 1.0;    // Close part at this R
input double InpPartial1Pct    = 50.0;   // % to close at tier 1
input double InpPartial2R      = 2.0;    // Close part at this R
input double InpPartial2Pct    = 25.0;   // % to close at tier 2

//====================================================================
//  INPUTS  --  FILTERS
//====================================================================
input group "===== Chop / Market-condition filter ====="
input bool   InpUseChopFilter  = true;   // Enable chop filter
input int    InpAdxPeriod      = 14;     // ADX period
input double InpAdxMin         = 20.0;   // Min ADX to trade
input int    InpAtrCompPeriod  = 50;     // ATR compression lookback
input double InpAtrCompRatio   = 0.85;   // Block if ATR < avgATR * ratio
input int    InpRangePeriod    = 20;     // Range detection lookback
input double InpRangeAtrMult   = 1.5;    // Min (range/ATR) to trade

input group "===== Other filters ====="
input double InpMaxSpreadPts   = 50.0;   // Max spread (points), 0=off
input double InpMinAtrPts      = 0.0;    // Min ATR (points), 0=off
input bool   InpUseSession     = false;  // Use trading session filter
input int    InpSessStartHour  = 7;      // Session start hour (server)
input int    InpSessEndHour    = 21;     // Session end hour (server)
input bool   InpUseNewsBlackout= false;  // Manual news blackout window
input int    InpNewsStartHour  = 13;     // Blackout start hour
input int    InpNewsStartMin   = 28;     // Blackout start minute
input int    InpNewsEndHour    = 13;     // Blackout end hour
input int    InpNewsEndMin     = 35;     // Blackout end minute

input group "===== Daily / Drawdown protection ====="
input double InpMaxDailyLoss   = 0.0;    // Max daily loss ($), 0=off
input int    InpMaxDailyTrades = 0;      // Max trades per day, 0=off
input double InpMaxDrawdownPct = 0.0;    // Max equity DD from peak (%), 0=off

input group "===== Execution ====="
input int    InpMaxBars        = 4000;   // History bars for ML warmup
input int    InpSlippagePts    = 30;     // Max slippage (points)
input long   InpMagic          = 990011; // Magic number
input bool   InpAllowReverse   = true;   // Reverse on opposite signal

//====================================================================
//  GLOBALS
//====================================================================
double  g_point;
double  g_tickSize;
double  g_tickValue;
int     g_digits;
datetime g_lastBarTime = 0;

// daily / dd tracking
datetime g_dayStart   = 0;
double   g_dayStartBal= 0;
int      g_dayTrades  = 0;
double   g_equityPeak = 0;

// --- signal results from the last completed pass (last closed bar) ---
bool   sigLongPower  = false;
bool   sigShortPower = false;
bool   sigFlipUp     = false;
bool   sigFlipDn     = false;
bool   sigBounceUp   = false;
bool   sigBounceDn   = false;
int    sigStDir      = 1;      // current AI trend direction
double sigStLine     = 0.0;    // current kinetic (AI supertrend) line
double sigRsi        = 50.0;
double sigAtr14      = 0.0;
double sigEmaHighSlow= 0.0;
double sigEmaLowSlow = 0.0;
double sigEma8       = 0.0;
double sigEma200     = 0.0;
bool   sigLoConf     = false;
bool   sigShConf     = false;
double sigSwingHigh  = 0.0;
double sigSwingLow   = 0.0;

// ML persistent banks (reset & rebuilt each pass -> deterministic)
// bankO/H/L/C limit = memoryDepth ; bankAll limit = memoryDepth*4
double bankO[][7], bankH[][7], bankL[][7], bankC[][7], bankAll[][7];
int    cntO, cntH, cntL, cntC, cntAll;

// chop / adx handle
int hADX = INVALID_HANDLE;

// partial-close state (single position per symbol assumption)
bool g_partial1Done = false;
bool g_partial2Done = false;

//+------------------------------------------------------------------+
//|  Small math helpers                                              |
//+------------------------------------------------------------------+
double clampd(double x,double lo,double hi){ return MathMax(lo,MathMin(x,hi)); }
double compressd(double d){ return MathLog(1.0+MathAbs(d)); }
double normScore(double x){ return 1.0/(1.0+MathExp(-clampd(x,-8,8))); }
double sgn(double x){ return (x>0)?1.0:((x<0)?-1.0:0.0); }

//+------------------------------------------------------------------+
//|  Series builders (chronological: index 0 = oldest)              |
//|  These mirror Pine ta.* recursions as closely as possible.       |
//+------------------------------------------------------------------+
void calcEMA(const double &src[], double &out[], int len, int n)
  {
   ArrayResize(out,n);
   double a = 2.0/(len+1.0);
   for(int i=0;i<n;i++)
      out[i] = (i==0) ? src[0] : a*src[i] + (1.0-a)*out[i-1];
  }

void calcSMA(const double &src[], double &out[], int len, int n)
  {
   ArrayResize(out,n);
   double sum=0;
   for(int i=0;i<n;i++)
     {
      sum += src[i];
      if(i>=len) sum -= src[i-len];
      int cnt = (i+1<len)?(i+1):len;
      out[i] = sum/cnt;
     }
  }

void calcRMA(const double &src[], double &out[], int len, int n)
  {
   ArrayResize(out,n);
   double a = 1.0/len;
   double seed=0;
   for(int i=0;i<n;i++)
     {
      if(i<len)
        {
         seed += src[i];
         out[i] = seed/(i+1);          // partial average until seeded
        }
      else
         out[i] = a*src[i] + (1.0-a)*out[i-1];
     }
  }

void calcStdev(const double &src[], double &out[], int len, int n)
  {
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      int start = (i+1<len)?0:(i-len+1);
      int cnt   = i-start+1;
      double mean=0;
      for(int j=start;j<=i;j++) mean+=src[j];
      mean/=cnt;
      double v=0;
      for(int j=start;j<=i;j++){ double d=src[j]-mean; v+=d*d; }
      out[i] = MathSqrt(v/cnt);          // population stdev (Pine default)
     }
  }

void calcHighest(const double &src[], double &out[], int len, int n)
  {
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      int start=(i+1<len)?0:(i-len+1);
      double h=src[start];
      for(int j=start+1;j<=i;j++) if(src[j]>h) h=src[j];
      out[i]=h;
     }
  }

void calcLowest(const double &src[], double &out[], int len, int n)
  {
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      int start=(i+1<len)?0:(i-len+1);
      double l=src[start];
      for(int j=start+1;j<=i;j++) if(src[j]<l) l=src[j];
      out[i]=l;
     }
  }

void calcATR(const double &h[],const double &l[],const double &c[],double &out[],int len,int n)
  {
   double tr[]; ArrayResize(tr,n);
   for(int i=0;i<n;i++)
     {
      if(i==0) tr[i]=h[i]-l[i];
      else
        {
         double a1=h[i]-l[i];
         double a2=MathAbs(h[i]-c[i-1]);
         double a3=MathAbs(l[i]-c[i-1]);
         tr[i]=MathMax(a1,MathMax(a2,a3));
        }
     }
   calcRMA(tr,out,len,n);
  }

void calcRSI(const double &c[], double &out[], int len, int n)
  {
   double up[],dn[]; ArrayResize(up,n); ArrayResize(dn,n);
   for(int i=0;i<n;i++)
     {
      double ch = (i==0)?0.0:(c[i]-c[i-1]);
      up[i]=MathMax(ch,0.0);
      dn[i]=MathMax(-ch,0.0);
     }
   double ru[],rd[];
   calcRMA(up,ru,len,n);
   calcRMA(dn,rd,len,n);
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      if(rd[i]==0.0) out[i]=100.0;
      else if(ru[i]==0.0) out[i]=0.0;
      else out[i]=100.0-100.0/(1.0+ru[i]/rd[i]);
     }
  }

// scale01 over rolling window (Pine: lowest/highest over len)
void calcScale01(const double &src[], double &out[], int len, int n)
  {
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      int start=(i+1<len)?0:(i-len+1);
      double lo=src[start],hi=src[start];
      for(int j=start+1;j<=i;j++){ if(src[j]<lo)lo=src[j]; if(src[j]>hi)hi=src[j]; }
      out[i] = (hi==lo)?0.5:clampd((src[i]-lo)/(hi-lo),0.0,1.0);
     }
  }

//+------------------------------------------------------------------+
//|  Feature builders (Pine featTrend/Mean/Momentum/Vol/Range/Slope) |
//+------------------------------------------------------------------+
// featTrend(src,atr) = clamp((ema(src,10)-ema(src,34))/atr,-3,3)/3
void buildFeatTrend(const double &src[],const double &atr[],double &out[],int n)
  {
   double e10[],e34[]; calcEMA(src,e10,10,n); calcEMA(src,e34,34,n);
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
      out[i] = (atr[i]==0.0)?0.0:clampd((e10[i]-e34[i])/atr[i],-3,3)/3.0;
  }
// featMean(src) = clamp(-((src-sma30)/stdev30),-3,3)/3
void buildFeatMean(const double &src[],double &out[],int n)
  {
   double sm[],sd[]; calcSMA(src,sm,30,n); calcStdev(src,sd,30,n);
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      double z = (sd[i]==0.0)?0.0:(src[i]-sm[i])/sd[i];
      out[i]=clampd(-z,-3,3)/3.0;
     }
  }
// featMomentum(src) = clamp((src/src[14]-1)/0.05,-3,3)/3
void buildFeatMomentum(const double &src[],double &out[],int n)
  {
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      if(i<14 || src[i-14]==0.0){ out[i]=0.0; continue; }
      double roc = src[i]/src[i-14]-1.0;
      out[i]=clampd(roc/0.05,-3,3)/3.0;
     }
  }
// featVol(src) = scale01(stdev(src,20),100)*2-1
void buildFeatVol(const double &src[],double &out[],int n)
  {
   double sd[],sc[]; calcStdev(src,sd,20,n); calcScale01(sd,sc,100,n);
   ArrayResize(out,n);
   for(int i=0;i<n;i++) out[i]=sc[i]*2.0-1.0;
  }
// featRange(src) = clamp(((src-low)/(high-low))*2-1,-1,1)  (bar high/low)
void buildFeatRange(const double &src[],const double &hi[],const double &lo[],double &out[],int n)
  {
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      double rng=hi[i]-lo[i];
      out[i]=(rng==0.0)?0.0:clampd(((src[i]-lo[i])/rng)*2.0-1.0,-1,1);
     }
  }
// featSlope(src,atr) = clamp((src-src[3])/atr,-3,3)/3
void buildFeatSlope(const double &src[],const double &atr[],double &out[],int n)
  {
   ArrayResize(out,n);
   for(int i=0;i<n;i++)
     {
      if(i<3 || atr[i]==0.0){ out[i]=0.0; continue; }
      out[i]=clampd((src[i]-src[i-3])/atr[i],-3,3)/3.0;
     }
  }

//+------------------------------------------------------------------+
//|  Bank operations (newest at index 0, like Pine add_row(0,..))    |
//+------------------------------------------------------------------+
void bankAdd(double &m[][7], int &cnt, int limit, const double &row[])
  {
   int newcnt = MathMin(cnt+1,limit);
   for(int i=newcnt-1;i>0;i--)
      for(int j=0;j<7;j++) m[i][j]=m[i-1][j];
   for(int j=0;j<7;j++) m[0][j]=row[j];
   cnt=newcnt;
  }

// gapTo with Fisher weights
double gapTo(double t,double m,double mo,double v,double r,double s,
             double &m2[][7],int idx,
             double wT,double wM,double wMo,double wV,double wR,double wS)
  {
   return wT*compressd(t-m2[idx][0]) + wM*compressd(m-m2[idx][1]) +
          wMo*compressd(mo-m2[idx][2]) + wV*compressd(v-m2[idx][3]) +
          wR*compressd(r-m2[idx][4]) + wS*compressd(s-m2[idx][5]);
  }

// knnScore -> outputs analog, agree, tight, k
void knnScore(double t,double m,double mo,double v,double r,double s,
              double &bank[][7],int cnt,int memoryDepth,int kNeighbors,int spacingBars,
              double wT,double wM,double wMo,double wV,double wR,double wS,
              double &outAnalog,double &outAgree,double &outTight,int &outK)
  {
   double gaps[];    ArrayResize(gaps,0);
   double classes[]; ArrayResize(classes,0);
   int n=cnt;
   int scanEnd = MathMin(n-1, memoryDepth-1);
   if(n>1)
     {
      for(int i=0;i<=scanEnd;i++)
        {
         if(i%spacingBars!=0) continue;
         double cls = bank[i][6];
         if(cls==0.0) continue;
         double g = gapTo(t,m,mo,v,r,s,bank,i,wT,wM,wMo,wV,wR,wS);
         int gsz=ArraySize(gaps);
         if(gsz<kNeighbors)
           {
            ArrayResize(gaps,gsz+1);    gaps[gsz]=g;
            ArrayResize(classes,gsz+1); classes[gsz]=cls;
           }
         else
           {
            int worst=0; double worstGap=gaps[0];
            for(int j=1;j<gsz;j++) if(gaps[j]>worstGap){ worstGap=gaps[j]; worst=j; }
            if(g<worstGap){ gaps[worst]=g; classes[worst]=cls; }
           }
        }
     }
   double total=0,score=0,bull=0,bear=0,gapSum=0;
   int k=ArraySize(gaps);
   for(int j=0;j<k;j++)
     {
      double g=gaps[j], cls=classes[j];
      double wg=1.0/(1.0+g);
      total+=wg; score+=cls*wg;
      if(cls>0) bull+=wg; if(cls<0) bear+=wg;
      gapSum+=g;
     }
   double analog = (total>0)?score/total:0.0;
   int dir = (analog>0.15)?1:((analog<-0.15)?-1:0);
   double agree = (total>0)?((dir==1?bull:(dir==-1?bear:0.0))/total):0.0;
   double avgGap = (k>0)?gapSum/k:0.0;
   double gapScale = (wT+wM+wMo+wV+wR+wS)*0.45 + 0.000001;
   double tight = clampd(1.0-avgGap/gapScale,0.0,1.0);
   outAnalog=analog; outAgree=agree; outTight=tight; outK=k;
  }

//+------------------------------------------------------------------+
//|  Fisher auto feature weights on bankAll                          |
//+------------------------------------------------------------------+
void autoFeatureWeights(double &m[][7],int cnt,int minN,double floorv,double &imp[])
  {
   ArrayResize(imp,6);
   for(int j=0;j<6;j++) imp[j]=1.0;
   int n=cnt;
   if(n<minN) return;
   double sumB[6],sumS[6],sqB[6],sqS[6];
   for(int j=0;j<6;j++){ sumB[j]=0;sumS[j]=0;sqB[j]=0;sqS[j]=0; }
   int cntB=0,cntS=0;
   for(int i=0;i<n;i++)
     {
      double cls=m[i][6];
      if(cls==0.0) continue;
      bool isBull = cls>0;
      for(int j=0;j<6;j++)
        {
         double val=m[i][j];
         if(isBull){ sumB[j]+=val; sqB[j]+=val*val; }
         else      { sumS[j]+=val; sqS[j]+=val*val; }
        }
      if(isBull) cntB++; else cntS++;
     }
   if(cntB>3 && cntS>3)
     {
      double maxF=0; double fish[6];
      for(int j=0;j<6;j++)
        {
         double meanB=sumB[j]/cntB, meanS=sumS[j]/cntS;
         double varB=MathMax(0.0,sqB[j]/cntB-meanB*meanB);
         double varS=MathMax(0.0,sqS[j]/cntS-meanS*meanS);
         double f=MathPow(meanB-meanS,2)/(varB+varS+0.000001);
         fish[j]=f; if(f>maxF) maxF=f;
        }
      for(int j=0;j<6;j++)
        {
         double norm=(maxF>0)?fish[j]/maxF:1.0;
         imp[j]=MathMax(floorv,norm*8.0);
        }
     }
  }

//+------------------------------------------------------------------+
//|  Pivot high/low arrays (Pine ta.pivothigh/low, left=right)       |
//+------------------------------------------------------------------+
void calcPivotHigh(const double &h[],double &out[],bool &has[],int left,int right,int n)
  {
   ArrayResize(out,n); ArrayResize(has,n);
   for(int i=0;i<n;i++){ out[i]=0; has[i]=false; }
   for(int i=0;i<n;i++)
     {
      int c=i-right;                       // candidate bar
      if(c-left<0 || i>=n) continue;
      bool isPiv=true;
      double cv=h[c];
      for(int j=c-left;j<=c+right;j++)
        {
         if(j==c) continue;
         if(h[j]>=cv){ isPiv=false; break; }
        }
      if(isPiv){ out[i]=cv; has[i]=true; }
     }
  }
void calcPivotLow(const double &l[],double &out[],bool &has[],int left,int right,int n)
  {
   ArrayResize(out,n); ArrayResize(has,n);
   for(int i=0;i<n;i++){ out[i]=0; has[i]=false; }
   for(int i=0;i<n;i++)
     {
      int c=i-right;
      if(c-left<0 || i>=n) continue;
      bool isPiv=true;
      double cv=l[c];
      for(int j=c-left;j<=c+right;j++)
        {
         if(j==c) continue;
         if(l[j]<=cv){ isPiv=false; break; }
        }
      if(isPiv){ out[i]=cv; has[i]=true; }
     }
  }

//+------------------------------------------------------------------+
//|  THE FULL PASS  -- recompute strategy state on closed bars       |
//|  Mirrors Pine left-to-right execution; outputs last-bar signals. |
//+------------------------------------------------------------------+
bool ComputePass()
  {
   int want = InpMaxBars + 400;        // extra for indicator warmup
   MqlRates rates[];
   int n = CopyRates(_Symbol,_Period,1,want,rates); // shift 1 => closed bars only
   if(n < 500) return false;           // not enough history yet
   ArraySetAsSeries(rates,false);      // chronological: 0=oldest

   double O[],H[],L[],C[];
   ArrayResize(O,n); ArrayResize(H,n); ArrayResize(L,n); ArrayResize(C,n);
   for(int i=0;i<n;i++){ O[i]=rates[i].open; H[i]=rates[i].high; L[i]=rates[i].low; C[i]=rates[i].close; }

   // ---- base series ----
   double atr14[],atr200[],atrST[],rsi14[];
   calcATR(H,L,C,atr14,14,n);
   calcATR(H,L,C,atr200,200,n);
   calcATR(H,L,C,atrST,InpStLen,n);
   calcRSI(C,rsi14,14,n);

   // EMA cloud
   double emaHiSlow[],emaLoSlow[],emaHiFast[],emaLoFast[],ema8c[],ema200c[];
   calcEMA(H,emaHiSlow,InpEmaSlowLen,n);
   calcEMA(L,emaLoSlow,InpEmaSlowLen,n);
   calcEMA(H,emaHiFast,InpEmaFastLen,n);
   calcEMA(L,emaLoFast,InpEmaFastLen,n);
   calcEMA(C,ema8c,InpEmaFastLen,n);
   calcEMA(C,ema200c,InpEmaSlowLen,n);

   // ---- features for each source ----
   double oT[],oM[],oMo[],oV[],oR[],oS[];
   double hT[],hM[],hMo[],hV[],hR[],hS[];
   double lT[],lM[],lMo[],lV[],lR[],lS[];
   double cT[],cM[],cMo[],cV[],cR[],cS[];
   buildFeatTrend(O,atr14,oT,n); buildFeatMean(O,oM,n); buildFeatMomentum(O,oMo,n);
   buildFeatVol(O,oV,n); buildFeatRange(O,H,L,oR,n); buildFeatSlope(O,atr14,oS,n);
   buildFeatTrend(H,atr14,hT,n); buildFeatMean(H,hM,n); buildFeatMomentum(H,hMo,n);
   buildFeatVol(H,hV,n); buildFeatRange(H,H,L,hR,n); buildFeatSlope(H,atr14,hS,n);
   buildFeatTrend(L,atr14,lT,n); buildFeatMean(L,lM,n); buildFeatMomentum(L,lMo,n);
   buildFeatVol(L,lV,n); buildFeatRange(L,H,L,lR,n); buildFeatSlope(L,atr14,lS,n);
   buildFeatTrend(C,atr14,cT,n); buildFeatMean(C,cM,n); buildFeatMomentum(C,cMo,n);
   buildFeatVol(C,cV,n); buildFeatRange(C,H,L,cR,n); buildFeatSlope(C,atr14,cS,n);

   // ---- zone base series ----
   double rollHigh[],rollLow[]; calcHighest(H,rollHigh,InpZoneLength,n); calcLowest(L,rollLow,InpZoneLength,n);
   double seedHi[],seedLo[];    calcHighest(H,seedHi,50,n);             calcLowest(L,seedLo,50,n);
   double pHigh[],pLow[]; bool pHhas[],pLhas[];
   calcPivotHigh(H,pHigh,pHhas,InpPivLeft,InpPivRight,n);
   calcPivotLow (L,pLow ,pLhas,InpPivLeft,InpPivRight,n);

   // ---- reset ML banks (deterministic rebuild) ----
   int limS=InpMemoryDepth, limA=InpMemoryDepth*4;
   ArrayResize(bankO,limS); ArrayResize(bankH,limS); ArrayResize(bankL,limS);
   ArrayResize(bankC,limS); ArrayResize(bankAll,limA);
   cntO=cntH=cntL=cntC=cntAll=0;

   // neural weights
   double nt=0.01,nm=0.01,nmo=0.01,nv=0.01,nr=0.01,ns=0.01,nb=0.0;
   double mt=0,mm=0,mmo=0,mv=0,mr=0,ms=0,mb=0;
   double vt=0,vm=0,vmo=0,vvw=0,vr=0,vs=0,vb=0;
   int    step=0;
   double beta1=0.9,beta2=0.999,eps=1e-8;

   // Fisher weights
   double wAuto[6]; for(int j=0;j<6;j++) wAuto[j]=1.0;

   // supertrend / zone sequential state
   double aiSource_prev=0; bool aiSrc_init=false;
   double stLong_prev=0,stShort_prev=0; bool stL_init=false,stS_init=false;
   int    stDir_prev=1; bool stDir_init=false;
   double piv_res=seedHi[(n>0?MathMin(49,n-1):0)]; // seeded below in loop start
   double piv_sup=seedLo[(n>0?MathMin(49,n-1):0)];
   bool   pivSeed=false;
   int    sh_rise=0, lo_fall=0;
   double zone_hi_prev=0, zone_lo_prev=0; bool zone_init=false;
   bool   sh_true_prev=false, lo_true_prev=false, sh_raw_prev=false, lo_raw_prev=false;

   // output arrays we need at the end
   double aArr_stLine[]; int aArr_stDir[]; bool aArr_loTrue[],aArr_shTrue[];
   ArrayResize(aArr_stLine,n); ArrayResize(aArr_stDir,n);
   ArrayResize(aArr_loTrue,n); ArrayResize(aArr_shTrue,n);

   int horizon = InpHorizonBars;
   int warm    = horizon + 120;        // Pine: bar_index > horizonBars+120

   for(int i=0;i<n;i++)
     {
      // ===== pivot-carried zone bounds (var piv_res/sup) =====
      if(!pivSeed && i>=50){ piv_res=seedHi[i]; piv_sup=seedLo[i]; pivSeed=true; }
      if(pHhas[i]) piv_res=pHigh[i];
      if(pLhas[i]) piv_sup=pLow[i];
      double zone_hi = InpUsePivotZones?piv_res:rollHigh[i];
      double zone_lo = InpUsePivotZones?piv_sup:rollLow[i];
      double atr_zone= atr200[i]*0.5;
      double res_top=zone_hi+atr_zone, res_bot=zone_hi-atr_zone;
      double sup_top=zone_lo+atr_zone, sup_bot=zone_lo-atr_zone;

      // ===== ML: add lagged rows with realized outcome =====
      bool addOk = (i>warm && i>=horizon+1 && i>=200);
      if(addOk)
        {
         int li=i-horizon;
         double moveFwd = C[i]-C[i-horizon];
         double bandFwd = InpLearnAtrFactor*atr14[i-horizon];
         double outcome;
         if(moveFwd>2*bandFwd) outcome=3; else if(moveFwd>bandFwd) outcome=2;
         else if(moveFwd>0) outcome=1; else if(moveFwd<-2*bandFwd) outcome=-3;
         else if(moveFwd<-bandFwd) outcome=-2; else if(moveFwd<0) outcome=-1; else outcome=0;

         double rowO[7],rowH[7],rowL[7],rowC[7];
         rowO[0]=oT[li];rowO[1]=oM[li];rowO[2]=oMo[li];rowO[3]=oV[li];rowO[4]=oR[li];rowO[5]=oS[li];rowO[6]=outcome;
         rowH[0]=hT[li];rowH[1]=hM[li];rowH[2]=hMo[li];rowH[3]=hV[li];rowH[4]=hR[li];rowH[5]=hS[li];rowH[6]=outcome;
         rowL[0]=lT[li];rowL[1]=lM[li];rowL[2]=lMo[li];rowL[3]=lV[li];rowL[4]=lR[li];rowL[5]=lS[li];rowL[6]=outcome;
         rowC[0]=cT[li];rowC[1]=cM[li];rowC[2]=cMo[li];rowC[3]=cV[li];rowC[4]=cR[li];rowC[5]=cS[li];rowC[6]=outcome;
         bankAdd(bankO,cntO,limS,rowO); bankAdd(bankAll,cntAll,limA,rowO);
         bankAdd(bankH,cntH,limS,rowH); bankAdd(bankAll,cntAll,limA,rowH);
         bankAdd(bankL,cntL,limS,rowL); bankAdd(bankAll,cntAll,limA,rowL);
         bankAdd(bankC,cntC,limS,rowC); bankAdd(bankAll,cntAll,limA,rowC);

         // ===== neural online training (Adam) =====
         double targetDir = (outcome>0)?1.0:((outcome<0)?-1.0:0.0);
         if(InpUseNeural && targetDir!=0)
           {
            double pred = nt*cT[li]+nm*cM[li]+nmo*cMo[li]+nv*cV[li]+nr*cR[li]+ns*cS[li]+nb;
            double err  = pred-targetDir;
            double grad = (MathAbs(err)<=InpHuberD)?err:InpHuberD*sgn(err);
            step++;
            double g_t=grad*cT[li], g_m=grad*cM[li], g_mo=grad*cMo[li];
            double g_v=grad*cV[li], g_r=grad*cR[li], g_s=grad*cS[li], g_b=grad;
            // adam updates
            double bc1=1.0-MathPow(beta1,step), bc2=1.0-MathPow(beta2,step);
            mt =beta1*mt +(1-beta1)*g_t;  vt =beta2*vt +(1-beta2)*g_t*g_t;   nt -=InpLearnRate*(mt/bc1)/(MathSqrt(vt/bc2)+eps);
            mm =beta1*mm +(1-beta1)*g_m;  vm =beta2*vm +(1-beta2)*g_m*g_m;   nm -=InpLearnRate*(mm/bc1)/(MathSqrt(vm/bc2)+eps);
            mmo=beta1*mmo+(1-beta1)*g_mo; vmo=beta2*vmo+(1-beta2)*g_mo*g_mo; nmo-=InpLearnRate*(mmo/bc1)/(MathSqrt(vmo/bc2)+eps);
            mv =beta1*mv +(1-beta1)*g_v;  vvw=beta2*vvw+(1-beta2)*g_v*g_v;   nv -=InpLearnRate*(mv/bc1)/(MathSqrt(vvw/bc2)+eps);
            mr =beta1*mr +(1-beta1)*g_r;  vr =beta2*vr +(1-beta2)*g_r*g_r;   nr -=InpLearnRate*(mr/bc1)/(MathSqrt(vr/bc2)+eps);
            ms =beta1*ms +(1-beta1)*g_s;  vs =beta2*vs +(1-beta2)*g_s*g_s;   ns -=InpLearnRate*(ms/bc1)/(MathSqrt(vs/bc2)+eps);
            mb =beta1*mb +(1-beta1)*g_b;  vb =beta2*vb +(1-beta2)*g_b*g_b;   nb -=InpLearnRate*(mb/bc1)/(MathSqrt(vb/bc2)+eps);
           }
        }

      // ===== Fisher weight update (per confirmed bar) =====
      if(InpUseFisher)
        {
         double wRaw[]; autoFeatureWeights(bankAll,cntAll,InpMinRows,InpFisherFloor,wRaw);
         for(int j=0;j<6;j++) wAuto[j]=wAuto[j]+InpFisherSpeed*(wRaw[j]-wAuto[j]);
        }
      double wT  = InpUseFisher?wAuto[0]:1.0;
      double wM  = InpUseFisher?wAuto[1]:1.0;
      double wMo = InpUseFisher?wAuto[2]:1.0;
      double wV  = InpUseFisher?wAuto[3]:1.0;
      double wR  = InpUseFisher?wAuto[4]:1.0;
      double wS  = InpUseFisher?wAuto[5]:1.0;

      // ===== KNN scores for current bar (query with current features) =====
      double oAn,oAg,oTi; int oK; knnScore(oT[i],oM[i],oMo[i],oV[i],oR[i],oS[i],bankO,cntO,InpMemoryDepth,InpKNeighbors,InpSpacingBars,wT,wM,wMo,wV,wR,wS,oAn,oAg,oTi,oK);
      double hAn,hAg,hTi; int hK; knnScore(hT[i],hM[i],hMo[i],hV[i],hR[i],hS[i],bankH,cntH,InpMemoryDepth,InpKNeighbors,InpSpacingBars,wT,wM,wMo,wV,wR,wS,hAn,hAg,hTi,hK);
      double lAn,lAg,lTi; int lK; knnScore(lT[i],lM[i],lMo[i],lV[i],lR[i],lS[i],bankL,cntL,InpMemoryDepth,InpKNeighbors,InpSpacingBars,wT,wM,wMo,wV,wR,wS,lAn,lAg,lTi,lK);
      double cAn,cAg,cTi; int cK; knnScore(cT[i],cM[i],cMo[i],cV[i],cR[i],cS[i],bankC,cntC,InpMemoryDepth,InpKNeighbors,InpSpacingBars,wT,wM,wMo,wV,wR,wS,cAn,cAg,cTi,cK);

      // ===== rank sources -> bestId =====
      double rO=rankSource(oT[i],oM[i],oMo[i],oV[i],oR[i],oS[i],oAn,oAg,oTi,oK,nt,nm,nmo,nv,nr,ns,nb);
      double rH=rankSource(hT[i],hM[i],hMo[i],hV[i],hR[i],hS[i],hAn,hAg,hTi,hK,nt,nm,nmo,nv,nr,ns,nb);
      double rL=rankSource(lT[i],lM[i],lMo[i],lV[i],lR[i],lS[i],lAn,lAg,lTi,lK,nt,nm,nmo,nv,nr,ns,nb);
      double rC=rankSource(cT[i],cM[i],cMo[i],cV[i],cR[i],cS[i],cAn,cAg,cTi,cK,nt,nm,nmo,nv,nr,ns,nb);
      bool ready = (cntO>20 && cntH>20 && cntL>20 && cntC>20);
      double sRO=ready?rO:0.25, sRH=ready?rH:0.25, sRL=ready?rL:0.25, sRC=ready?rC:0.25;
      int bestId = (sRO>=sRH && sRO>=sRL && sRO>=sRC)?0:((sRH>=sRL && sRH>=sRC)?1:((sRL>=sRC)?2:3));
      double hardSrc = (bestId==0)?O[i]:((bestId==1)?H[i]:((bestId==2)?L[i]:C[i]));

      // ===== aiSource = ema(hardSrc, srcSmoothLen) (stateful on hybrid series) =====
      double aAlpha=2.0/(InpSrcSmoothLen+1.0);
      double aiSource = aiSrc_init ? aAlpha*hardSrc+(1.0-aAlpha)*aiSource_prev : hardSrc;
      aiSource_prev=aiSource; aiSrc_init=true;

      // ===== aiDrive =====
      double avgAnalog=(oAn+hAn+lAn+cAn)/4.0;
      double avgAgree =(oAg+hAg+lAg+cAg)/4.0;
      double avgTight =(oTi+hTi+lTi+cTi)/4.0;
      double aiDrive  = clampd(MathAbs(avgAnalog)*0.20+avgAgree*0.40+avgTight*0.40,0.0,1.0);

      // ===== adaptive supertrend =====
      double adaptMult=InpStMult*(1.0+InpStAdapt*(1.0-aiDrive));
      double upBand=aiSource-adaptMult*atrST[i];
      double dnBand=aiSource+adaptMult*atrST[i];
      double cPrev=(i>0)?C[i-1]:C[i];
      double stLong  = !stL_init?upBand:(cPrev>stLong_prev?MathMax(upBand,stLong_prev):upBand);
      double stShort = !stS_init?dnBand:(cPrev<stShort_prev?MathMin(dnBand,stShort_prev):dnBand);
      int stDir;
      if(!stDir_init) stDir=1;
      else if(stDir_prev==-1 && C[i]>stShort_prev) stDir=1;
      else if(stDir_prev==1  && C[i]<stLong_prev ) stDir=-1;
      else stDir=stDir_prev;
      double stLine=(stDir==1)?stLong:stShort;

      // store
      aArr_stLine[i]=stLine; aArr_stDir[i]=stDir;

      // advance supertrend state
      stLong_prev=stLong; stShort_prev=stShort; stDir_prev=stDir;
      stL_init=true; stS_init=true; stDir_init=true;

      // ===== ZONE VALIDITY (Pine) =====
      // chasing detection
      bool zhUp = zone_init && (zone_hi>zone_hi_prev) && (i>0 && C[i]>C[i-1]);
      sh_rise = zhUp ? sh_rise+1 : 0;
      bool sh_chasing = (sh_rise>=InpChaseBars) && (C[i]>res_bot);
      bool zlDn = zone_init && (zone_lo<zone_lo_prev) && (i>0 && C[i]<C[i-1]);
      lo_fall = zlDn ? lo_fall+1 : 0;
      bool lo_chasing = (lo_fall>=InpChaseBars) && (C[i]<sup_top);

      bool sh_atzone = H[i]>=res_bot;
      bool lo_atzone = L[i]<=sup_top;
      bool sh_inzone = (H[i]>=res_bot) && (C[i]<=res_top);
      bool lo_inzone = (L[i]<=sup_top) && (C[i]>=sup_bot);
      bool sh_rejecting = sh_inzone && (C[i] < H[i]-(H[i]-L[i])*InpRejWick);
      bool lo_rejecting = lo_inzone && (C[i] > L[i]+(H[i]-L[i])*InpRejWick);

      bool sh_predict = InpTruePredict && sh_atzone && (rsi14[i]>=InpRsiStretch);
      bool lo_predict = InpTruePredict && lo_atzone && (rsi14[i]<=(100.0-InpRsiStretch));

      bool sh_true_raw = (!sh_chasing) && (sh_predict || sh_rejecting);
      bool lo_true_raw = (!lo_chasing) && (lo_predict || lo_rejecting);

      // true_confirm: on closed bars barstate.isconfirmed==true ->
      //   sh_true = (sh_true_raw) or sh_true_raw[1]
      bool sh_true = InpTrueConfirm ? (sh_true_raw || sh_raw_prev) : sh_true_raw;
      bool lo_true = InpTrueConfirm ? (lo_true_raw || lo_raw_prev) : lo_true_raw;

      aArr_loTrue[i]=lo_true; aArr_shTrue[i]=sh_true;

      // advance zone state
      sh_raw_prev=sh_true_raw; lo_raw_prev=lo_true_raw;
      sh_true_prev=sh_true; lo_true_prev=lo_true;
      zone_hi_prev=zone_hi; zone_lo_prev=zone_lo; zone_init=true;
     }

   // ---------- derive last-bar signals ----------
   int L1=n-1, L0=n-2;
   sigStDir = aArr_stDir[L1];
   sigStLine= aArr_stLine[L1];
   sigRsi   = rsi14[L1];
   sigAtr14 = atr14[L1];
   sigEmaHighSlow=emaHiSlow[L1]; sigEmaLowSlow=emaLoSlow[L1];
   sigEma8=ema8c[L1]; sigEma200=ema200c[L1];

   sigLongPower  = aArr_loTrue[L1] && !aArr_loTrue[L0] && (rsi14[L1]<=InpRsiBuyLevel);
   sigShortPower = aArr_shTrue[L1] && !aArr_shTrue[L0] && (rsi14[L1]>=InpRsiSellLevel);
   sigFlipUp     = (aArr_stDir[L1]==1  && aArr_stDir[L0]==-1);
   sigFlipDn     = (aArr_stDir[L1]==-1 && aArr_stDir[L0]==1);

   // kinetic-line bounce (Pine trailBounceUp/Dn) on last closed bar
   double trailVal = aArr_stLine[L1];
   double trailDist= atr14[L1]*0.25;
   sigBounceUp = (aArr_stDir[L1]==1  && aArr_stDir[L0]==1  && L[L1]<=trailVal+trailDist && C[L1]>trailVal && C[L1]>=O[L1]);
   sigBounceDn = (aArr_stDir[L1]==-1 && aArr_stDir[L0]==-1 && H[L1]>=trailVal-trailDist && C[L1]<trailVal && C[L1]<=O[L1]);

   // swing high/low for SL/TP
   double swH[],swL[]; calcHighest(H,swH,InpSwingLookback,n); calcLowest(L,swL,InpSwingLookback,n);
   sigSwingHigh=swH[L1]; sigSwingLow=swL[L1];

   // HTF confluence (optional)
   sigLoConf=false; sigShConf=false;
   if(InpUseHtfConfluence)
      ComputeHtfConfluence(InpUsePivotZones?0:0); // computed inside using current zone via globals below

   return true;
  }

//+------------------------------------------------------------------+
//|  rankSource (uses neural weights captured at call time)          |
//+------------------------------------------------------------------+
double rankSource(double t,double m,double mo,double v,double r,double s,
                  double analog,double agree,double tight,int k,
                  double nt,double nm,double nmo,double nv,double nr,double ns,double nb)
  {
   double neural = InpUseNeural ? (nt*t+nm*m+nmo*mo+nv*v+nr*r+ns*s+nb) : 0.0;
   double directional = MathAbs(analog)/3.0;
   double raw = directional*0.35 + agree*0.25 + tight*0.20 +
                normScore(neural)*InpNeuralInfluence + ((k>=InpKNeighbors)?0.10:0.0);
   return clampd(raw,0.0,1.0);
  }

//+------------------------------------------------------------------+
//|  HTF confluence (optional) -- compares HTF hi/lo to current zone |
//+------------------------------------------------------------------+
void ComputeHtfConfluence(int dummy)
  {
   // current zone hi/lo on this TF (last closed bar) re-derived simply
   double zhi,zlo;
   if(InpUsePivotZones)
     {
      // approximate with recent extremes (zone already drawn off pivots)
      zhi = iHigh(_Symbol,_Period,iHighest(_Symbol,_Period,MODE_HIGH,50,1));
      zlo = iLow(_Symbol,_Period,iLowest(_Symbol,_Period,MODE_LOW,50,1));
     }
   else
     {
      zhi = iHigh(_Symbol,_Period,iHighest(_Symbol,_Period,MODE_HIGH,InpZoneLength,1));
      zlo = iLow(_Symbol,_Period,iLowest(_Symbol,_Period,MODE_LOW,InpZoneLength,1));
     }
   ENUM_TIMEFRAMES tf1=StringToTF(InpHtf1), tf2=StringToTF(InpHtf2);
   double h1=iHigh(_Symbol,tf1,iHighest(_Symbol,tf1,MODE_HIGH,InpHtfLookback,1));
   double l1=iLow (_Symbol,tf1,iLowest (_Symbol,tf1,MODE_LOW ,InpHtfLookback,1));
   double h2=iHigh(_Symbol,tf2,iHighest(_Symbol,tf2,MODE_HIGH,InpHtfLookback,1));
   double l2=iLow (_Symbol,tf2,iLowest (_Symbol,tf2,MODE_LOW ,InpHtfLookback,1));
   double cr=sigAtr14*InpConfAtr;
   sigShConf = (MathAbs(h1-zhi)<=cr) || (MathAbs(h2-zhi)<=cr);
   sigLoConf = (MathAbs(l1-zlo)<=cr) || (MathAbs(l2-zlo)<=cr);
  }

ENUM_TIMEFRAMES StringToTF(string s)
  {
   if(s=="1")   return PERIOD_M1;
   if(s=="5")   return PERIOD_M5;
   if(s=="15")  return PERIOD_M15;
   if(s=="30")  return PERIOD_M30;
   if(s=="60")  return PERIOD_H1;
   if(s=="240") return PERIOD_H4;
   if(s=="D"||s=="1D") return PERIOD_D1;
   return PERIOD_H1;
  }

//+------------------------------------------------------------------+
//|  POSITION / TRADE HELPERS                                        |
//+------------------------------------------------------------------+
bool HasPosition(int &dir)   // dir: +1 buy, -1 sell, 0 none
  {
   dir=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      if(posinfo.SelectByIndex(i))
         if(posinfo.Symbol()==_Symbol && posinfo.Magic()==InpMagic)
           {
            dir=(posinfo.PositionType()==POSITION_TYPE_BUY)?1:-1;
            return true;
           }
     }
   return false;
  }

void CloseAllPositions()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
      if(posinfo.SelectByIndex(i))
         if(posinfo.Symbol()==_Symbol && posinfo.Magic()==InpMagic)
            trade.PositionClose(posinfo.Ticket(),InpSlippagePts);
  }

double NormalizeLot(double lot)
  {
   double minl=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
   double maxl=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
   lot=MathFloor(lot/step)*step;
   lot=MathMax(minl,MathMin(lot,maxl));
   lot=MathMin(lot,InpMaxLot);
   return lot;
  }

double MoneyPerPointPerLot()
  {
   double tv=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);
   double ts=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   if(ts<=0) return 0;
   return tv*(g_point/ts);   // $ per point per 1.0 lot
  }

double AutoScaleFactor()
  {
   if(!InpAutoLotScale) return 1.0;
   double bal=AccountInfoDouble(ACCOUNT_BALANCE);
   if(bal<=InpScaleBaseBalance || InpScaleStep<=0) return 1.0;
   double steps=MathFloor((bal-InpScaleBaseBalance)/InpScaleStep);
   return 1.0 + steps*InpScaleAddPct;
  }

double CalcLot(double slDistPts)
  {
   double lot;
   if(InpRiskMode==RISK_FIXED_LOT)
     {
      lot=InpFixedLot*AutoScaleFactor();
      return NormalizeLot(lot);
     }
   double riskMoney = (InpRiskMode==RISK_PERCENT)
                      ? AccountInfoDouble(ACCOUNT_BALANCE)*InpRiskPercent/100.0
                      : InpRiskMoney;
   double mpp=MoneyPerPointPerLot();
   if(mpp<=0 || slDistPts<=0) return NormalizeLot(InpFixedLot);
   lot = riskMoney/(slDistPts*mpp);
   lot *= AutoScaleFactor();
   return NormalizeLot(lot);
  }

//+------------------------------------------------------------------+
//|  Build SL price for a direction                                  |
//+------------------------------------------------------------------+
double BuildSL(int dir,double entry)
  {
   double sl=0;
   double buf=InpSlBufferPts*g_point;
   if(InpSlMode==SL_ATR)
     {
      double d=sigAtr14*InpAtrSlMult;
      sl=(dir>0)?(entry-d-buf):(entry+d+buf);
     }
   else if(InpSlMode==SL_KINETIC)
     {
      sl=(dir>0)?(sigStLine-buf):(sigStLine+buf);
      // guard: ensure SL on correct side
      if(dir>0 && sl>=entry) sl=entry-sigAtr14*InpAtrSlMult-buf;
      if(dir<0 && sl<=entry) sl=entry+sigAtr14*InpAtrSlMult+buf;
     }
   else // SL_SWING
     {
      sl=(dir>0)?(sigSwingLow-buf):(sigSwingHigh+buf);
      if(dir>0 && sl>=entry) sl=entry-sigAtr14*InpAtrSlMult-buf;
      if(dir<0 && sl<=entry) sl=entry+sigAtr14*InpAtrSlMult+buf;
     }
   return NormalizeDouble(sl,g_digits);
  }

double BuildTP(int dir,double entry,double sl)
  {
   if(InpTpMode==TP_TRAIL) return 0.0;   // no fixed TP, trail until reversal
   double risk=MathAbs(entry-sl);
   if(InpTpMode==TP_SWING)
     {
      double tp=(dir>0)?sigSwingHigh:sigSwingLow;
      if(dir>0 && tp<=entry) tp=entry+risk*2.0;
      if(dir<0 && tp>=entry) tp=entry-risk*2.0;
      return NormalizeDouble(tp,g_digits);
     }
   double rr = (InpTpMode==TP_RR2)?2.0:((InpTpMode==TP_RR3)?3.0:4.0);
   double tp=(dir>0)?(entry+risk*rr):(entry-risk*rr);
   return NormalizeDouble(tp,g_digits);
  }

//+------------------------------------------------------------------+
//|  Open a trade in direction (handles reverse)                     |
//+------------------------------------------------------------------+
void OpenTrade(int dir,string reason)
  {
   int cur; bool has=HasPosition(cur);
   if(has && cur==dir) return;                 // already in this direction, no stacking
   if(has && cur!=dir)
     {
      if(!InpAllowReverse) return;
      CloseAllPositions();
     }

   double ask=SymbolInfoDouble(_Symbol,SYMBOL_ASK);
   double bid=SymbolInfoDouble(_Symbol,SYMBOL_BID);
   double entry=(dir>0)?ask:bid;
   double sl=BuildSL(dir,entry);
   double slDistPts=MathAbs(entry-sl)/g_point;
   if(slDistPts<1) slDistPts=sigAtr14*InpAtrSlMult/g_point;
   double tp=BuildTP(dir,entry,sl);
   double lot=CalcLot(slDistPts);

   trade.SetDeviationInPoints(InpSlippagePts);
   bool ok;
   if(dir>0) ok=trade.Buy(lot,_Symbol,0.0,sl,tp,reason);
   else      ok=trade.Sell(lot,_Symbol,0.0,sl,tp,reason);
   if(ok){ g_dayTrades++; g_partial1Done=false; g_partial2Done=false; }
   else   PrintFormat("Order failed (%s): %d %s",reason,trade.ResultRetcode(),trade.ResultRetcodeDescription());
  }

//+------------------------------------------------------------------+
//|  Manage open position: BE, profit-lock, trailing, partials       |
//+------------------------------------------------------------------+
void ManagePosition()
  {
   for(int i=PositionsTotal()-1;i>=0;i--)
     {
      if(!posinfo.SelectByIndex(i)) continue;
      if(posinfo.Symbol()!=_Symbol || posinfo.Magic()!=InpMagic) continue;

      int dir=(posinfo.PositionType()==POSITION_TYPE_BUY)?1:-1;
      double entry=posinfo.PriceOpen();
      double curSL=posinfo.StopLoss();
      double curTP=posinfo.TakeProfit();
      double vol =posinfo.Volume();
      double price=(dir>0)?SymbolInfoDouble(_Symbol,SYMBOL_BID):SymbolInfoDouble(_Symbol,SYMBOL_ASK);
      ulong  ticket=posinfo.Ticket();

      // initial risk distance (entry->SL); fall back to ATR if SL missing
      double riskDist = (curSL!=0)?MathAbs(entry-curSL):sigAtr14*InpAtrSlMult;
      if(riskDist<=0) riskDist=sigAtr14*InpAtrSlMult;
      double moveDist = (dir>0)?(price-entry):(entry-price);
      double rMultiple= (riskDist>0)?moveDist/riskDist:0;
      double profitMoney=posinfo.Profit()+posinfo.Swap()+posinfo.Commission();

      double newSL=curSL;

      // ---- Break Even ----
      if(InpUseBreakEven && rMultiple>=InpBeTriggerR)
        {
         double be=(dir>0)?(entry+InpBeBufferPts*g_point):(entry-InpBeBufferPts*g_point);
         if(dir>0 && (newSL==0 || be>newSL)) newSL=be;
         if(dir<0 && (newSL==0 || be<newSL)) newSL=be;
        }

      // ---- Dynamic Profit Lock (tiered $) ----
      if(InpUseProfitLock)
        {
         double lockMoney=0;
         if(profitMoney>=InpLockT4Profit) lockMoney=InpLockT4Lock;
         else if(profitMoney>=InpLockT3Profit) lockMoney=InpLockT3Lock;
         else if(profitMoney>=InpLockT2Profit) lockMoney=InpLockT2Lock;
         else if(profitMoney>=InpLockT1Profit) lockMoney=InpLockT1Lock;
         if(lockMoney>0)
           {
            double mpp=MoneyPerPointPerLot()*vol;             // $ per point for this position
            if(mpp>0)
              {
               double lockPts=lockMoney/mpp;
               double lockSL=(dir>0)?(entry+lockPts*g_point):(entry-lockPts*g_point);
               if(dir>0 && (newSL==0 || lockSL>newSL)) newSL=lockSL;
               if(dir<0 && (newSL==0 || lockSL<newSL)) newSL=lockSL;
              }
           }
        }

      // ---- Trailing stop ----
      if(InpTrailMode!=TRAIL_NONE && rMultiple>=InpTrailStartR)
        {
         double trailSL=newSL;
         if(InpTrailMode==TRAIL_ATR)
           {
            double d=sigAtr14*InpTrailAtrMult;
            trailSL=(dir>0)?(price-d):(price+d);
           }
         else if(InpTrailMode==TRAIL_KINETIC)
           {
            trailSL=sigStLine;                     // follow AI supertrend line
           }
         else if(InpTrailMode==TRAIL_SWING)
           {
            trailSL=(dir>0)?sigSwingLow:sigSwingHigh;
           }
         else if(InpTrailMode==TRAIL_FIXED)
           {
            double d=InpTrailFixedPts*g_point;
            trailSL=(dir>0)?(price-d):(price+d);
           }
         if(dir>0 && trailSL>newSL && trailSL<price) newSL=trailSL;
         if(dir<0 && (newSL==0 || trailSL<newSL) && trailSL>price) newSL=trailSL;
        }

      // ---- apply SL change (never move backwards) ----
      newSL=NormalizeDouble(newSL,g_digits);
      bool improve=false;
      if(dir>0 && newSL>curSL && newSL<price) improve=true;
      if(dir<0 && (curSL==0 || newSL<curSL) && newSL>price && newSL!=0) improve=true;
      if(improve)
         trade.PositionModify(ticket,newSL,curTP);

      // ---- Partial take profit (each tier fires at most once per position) ----
      if(InpUsePartials)
        {
         double minLot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN);
         double step  =SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
         if(!g_partial2Done && rMultiple>=InpPartial2R && vol>minLot)
           {
            double closeVol=NormalizeDouble(MathFloor((vol*InpPartial2Pct/100.0)/step)*step,2);
            if(closeVol>=minLot && (vol-closeVol)>=minLot)
               if(trade.PositionClosePartial(ticket,closeVol,InpSlippagePts)) g_partial2Done=true;
           }
         else if(!g_partial1Done && rMultiple>=InpPartial1R && vol>minLot)
           {
            double closeVol=NormalizeDouble(MathFloor((vol*InpPartial1Pct/100.0)/step)*step,2);
            if(closeVol>=minLot && (vol-closeVol)>=minLot)
               if(trade.PositionClosePartial(ticket,closeVol,InpSlippagePts)) g_partial1Done=true;
           }
        }
     }
  }

//+------------------------------------------------------------------+
//|  FILTERS                                                         |
//+------------------------------------------------------------------+
bool SpreadOK()
  {
   if(InpMaxSpreadPts<=0) return true;
   double spr=(double)SymbolInfoInteger(_Symbol,SYMBOL_SPREAD);
   return (spr<=InpMaxSpreadPts);
  }

bool VolatilityOK()
  {
   if(InpMinAtrPts<=0) return true;
   return (sigAtr14/g_point >= InpMinAtrPts);
  }

bool SessionOK()
  {
   if(!InpUseSession) return true;
   MqlDateTime t; TimeToStruct(TimeCurrent(),t);
   if(InpSessStartHour<=InpSessEndHour)
      return (t.hour>=InpSessStartHour && t.hour<InpSessEndHour);
   return (t.hour>=InpSessStartHour || t.hour<InpSessEndHour);
  }

bool NewsOK()
  {
   if(!InpUseNewsBlackout) return true;
   MqlDateTime t; TimeToStruct(TimeCurrent(),t);
   int cur=t.hour*60+t.min;
   int s=InpNewsStartHour*60+InpNewsStartMin;
   int e=InpNewsEndHour*60+InpNewsEndMin;
   if(s<=e) return !(cur>=s && cur<=e);
   return !(cur>=s || cur<=e);
  }

bool ChopOK()
  {
   if(!InpUseChopFilter) return true;
   // ADX
   if(hADX!=INVALID_HANDLE)
     {
      double adx[]; if(CopyBuffer(hADX,0,1,1,adx)==1)
         if(adx[0]<InpAdxMin) return false;
     }
   // ATR compression: current ATR vs average ATR
   double atrArr[];
   if(CopyBuffer(iATR(_Symbol,_Period,14),0,1,InpAtrCompPeriod,atrArr)==InpAtrCompPeriod)
     {
      double sum=0; for(int i=0;i<InpAtrCompPeriod;i++) sum+=atrArr[i];
      double avg=sum/InpAtrCompPeriod;
      if(sigAtr14 < avg*InpAtrCompRatio) return false;   // compressed -> chop
     }
   // Range detection: span of last N bars relative to ATR
   int hh=iHighest(_Symbol,_Period,MODE_HIGH,InpRangePeriod,1);
   int ll=iLowest (_Symbol,_Period,MODE_LOW ,InpRangePeriod,1);
   double span=iHigh(_Symbol,_Period,hh)-iLow(_Symbol,_Period,ll);
   if(sigAtr14>0 && (span/sigAtr14) < InpRangeAtrMult) return false;
   return true;
  }

bool CloudFilterOK(int dir)
  {
   if(InpCloudFilter==CLOUD_OFF) return true;
   double close=iClose(_Symbol,_Period,1);
   if(InpCloudFilter==CLOUD_SLOW)
     {
      if(dir>0) return (close>sigEmaHighSlow);   // above slow cloud
      else      return (close<sigEmaLowSlow);    // below slow cloud
     }
   // CLOUD_FASTSLOW
   if(dir>0) return (sigEma8>sigEma200);
   return (sigEma8<sigEma200);
  }

bool DailyGuardsOK()
  {
   // refresh day
   MqlDateTime t; TimeToStruct(TimeCurrent(),t);
   datetime today=StringToTime(StringFormat("%04d.%02d.%02d",t.year,t.mon,t.day));
   if(today!=g_dayStart)
     {
      g_dayStart=today;
      g_dayStartBal=AccountInfoDouble(ACCOUNT_BALANCE);
      g_dayTrades=0;
     }
   double eq=AccountInfoDouble(ACCOUNT_EQUITY);
   if(eq>g_equityPeak) g_equityPeak=eq;

   if(InpMaxDailyTrades>0 && g_dayTrades>=InpMaxDailyTrades) return false;
   if(InpMaxDailyLoss>0)
     {
      double dayPnL=eq-g_dayStartBal;
      if(dayPnL<=-InpMaxDailyLoss) return false;
     }
   if(InpMaxDrawdownPct>0 && g_equityPeak>0)
     {
      double dd=(g_equityPeak-eq)/g_equityPeak*100.0;
      if(dd>=InpMaxDrawdownPct) return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
//|  Decide & act on the freshly computed signals                    |
//+------------------------------------------------------------------+
void EvaluateSignals()
  {
   int cur; bool has=HasPosition(cur);

   // ===== 1) AI TREND FLIP (highest-priority directional event) =====
   // A flip always closes the opposite position; a fresh entry also needs
   // daily guards + spread to be sane.
   if(InpEnableTrendFlip)
     {
      if(sigFlipUp)
        {
         if(has && cur<0 && InpAllowReverse) CloseAllPositions();
         if(DailyGuardsOK() && SpreadOK()) OpenTrade(+1,"AI Trend Flip UP");
         return;
        }
      if(sigFlipDn)
        {
         if(has && cur>0 && InpAllowReverse) CloseAllPositions();
         if(DailyGuardsOK() && SpreadOK()) OpenTrade(-1,"AI Trend Flip DN");
         return;
        }
     }

   // ===== 2) Kinetic line exit (close beyond line) handled by SL/flip =====
   // (Pine exit = trend flip / close beyond line -> covered above & by kinetic SL)

   // ===== 3) Entry signals require gating filters =====
   bool baseOK = DailyGuardsOK() && SpreadOK() && VolatilityOK() && SessionOK() && NewsOK() && ChopOK();
   if(!baseOK) return;

   // LONG POWER
   if(InpEnableLongPower && sigLongPower)
     {
      bool conf = (!InpUseHtfConfluence) || sigLoConf;
      if(conf && CloudFilterOK(+1)) { OpenTrade(+1,"Long Power Zone"); return; }
     }
   // SHORT POWER
   if(InpEnableShortPower && sigShortPower)
     {
      bool conf = (!InpUseHtfConfluence) || sigShConf;
      if(conf && CloudFilterOK(-1)) { OpenTrade(-1,"Short Power Zone"); return; }
     }

   // KINETIC LINE BOUNCE
   if(InpEnableBounce)
     {
      if(sigBounceUp && CloudFilterOK(+1)) { OpenTrade(+1,"Kinetic Bounce UP"); return; }
      if(sigBounceDn && CloudFilterOK(-1)) { OpenTrade(-1,"Kinetic Bounce DN"); return; }
     }
  }

//+------------------------------------------------------------------+
//|  Init                                                            |
//+------------------------------------------------------------------+
int OnInit()
  {
   g_point   =SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   g_digits  =(int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS);
   g_tickSize=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_SIZE);
   g_tickValue=SymbolInfoDouble(_Symbol,SYMBOL_TRADE_TICK_VALUE);
   trade.SetExpertMagicNumber(InpMagic);
   trade.SetDeviationInPoints(InpSlippagePts);
   trade.SetTypeFillingBySymbol(_Symbol);

   hADX=iADX(_Symbol,_Period,InpAdxPeriod);

   g_equityPeak=AccountInfoDouble(ACCOUNT_EQUITY);
   g_dayStartBal=AccountInfoDouble(ACCOUNT_BALANCE);

   Print("TUX_SD_Trend_EA initialised on ",_Symbol," ",EnumToString(_Period));
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   if(hADX!=INVALID_HANDLE) IndicatorRelease(hADX);
  }

//+------------------------------------------------------------------+
//|  Tick                                                            |
//+------------------------------------------------------------------+
void OnTick()
  {
   // reset partial-close flags whenever flat
   int _d; if(!HasPosition(_d)){ g_partial1Done=false; g_partial2Done=false; }

   // manage open positions every tick (trailing, BE, locks, partials)
   ManagePosition();

   // only evaluate signals once per newly closed bar (no repaint)
   datetime bt=iTime(_Symbol,_Period,0);
   if(bt==g_lastBarTime) return;
   g_lastBarTime=bt;

   if(!ComputePass())
     {
      Print("ComputePass: not enough history yet");
      return;
     }
   if(InpUseHtfConfluence) ComputeHtfConfluence(0);

   EvaluateSignals();
  }
//+------------------------------------------------------------------+
