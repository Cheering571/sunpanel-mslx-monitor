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


def to_data_uri(img, fmt='PNG'):
    buf = io.BytesIO()
    img.save(buf, format=fmt, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f'data:image/png;base64,{b64}'


def gen_stone(w=16, h=16):
    """16×16，卡片上以 background-size:16px 平铺，做到 1:1 不缩放"""
    img = Image.new('RGBA', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            c = random.choices(STONE, weights=STONE_W, k=1)[0]
            px[x, y] = hex2rgb(c) + (255,)
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

    # 每列草皮深度（8~16 行），参差不齐
    depth = []
    for _ in range(w):
        r = random.random()
        if r < 0.25:
            depth.append(8)
        elif r < 0.6:
            depth.append(11)
        elif r < 0.85:
            depth.append(13)
        else:
            depth.append(16)

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
