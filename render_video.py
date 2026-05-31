"""
TUX S&D + KINETIC — Cinematic Chart Animation
Renders 960x540 @ 30fps → MP4 using Pillow + imageio-ffmpeg
"""

import math, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio
from imageio_ffmpeg import get_ffmpeg_exe

# ── Config ──────────────────────────────────────────────────────────────────
W, H   = 960, 540
FPS    = 30
DURATION = 24          # seconds
FRAMES   = FPS * DURATION
OUT_PATH = "tux_kinetic_animation.mp4"

CHART_X, CHART_Y = 60, 32
CHART_W, CHART_H = 820, 460
PRICE_MIN, PRICE_MAX = 43.0, 73.0

# ── Helpers ──────────────────────────────────────────────────────────────────
def py(price):
    return int(CHART_Y + CHART_H * (1 - (price - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)))

def cx(i, total):
    return int(CHART_X + (i / (total - 1)) * CHART_W)

def lerp(a, b, t):
    return a + (b - a) * t

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def ease_out(t):
    return 1 - (1 - t) ** 3

def pulse(t, speed=3.0):
    return 0.5 + 0.5 * math.sin(t * speed)

# ── Data ─────────────────────────────────────────────────────────────────────
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
    for i in range(len(SCENE_BREAKS)-1, 0, -1):
        if ci >= SCENE_BREAKS[i-1]:
            return min(6, i)
    return 1

# ── Particle system ──────────────────────────────────────────────────────────
rng = random.Random(42)
PARTS = [{
    'x': rng.random()*W, 'y': rng.random()*H,
    'vx': (rng.random()-.5)*.28, 'vy': (rng.random()-.5)*.28,
    'r': rng.random()*1.4+.4,
    'a': rng.random()*.32+.04,
    'col': (124,58,237) if rng.random()>.5 else (190,24,93),
} for _ in range(55)]

def step_particles():
    for p in PARTS:
        p['x'] = (p['x'] + p['vx']) % W
        p['y'] = (p['y'] + p['vy']) % H

# ── Color helpers ────────────────────────────────────────────────────────────
GREEN  = (34,197,94)
RED    = (239,68,68)
PURPLE = (168,85,247)
DPURP  = (124,58,237)
PINK   = (190,24,93)
GOLD   = (245,158,11)
LBLUE  = (167,139,250)
WHITE  = (233,213,255)

def rgba(rgb, a):
    return (rgb[0], rgb[1], rgb[2], int(a*255))

def blend(base_img, overlay_img):
    return Image.alpha_composite(base_img.convert('RGBA'), overlay_img.convert('RGBA'))

# ── Glow helper (draw on an RGBA layer and blur) ────────────────────────────
def make_glow_layer(draw_fn, size=(W,H), blur=8):
    layer = Image.new('RGBA', size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    draw_fn(d)
    return layer.filter(ImageFilter.GaussianBlur(blur))

# ── Font loading ─────────────────────────────────────────────────────────────
try:
    FONT_SM  = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 9)
    FONT_MD  = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 11)
    FONT_LG  = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 14)
    FONT_XL  = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 20)
    FONT_BD  = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 9)
    FONT_BDMD= ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 11)
    FONT_BDLG= ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 14)
    FONT_BDXL= ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 20)
    FONT_BDXX= ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', 28)
except:
    FONT_SM=FONT_MD=FONT_LG=FONT_XL=FONT_BD=FONT_BDMD=FONT_BDLG=FONT_BDXL=FONT_BDXX=ImageFont.load_default()

# ── Per-candle animation progress ────────────────────────────────────────────
candle_prog = [0.0]*N

def update_candle_progs(ci):
    for i in range(ci+1):
        candle_prog[i] = min(1.0, candle_prog[i] + 0.055)

# ── DRAW FUNCTIONS ────────────────────────────────────────────────────────────

def draw_bg(img, d):
    # Dark gradient background
    for row in range(H):
        t = row/H
        r = int(lerp(10,6,t)); g = int(lerp(8,5,t)); b = int(lerp(18,14,t))
        d.line([(0,row),(W,row)], fill=(r,g,b,255))

def draw_grid(d):
    for price in [46,50,54,58,62,66,70]:
        y = py(price)
        d.line([(CHART_X,y),(CHART_X+CHART_W,y)], fill=(255,255,255,9), width=1)
        d.text((CHART_X+CHART_W+8, y-5), str(price), font=FONT_SM, fill=(167,139,250,115))

