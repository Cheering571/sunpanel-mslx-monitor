"""WCAG 对比度检查：把当前皮肤里所有前景/背景组合算一遍"""


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(c):
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(h):
    r, g, b = hex2rgb(h)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast(fg, bg):
    l1, l2 = luminance(fg), luminance(bg)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


def grade(c):
    # WCAG AA：正文 4.5，大字 3.0
    if c >= 7:
        return 'AAA', '优'
    if c >= 4.5:
        return 'AA ', '良'
    if c >= 3:
        return 'AA-L', '大字勉强'
    return 'FAIL', '不合格'


CASES = [
    # (说明, 前景, 背景)
    ('[石头] 卡片主文字', '#ffffff', '#6a6a6a'),
    ('[石头] 卡片次文字', '#d0d0d0', '#6a6a6a'),
    ('[石头] 状态-运行中', '#55ff55', '#6a6a6a'),
    ('[石头] 状态-停止',   '#ff5555', '#6a6a6a'),
    ('[石头] 状态-警告',   '#ffff55', '#6a6a6a'),
    ('[石头] 页面背景文字', '#e2e2e2', '#242424'),
    ('[石头] 页面次要文字', '#c0c0c0', '#242424'),
    ('[石头] 面板文字',     '#303030', '#b6b6b6'),
    ('[石头] 面板次要',     '#4a4a4a', '#b6b6b6'),
    ('[石头] 按钮文字',     '#ffffff', '#8b8b8b'),
    ('[石头] 按钮-禁用',    '#9a9a9a', '#6f6f6f'),

    ('[草] 卡片主文字',   '#ffffff', '#4a3a28'),
    ('[草] 草区白字',     '#ffffff', '#406838'),
    ('[草] 状态-运行中',  '#55ff55', '#406838'),
    ('[草] 状态-停止',    '#ff5555', '#4a3a28'),
    ('[草] 状态-警告',    '#ffff55', '#406838'),
    ('[草] 页面背景文字', '#e2e2e2', '#26361f'),
    ('[草] 页面次要文字', '#c0c0c0', '#26361f'),
    ('[草] 面板文字',     '#1b3d14', '#97c187'),
    ('[草] 面板次要',     '#2d5a24', '#97c187'),
    ('[草] 按钮文字',     '#ffffff', '#8b8b8b'),
]

print(f"{'场景':<22}{'前景':<10}{'背景':<10}{'对比度':>7}  {'等级':<6}{'评价'}")
print('-' * 78)
bad = []
for name, fg, bg in CASES:
    c = contrast(fg, bg)
    g, note = grade(c)
    flag = '  <-- 需调整' if c < 4.5 else ''
    print(f'{name:<22}{fg:<10}{bg:<10}{c:>7.2f}  {g:<6}{note}{flag}')
    if c < 4.5:
        bad.append((name, fg, bg, c))

print()
print('不达标数量:', len(bad))
