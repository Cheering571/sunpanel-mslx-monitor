# 皮肤系统实现

本文记录五套皮肤的架构、踩过的坑，以及新增皮肤时的做法。

---

## 架构

### 一、皮肤由 class 决定

`src/api/mslx.js`：

```javascript
export function skinClass(skin) {
  if (skin === 'mc' || skin === 'mc-stone') return 'skin-mc skin-stone';
  if (skin === 'mc-grass') return 'skin-mc skin-grass';
  if (skin === 'neu') return 'skin-neu';
  if (skin === 'glass') return 'skin-glass';
  return '';   // default 不挂任何类
}
```

组件根元素统一套用：

```javascript
<div class="wrap ${skinClass(this.skin)} ${fontClass(this.font)} ${darkMode ? 'dark' : ''}">
```

### 二、颜色全部走 CSS 变量

皮肤的规则里**不写死颜色**，只引用变量：

```css
.skin-glass {
  --glass-text: #ffffff;
  --glass-page-bg: rgba(20, 23, 34, 0.58);
  color: var(--glass-text);
}

.skin-glass.page {
  background-color: var(--glass-page-bg) !important;
}
```

好处是：切换皮肤 = 换一套变量，所有规则自动跟随，不用给每个元素写一遍。

### 三、每套皮肤导出 CSSResult

```javascript
// src/styles/mcSkin.js
export const mcSkin = [base, textures];   // 数组，因为纹理需要 unsafeCSS 拼接

// src/styles/neuSkin.js
export const neuSkin = css`...`;          // 单个 CSSResult
```

组件里按顺序展开：

```javascript
static styles = [...mcSkin, neuSkin, glassSkin, css`/* 组件自己的 */`];
```

**后面的覆盖前面的**（同特异性时）。组件自己的规则放最后，优先级最高。

---

## 圆角陷阱

这是本项目最隐蔽的一个 bug，值得单独记下来。

### 现象

卡片皮肤的 `border-radius: 20px` 设了，但四角总有白色缺口，像被切掉一块。

### 原因

Sun-Panel 的卡片容器是：

```css
.item-card-content { overflow: hidden; border-radius: 20px; }
```

而组件自己的样式里有：

```css
.wrap { border-radius: 8px; }
```

`.wrap` 和 `.skin-mc` **特异性相同**，都是单个类选择器 `(0,1,0)`，而组件样式在 `static styles` 数组里排在皮肤之后 —— 所以 **`8px` 赢了**。

于是：

```
父级按 20px 裁切
我的元素只圆到 8px（更方）
8px 弧线到 20px 弧线之间那圈 → 露出父级的半透明底
视觉上 = 四角被切
```

### 修法

三层一起做：

```css
/* 1. 组件自己的 .wrap 改成 20px */
.wrap { border-radius: 20px; }

/* 2. :host 也补上，宿主元素本身也参与裁剪链 */
:host { border-radius: 20px; }

/* 3. 皮肤里用更高特异性锁死，防止再被覆盖 */
.wrap.skin-mc {          /* (0,2,0)，压过 .wrap (0,1,0) */
  border-radius: 20px;
  clip-path: inset(0 round 20px);
}
```

`clip-path: inset(0 round 20px)` 让元素**先把自己裁成 20px 圆角**，再交给父级，两层轮廓完全重合，消除亚像素误差。

### 边框也别用 border

`border` 画在元素外沿，正好压在父级圆角的裁剪线上，四个角会被切掉一截。改用内部绘制的 inset 阴影：

```css
.skin-mc {
  border: none;
  box-shadow: inset 0 0 0 2px #000000,                      /* 黑边 */
              inset 3px 3px 0 1px rgba(255,255,255,0.22),   /* 左上高光 */
              inset -3px -3px 0 1px rgba(0,0,0,0.45);       /* 右下暗边 */
}
```

---

## 各皮肤要点

### 我的世界 · 石头 / 草方块

**纹理是运行时生成的 PNG**。

最初用 SVG 内联（`<rect>` 拼像素块），但石头 13.5 KB、草方块 **104 KB** —— 每个色块一个节点，字符数爆炸。改存 PNG 后：

| | SVG | PNG base64 |
|---|---|---|
| 石头 | 13,522 字符 | **850** |
| 草方块 | 104,764 字符 | **5,846** |

生成脚本 `tools/gen-textures.py`：