def draw_power_zone(img, scene, t):
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    # Long Power Level 49
    if scene >= 2:
        y = py(49); glowing = (scene==2)
        alpha = int(pulse(t,2)*60+40) if glowing else 30
        for row in range(y, y+10):
            a = int(alpha * (1-(row-y)/10))
            d.line([(CHART_X,row),(CHART_X+CHART_W,row)], fill=(34,197,94,a))
        lw = 2 if glowing else 1
        ga = int(pulse(t,2)*120+100) if glowing else 80
        d.line([(CHART_X,y),(CHART_X+CHART_W,y)], fill=(34,197,94,ga), width=lw)
        d.text((CHART_X+10, y-13), 'LONG POWER  49', font=FONT_BD, fill=(34,197,94,200))
        d.text((CHART_X+CHART_W+8, y-5), '49', font=FONT_BDMD, fill=(34,197,94,220))
    # Short Power Level 68
    if scene >= 5:
        y = py(68); glowing = True
        alpha = int(pulse(t,2.5)*70+50)
        for row in range(y-8, y+1):
            a = int(alpha * (1-(y-row)/9))
            d.line([(CHART_X,row),(CHART_X+CHART_W,row)], fill=(239,68,68,a))
        ga = int(pulse(t,2.5)*140+100)
        d.line([(CHART_X,y),(CHART_X+CHART_W,y)], fill=(239,68,68,ga), width=2)
        d.text((CHART_X+10, y-13), 'SHORT POWER  68', font=FONT_BD, fill=(239,68,68,200))
        d.text((CHART_X+CHART_W+8, y-5), '68', font=FONT_BDMD, fill=(239,68,68,220))
    img.alpha_composite(ov)

def draw_sd_boxes(img, scene):
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    if scene >= 2:
        x1,x2 = cx(8,N), cx(12,N)
        y1,y2 = py(50.8), py(48.4)
        d.rectangle([x1,y1,x2,y2], fill=(34,197,94,22), outline=(34,197,94,100), width=1)
    if scene >= 5:
        x1,x2 = cx(21,N), cx(24,N)
        y1,y2 = py(69.0), py(67.2)
        d.rectangle([x1,y1,x2,y2], fill=(239,68,68,22), outline=(239,68,68,100), width=1)
    img.alpha_composite(ov)

def draw_projection(img, scene, t):
    if scene != 4: return
    pts = [
        (cx(15,N), py(55.2)), (cx(16,N), py(57.5)),
        (cx(17,N), py(60.5)), (cx(18,N), py(63.5)),
        (cx(19,N), py(66.0)), (cx(20,N), py(68.0)),
    ]
    # progress over the 4 second scene 4 window
    # Scene 4 starts at candle 16 (~16/27*24 = 14.2s)
    scene4_start = (16/N)*DURATION
    prog = clamp((t - scene4_start) / 4.0, 0, 1)
    n_segs = len(pts)-1
    drawn = prog * n_segs

    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    for i in range(1, len(pts)):
        if i-1 >= drawn: break
        frac = clamp(drawn-(i-1), 0, 1)
        px2 = int(pts[i-1][0] + (pts[i][0]-pts[i-1][0])*frac)
        py2 = int(pts[i-1][1] + (pts[i][1]-pts[i-1][1])*frac)
        # glow
        d.line([pts[i-1],(px2,py2)], fill=(245,158,11,60), width=4)
        d.line([pts[i-1],(px2,py2)], fill=(245,158,11,200), width=2)
    for j,p in enumerate(pts):
        if j/n_segs > prog: break
        d.ellipse([p[0]-3,p[1]-3,p[0]+3,p[1]+3], fill=(245,158,11,180))
    img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(1)))
    ov2 = Image.new('RGBA', (W,H), (0,0,0,0))
    d2 = ImageDraw.Draw(ov2)
    for i in range(1, len(pts)):
        if i-1 >= drawn: break
        frac = clamp(drawn-(i-1), 0, 1)
        px2 = int(pts[i-1][0] + (pts[i][0]-pts[i-1][0])*frac)
        py2 = int(pts[i-1][1] + (pts[i][1]-pts[i-1][1])*frac)
        d2.line([pts[i-1],(px2,py2)], fill=(245,158,11,220), width=1)
    img.alpha_composite(ov2)

