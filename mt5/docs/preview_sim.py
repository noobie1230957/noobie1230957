#!/usr/bin/env python3
"""
Visual SIMULATION of the TUX_SD_Trend_EA logic.
This is NOT the MT5 EA running -- it is a faithful Python port of the same
signal pipeline (AI Supertrend ML engine + S&D zones + RSI gating + the 4
entries + SL/TP/trailing) so you can SEE how the EA decides trades.

Real "live" execution happens in MT5's Strategy Tester. This preview uses
synthetic-but-realistic OHLC so the chart is self-contained and reproducible.
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

np.random.seed(7)

# ----------------------------------------------------------------------
# 1) Build realistic OHLC: alternating trend / range regimes
# ----------------------------------------------------------------------
def make_data(n=1400):
    price = 2000.0          # gold-like scale
    closes=[]; opens=[]; highs=[]; lows=[]
    regime_len=0; drift=0.0; vol=0.0
    for i in range(n):
        if regime_len<=0:
            regime_len = np.random.randint(60,160)
            kind = np.random.choice(["up","down","range"], p=[0.35,0.35,0.30])
            drift = {"up":0.0009,"down":-0.0009,"range":0.0}[kind]
            vol   = {"up":0.0045,"down":0.0045,"range":0.0030}[kind]
        regime_len-=1
        o=price
        ret=np.random.normal(drift,vol)
        price=max(1.0, price*(1+ret))
        c=price
        wick=abs(np.random.normal(0,vol))*price
        hi=max(o,c)+wick*np.random.rand()
        lo=min(o,c)-wick*np.random.rand()
        opens.append(o);closes.append(c);highs.append(hi);lows.append(lo)
    return (np.array(opens),np.array(highs),np.array(lows),np.array(closes))

O,H,L,C = make_data()
n=len(C)

# ----------------------------------------------------------------------
# 2) Indicator helpers (mirror the MQL5 / Pine recursions)
# ----------------------------------------------------------------------
def ema(src,length):
    a=2.0/(length+1.0); out=np.empty_like(src)
    out[0]=src[0]
    for i in range(1,len(src)): out[i]=a*src[i]+(1-a)*out[i-1]
    return out
def rma(src,length):
    a=1.0/length; out=np.empty_like(src); s=0.0
    for i in range(len(src)):
        if i<length:
            s+=src[i]; out[i]=s/(i+1)
        else: out[i]=a*src[i]+(1-a)*out[i-1]
    return out
def sma(src,length):
    out=np.empty_like(src); s=0.0
    for i in range(len(src)):
        s+=src[i]
        if i>=length: s-=src[i-length]
        out[i]=s/min(i+1,length)
    return out
def stdev(src,length):
    out=np.empty_like(src)
    for i in range(len(src)):
        st=max(0,i-length+1); w=src[st:i+1]; out[i]=np.sqrt(np.mean((w-w.mean())**2))
    return out
def atr(H,L,C,length):
    tr=np.empty(n)
    for i in range(n):
        tr[i]=H[i]-L[i] if i==0 else max(H[i]-L[i],abs(H[i]-C[i-1]),abs(L[i]-C[i-1]))
    return rma(tr,length)
def rsi(C,length):
    up=np.zeros(n); dn=np.zeros(n)
    for i in range(1,n):
        ch=C[i]-C[i-1]; up[i]=max(ch,0); dn[i]=max(-ch,0)
    ru=rma(up,length); rd=rma(dn,length); out=np.empty(n)
    for i in range(n):
        out[i]=100 if rd[i]==0 else (0 if ru[i]==0 else 100-100/(1+ru[i]/rd[i]))
    return out
def clamp(x,lo,hi): return max(lo,min(x,hi))
def highest(src,length):
    out=np.empty(n)
    for i in range(n):
        st=max(0,i-length+1); out[i]=src[st:i+1].max()
    return out
def lowest(src,length):
    out=np.empty(n)
    for i in range(n):
        st=max(0,i-length+1); out[i]=src[st:i+1].min()
    return out
def scale01(src,length):
    out=np.empty(n)
    for i in range(n):
        st=max(0,i-length+1); w=src[st:i+1]; lo,hi=w.min(),w.max()
        out[i]=0.5 if hi==lo else clamp((src[i]-lo)/(hi-lo),0,1)
    return out

atr14=atr(H,L,C,14); atr200=atr(H,L,C,200); rsi14=rsi(C,14)
ST_LEN=10; atrST=atr(H,L,C,ST_LEN)

# features
def feat_trend(src,a):
    e10=ema(src,10); e34=ema(src,34); out=np.empty(n)
    for i in range(n): out[i]=0 if a[i]==0 else clamp((e10[i]-e34[i])/a[i],-3,3)/3
    return out
def feat_mean(src):
    sm=sma(src,30); sd=stdev(src,30); out=np.empty(n)
    for i in range(n):
        z=0 if sd[i]==0 else (src[i]-sm[i])/sd[i]; out[i]=clamp(-z,-3,3)/3
    return out
def feat_mom(src):
    out=np.zeros(n)
    for i in range(14,n):
        if src[i-14]!=0: out[i]=clamp((src[i]/src[i-14]-1)/0.05,-3,3)/3
    return out
def feat_vol(src):
    sc=scale01(stdev(src,20),100); return sc*2-1
def feat_range(src):
    out=np.empty(n)
    for i in range(n):
        rng=H[i]-L[i]; out[i]=0 if rng==0 else clamp(((src[i]-L[i])/rng)*2-1,-1,1)
    return out
def feat_slope(src,a):
    out=np.zeros(n)
    for i in range(3,n):
        if a[i]!=0: out[i]=clamp((src[i]-src[i-3])/a[i],-3,3)/3
    return out

def feats(src):
    return (feat_trend(src,atr14),feat_mean(src),feat_mom(src),
            feat_vol(src),feat_range(src),feat_slope(src,atr14))
F={s:feats(v) for s,v in zip("OHLC",[O,H,L,C])}

# ----------------------------------------------------------------------
# 3) AI engine: KNN banks + Adam neural + Fisher  -> adaptive supertrend
#    (params mirror EA defaults)
# ----------------------------------------------------------------------
MEM=40; K=9; HOR=4; SPACE=4; LF=0.45
USE_NEURAL=True; NINF=0.35; LR=0.01; HUBER=0.02
USE_FISHER=True; FSPD=0.20; FFLOOR=0.40; MINROWS=80
ST_MULT=1.7; ST_ADAPT=0.80; SMOOTH=3

def compress(d): return np.log(1+abs(d))
def norm(x): return 1/(1+np.exp(-clamp(x,-8,8)))
def sgn(x): return 1.0 if x>0 else (-1.0 if x<0 else 0.0)

bankO=[];bankH=[];bankL=[];bankC=[];bankAll=[]
def bank_add(b,row,limit):
    b.insert(0,row)
    if len(b)>limit: b.pop()

# neural state
nw=[0.01]*6+[0.0]; mm=[0.0]*7; vv=[0.0]*7; step=[0]
b1,b2,eps=0.9,0.999,1e-8
wAuto=[1.0]*6

def fisher(bankAll):
    imp=[1.0]*6
    if len(bankAll)<MINROWS: return imp
    sB=[0]*6;sS=[0]*6;qB=[0]*6;qS=[0]*6;cB=0;cS=0
    for r in bankAll:
        cls=r[6]
        if cls==0: continue
        bull=cls>0
        for j in range(6):
            v=r[j]
            if bull: sB[j]+=v;qB[j]+=v*v
            else: sS[j]+=v;qS[j]+=v*v
        cB+=1 if bull else 0; cS+=0 if bull else 1
    if cB>3 and cS>3:
        fish=[0]*6; mx=0
        for j in range(6):
            mB=sB[j]/cB;mS=sS[j]/cS
            vB=max(0,qB[j]/cB-mB*mB);vS=max(0,qS[j]/cS-mS*mS)
            f=(mB-mS)**2/(vB+vS+1e-6); fish[j]=f; mx=max(mx,f)
        for j in range(6):
            nrm=fish[j]/mx if mx>0 else 1; imp[j]=max(FFLOOR,nrm*8)
    return imp

def knn(q,bank,w):
    gaps=[];cls=[]
    nn=len(bank); scanEnd=min(nn-1,MEM-1)
    if nn>1:
        for i in range(0,scanEnd+1):
            if i%SPACE!=0: continue
            c=bank[i][6]
            if c==0: continue
            g=sum(w[j]*compress(q[j]-bank[i][j]) for j in range(6))
            if len(gaps)<K: gaps.append(g);cls.append(c)
            else:
                wi=int(np.argmax(gaps))
                if g<gaps[wi]: gaps[wi]=g;cls[wi]=c
    total=score=bull=bear=gsum=0.0
    for g,c in zip(gaps,cls):
        wg=1/(1+g); total+=wg; score+=c*wg
        if c>0:bull+=wg
        if c<0:bear+=wg
        gsum+=g
    analog=score/total if total>0 else 0
    d=1 if analog>0.15 else(-1 if analog<-0.15 else 0)
    agree=((bull if d==1 else (bear if d==-1 else 0))/total) if total>0 else 0
    avg=gsum/len(gaps) if gaps else 0
    gs=sum(w)*0.45+1e-6; tight=clamp(1-avg/gs,0,1)
    return analog,agree,tight,len(gaps)

def rankf(q,an,ag,ti,k,w):
    neural=sum(w[j]*q[j] for j in range(6))+nw[6] if USE_NEURAL else 0
    raw=abs(an)/3*0.35+ag*0.25+ti*0.20+norm(neural)*NINF+(0.10 if k>=K else 0)
    return clamp(raw,0,1)

# sequential pass
stDir=np.ones(n,dtype=int); stLine=np.zeros(n); stLong_p=None;stShort_p=None;dir_p=1
aiSrc_p=None
loTrue=np.zeros(n,bool); shTrue=np.zeros(n,bool)
RSI_STR=68.0; CHASE=3; REJW=0.4; ZLEN=130
rollHi=highest(H,ZLEN); rollLo=lowest(L,ZLEN)
res_top=np.zeros(n);res_bot=np.zeros(n);sup_top=np.zeros(n);sup_bot=np.zeros(n)
sh_rise=0;lo_fall=0; zhi_p=None;zlo_p=None; sh_raw_p=False;lo_raw_p=False

for i in range(n):
    zone_hi=rollHi[i]; zone_lo=rollLo[i]; az=atr200[i]*0.5
    rt,rb,stp,sb=zone_hi+az,zone_hi-az,zone_lo+az,zone_lo-az
    res_top[i],res_bot[i],sup_top[i],sup_bot[i]=rt,rb,stp,sb

    add=i>HOR+120 and i>=200
    if add:
        li=i-HOR; mv=C[i]-C[i-HOR]; bf=LF*atr14[i-HOR]
        oc=3 if mv>2*bf else 2 if mv>bf else 1 if mv>0 else -3 if mv<-2*bf else -2 if mv<-bf else -1 if mv<0 else 0
        for s,bank,lim in [("O",bankO,MEM),("H",bankH,MEM),("L",bankL,MEM),("C",bankC,MEM)]:
            row=[F[s][j][li] for j in range(6)]+[oc]
            bank_add(bank,row,lim); bank_add(bankAll,row,MEM*4)
        td=1.0 if oc>0 else(-1.0 if oc<0 else 0.0)
        if USE_NEURAL and td!=0:
            cf=[F["C"][j][li] for j in range(6)]
            pred=sum(nw[j]*cf[j] for j in range(6))+nw[6]
            err=pred-td; grad=err if abs(err)<=HUBER else HUBER*sgn(err)
            step[0]+=1; bc1=1-b1**step[0]; bc2=1-b2**step[0]
            g=[grad*cf[j] for j in range(6)]+[grad]
            for j in range(7):
                mm[j]=b1*mm[j]+(1-b1)*g[j]; vv[j]=b2*vv[j]+(1-b2)*g[j]*g[j]
                nw[j]-=LR*(mm[j]/bc1)/(np.sqrt(vv[j]/bc2)+eps)
    if USE_FISHER:
        wr=fisher(bankAll)
        for j in range(6): wAuto[j]+=FSPD*(wr[j]-wAuto[j])
    w=wAuto if USE_FISHER else [1.0]*6

    res={}
    for s,bank in [("O",bankO),("H",bankH),("L",bankL),("C",bankC)]:
        q=[F[s][j][i] for j in range(6)]
        res[s]=knn(q,bank,w)
    ranks={}
    for s in "OHLC":
        q=[F[s][j][i] for j in range(6)]
        ranks[s]=rankf(q,*res[s],w)
    ready=all(len(b)>20 for b in [bankO,bankH,bankL,bankC])
    sr={s:(ranks[s] if ready else 0.25) for s in "OHLC"}
    best=max("OHLC",key=lambda s:(sr[s], "OHLC".index(s)*-1))  # tie -> first
    # replicate exact tie order O>=H>=L>=C
    if sr["O"]>=sr["H"] and sr["O"]>=sr["L"] and sr["O"]>=sr["C"]: best="O"
    elif sr["H"]>=sr["L"] and sr["H"]>=sr["C"]: best="H"
    elif sr["L"]>=sr["C"]: best="L"
    else: best="C"
    hard={"O":O,"H":H,"L":L,"C":C}[best][i]
    a=2.0/(SMOOTH+1)
    aiSrc=hard if aiSrc_p is None else a*hard+(1-a)*aiSrc_p; aiSrc_p=aiSrc
    avgA=np.mean([res[s][0] for s in "OHLC"]); avgG=np.mean([res[s][1] for s in "OHLC"]); avgT=np.mean([res[s][2] for s in "OHLC"])
    drive=clamp(abs(avgA)*0.20+avgG*0.40+avgT*0.40,0,1)
    amult=ST_MULT*(1+ST_ADAPT*(1-drive))
    up=aiSrc-amult*atrST[i]; dn=aiSrc+amult*atrST[i]
    cprev=C[i-1] if i>0 else C[i]
    sL=up if stLong_p is None else (max(up,stLong_p) if cprev>stLong_p else up)
    sS=dn if stShort_p is None else (min(dn,stShort_p) if cprev<stShort_p else dn)
    if stLong_p is None or stShort_p is None: d=1
    elif dir_p==-1 and C[i]>stShort_p: d=1
    elif dir_p==1 and C[i]<stLong_p: d=-1
    else: d=dir_p
    stDir[i]=d; stLine[i]=sL if d==1 else sS
    stLong_p,stShort_p,dir_p=sL,sS,d

    # zone validity
    zhUp = (zhi_p is not None and zone_hi>zhi_p and i>0 and C[i]>C[i-1])
    sh_rise = sh_rise+1 if zhUp else 0
    sh_ch = sh_rise>=CHASE and C[i]>rb
    zlDn = (zlo_p is not None and zone_lo<zlo_p and i>0 and C[i]<C[i-1])
    lo_fall = lo_fall+1 if zlDn else 0
    lo_ch = lo_fall>=CHASE and C[i]<stp
    sh_at=H[i]>=rb; lo_at=L[i]<=stp
    sh_in=H[i]>=rb and C[i]<=rt; lo_in=L[i]<=stp and C[i]>=sb
    sh_rej=sh_in and C[i]<H[i]-(H[i]-L[i])*REJW
    lo_rej=lo_in and C[i]>L[i]+(H[i]-L[i])*REJW
    sh_pr=sh_at and rsi14[i]>=RSI_STR
    lo_pr=lo_at and rsi14[i]<=(100-RSI_STR)
    shr=(not sh_ch) and (sh_pr or sh_rej)
    lor=(not lo_ch) and (lo_pr or lo_rej)
    shTrue[i]=shr or sh_raw_p; loTrue[i]=lor or lo_raw_p
    sh_raw_p,lo_raw_p=shr,lor; zhi_p,zlo_p=zone_hi,zone_lo

# ----------------------------------------------------------------------
# 4) Signals + trade engine (risk $, ATR SL, RR2 TP, kinetic trail, reverse)
# ----------------------------------------------------------------------
RSI_BUY=49; RSI_SELL=55; RISK=20.0; ATR_SL=1.5; RR=2.0
PVAL=1.0  # $ per 1.0 price unit per lot (simplified for preview)
trades=[]; pos=None; equity=1000.0; eq_curve=[]
def close_pos(i,price,reason):
    global pos,equity
    pnl=(price-pos['entry'])*pos['dir']*pos['lot']*PVAL
    equity+=pnl
    trades.append({**pos,'exit_i':i,'exit':price,'pnl':pnl,'exit_reason':reason})
    pos=None

for i in range(1,n):
    price=C[i]
    # manage open position: kinetic trailing + SL/TP hit
    if pos:
        # trail SL to kinetic line in profit direction
        kl=stLine[i]
        if pos['dir']>0 and kl>pos['sl'] and kl<price: pos['sl']=kl
        if pos['dir']<0 and kl<pos['sl'] and kl>price: pos['sl']=kl
        # SL / TP hit (use bar extremes)
        if pos['dir']>0:
            if L[i]<=pos['sl']: close_pos(i,pos['sl'],'SL');
            elif pos['tp'] and H[i]>=pos['tp']: close_pos(i,pos['tp'],'TP')
        elif pos:
            if H[i]>=pos['sl']: close_pos(i,pos['sl'],'SL')
            elif pos['tp'] and L[i]<=pos['tp']: close_pos(i,pos['tp'],'TP')

    flipUp = stDir[i]==1 and stDir[i-1]==-1
    flipDn = stDir[i]==-1 and stDir[i-1]==1
    longPow = loTrue[i] and not loTrue[i-1] and rsi14[i]<=RSI_BUY
    shortPow= shTrue[i] and not shTrue[i-1] and rsi14[i]>=RSI_SELL
    tv=stLine[i]; td=atr14[i]*0.25
    bounceUp = stDir[i]==1 and stDir[i-1]==1 and L[i]<=tv+td and C[i]>tv and C[i]>=O[i]
    bounceDn = stDir[i]==-1 and stDir[i-1]==-1 and H[i]>=tv-td and C[i]<tv and C[i]<=O[i]

    sig=0; reason=''
    if flipUp: sig=1;reason='Trend Flip UP'
    elif flipDn: sig=-1;reason='Trend Flip DN'
    elif longPow: sig=1;reason='Long Power'
    elif shortPow: sig=-1;reason='Short Power'
    elif bounceUp: sig=1;reason='Kinetic Bounce UP'
    elif bounceDn: sig=-1;reason='Kinetic Bounce DN'

    if sig!=0:
        if pos and pos['dir']!=sig: close_pos(i,price,'Reverse')
        if not pos:
            sl=price-atr14[i]*ATR_SL if sig>0 else price+atr14[i]*ATR_SL
            dist=abs(price-sl); lot=RISK/(dist*PVAL) if dist>0 else 0.01
            tp=price+dist*RR*sig
            pos={'dir':sig,'entry':price,'sl':sl,'tp':tp,'lot':lot,
                 'entry_i':i,'reason':reason}
    eq_curve.append(equity)
if pos: close_pos(n-1,C[-1],'EOD')

# ----------------------------------------------------------------------
# 5) Plot
# ----------------------------------------------------------------------
fig,(ax1,ax2)=plt.subplots(2,1,figsize=(18,11),gridspec_kw={'height_ratios':[3,1]},sharex=True)
x=np.arange(n)
# candles (thin)
for i in range(n):
    col='#26a69a' if C[i]>=O[i] else '#ef5350'
    ax1.plot([i,i],[L[i],H[i]],color=col,lw=0.5,alpha=0.6)
    ax1.plot([i,i],[O[i],C[i]],color=col,lw=2.2,alpha=0.9,solid_capstyle='butt')
# AI supertrend line colored by direction
for i in range(1,n):
    col='#00e676' if stDir[i]==1 else '#ff5252'
    ax1.plot([i-1,i],[stLine[i-1],stLine[i]],color=col,lw=1.6)
# S&D zones (last segment shaded)
ax1.fill_between(x,res_bot,res_top,color='magenta',alpha=0.06,label='Short Power zone')
ax1.fill_between(x,sup_bot,sup_top,color='lime',alpha=0.06,label='Long Power zone')
# trade markers
for t in trades:
    ei=t['entry_i']; col='lime' if t['dir']>0 else 'red'; mk='^' if t['dir']>0 else 'v'
    ax1.scatter(ei,t['entry'],marker=mk,s=130,color=col,edgecolor='black',zorder=5)
    ax1.annotate(t['reason'].replace(' ','\n'),(ei,t['entry']),fontsize=6,
                 ha='center',va='bottom' if t['dir']>0 else 'top',color='black')
    xi=t['exit_i']; ecol='blue' if t['pnl']>=0 else 'darkred'
    ax1.scatter(xi,t['exit'],marker='x',s=70,color=ecol,zorder=5)
    ax1.plot([ei,xi],[t['entry'],t['exit']],color=ecol,lw=0.7,ls='--',alpha=0.6)
ax1.set_title("TUX_SD_Trend_EA  —  LOGIC PREVIEW (simulation, not live MT5)\n"
              "Green/red line = AI SuperTrend (kinetic line) | shaded = S&D power zones | "
              "▲▼ = entries | ✕ = exits",fontsize=11)
ax1.legend(loc='upper left',fontsize=8); ax1.grid(alpha=0.15)
# equity
ax2.plot(x[1:],eq_curve,color='gold',lw=1.5)
ax2.axhline(1000,color='gray',ls=':',lw=0.8)
ax2.set_title("Simulated equity ($1000 start, $20 risk/trade)",fontsize=10)
ax2.grid(alpha=0.15)
plt.tight_layout()
out="/home/user/noobie1230957/mt5/docs/EA_preview.png"
plt.savefig(out,dpi=110)
print("saved",out)

# ---- zoomed, readable window ----
a,b=620,880
fig2,ax=plt.subplots(figsize=(18,9))
for i in range(a,b):
    col='#26a69a' if C[i]>=O[i] else '#ef5350'
    ax.plot([i,i],[L[i],H[i]],color=col,lw=0.9,alpha=0.7)
    ax.plot([i,i],[O[i],C[i]],color=col,lw=4,alpha=0.95,solid_capstyle='butt')
for i in range(a+1,b):
    col='#00c853' if stDir[i]==1 else '#d50000'
    ax.plot([i-1,i],[stLine[i-1],stLine[i]],color=col,lw=2.4)
ax.fill_between(np.arange(a,b),res_bot[a:b],res_top[a:b],color='magenta',alpha=0.10)
ax.fill_between(np.arange(a,b),sup_bot[a:b],sup_top[a:b],color='lime',alpha=0.10)
for t in trades:
    if a<=t['entry_i']<b:
        ei=t['entry_i'];col='#00c853' if t['dir']>0 else '#d50000';mk='^' if t['dir']>0 else 'v'
        ax.scatter(ei,t['entry'],marker=mk,s=240,color=col,edgecolor='black',zorder=6)
        ax.annotate(t['reason'],(ei,t['entry']),fontsize=8,fontweight='bold',
                    ha='center',va='bottom' if t['dir']>0 else 'top',
                    xytext=(0,14 if t['dir']>0 else -14),textcoords='offset points')
    if a<=t.get('exit_i',-1)<b:
        ax.scatter(t['exit_i'],t['exit'],marker='x',s=130,
                   color='blue' if t['pnl']>=0 else 'darkred',zorder=6,lw=2.5)
ax.set_title(f"ZOOM (bars {a}-{b}) — see the AI SuperTrend (kinetic line) flip color, "
             f"price tag the S&D zones, and entries/exits fire\n"
             f"GREEN line=bullish trend  RED line=bearish trend  ▲=BUY ▼=SELL  ✕=exit",fontsize=12)
ax.grid(alpha=0.2)
plt.tight_layout()
out2="/home/user/noobie1230957/mt5/docs/EA_preview_zoom.png"
plt.savefig(out2,dpi=120)
print("saved",out2)

# ----------------------------------------------------------------------
# 6) Stats + trade log
# ----------------------------------------------------------------------
wins=[t for t in trades if t['pnl']>0]; losses=[t for t in trades if t['pnl']<=0]
print(f"\n===== SIMULATION SUMMARY ({n} bars) =====")
print(f"Total trades : {len(trades)}")
print(f"Wins/Losses  : {len(wins)}/{len(losses)}  (win rate {100*len(wins)/max(1,len(trades)):.1f}%)")
print(f"Net P/L      : ${equity-1000:+.2f}   (end equity ${equity:.2f})")
if trades:
    print(f"Avg win ${np.mean([t['pnl'] for t in wins]) if wins else 0:.2f} | "
          f"Avg loss ${np.mean([t['pnl'] for t in losses]) if losses else 0:.2f}")
print("\n--- First 12 trades ---")
print(f"{'#':>2} {'dir':>4} {'reason':<18} {'entry':>9} {'exit':>9} {'why':<8} {'pnl$':>8}")
for k,t in enumerate(trades[:12]):
    print(f"{k+1:>2} {'BUY' if t['dir']>0 else 'SELL':>4} {t['reason']:<18} "
          f"{t['entry']:>9.2f} {t['exit']:>9.2f} {t['exit_reason']:<8} {t['pnl']:>8.2f}")
# reason breakdown
from collections import Counter
print("\nEntry reasons:",dict(Counter(t['reason'] for t in trades)))
