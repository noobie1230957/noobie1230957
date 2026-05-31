"""
TUX S&D + KINETIC — High-Quality Video Renderer
Pipes raw RGB frames directly into ffmpeg for maximum quality.
"""

import math, random, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from imageio_ffmpeg import get_ffmpeg_exe

# ── Config ────────────────────────────────────────────────────────────────────
W, H      = 1920, 1080   # Full HD for social ads
FPS       = 30
DURATION  = 24
FRAMES    = FPS * DURATION
OUT_PATH  = "tux_kinetic_animation.mp4"
SCALE     = 2.0          # everything drawn at 2x for sharpness

# Internal drawing size
IW, IH = int(W), int(H)

CHART_X = 120
CHART_Y = 64
CHART_W = 1640
CHART_H = 920
PRICE_MIN, PRICE_MAX = 43.0, 73.0

def py(price):
    return int(CHART_Y + CHART_H * (1 - (price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)))

def cx(i, total):
    return int(CHART_X + (i / (total - 1)) * CHART_W)

def lerp(a, b, t): return a + (b - a) * t
def clamp(v, lo, hi): return max(lo, min(hi, v))
def ease_out(t): return 1 - (1 - t) ** 3
def pulse(t, speed=3.0): return 0.5 + 0.5 * math.sin(t * speed)

# ── Data ──────────────────────────────────────────────────────────────────────
CANDLES = [
    (65.2,66.1,63.8,64.0,1),(64.0,64.5,62.2,62.5,1),
    (62.5,63.0,60.5,60.8,1),(60.8,61.2,58.8,59.1,1),
    (59.1,59.8,57.2,57.5,1),(57.5,58.1,55.5,55.8,1),
    (55.8,56.2,53.5,53.8,1),(53.8,54.3,51.8,52.0,1),
    (52.0,52.4,50.1,50.3,2),(50.3,50.8,48.8,49.2,2),
    (49.2,49.9,48.5,49.0,2),(49.0,49.7,48.4,49.3,2),
    (49.3,50.8,49.0,50.5,3),(50.5,52.5,50.3,52.2,3),
    (52.2,54.0,52.0,53.8,3),(53.8,55.5,53.5,55.2,3),
    (55.2,57.3,55.0,57.0,4),(57.0,59.5,56.8,59.2,4),
    (59.2,61.5,59.0,61.3,4),(61.3,63.5,61.1,63.2,4),
    (63.2,65.5,63.0,65.3,4),(65.3,67.2,65.1,67.0,5),
    (67.0,68.5,66.8,68.1,5),(68.1,68.9,67.5,68.3,5),
    (68.3,68.8,65.5,65.8,6),(65.8,66.2,63.0,63.3,6),
    (63.3,63.8,61.0,61.2,6),
]
N = len(CANDLES)

KINETIC = [
    67.0,66.5,65.2,63.8,62.0,60.5,58.5,56.5,
    54.8,53.0,51.8,51.2,
    49.0,49.5,50.8,52.5,
    54.0,56.2,58.5,60.8,63.0,
    65.0,66.5,67.2,
    66.0,64.0,62.0,
]

SCENE_BREAKS = [0,8,12,16,21,24,N]

def get_scene(ci):
    for i in range(len(SCENE_BREAKS)-1,0,-1):
        if ci >= SCENE_BREAKS[i-1]: return min(6,i)
    return 1

# ── Particles ──────────────────────────────────────────────────────────────────
rng = random.Random(42)
PARTS = [{
    'x':rng.random()*IW,'y':rng.random()*IH,
    'vx':(rng.random()-.5)*.5,'vy':(rng.random()-.5)*.5,
    'r':rng.random()*3+.6,'a':rng.random()*.3+.04,
    'col':(124,58,237) if rng.random()>.5 else (190,24,93),
} for _ in range(70)]

def step_particles():
    for p in PARTS:
        p['x']=(p['x']+p['vx'])%IW
        p['y']=(p['y']+p['vy'])%IH

# ── Fonts ──────────────────────────────────────────────────────────────────────
BASE = '/usr/share/fonts/truetype/dejavu/'
def F(size, bold=False):
    try:
        name = 'DejaVuSansMono-Bold.ttf' if bold else 'DejaVuSansMono.ttf'
        return ImageFont.truetype(BASE+name, size)
    except:
        return ImageFont.load_default()