def draw_candles(img, ci):
    for i in range(ci+1):
        prog = ease_out(candle_prog[i])
        if prog <= 0: continue
        c = CANDLES[i]
        o,h,l,cl = c[0],c[1],c[2],c[3]
        bull = cl >= o
        color = GREEN if bull else RED
        glow_col = (34,197,94,80) if bull else (239,68,68,80)
        x = cx(i, N)
        cw = max(5, int(CHART_W/(N-1)*0.52))
        body_top = py(max(o,cl)); body_bot = py(min(o,cl))
        body_h = max(2, body_bot - body_top)
        wick_top = py(h); wick_bot = py(l)
        mid_y = (body_top+body_bot)//2
        # Scale Y around midpoint
        scaled_ht = max(1, int(body_h*prog))
        scaled_byt = mid_y - scaled_ht//2
        scaled_wt = int(mid_y - (mid_y-wick_top)*prog)
        scaled_wb = int(mid_y + (wick_bot-mid_y)*prog)

        ov = Image.new('RGBA', (W,H), (0,0,0,0))
        d = ImageDraw.Draw(ov)
        # Glow body
        d.rectangle([x-cw//2-2, scaled_byt-2, x+cw//2+2, scaled_byt+scaled_ht+2],
                    fill=glow_col)
        # Wick
        d.line([(x,scaled_wt),(x,scaled_wb)], fill=(*color,170), width=1)
        # Body
        d.rectangle([x-cw//2, scaled_byt, x+cw//2, scaled_byt+scaled_ht],
                    fill=(*color,220))
        img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(1)))
        ov2 = Image.new('RGBA', (W,H), (0,0,0,0))
        d2 = ImageDraw.Draw(ov2)
        d2.line([(x,scaled_wt),(x,scaled_wb)], fill=(*color,170), width=1)
        d2.rectangle([x-cw//2, scaled_byt, x+cw//2, scaled_byt+scaled_ht],
                     fill=(*color,235))
        img.alpha_composite(ov2)

def draw_kinetic(img, ci, t):
    if ci < 1: return
    scene = get_scene(ci)
    color = (168,85,247)

    ov_glow = Image.new('RGBA', (W,H), (0,0,0,0))
    ov_line = Image.new('RGBA', (W,H), (0,0,0,0))
    dg = ImageDraw.Draw(ov_glow)
    dl = ImageDraw.Draw(ov_line)

    pts = [(cx(i,N), py(KINETIC[i])) for i in range(ci+1)]
    for i in range(1, len(pts)):
        dg.line([pts[i-1],pts[i]], fill=(*color,35), width=6)
        dl.line([pts[i-1],pts[i]], fill=(*color,210), width=2)

    img.alpha_composite(ov_glow.filter(ImageFilter.GaussianBlur(5)))
    img.alpha_composite(ov_line)

    # Leading dot pulse
    lx, ly = pts[-1]
    r = int(4 + pulse(t,3)*2)
    ov_dot = Image.new('RGBA', (W,H), (0,0,0,0))
    dd = ImageDraw.Draw(ov_dot)
    dd.ellipse([lx-r-3,ly-r-3,lx+r+3,ly+r+3], fill=(*color,40))
    dd.ellipse([lx-r,ly-r,lx+r,ly+r], fill=(*color,230))
    img.alpha_composite(ov_dot.filter(ImageFilter.GaussianBlur(2)))
    ov_dot2 = Image.new('RGBA', (W,H), (0,0,0,0))
    dd2 = ImageDraw.Draw(ov_dot2)
    dd2.ellipse([lx-3,ly-3,lx+3,ly+3], fill=(*color,255))
    img.alpha_composite(ov_dot2)

    # Label
    ov_lbl = Image.new('RGBA', (W,H), (0,0,0,0))
    dl2 = ImageDraw.Draw(ov_lbl)
    dl2.text((lx+8, ly-14), 'KINETIC STOP', font=FONT_BD, fill=(*color,200))
    img.alpha_composite(ov_lbl)

def draw_signal(img, sig_type, ci, t):
    x = cx(ci, N)
    c = CANDLES[ci]
    is_buy = sig_type == 'BUY'
    color = GREEN if is_buy else RED
    signal_y = py(c[2])+10 if is_buy else py(c[1])-10
    arrow_tip = signal_y+8 if is_buy else signal_y-8
    label_y   = signal_y+26 if is_buy else signal_y-28
    pa = int(pulse(t,2.5)*30+200)

    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    # Arrow
    if is_buy:
        d.polygon([(x,arrow_tip),(x-7,arrow_tip-14),(x+7,arrow_tip-14)],
                  fill=(*color,pa))
    else:
        d.polygon([(x,arrow_tip),(x-7,arrow_tip+14),(x+7,arrow_tip+14)],
                  fill=(*color,pa))
    # Box
    d.rounded_rectangle([x-18,label_y-11,x+18,label_y+5], radius=3,
                        fill=(*color,40), outline=(*color,160), width=1)
    d.text((x-13,label_y-9), sig_type, font=FONT_BD, fill=(*color,240))
    img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(1)))
    ov2 = Image.new('RGBA', (W,H), (0,0,0,0))
    d2  = ImageDraw.Draw(ov2)
    if is_buy:
        d2.polygon([(x,arrow_tip),(x-7,arrow_tip-14),(x+7,arrow_tip-14)], fill=(*color,240))
    else:
        d2.polygon([(x,arrow_tip),(x-7,arrow_tip+14),(x+7,arrow_tip+14)], fill=(*color,240))
    d2.rounded_rectangle([x-18,label_y-11,x+18,label_y+5], radius=3,
                         fill=(*color,45), outline=(*color,180), width=1)
    d2.text((x-13,label_y-9), sig_type, font=FONT_BD, fill=(*color,255))
    img.alpha_composite(ov2)

