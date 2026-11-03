"""
按 MC 原版结构生成像素纹理（PNG base64 data URI）

调色板来自用户提供的官方贴图取样：
  石头  #484848 ~ #888888，主色 #606060
  草    #305028 ~ #507840，主色 #406838
  泥土  #382018 ~ #906848，主色 #584028

为什么用 PNG 而不是 SVG：SVG 每个色块要一个 <rect>，字符数上万；
同样画面存成 16×16 PNG 只有几百字节，base64 后更小。
"""
import base64
import io
import os
import random

from PIL import Image

random.seed(20261103)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'styles', 'textures.js')

STONE = [
    '#4a4a4a', '#525252', '#5a5a5a', '#606060',
    '#666666', '#6e6e6e', '#767676', '#7e7e7e', '#888888',
]
STONE_W = [3, 4, 6, 9, 10, 9, 7, 5, 2]

GRASS_TOP = ['#385c30', '#406838', '#46703c', '#4b7840', '#507840']
GRASS_DARK = ['#2f4c28', '#345428', '#3a5c30']
DIRT = ['#3d2818', '#483020', '#523626', '#584028', '#5f452c', '#6b4e32', '#785038', '#8a6242']
DIRT_W = [3, 5, 7, 9, 8, 7, 5, 2]


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_data_uri(img, fmt='PNG', colors=32):
    """
    转 base64 data URI。

    顺带量化到 32 色调色板：这两张纹理本身只有 9~17 种颜色，
    调色板 PNG 能完整保留所有颜色，体积却只有 RGB PNG 的三分之一
    （128×128 石头：29.8 KB -> 9.9 KB）。
    """
    buf = io.BytesIO()
    rgb = img.convert('RGB')
    q = rgb.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)
    q.save(buf, format=fmt, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f'data:image/png;base64,{b64}'


def gen_stone(w=128, h=128):
    """
    128×128，卡片上以 background-size:32px 平铺。

    为什么不是 16×16：
    220px 宽的卡片上 16×16 要平铺 13 次，同一个图案重复太密，
    肉眼能看出规整的网格。64×64 每次重复覆盖 32px，只重复 7 次，
    而且单块内容更丰富，规律感基本消失。
    在 devicePixelRatio=2 的屏幕上 32px 正好对应 64 物理像素，1:1 不缩放。

    结构上也不是逐像素雪花噪点，而是「成块的明暗斑」：
    先铺细噪点打底，再盖若干 4~9px 的斑块，形成石块颗粒感。
    """
    img = Image.new('RGBA', (w, h))
    px = img.load()

    # 1. 细噪点打底
    for y in range(h):
        for x in range(w):
            c = random.choices(STONE, weights=STONE_W, k=1)[0]
            px[x, y] = hex2rgb(c) + (255,)

    # 2. 叠斑块，制造石块感（斑块随纹理一起放大，视觉密度不变）
    for _ in range(70):
        bw = random.choice([4, 5, 6, 7, 9])
        bh = random.choice([4, 5, 6, 7])
        bx = random.randrange(0, w - bw + 1)
        by = random.randrange(0, h - bh + 1)
        c = random.choices(STONE, weights=STONE_W, k=1)[0]
        rgb = hex2rgb(c) + (255,)
        for yy in range(by, by + bh):
            for xx in range(bx, bx + bw):
                px[xx, yy] = rgb

    return img


def gen_grass(w=64, h=128):
    """
    64×128 而非 32×64。

    草方块在卡片上是拉伸显示（background-size:100% 100%），
    220px 的卡片上 32×64 会被放大 6.9×/3.4×，像素块被拉成矩形，看起来发糊。
    提到 96×192 后放大倍数是 2.3×/1.15×，颗粒保持锐利。

    草带深度按比例放大到 8~16 行，边缘依旧逐列随机，避免出现直边。
    """
    img = Image.new('RGBA', (w, h))
    px = img.load()

    # 每列草皮深度，参差不齐。
    # 128 高的纹理里占 14~26 行（11%~20%），接近原版草方块侧面的比例
    depth = []
    for _ in range(w):
        r = random.random()
        if r < 0.25:
            depth.append(14)
        elif r < 0.6:
            depth.append(18)
        elif r < 0.85:
            depth.append(22)
        else:
            depth.append(26)

    for x in range(w):
        for y in range(h):
            if y < depth[x]:
                if y == 0:
                    # 最上一行提亮，模拟受光
                    c = random.choice(GRASS_TOP[:2] + ['#5a8a48'])
                elif y >= depth[x] - 2:
                    # 草与泥土交界压暗
                    c = random.choice(GRASS_DARK)
                else:
                    c = random.choice(GRASS_TOP)
            else:
                c = random.choices(DIRT, weights=DIRT_W, k=1)[0]
            px[x, y] = hex2rgb(c) + (255,)
    return img


if __name__ == '__main__':
    stone_uri = to_data_uri(gen_stone())
    grass_uri = to_data_uri(gen_grass())

    js = f'''/**
 * MC 像素纹理（PNG base64 data URI）
 * 由 tools/gen-textures.py 生成，颜色取自官方贴图取样
 * 不要手动编辑，改调色板后重跑脚本
 */

export const STONE_TEX =
  '{stone_uri}';

export const GRASS_TEX =
  '{grass_uri}';
'''
    with open(OUT, 'w', encoding='utf-8', newline='\n') as fp:
        fp.write(js)
    print('written:', OUT)
    print('stone uri len:', len(stone_uri))
    print('grass uri len:', len(grass_uri))