```python
# 调色板来自官方贴图取样
STONE = ['#4a4a4a', ..., '#888888']
GRASS_TOP = ['#385c30', ..., '#507840']
DIRT = ['#3d2818', ..., '#8a6242']

# 草方块侧面：每列草皮深度随机 3~6 行，边缘参差不齐
depth = [3 if r < .25 else 4 if r < .6 else 5 if r < .85 else 6 for r in randoms]
```

**草方块不平铺**：

```css
.skin-grass {
  background-size: 100% 100%;   /* 整张拉伸，草带只出现一次 */
  background-repeat: no-repeat;
}
```

如果用 `background-size: 16px` 平铺，草带每 16px 重复一次，卡片上会变成横条纹。

**颜色来源**：用 Pillow 对官方贴图采样统计主色，而不是凭肉眼估。第一次凭感觉用了 `#8b8b8b` 当石头色，比真实值亮了 40%，用户一眼看出不还原。

### 拟态（Neumorphism）

核心是**双向阴影**：

```css
/* 凸起 */
box-shadow: 6px 6px 12px #A3B1C6, -6px -6px 12px #FFFFFF;

/* 凹陷 */
box-shadow: inset 4px 4px 8px #A3B1C6, inset -4px -4px 8px #FFFFFF;
```

**但卡片本体的外阴影会被父级裁掉**（`overflow: hidden`），所以卡片改用斜向渐变 + 内阴影模拟凸起：

```css
.skin-neu {
  background: linear-gradient(145deg, #f0f3f8 0%, #d3dae4 100%);
  box-shadow: inset 2px 2px 6px rgba(255,255,255,0.9),
              inset -2px -2px 6px rgba(163,177,198,0.45);
}
```

卡片内部的按钮和面板不受裁剪影响，用标准拟态阴影。

### 液态玻璃

三层叠加：

```css
.skin-glass {
  /* 1. 背景模糊 */
  backdrop-filter: blur(24px) saturate(180%) brightness(1.08);

  /* 2. 半透明 + 斜向高光 */
  background-image: linear-gradient(140deg,
    rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 30%,
    rgba(255,255,255,0.02) 55%, rgba(255,255,255,0.09) 100%);
  background-color: rgba(205, 225, 255, 0.14);

  /* 3. 边缘高光 */
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.72),   /* 上沿反光 */
              inset 0 -1px 0 rgba(255,255,255,0.1);     /* 下沿弱反光 */
}
```

**`saturate(180%)` 是关键** —— 苹果玻璃的标志性特点是透过玻璃的颜色更鲜艳。

#### 悬停：不要只加白

错误的做法：

```css
:hover { background-color: rgba(255,255,255,0.26); }   /* 14% → 26% */
```

白色透明度越高，叠在深色底上**越灰**。加得越多越难看。

正确做法是**提亮背后的壁纸**：

```css
:hover {
  backdrop-filter: blur(24px) saturate(210%) brightness(1.45);   /* 1.08 → 1.45 */
  background-color: rgba(205, 225, 255, 0.18);
  box-shadow: ..., 0 0 22px rgba(150, 195, 255, 0.3);           /* 冷蓝外发光 */
}
```

亮度来自背后的光，而不是叠加的颜料。

#### 悬停不要做过渡

```css
/* 错误：逐帧重算模糊，鼠标移开时亮度回落极其拖沓 */
transition: backdrop-filter 0.2s ease;

/* 正确：瞬时切换 */
transition: none;
```

`backdrop-filter` 每变一帧，浏览器就要把背后区域重新模糊一遍。0.2 秒内重算几十次，渲染跟不上，视觉上就是"慢慢变灰"的尾巴。

---

## 文字对比度

所有配色都经过 WCAG 相对亮度公式校验（`tools/check-contrast.py`）。

```
contrast = (L1 + 0.05) / (L2 + 0.05)
L = 0.2126*R + 0.7152*G + 0.0722*B   （线性化后）
```

判定线：正文 ≥ 4.5（AA），大字 ≥ 3.0。

### 状态色要按皮肤分层

状态色原本是硬编码的：

```javascript
STATUS = { 0: { text: '未启动', color: '#8c8c8c' } }
```

以**内联 style** 写进 DOM，会压过所有样式表。结果「未启动」在深色玻璃上对比度只有 4.2，几乎看不见。

改成 CSS 变量 + 回退：

```javascript
0: { text: '未启动', color: 'var(--st-stopped, #8c8c8c)' }
```