def draw_particles(img):
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    for p in PARTS:
        r = p['r']; a = int(p['a']*255)
        x,y = int(p['x']), int(p['y'])
        d.ellipse([x-r,y-r,x+r,y+r], fill=(*p['col'],a))
    img.alpha_composite(ov)

def draw_top_bar(img, ci, scene, t):
    c = CANDLES[max(0,ci)]
    price = f"{c[3]:.2f}"
    bull  = c[3] >= c[0]
    chg   = f"{abs((c[3]-c[0])/c[0]*100):.2f}%"
    pcolor = GREEN if bull else RED

    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    # Bar bg
    for row in range(32):
        t2 = row/32
        r = int(lerp(10,20,t2)); g = int(lerp(5,5,t2)); b = int(lerp(25,35,t2))
        d.line([(0,row),(W,row)], fill=(r,g,b,247))
    d.line([(0,32),(W,32)], fill=(124,58,237,50), width=1)
    # Logo square
    for row in range(8,26):
        t2=(row-8)/18
        r2=int(lerp(124,190,t2)); g2=int(lerp(58,24,t2)); b2=int(lerp(237,93,t2))
        d.line([(14,row),(34,row)], fill=(r2,g2,b2,255))
    d.text((18,12), 'T', font=FONT_BDLG, fill=(255,255,255,255))
    d.text((40,11), 'TUX S&D + KINETIC', font=FONT_BDMD, fill=(233,213,255,255))
    d.line([(200,10),(200,24)], fill=(124,58,237,80), width=1)
    d.text((210,11), 'CRYPTO / 1H', font=FONT_MD, fill=(167,139,250,220))
    d.line([(315,10),(315,24)], fill=(124,58,237,80), width=1)
    # Price with glow
    glow_ov = Image.new('RGBA', (W,H), (0,0,0,0))
    gd = ImageDraw.Draw(glow_ov)
    gd.text((325,9), price, font=FONT_BDLG, fill=(*pcolor,255))
    img.alpha_composite(glow_ov.filter(ImageFilter.GaussianBlur(3)))
    d.text((325,9), price, font=FONT_BDLG, fill=(*pcolor,255))
    arrow = '▲' if bull else '▼'
    d.text((378,13), f'{arrow} {chg}', font=FONT_SM, fill=(*pcolor,210))
    # Scene
    d.text((W-70,12), f'SCENE {scene}/6', font=FONT_SM, fill=(167,139,250,120))
    # Live dot
    lp = int(pulse(t,3)*80+160)
    r2 = int(3+pulse(t,3)*1.5)
    d.ellipse([W-35-r2,16-r2,W-35+r2,16+r2], fill=(34,197,94,lp))
    d.text((W-29,11), 'LIVE', font=FONT_SM, fill=(34,197,94,200))
    img.alpha_composite(ov)