FS  = F(18);    FB  = F(18,True)
FM  = F(22);    FBM = F(22,True)
FL  = F(28);    FBL = F(28,True)
FXL = F(40);    FBXL= F(40,True)
FBXX= F(56,True)

# ── Candle animation progress ─────────────────────────────────────────────────
candle_prog = [0.0]*N

def update_candle_progs(ci):
    for i in range(ci+1):
        candle_prog[i] = min(1.0, candle_prog[i]+0.055)

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN=(34,197,94); RED=(239,68,68); PURPLE=(168,85,247)
DPURP=(124,58,237); PINK=(190,24,93); GOLD=(245,158,11)
LBLUE=(167,139,250); WHITE=(233,213,255)

# ── Draw helpers ──────────────────────────────────────────────────────────────
def composite(img, ov, blur=0):
    if blur>0: ov=ov.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(ov)

def draw_bg(img):
    d=ImageDraw.Draw(img)
    for row in range(IH):
        t=row/IH
        r=int(lerp(10,6,t)); g=int(lerp(8,5,t)); b=int(lerp(18,14,t))
        d.line([(0,row),(IW,row)],fill=(r,g,b,255))

def draw_grid(img):
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for price in [46,50,54,58,62,66,70]:
        y=py(price)
        d.line([(CHART_X,y),(CHART_X+CHART_W,y)],fill=(255,255,255,10),width=1)
        d.text((CHART_X+CHART_W+16,y-8),str(price),font=FB,fill=(167,139,250,115))
    composite(img,ov)

def draw_power_zone(img,scene,t):
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    if scene>=2:
        y=py(49); glowing=(scene==2)
        a=int(pulse(t,2)*80+60) if glowing else 40
        for row in range(y,y+20):
            fa=int(a*(1-(row-y)/20))
            d.line([(CHART_X,row),(CHART_X+CHART_W,row)],fill=(34,197,94,fa))
        lw=3 if glowing else 1
        ga=int(pulse(t,2)*150+100) if glowing else 80
        d.line([(CHART_X,y),(CHART_X+CHART_W,y)],fill=(34,197,94,ga),width=lw)
        d.text((CHART_X+20,y-26),'LONG POWER  49',font=FBM,fill=(34,197,94,210))
        d.text((CHART_X+CHART_W+16,y-10),'49',font=FBM,fill=(34,197,94,230))
    if scene>=5:
        y=py(68)
        a=int(pulse(t,2.5)*90+60)
        for row in range(y-16,y+1):
            fa=int(a*(1-(y-row)/17))
            d.line([(CHART_X,row),(CHART_X+CHART_W,row)],fill=(239,68,68,fa))
        ga=int(pulse(t,2.5)*160+110)
        d.line([(CHART_X,y),(CHART_X+CHART_W,y)],fill=(239,68,68,ga),width=3)
        d.text((CHART_X+20,y-26),'SHORT POWER  68',font=FBM,fill=(239,68,68,210))
        d.text((CHART_X+CHART_W+16,y-10),'68',font=FBM,fill=(239,68,68,230))
    composite(img,ov)

def draw_sd_boxes(img,scene):
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    if scene>=2:
        x1,x2=cx(8,N),cx(12,N); y1,y2=py(50.8),py(48.4)
        d.rectangle([x1,y1,x2,y2],fill=(34,197,94,22),outline=(34,197,94,100),width=1)
    if scene>=5:
        x1,x2=cx(21,N),cx(24,N); y1,y2=py(69.0),py(67.2)
        d.rectangle([x1,y1,x2,y2],fill=(239,68,68,22),outline=(239,68,68,100),width=1)
    composite(img,ov)

