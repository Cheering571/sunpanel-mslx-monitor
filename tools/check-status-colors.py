"""为每个皮肤挑选达标的状态色（未启动 / 运行中 / 启动中）"""


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(rgb):
    r, g, b = rgb
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def cr(f, b):
    l1, l2 = lum(hex2rgb(f)), lum(hex2rgb(b))
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


def blend(fg, bg, a):
    f, b = hex2rgb(fg), hex2rgb(bg)
    return '#%02x%02x%02x' % tuple(round(f[i] * a + b[i] * (1 - a)) for i in range(3))


# 各皮肤的关键背景
BG = {
    'default-浅': '#ffffff',
    'default-深': '#1a1a1a',
    'mc-stone 卡片': '#6a6a6a',
    'mc-stone 面板': '#b6b6b6',
    'mc-stone 页面': '#242424',
    'mc-grass 卡片(泥土)': '#4a3a28',
    'mc-grass 卡片(草)': '#406838',
    'mc-grass 面板': '#97c187',
    'mc-grass 页面': '#26361f',
    'neu 卡片': '#e0e5ec',
    'neu 面板': '#e6eaf0',
    'glass 卡片': blend('#3a3f4a', '#1a1a1a', 0.5),
    'glass 页面': blend('#141722', '#1a1a1a', 0.58),
}

CAND = {
    'stopped(深底)': ['#8c8c8c', '#b8b8b8', '#c8d4e8', '#e0e0e0', '#e8e8e8'],
    'stopped(浅底)': ['#8c8c8c', '#6a6a6a', '#5a5a5a', '#4a5568'],
    'running(深底)': ['#52c41a', '#6ee787', '#8dffa8', '#a6ffa6'],
    'running(浅底)': ['#52c41a', '#1a7f37', '#1a6b2b', '#2f8f2f'],
    'starting(深底)': ['#faad14', '#ffd166', '#ffd98a', '#ffe08a'],
    'starting(浅底)': ['#faad14', '#8a5a00', '#6f5000', '#7a5500'],
}

print('=== 每个候选色在各背景上的对比度 ===\n')
for group, opts in CAND.items():
    print(f'--- {group} ---')
    for c in opts:
        line = f'  {c}'
        worst = 99
        for name, bg in BG.items():
            v = cr(c, bg)
            line += f'  {v:.1f}'
            worst = min(worst, v)
        print(line + f'   [最差 {worst:.2f}]')
    print()

print('=== 背景表 ===')
for k, v in BG.items():
    print(f'  {k:<22} {v}')
