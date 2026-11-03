"""压缩文档截图：在保证可读的前提下减小体积

GitHub README 首屏会加载所有图片，overview.png 原本 311 KB 太重。
统一转 WebP（GitHub 支持），视觉无损但体积小很多。
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'docs', 'images')

# 屏幕截图适合有损压缩，quality 88 肉眼无差别
QUALITY = 88

for name in sorted(os.listdir(IMG)):
    if not name.lower().endswith('.png'):
        continue
    src = os.path.join(IMG, name)
    before = os.path.getsize(src) / 1024

    im = Image.open(src).convert('RGBA')
    # 转 RGB（WebP 不需要 alpha 时更小）
    if im.getextrema()[3][0] == 255:
        im = im.convert('RGB')

    dst = os.path.join(IMG, name[:-4] + '.webp')
    im.save(dst, 'WEBP', quality=QUALITY, method=6)

    after = os.path.getsize(dst) / 1024
    ratio = (1 - after / before) * 100 if before else 0
    print(f'  {name:<22} {before:7.1f} KB -> {after:6.1f} KB  (-{ratio:.0f}%)  {im.size[0]}x{im.size[1]}')

print()
total_before = sum(os.path.getsize(os.path.join(IMG, f)) for f in os.listdir(IMG) if f.endswith('.png'))
total_after = sum(os.path.getsize(os.path.join(IMG, f)) for f in os.listdir(IMG) if f.endswith('.webp'))
print(f'  PNG  合计 {total_before/1024:.1f} KB')
print(f'  WebP 合计 {total_after/1024:.1f} KB')