def draw_dashboard(img, scene, ci, t):
    bull  = 3 <= scene <= 5
    bear  = scene in (1,6)
    trend = 'BULLISH' if bull else 'BEARISH' if bear else 'NEUTRAL'
    tc    = GREEN if bull else RED if bear else GOLD
    score = clamp(55+(ci-12)*4,0,85) if bull else clamp(70-ci*3,15,100) if bear else 40
    rsi   = clamp(58-ci*4,22,100) if ci<=11 else clamp(28+(ci-12)*5,22,72) if ci<=20 else 65
    rsi_l = 'OVERSOLD' if rsi<30 else 'OVERBOUGHT' if rsi>70 else 'NEUTRAL'
    rsi_c = GREEN if rsi<30 else RED if rsi>70 else GOLD
    rev   = f"{clamp(45+(ci-21)*11,0,78)}%" if scene>=5 else f"{clamp((ci-12)*5,0,45)}%" if scene>=3 else '—'
    resist= 'DETECTED' if scene>=5 else '—'
    res_c = RED if scene>=5 else (107,114,128)

    DX,DY,DW,DH = 14, H-152, 200, 138
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    # Panel bg
    d.rounded_rectangle([DX,DY,DX+DW,DY+DH], radius=6,
                        fill=(10,10,20,235), outline=(124,58,237,90), width=1)
    # Header gradient
    for row in range(DY,DY+22):
        t3=(row-DY)/22
        r3=int(lerp(124,190,t3)); g3=int(lerp(58,24,t3)); b3=int(lerp(237,93,t3))
        for col in range(DX,DX+DW):
            pass  # done via rectangle below
    d.rounded_rectangle([DX,DY,DX+DW,DY+22], radius=6,
                        fill=(80,20,130,160))
    # Status dot
    dp = int(pulse(t,2.5)*60+160)
    r2 = int(3+pulse(t,2.5))
    d.ellipse([DX+9-r2,DY+11-r2,DX+9+r2,DY+11+r2], fill=(*tc,dp))
    d.text((DX+17,DY+5), 'TUX S&D + KINETIC', font=FONT_BD, fill=(233,213,255,240))
    # Rows
    rows = [
        ('TREND', trend, tc),
        ('SCORE', f'{round(score)}/100', GREEN if score>60 else RED if score<40 else GOLD),
        ('RSI', f'{round(rsi)} {rsi_l}', rsi_c),
        ('REVERSAL', rev, LBLUE),
        ('RESISTANCE', resist, res_c),
    ]
    for ri,(label,val,col) in enumerate(rows):
        ry = DY+28+ri*20
        d.line([(DX+4,ry-1),(DX+DW-4,ry-1)], fill=(124,58,237,30), width=1)
        d.text((DX+8,ry+2), label, font=FONT_SM, fill=(167,139,250,180))
        # right-align value
        bbox = d.textbbox((0,0), val, font=FONT_BD)
        vw = bbox[2]-bbox[0]
        d.text((DX+DW-8-vw, ry+2), val, font=FONT_BD, fill=(*col,240))
    # Score bar
    bY = DY+DH-9
    d.rounded_rectangle([DX+8,bY-3,DX+DW-8,bY], radius=2, fill=(255,255,255,15))
    bw = int((clamp(score,0,100)/100)*(DW-16))
    if bw > 0:
        d.rounded_rectangle([DX+8,bY-3,DX+8+bw,bY], radius=2, fill=(*tc,180))
    img.alpha_composite(ov)

