"""
字体子集化工具

原始字体太大（Unifont 5MB / Mojangles 15MB），
只保留微应用实际需要的字符，压缩到几十~几百 KB。

字符集构成：
  1. ASCII 32-126
  2. GB2312 一级常用汉字（3755 个）
  3. 源码 / 语言文件里出现的所有字符（界面文案）
  4. 用户实际的服务器名（避免运行时缺字）
"""
import os
import sys
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIRS = [os.path.join(ROOT, 'src'), os.path.join(ROOT, 'locales')]
OUT_DIR = os.path.join(ROOT, 'public', 'fonts')

# 用户实际存在的服务器名（保证不出现豆腐块）
EXTRA_TEXT = '无限奇妙商店物语元素觉醒卓越德雷马尔神化CDP运行中未启动在线内存端口备份停止重启启动玩家历史白名单封禁异常'


def build_charset():
    chars = set(chr(c) for c in range(32, 127))

    # GB2312 一级汉字
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0x100):
            try:
                chars.add(bytes([hi, lo]).decode('gb2312'))
            except Exception:
                pass

    # 源码 / 语言文件里的字符
    for d in SRC_DIRS:
        if not os.path.isdir(d):
            continue
        for root, _, files in os.walk(d):
            for fn in files:
                if not fn.endswith(('.js', '.json', '.css')):
                    continue
                try:
                    with open(os.path.join(root, fn), 'r', encoding='utf-8') as fp:
                        chars.update(fp.read())
                except Exception:
                    pass

    chars.update(EXTRA_TEXT)
    chars.discard('\n')
    chars.discard('\r')
    chars.discard('\t')
    return chars


def do_subset(src, dst, chars, label):
    if not os.path.exists(src):
        print(f'  ! 源文件不存在: {src}')
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    text_path = os.path.join(OUT_DIR, '_charset.txt')
    with open(text_path, 'w', encoding='utf-8') as fp:
        fp.write(''.join(sorted(chars)))

    args = [
        src,
        f'--output-file={dst}',
        f'--text-file={text_path}',
        '--layout-features=*',
        '--drop-tables+=DSIG',
        '--no-hinting',
        '--desubroutinize',
        '--recalc-bounds',
    ]
    subset.main(args)
    orig = os.path.getsize(src) / 1024
    new = os.path.getsize(dst) / 1024
    print(f'  {label}: {orig:.0f} KB -> {new:.0f} KB')
    try:
        os.remove(text_path)
    except Exception:
        pass


if __name__ == '__main__':
    chars = build_charset()
    print(f'字符集大小: {len(chars)}')
    print('子集化:')
    do_subset(
        r'D:\Downloads\Edge\unifont-17.0.04.ttf',
        os.path.join(OUT_DIR, 'unifont-subset.ttf'),
        chars,
        'Unifont',
    )
    do_subset(
        r'D:\Downloads\Edge\Mojangles.ttf',
        os.path.join(OUT_DIR, 'mojangles-subset.ttf'),
        chars,
        'Mojangles',
    )