def draw_projection(img,scene,t):
    if scene!=4: return
    pts=[(cx(15,N),py(55.2)),(cx(16,N),py(57.5)),(cx(17,N),py(60.5)),
         (cx(18,N),py(63.5)),(cx(19,N),py(66.0)),(cx(20,N),py(68.0))]
    s4_start=(16/N)*DURATION
    prog=clamp((t-s4_start)/4.0,0,1)
    n_segs=len(pts)-1; drawn=prog*n_segs
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for i in range(1,len(pts)):
        if i-1>=drawn: break
        frac=clamp(drawn-(i-1),0,1)
        ex=int(pts[i-1][0]+(pts[i][0]-pts[i-1][0])*frac)
        ey=int(pts[i-1][1]+(pts[i][1]-pts[i-1][1])*frac)
        d.line([pts[i-1],(ex,ey)],fill=(245,158,11,60),width=8)
        d.line([pts[i-1],(ex,ey)],fill=(245,158,11,200),width=3)
    for j,p in enumerate(pts):
        if j/n_segs>prog: break
        d.ellipse([p[0]-5,p[1]-5,p[0]+5,p[1]+5],fill=(245,158,11,190))
    composite(img,ov,blur=2)
    ov2=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d2=ImageDraw.Draw(ov2)
    for i in range(1,len(pts)):
        if i-1>=drawn: break
        frac=clamp(drawn-(i-1),0,1)
        ex=int(pts[i-1][0]+(pts[i][0]-pts[i-1][0])*frac)
        ey=int(pts[i-1][1]+(pts[i][1]-pts[i-1][1])*frac)
        d2.line([pts[i-1],(ex,ey)],fill=(245,158,11,230),width=2)
    composite(img,ov2)

