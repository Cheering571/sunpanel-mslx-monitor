from PIL import Image
from collections import Counter
import os

paths = {
    "grass": r"C:\Users\Cheering\.dsh\attachments\v1\objects\9c\9c5bb8d6299d76b54e6fd72b702ad91e2ad1a97f73044644e8c3b6b4ae8f87b8",
    "stone": r"C:\Users\Cheering\.dsh\attachments\v1\objects\3b\3be41dd9f445372ac685b97f9afca7bcd9d6b78beb7d88c9a21fead3b4ff7789",
}

for name, p in paths.items():
    if not os.path.exists(p):
        print(name, "missing")
        continue
    im = Image.open(p).convert("RGBA")
    w, h = im.size
    print(f"\n=== {name} {w}x{h} ===")
    cnt = Counter()
    px = im.load()
    step = max(1, min(w, h) // 150)
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            cnt[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
    total = sum(cnt.values()) or 1
    for (r, g, b), c in cnt.most_common(14):
        print(f"  #{r:02x}{g:02x}{b:02x}  {100*c/total:5.1f}%")

    # 草方块：单独看上半部和下半部的颜色
    if name == "grass":
        print("  --- 上部 25% 区域主色 ---")
        top = Counter()
        for y in range(0, max(1, h // 4), 2):
            for x in range(0, w, 2):
                r, g, b, a = px[x, y]
                if a < 128:
                    continue
                top[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
        for (r, g, b), c in top.most_common(8):
            print(f"    #{r:02x}{g:02x}{b:02x}")
        print("  --- 下部 50% 区域主色 ---")
        bot = Counter()
        for y in range(h // 2, h, 2):
            for x in range(0, w, 2):
                r, g, b, a = px[x, y]
                if a < 128:
                    continue
                bot[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
        for (r, g, b), c in bot.most_common(8):
            print(f"    #{r:02x}{g:02x}{b:02x}")
