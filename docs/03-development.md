# 开发指南

## 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Sun-Panel V2 微应用（Web Component + Shadow DOM） |
| 视图 | [Lit](https://lit.dev/) 3.x（`lit-html` + `lit-element`） |
| 构建 | Vite 5 |
| 打包 | adm-zip（自定义 `build/pack.js`） |
| SDK | `@sun-panel/micro-app` |

---

## 项目结构

```
config/
  app.config.js         微应用清单：ID、版本、权限、网络白名单、dataNode
  components.config.js  组件声明：页面、卡片、支持的尺寸

src/
  main.js               入口：注册所有自定义元素
  api/mslx.js           MSLX 接口封装 + 配置读写 + 状态定义
  components/
    widget.js           卡片，7 种尺寸各一套布局
    mainPage.js         主页面，实例列表
    playersPage.js      玩家管理页，4 个标签
    widgetConfig.js     配置页
  styles/
    mcSkin.js           我的世界皮肤（石头 / 草方块）
    neuSkin.js          拟态皮肤
    glassSkin.js        液态玻璃皮肤
    textures.js         运行时生成的 PNG 纹理（base64）
    fonts.js            字体注入与切换
  utils/skinBus.js      皮肤变更广播

tools/
  gen-textures.py       从调色板生成像素纹理
  subset-fonts.py       字体子集化
  analyze_tex.py        从图片提取主色
  check-contrast.py     皮肤配色 WCAG 校验
  check-status-colors.py 状态色对比度校验
```

---

## 开发调试

```bash
npm run dev
```

Vite 会启动本地服务，但**微应用依赖 Sun-Panel 注入的 `spCtx`**，脱离平台无法完整运行。

实际调试方式：

1. `npm run pack`
2. 上传到 Sun-Panel
3. 打开 DevTools → 选中 `#shadow-root (open)` → 检查样式

因为 Shadow DOM 是 open 的，可以直接用元素检查器看到内部结构。

### 版本号要跟着改

每次改动后改 `config/app.config.js` 的 `version`，否则浏览器可能复用旧缓存，让人误以为代码没生效。

---

## SDK 关键 API

### 网络请求

**必须**走平台代理，否则会被 CORS 拦住：

```javascript
const res = await this.spCtx.api.network.request({
  url: `${baseUrl}/api/ping`,
  method: 'GET',
  headers: { 'x-user-token': token },
  body: JSON.stringify(payload),   // 注意：必须是字符串
});
```

`body` 传对象会失败，必须 `JSON.stringify`。

### 定时器

用平台的，不要用原生 `setInterval`：

```javascript
this._timerId = this.spCtx.api.timer.setInterval(fn, 30000);
this.spCtx.api.timer.clearInterval(this._timerId);
```

原生定时器在组件卸载后不会被平台清理，会泄漏。

### 数据存储

```javascript
// 读
const data = await this.spCtx.api.dataNode.user.getByKeys('mslx', ['skin', 'font']);

// 写
await this.spCtx.api.dataNode.user.setByKeys('mslx', { skin: 'glass' });
```

需要在 `app.config.js` 里声明节点：

```javascript
dataNodes: {
  mslx: { scope: 'user', isPublic: false },
}
```

没声明会报 `node mslx permission not configured`。

### 打开页面

```javascript
this.spCtx.api.window.open({
  componentName: 'mslx-players',
  title: '玩家管理',
  customParam: { instanceId: 9 },
});
```

### 资源路径

```javascript
this.spCtx.staticPath   // 形如 /micro_app/cheering-mslx-monitor_xxx
```

拼接字体、图片等静态资源时用这个前缀。

---

## 组件生命周期

Sun-Panel 的基类在标准 Lit 生命周期上包了一层：

```javascript
class MyPage extends SunPanelPageElement {
  onInitialized(params) {  /* spCtx 已就绪 */ }
  onDisconnected() {       /* 组件卸载，清理定时器和监听 */ }
}
```

`spCtx` 在 `onInitialized` 里才可用，`connectedCallback` 里可能还是 `undefined`。

---

## 卡片尺寸自适应

### 不要相信 gridSize

同一个 `2x4` 在不同卡片布局下可能是宽卡也可能是高卡。所以用 `ResizeObserver` 拿真实像素：

```javascript
connectedCallback() {
  this._ro = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect;
    this._size = { w: Math.round(width), h: Math.round(height) };
    this.requestUpdate();
  });
  this._ro.observe(this);
}
```

### 缩放因子

```javascript
_metrics() {
  const { w, h } = this._size;
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  const ratio = w / h;
  const wide = ratio > 1.5;    // 宽卡
  const tall = ratio < 0.72;   // 高卡
  const base = (wide || tall) ? max * 0.45 + min * 0.55 : min;
  const s = Math.min(2.0, Math.max(1.1, base / 145));
  return { w, h, s, wide, tall, ratio, base };
}
```

`--s` 变量再驱动所有字号和间距：

```css
.mv { font-size: calc(13px * var(--s, 1)); }
```

---

## 构建与打包

```bash
npm run build    # 只构建，产物在 dist/
npm run pack     # 构建 + 打 zip
```

`build/pack.js` 会把 `dist/` 递归打进 zip，排除 `.map`。

### 一个坑：文件末尾不能有分号或换行

`build/build.js` 编译语言文件时用 `.replace(/;$/, '')` 去尾分号。如果文件本身以换行结尾，这个替换不会生效，产物会变成 `...};` 导致语法错误。

写 `locales/*.js` 时确保最后一行直接以 `}` 结束，后面不带换行。

### 改配置文件要注意编码

Windows PowerShell 的 `Set-Content` 默认可能不是 UTF-8，会把 `config/app.config.js` 里的中文写成乱码。

用 .NET 写入：

```powershell
$c = [System.IO.File]::ReadAllText($path)
[System.IO.File]::WriteAllText($path, $c, (New-Object System.Text.UTF8Encoding($false)))
```

---

## 样式隔离

微应用运行在 Shadow DOM 里，好处是样式不会污染宿主，代价是：

- **`@font-face` 要注入到 `document.head`**，否则字体加载不到
- **`:host` 的样式优先级低于外部**，不能依赖它做布局约束
- **外部 CSS 选择器进不来**，只能靠组件内部的 `static styles`

### static styles 是数组

```javascript
static styles = [
  ...mcSkin,     // 皮肤的通用规则
  neuSkin,
  glassSkin,
  css`/* 组件专属规则 */`,
];
```

**注意顺序**：后面的同名规则会覆盖前面的。组件自身规则写在最后，优先级最高。

这个特性曾经导致一个隐蔽 bug：组件里 ` .wrap { border-radius: 8px }` 悄悄覆盖了皮肤的 `20px`，表现是卡片四角被切。详见 [皮肤系统文档](04-skins.md#圆角陷阱)。

---

## 测试脚本

`test/` 下是 Node 脚本形式的断言测试：

```bash
node test/run-test.mjs     # 34 项断言：接口封装、格式化函数
node test/wrap-test.mjs    # 11 项断言：布局计算
```

不是完整的测试框架，但能在改动核心逻辑后快速回归。

---

## 代码风格

ESLint 配置在 `eslint.config.js`：

```bash
npm run lint       # 检查
npm run lint:fix   # 自动修复
```

---

## 提交前检查清单

- [ ] `npm run lint` 通过
- [ ] `npm run pack` 成功，zip 体积无异常增长
- [ ] `config/app.config.js` 的 `version` 已递增
- [ ] 新增样式在各皮肤下不互相污染
- [ ] 改动了文字颜色的话，跑一遍 `tools/check-contrast.py`