def draw_scene_label(img, scene, t):
    labels = {
        1:('BEARISH TREND','Kinetic Stop trailing above price',RED),
        2:('LONG POWER LEVEL','Price at 49 — RSI Oversold',GREEN),
        3:('BUY SIGNAL CONFIRMED','Kinetic Stop flips below price',GREEN),
        4:('RALLY IN PROGRESS','Target projection activated',GOLD),
        5:('SHORT POWER LEVEL','Resistance detected at 68',RED),
        6:('SELL SIGNAL','Rejection from Short Power Level',PINK),
    }
    if scene not in labels: return
    title, sub, col = labels[scene]
    lw = 270; lh = 38; lx = W//2-lw//2; ly = 38
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    d.rounded_rectangle([lx,ly,lx+lw,ly+lh], radius=6,
                        fill=(10,10,20,218), outline=(*col,90), width=1)
    # title center
    bbox = d.textbbox((0,0), title, font=FONT_BDMD)
    tw = bbox[2]-bbox[0]
    d.text((W//2-tw//2, ly+5), title, font=FONT_BDMD, fill=(*col,245))
    # sub center
    bbox2 = d.textbbox((0,0), sub, font=FONT_SM)
    sw = bbox2[2]-bbox2[0]
    d.text((W//2-sw//2, ly+21), sub, font=FONT_SM, fill=(200,180,255,160))
    img.alpha_composite(ov)

def draw_ambient(img, scene, t):
    cols = {1:(239,68,68),2:(34,197,94),3:(34,197,94),4:(245,158,11),5:(239,68,68),6:(190,24,93)}
    col = cols.get(scene,(100,100,100))
    alpha = int(pulse(t,0.7)*10+12)
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    # Radial glow from center
    for r in range(300,0,-20):
        a = int(alpha*(1-r/300)*0.4)
        d.ellipse([W//2-r,H//2-r,W//2+r,H//2+r], fill=(*col,a))
    img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(30)))

def draw_scan_line(img, t):
    y = int((t*70)%H)
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    d.line([(0,y),(W,y)], fill=(124,58,237,28), width=2)
    img.alpha_composite(ov.filter(ImageFilter.GaussianBlur(1)))

def draw_corner_brackets(img):
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    s=14; off=36; col=(124,58,237,115)
    d.line([(0,off+s),(0,off),(s,off)], fill=col, width=1)
    d.line([(W-s,off),(W,off),(W,off+s)], fill=col, width=1)
    d.line([(0,H-s-18),(0,H-18),(s,H-18)], fill=col, width=1)
    d.line([(W-s,H-18),(W,H-18),(W,H-s-18)], fill=col, width=1)
    img.alpha_composite(ov)

def draw_branding(img):
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    d  = ImageDraw.Draw(ov)
    for row in range(H-18,H):
        t2=(row-(H-18))/18
        d.line([(0,row),(W,row)], fill=(124,58,237,int(lerp(35,20,t2))))
    d.line([(0,H-18),(W,H-18)], fill=(124,58,237,50), width=1)
    txt = 'TUX S&D + KINETIC  ·  Supply & Demand  ·  Kinetic Trailing Stop  ·  Power Levels'
    bbox = d.textbbox((0,0), txt, font=FONT_SM)
    tw = bbox[2]-bbox[0]
    d.text((W//2-tw//2, H-14), txt, font=FONT_SM, fill=(167,139,250,140))
    img.alpha_composite(ov)

# ── RENDER ────────────────────────────────────────────────────────────────────
print(f"Rendering {FRAMES} frames at {FPS}fps ({DURATION}s) → {OUT_PATH}")
print("This may take a few minutes…")

ffmpeg_exe = get_ffmpeg_exe()
writer = imageio.get_writer(
    OUT_PATH, fps=FPS,
    codec='libx264', quality=9,
    ffmpeg_log_level='error',
    ffmpeg_params=['-preset','fast','-pix_fmt','yuv420p',
                   '-crf','18','-b:v','8000k'],
    macro_block_size=None,
)

for frame_idx in range(FRAMES):
    t = frame_idx / FPS  # seconds
    prog = t / DURATION
    ci = min(int(prog * (N-1)), N-1)
    scene = get_scene(ci)

    update_candle_progs(ci)
    step_particles()

    img = Image.new('RGBA', (W,H), (0,0,0,255))
    d   = ImageDraw.Draw(img)
    draw_bg(img, d)
    draw_ambient(img, scene, t)
    draw_particles(img)
    draw_scan_line(img, t)
    draw_grid(d)
    draw_sd_boxes(img, scene)
    draw_power_zone(img, scene, t)
    draw_projection(img, scene, t)
    draw_candles(img, ci)
    draw_kinetic(img, ci, t)
    # Signals
    if ci >= 7 and scene <= 3:
        draw_signal(img, 'SELL', 7, t)
    if ci >= 15 and 3 <= scene <= 5:
        draw_signal(img, 'BUY', 15, t)
    if ci >= 24 and scene >= 6:
        draw_signal(img, 'SELL', 24, t)
    draw_top_bar(img, ci, scene, t)
    draw_scene_label(img, scene, t)
    draw_dashboard(img, scene, ci, t)
    draw_branding(img)
    draw_corner_brackets(img)

    writer.append_data(np.array(img.convert('RGB')))

    if frame_idx % 60 == 0:
        pct = int(frame_idx/FRAMES*100)
        bar = '█'*int(pct/5)+'░'*(20-int(pct/5))
        print(f"\r  [{bar}] {pct}% — frame {frame_idx}/{FRAMES}", end='', flush=True)

writer.close()
print(f"\n✓ Done → {OUT_PATH}")
