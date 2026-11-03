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
    img = Image.new('RGBA', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            c = random.choices(STONE, weights=STONE_W, k=1)[0]
            px[x, y] = hex2rgb(c) + (255,)
    return img


def gen_grass(w=32, h=64):
    """侧面：顶部草带（边缘参差 3~6 行）+ 下方泥土"""
    img = Image.new('RGBA', (w, h))
    px = img.load()

    depth = []
    for _ in range(w):
        r = random.random()
        depth.append(3 if r < 0.25 else 4 if r < 0.6 else 5 if r < 0.85 else 6)

    for x in range(w):
        for y in range(h):
            if y < depth[x]:
                if y == 0:
                    c = random.choice(GRASS_TOP[:2] + ['#5a8a48'])
                elif y >= depth[x] - 1:
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