**关键结论**：同一个状态色不可能同时适配深色卡片和浅色面板。实测最差对比度只有 1.0。所以每个皮肤要分两层定义：

```css
/* 卡片是深底 → 亮色状态字 */
.skin-mc.skin-stone {
  --st-stopped: #f0f0f0;
  --st-running: #a6ffa6;
}

/* 页面里的面板是浅底 → 深色状态字 */
.skin-mc.page.skin-stone {
  --st-stopped: #3f3f3f;
  --st-running: #14521f;
}
```

最终全部组合 ≥ 4.5，最低是石头卡片上的「运行中」4.50。

---

## 字体

### 注入方式

`@font-face` 必须在 `document.head` 里定义，写在组件的 `static styles` 里不生效：

```javascript
export function ensureFontFaces(staticPath) {
  if (document.getElementById('mslx-mc-fonts')) return;   // 只注入一次
  const style = document.createElement('style');
  style.id = 'mslx-mc-fonts';
  style.textContent = `
    @font-face {
      font-family: 'MSLXUnifont';
      src: url('${staticPath}/fonts/unifont-subset.ttf') format('truetype');
      font-display: swap;
    }`;
  document.head.appendChild(style);
}
```

### 字体栈

Mojangles 只含 ASCII，中文必须回退：

```css
.font-mojangles {
  font-family: 'MSLXMojangles', 'MSLXUnifont', Consolas, monospace;
}
```

两者都是像素字体，混排不违和。

### 加载后要重新测量

字体异步加载，加载前后字宽完全不同。地址行的自适应逻辑必须在字体就绪后重跑：

```javascript
document.fonts.ready.then(() => this._fitAddress());
```

否则会出现"装好时正常，刷新后溢出"。

---

## 实时切换

### 问题

皮肤存在 dataNode 里，但卡片只在自己初始化时读一次：

```javascript
// _bootstrap()，只跑一次
this.skin = this._cfg.skin || 'default';
```

配置页保存后没有任何通知，已渲染的卡片内存里还是旧值 —— 必须刷新页面。

### 方案：window 自定义事件

```javascript
// src/utils/skinBus.js
const EVT = 'mslx:skin-changed';

export function emitSkinChange(skin, font) {
  window.dispatchEvent(new CustomEvent(EVT, { detail: { skin, font } }));
}

export function onSkinChange(handler) {
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}
```

微应用是同页面里的 Web Component，**共享同一个 `window`**，事件直接送达。

卡片订阅：

```javascript
connectedCallback() {
  this._unsubSkin = onSkinChange((d) => {
    if (d.skin !== undefined) this.skin = d.skin;   // Lit 属性，自动重渲染
    if (d.font !== undefined) this.font = d.font;
  });
}

onDisconnected() {
  this._unsubSkin?.();
  this._unsubSkin = null;
}
```

配置页在下拉框 `@change` 时直接广播 —— **不用点保存就能预览效果**。

### 限制

配置页和卡片如果在**不同的 `window`**（独立弹窗或 iframe），事件传不过去。兜底方案是 `BroadcastChannel` 或轮询重读配置。

---

## 新增一套皮肤

1. 在 `src/styles/` 新建 `xxxSkin.js`，导出 `css` 结果
2. 定义一套 `--xxx-*` 变量，规则里只引用变量
3. 覆盖这组选择器（参照现有皮肤）：
   - `.skin-xxx` 卡片本体
   - `.skin-xxx.dark` 深色变体
   - `.skin-xxx.page` / `.container` 整页
   - `.skin-xxx .btn` / `.pbtn` / `.tab` 按钮
   - `.skin-xxx .inst` / `.prow` / `.form-section` 面板
   - `.skin-xxx .styled-input` 输入框
   - 文字：`.nm` / `.mv` / `.ml` / `.addrline` 等
   - 状态色：`--st-stopped` / `--st-running` / `--st-starting`
4. `api/mslx.js` 的 `SKINS` 加一项，`skinClass()` 加分支
5. 四个组件的 `static styles` 数组里引入
6. 跑 `tools/check-contrast.py` 校验配色
7. 递增版本号，`npm run pack`

**别忘了几条硬约束**：

- 圆角必须是 20px，与父级 `.item-card-content` 对齐
- 边框用 inset 阴影，不要用 `border`
- 不要给 `backdrop-filter` 加 transition
- 状态色要分卡片层和页面层两套
