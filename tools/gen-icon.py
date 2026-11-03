"""
生成微应用图标：等距视角的草方块

严格 MC 风格的三条约束：
  1. 逐像素绘制，不用抗锯齿 —— 边缘必须是硬阶梯
  2. 有限色板，每个面 3~4 种色阶随机分布
  3. 1px 纯黑描边

前一版用多边形射线法判定面的归属，边界像素的浮点误差导致
交界处漏出黑线、四角出现缺口。这一版改成解析式：

  六边形轮廓  用分段线性式描述
  顶面菱形    用 |dx|/a + |dy|/b <= 1 描述
  左右面分界  直接用 x < 中心 硬切

这样任意像素只会落入唯一区域，不存在"哪个面都不算"的缝隙。

绘制顺序：外层六边形整块填黑（描边），再画内缩 1px 的三面。
最后用最近邻放大到 200×200。
"""
import os
import random

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'icon.png')
PREVIEW = os.path.join(ROOT, '_preview')

S = 32
FINAL = 200
random.seed(20261103)

# ---- 色板：比卡片背景版更亮，图标在深色列表里要跳得出来 ----
GRASS = ['#7cbd6b', '#6aa85a', '#8fd07d', '#5f9b50']
DIRT_LEFT = ['#8b6d4b', '#7a5f3f', '#967750', '#6f5638']
DIRT_RIGHT = ['#6b5238', '#5c452e', '#785038', '#54402b']
BLACK = (0, 0, 0, 255)

# ---- 几何参数 ----
CX = 16.0          # 水平中心
TOP_Y = 1.0        # 上顶点
MID_Y = 9.0        # 顶面菱形中心高度（也是左右面上沿）
BOT_Y = 31.0       # 下顶点
HALF_W = 13.5      # 半宽


def in_hexagon(x, y, shrink=0.0):
    """六边形轮廓的解析式，shrink 用于内缩出描边"""
    half = HALF_W - shrink
    t = TOP_Y + shrink
    b = BOT_Y - shrink
    if y < t or y > b:
        return False
    if y < MID_Y:
        # 上半：菱形收窄
        span = half * (y - t) / (MID_Y - t)
    elif y > BOT_Y - 7.0:
        # 下半：菱形收窄
        span = half * (b - y) / (b - (BOT_Y - 7.0))
    else:
        span = half
    return abs(x - CX) <= span


def in_top_diamond(x, y, shrink=0.0):
    """顶面菱形：|dx|/a + |dy|/b <= 1"""
    a = HALF_W - shrink
    b = 7.0 - shrink
    if a <= 0 or b <= 0:
        return False
    return abs(x - CX) / a + abs(y - MID_Y) / b <= 1.0


def hex_rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def build():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    px = img.load()

    for y in range(S):
        for x in range(S):
            cx, cy = x + 0.5, y + 0.5

            # 外轮廓内先整块填黑
            if not in_hexagon(cx, cy):
                continue
            px[x, y] = BLACK

            # 内缩 2px 画三个面，露出一圈黑边（缩到 40px 时也看得见）
            if not in_hexagon(cx, cy, shrink=2.0):
                continue

            # 顶面内缩小一些，避免绿区被吃掉太多
            if in_top_diamond(cx, cy, shrink=1.4):
                px[x, y] = hex_rgb(random.choice(GRASS))
            elif cx < CX:
                px[x, y] = hex_rgb(random.choice(DIRT_LEFT))
            else:
                px[x, y] = hex_rgb(random.choice(DIRT_RIGHT))

    return img


if __name__ == '__main__':
    small = build()
    big = small.resize((FINAL, FINAL), Image.NEAREST)
    big.save(OUT)
    print(f'  icon.png 已生成: {FINAL}x{FINAL}  {os.path.getsize(OUT)/1024:.1f} KB')

    os.makedirs(PREVIEW, exist_ok=True)
    small.resize((S * 8, S * 8), Image.NEAREST).save(os.path.join(PREVIEW, 'icon_x8.png'))
    small.resize((40, 40), Image.NEAREST).save(os.path.join(PREVIEW, 'icon_40px.png'))
    print('  预览图已输出到 _preview/')
