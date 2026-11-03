"""验证修正后的配色是否达标"""


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(c):
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(h):
    r, g, b = hex2rgb(h)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def cr(fg, bg):
    l1, l2 = lum(fg), lum(bg)
    if l1 < l2:
        l1, l2 = l2, l1
    return (l1 + 0.05) / (l2 + 0.05)


# 石头主题候选值
STONE = {
    'card_bg': '#6a6a6a',
    'text': '#ffffff',
    'text_dim': '#eaeaea',
    'text_mute': '#d8d8d8',
    'ok': '#7dff7d',
    'warn': '#ffff7d',
    'danger': '#ff8a8a',
    'page_bg': '#242424',
    'page_text': '#e8e8e8',
    'page_dim': '#c8c8c8',
    'panel_bg': '#b6b6b6',
    'panel_text': '#2b2b2b',
    'panel_dim': '#3f3f3f',
    'btn_bg': '#7a7a7a',
    'btn_text': '#ffffff',
    'btn_disabled_text': '#c8c8c8',
    'btn_disabled_bg': '#757575',
}

GRASS = {
    'card_bg': '#4a3a28',
    'grass_bg': '#3d5c33',
    'text': '#ffffff',
    'text_dim': '#f0f0f0',
    'text_mute': '#e0e0e0',
    'ok': '#8dff8d',
    'warn': '#ffff9d',
    'danger': '#ffa0a0',
    'page_bg': '#26361f',
    'page_text': '#e8e8e8',
    'page_dim': '#c8c8c8',
    'panel_bg': '#97c187',
    'panel_text': '#16330f',
    'panel_dim': '#264a1d',
    'btn_bg': '#7a7a7a',
    'btn_text': '#ffffff',
    'btn_disabled_text': '#c8c8c8',
    'btn_disabled_bg': '#757575',
}

CASES = [
    ('石头 card/text', STONE['text'], STONE['card_bg']),
    ('石头 card/dim', STONE['text_dim'], STONE['card_bg']),
    ('石头 card/mute', STONE['text_mute'], STONE['card_bg']),
    ('石头 card/ok', STONE['ok'], STONE['card_bg']),
    ('石头 card/warn', STONE['warn'], STONE['card_bg']),
    ('石头 card/danger', STONE['danger'], STONE['card_bg']),
    ('石头 page/text', STONE['page_text'], STONE['page_bg']),
    ('石头 page/dim', STONE['page_dim'], STONE['page_bg']),
    ('石头 panel/text', STONE['panel_text'], STONE['panel_bg']),
    ('石头 panel/dim', STONE['panel_dim'], STONE['panel_bg']),
    ('石头 btn/text', STONE['btn_text'], STONE['btn_bg']),
    ('石头 btn/disabled', STONE['btn_disabled_text'], STONE['btn_disabled_bg']),

    ('草 card/text(泥土)', GRASS['text'], GRASS['card_bg']),
    ('草 card/text(草)', GRASS['text'], GRASS['grass_bg']),
    ('草 card/ok(草)', GRASS['ok'], GRASS['grass_bg']),
    ('草 card/ok(泥土)', GRASS['ok'], GRASS['card_bg']),
    ('草 card/warn(草)', GRASS['warn'], GRASS['grass_bg']),
    ('草 card/danger(泥土)', GRASS['danger'], GRASS['card_bg']),
    ('草 card/danger(草)', GRASS['danger'], GRASS['grass_bg']),
    ('草 page/text', GRASS['page_text'], GRASS['page_bg']),
    ('草 page/dim', GRASS['page_dim'], GRASS['page_bg']),
    ('草 panel/text', GRASS['panel_text'], GRASS['panel_bg']),
    ('草 panel/dim', GRASS['panel_dim'], GRASS['panel_bg']),
    ('草 btn/text', GRASS['btn_text'], GRASS['btn_bg']),
]

print(f"{'case':<26}{'ratio':>7}  grade")
print('-' * 46)
fails = 0
for name, fg, bg in CASES:
    c = cr(fg, bg)
    g = 'AAA' if c >= 7 else 'AA' if c >= 4.5 else 'AA-L' if c >= 3 else 'FAIL'
    mark = ''
    if c < 4.5:
        fails += 1
        mark = '  <<<'
    print(f'{name:<26}{c:>7.2f}  {g}{mark}')
print()
print('below 4.5:', fails)