def draw_candles(img,ci):
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for i in range(ci+1):
        prog=ease_out(candle_prog[i])
        if prog<=0: continue
        c=CANDLES[i]; o,h,l,cl=c[0],c[1],c[2],c[3]
        bull=cl>=o
        color=GREEN if bull else RED
        glow_c=(34,197,94,70) if bull else (239,68,68,70)
        x=cx(i,N); cw=max(10,int(CHART_W/(N-1)*0.52))
        bt=py(max(o,cl)); bb=py(min(o,cl))
        bh=max(3,bb-bt); mid=(bt+bb)//2
        scaled_ht=max(2,int(bh*prog))
        sbyt=mid-scaled_ht//2
        swt=int(mid-(mid-py(h))*prog); swb=int(mid+(py(l)-mid)*prog)
        # glow body
        d.rectangle([x-cw//2-4,sbyt-4,x+cw//2+4,sbyt+scaled_ht+4],fill=(*color,50))
        # wick
        d.line([(x,swt),(x,swb)],fill=(*color,170),width=2)
        # body
        d.rectangle([x-cw//2,sbyt,x+cw//2,sbyt+scaled_ht],fill=(*color,230))
    composite(img,ov,blur=1)
    ov2=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d2=ImageDraw.Draw(ov2)
    for i in range(ci+1):
        prog=ease_out(candle_prog[i])
        if prog<=0: continue
        c=CANDLES[i]; o,h,l,cl=c[0],c[1],c[2],c[3]
        bull=cl>=o; color=GREEN if bull else RED
        x=cx(i,N); cw=max(10,int(CHART_W/(N-1)*0.52))
        bt=py(max(o,cl)); bb=py(min(o,cl))
        bh=max(3,bb-bt); mid=(bt+bb)//2
        scaled_ht=max(2,int(bh*prog)); sbyt=mid-scaled_ht//2
        swt=int(mid-(mid-py(h))*prog); swb=int(mid+(py(l)-mid)*prog)
        d2.line([(x,swt),(x,swb)],fill=(*color,175),width=2)
        d2.rectangle([x-cw//2,sbyt,x+cw//2,sbyt+scaled_ht],fill=(*color,240))
    composite(img,ov2)

def draw_kinetic(img,ci,t):
    if ci<1: return
    color=(168,85,247)
    pts=[(cx(i,N),py(KINETIC[i])) for i in range(ci+1)]
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for i in range(1,len(pts)):
        d.line([pts[i-1],pts[i]],fill=(*color,30),width=12)
    composite(img,ov,blur=8)
    ov2=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d2=ImageDraw.Draw(ov2)
    for i in range(1,len(pts)):
        d2.line([pts[i-1],pts[i]],fill=(*color,210),width=3)
    composite(img,ov2)
    # Leading dot
    lx,ly=pts[-1]; r=int(8+pulse(t,3)*4)
    ov3=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d3=ImageDraw.Draw(ov3)
    d3.ellipse([lx-r-6,ly-r-6,lx+r+6,ly+r+6],fill=(*color,40))
    d3.ellipse([lx-r,ly-r,lx+r,ly+r],fill=(*color,220))
    composite(img,ov3,blur=3)
    ov4=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d4=ImageDraw.Draw(ov4)
    d4.ellipse([lx-5,ly-5,lx+5,ly+5],fill=(*color,255))
    composite(img,ov4)
    ov5=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d5=ImageDraw.Draw(ov5)
    d5.text((lx+16,ly-28),'KINETIC STOP',font=FBM,fill=(*color,210))
    composite(img,ov5)

def draw_signal(img,sig_type,ci,t):
    x=cx(ci,N); c=CANDLES[ci]
    is_buy=sig_type=='BUY'; color=GREEN if is_buy else RED
    sig_y=py(c[2])+20 if is_buy else py(c[1])-20
    tip=sig_y+16 if is_buy else sig_y-16
    lbl_y=sig_y+52 if is_buy else sig_y-56
    pa=int(pulse(t,2.5)*30+200)
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    if is_buy:
        d.polygon([(x,tip),(x-14,tip-28),(x+14,tip-28)],fill=(*color,pa))
    else:
        d.polygon([(x,tip),(x-14,tip+28),(x+14,tip+28)],fill=(*color,pa))
    d.rounded_rectangle([x-36,lbl_y-22,x+36,lbl_y+10],radius=6,
                        fill=(*color,40),outline=(*color,160),width=2)
    bx=d.textbbox((0,0),sig_type,font=FBM); tw=bx[2]-bx[0]
    d.text((x-tw//2,lbl_y-18),sig_type,font=FBM,fill=(*color,255))
    composite(img,ov,blur=2)
    ov2=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d2=ImageDraw.Draw(ov2)
    if is_buy:
        d2.polygon([(x,tip),(x-14,tip-28),(x+14,tip-28)],fill=(*color,240))
    else:
        d2.polygon([(x,tip),(x-14,tip+28),(x+14,tip+28)],fill=(*color,240))
    d2.rounded_rectangle([x-36,lbl_y-22,x+36,lbl_y+10],radius=6,
                         fill=(*color,45),outline=(*color,185),width=1)
    d2.text((x-tw//2,lbl_y-18),sig_type,font=FBM,fill=(*color,255))
    composite(img,ov2)

def draw_particles(img):
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for p in PARTS:
        r=p['r']; a=int(p['a']*255)
        x,y=int(p['x']),int(p['y'])
        d.ellipse([x-r,y-r,x+r,y+r],fill=(*p['col'],a))
    composite(img,ov)

def draw_top_bar(img,ci,scene,t):
    c=CANDLES[max(0,ci)]; price=f"{c[3]:.2f}"
    bull=c[3]>=c[0]; chg=f"{abs((c[3]-c[0])/c[0]*100):.2f}%"
    pcolor=GREEN if bull else RED
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for row in range(64):
        t2=row/64; r=int(lerp(10,20,t2)); g=int(lerp(5,5,t2)); b=int(lerp(25,35,t2))
        d.line([(0,row),(IW,row)],fill=(r,g,b,247))
    d.line([(0,64),(IW,64)],fill=(124,58,237,50),width=1)
    # Logo
    for row in range(16,52):
        t2=(row-16)/36; r2=int(lerp(124,190,t2)); g2=int(lerp(58,24,t2)); b2=int(lerp(237,93,t2))
        d.line([(28,row),(68,row)],fill=(r2,g2,b2,255))
    d.text((36,24),'T',font=FBL,fill=(255,255,255,255))
    d.text((80,22),'TUX S&D + KINETIC',font=FBM,fill=(233,213,255,255))
    d.line([(400,20),(400,48)],fill=(124,58,237,80),width=1)
    d.text((420,22),'CRYPTO / 1H',font=FM,fill=(167,139,250,220))
    d.line([(630,20),(630,48)],fill=(124,58,237,80),width=1)
    # Price glow
    g_ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    gd=ImageDraw.Draw(g_ov)
    gd.text((650,18),price,font=FBL,fill=(*pcolor,255))
    composite(img,g_ov.filter(ImageFilter.GaussianBlur(4)))
    d.text((650,18),price,font=FBL,fill=(*pcolor,255))
    arrow='▲' if bull else '▼'
    d.text((756,26),f'{arrow} {chg}',font=FS,fill=(*pcolor,210))
    d.text((IW-140,24),f'SCENE {scene}/6',font=FS,fill=(167,139,250,120))
    lp=int(pulse(t,3)*80+160); r2=int(6+pulse(t,3)*3)
    d.ellipse([IW-70-r2,32-r2,IW-70+r2,32+r2],fill=(34,197,94,lp))
    d.text((IW-58,26),'LIVE',font=FB,fill=(34,197,94,200))
    composite(img,ov)

def draw_dashboard(img,scene,ci,t):
    bull=3<=scene<=5; bear=scene in(1,6)
    trend='BULLISH' if bull else 'BEARISH' if bear else 'NEUTRAL'
    tc=GREEN if bull else RED if bear else GOLD
    score=clamp(55+(ci-12)*4,0,85) if bull else clamp(70-ci*3,15,100) if bear else 40
    rsi=clamp(58-ci*4,22,100) if ci<=11 else clamp(28+(ci-12)*5,22,72) if ci<=20 else 65
    rsi_l='OVERSOLD' if rsi<30 else 'OVERBOUGHT' if rsi>70 else 'NEUTRAL'
    rsi_c=GREEN if rsi<30 else RED if rsi>70 else GOLD
    rev=f"{clamp(45+(ci-21)*11,0,78)}%" if scene>=5 else f"{clamp((ci-12)*5,0,45)}%" if scene>=3 else '—'
    resist='DETECTED' if scene>=5 else '—'; res_c=RED if scene>=5 else (107,114,128)
    DX,DY,DW,DH=28,IH-304,400,276
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    d.rounded_rectangle([DX,DY,DX+DW,DY+DH],radius=10,fill=(10,10,20,235),outline=(124,58,237,90),width=2)
    d.rounded_rectangle([DX,DY,DX+DW,DY+44],radius=10,fill=(80,20,130,160))
    dp=int(pulse(t,2.5)*60+160); r2=int(6+pulse(t,2.5)*2)
    d.ellipse([DX+18-r2,DY+22-r2,DX+18+r2,DY+22+r2],fill=(*tc,dp))
    d.text((DX+34,DY+10),'TUX S&D + KINETIC',font=FBM,fill=(233,213,255,240))
    rows=[('TREND',trend,tc),
          ('SCORE',f'{round(score)}/100',GREEN if score>60 else RED if score<40 else GOLD),
          ('RSI',f'{round(rsi)} {rsi_l}',rsi_c),
          ('REVERSAL',rev,LBLUE),
          ('RESISTANCE',resist,res_c)]
    for ri,(label,val,col) in enumerate(rows):
        ry=DY+52+ri*40
        d.line([(DX+8,ry-2),(DX+DW-8,ry-2)],fill=(124,58,237,30),width=1)
        d.text((DX+16,ry+4),label,font=FB,fill=(167,139,250,180))
        bx=d.textbbox((0,0),val,font=FBM); vw=bx[2]-bx[0]
        d.text((DX+DW-16-vw,ry+2),val,font=FBM,fill=(*col,240))
    bY=DY+DH-18
    d.rounded_rectangle([DX+16,bY-6,DX+DW-16,bY],radius=4,fill=(255,255,255,15))
    bw=int((clamp(score,0,100)/100)*(DW-32))
    if bw>0: d.rounded_rectangle([DX+16,bY-6,DX+16+bw,bY],radius=4,fill=(*tc,180))
    composite(img,ov)

def draw_scene_label(img,scene,t):
    labels={
        1:('BEARISH TREND','Kinetic Stop trailing above price',RED),
        2:('LONG POWER LEVEL','Price at 49 — RSI Oversold',GREEN),
        3:('BUY SIGNAL CONFIRMED','Kinetic Stop flips below price',GREEN),
        4:('RALLY IN PROGRESS','Target projection activated',GOLD),
        5:('SHORT POWER LEVEL','Resistance detected at 68',RED),
        6:('SELL SIGNAL','Rejection from Short Power Level',PINK),
    }
    if scene not in labels: return
    title,sub,col=labels[scene]
    lw=540; lh=76; lx=IW//2-lw//2; ly=76
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    d.rounded_rectangle([lx,ly,lx+lw,ly+lh],radius=10,fill=(10,10,20,218),outline=(*col,90),width=2)
    bx=d.textbbox((0,0),title,font=FBM); tw=bx[2]-bx[0]
    d.text((IW//2-tw//2,ly+10),title,font=FBM,fill=(*col,245))
    bx2=d.textbbox((0,0),sub,font=FB); sw=bx2[2]-bx2[0]
    d.text((IW//2-sw//2,ly+42),sub,font=FB,fill=(200,180,255,160))
    composite(img,ov)

def draw_ambient(img,scene,t):
    cols={1:(239,68,68),2:(34,197,94),3:(34,197,94),4:(245,158,11),5:(239,68,68),6:(190,24,93)}
    col=cols.get(scene,(100,100,100))
    a=int(pulse(t,.7)*12+14)
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for r in range(600,0,-30):
        fa=int(a*(1-r/600)*.5)
        d.ellipse([IW//2-r,IH//2-r,IW//2+r,IH//2+r],fill=(*col,fa))
    composite(img,ov.filter(ImageFilter.GaussianBlur(40)))

def draw_scan_line(img,t):
    y=int((t*140)%IH)
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    d.line([(0,y),(IW,y)],fill=(124,58,237,22),width=3)
    composite(img,ov.filter(ImageFilter.GaussianBlur(1)))

def draw_branding(img):
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov)
    for row in range(IH-36,IH):
        t2=(row-(IH-36))/36
        d.line([(0,row),(IW,row)],fill=(124,58,237,int(lerp(35,20,t2))))
    d.line([(0,IH-36),(IW,IH-36)],fill=(124,58,237,50),width=1)
    txt='TUX S&D + KINETIC  ·  Supply & Demand  ·  Kinetic Trailing Stop  ·  Power Levels'
    bx=d.textbbox((0,0),txt,font=FB); tw=bx[2]-bx[0]
    d.text((IW//2-tw//2,IH-28),txt,font=FB,fill=(167,139,250,140))
    composite(img,ov)

def draw_corner_brackets(img):
    ov=Image.new('RGBA',(IW,IH),(0,0,0,0))
    d=ImageDraw.Draw(ov); s=28; off=72; col=(124,58,237,115)
    d.line([(0,off+s),(0,off),(s,off)],fill=col,width=2)
    d.line([(IW-s,off),(IW,off),(IW,off+s)],fill=col,width=2)
    d.line([(0,IH-s-36),(0,IH-36),(s,IH-36)],fill=col,width=2)
    d.line([(IW-s,IH-36),(IW,IH-36),(IW,IH-s-36)],fill=col,width=2)
    composite(img,ov)

# ── RENDER ─────────────────────────────────────────────────────────────────────
print(f"Rendering {FRAMES} frames ({IW}x{IH}) @ {FPS}fps → {OUT_PATH}")

ffmpeg_exe = get_ffmpeg_exe()
cmd = [
    ffmpeg_exe, '-y',
    '-f', 'rawvideo', '-vcodec', 'rawvideo',
    '-s', f'{IW}x{IH}', '-pix_fmt', 'rgb24',
    '-r', str(FPS), '-i', 'pipe:0',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'fast',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-b:v', '10000k', '-maxrate', '12000k', '-bufsize', '18000k',
    OUT_PATH
]
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)

for frame_idx in range(FRAMES):
    t  = frame_idx / FPS
    ci = min(int((t/DURATION)*(N-1)), N-1)
    scene = get_scene(ci)
    update_candle_progs(ci)
    step_particles()

    img = Image.new('RGBA', (IW,IH), (0,0,0,255))
    draw_bg(img)
    draw_ambient(img,scene,t)
    draw_particles(img)
    draw_scan_line(img,t)
    draw_grid(img)
    draw_sd_boxes(img,scene)
    draw_power_zone(img,scene,t)
    draw_projection(img,scene,t)
    draw_candles(img,ci)
    draw_kinetic(img,ci,t)
    if ci>=7 and scene<=3:  draw_signal(img,'SELL',7,t)
    if ci>=15 and 3<=scene<=5: draw_signal(img,'BUY',15,t)
    if ci>=24 and scene>=6: draw_signal(img,'SELL',24,t)
    draw_top_bar(img,ci,scene,t)
    draw_scene_label(img,scene,t)
    draw_dashboard(img,scene,ci,t)
    draw_branding(img)
    draw_corner_brackets(img)

    proc.stdin.write(img.convert('RGB').tobytes())

    if frame_idx%30==0:
        pct=int(frame_idx/FRAMES*100)
        bar='█'*int(pct/5)+'░'*(20-int(pct/5))
        print(f"\r  [{bar}] {pct}%  frame {frame_idx}/{FRAMES}", end='', flush=True)

proc.stdin.close()
proc.wait()
print(f"\n✓  Done → {OUT_PATH}")
