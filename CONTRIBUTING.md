# 参与贡献

## 提 Issue

**Bug 反馈**请带上：

- Sun-Panel 版本、MSLX 版本
- 微应用版本（配置页顶部能看到，形如 `v1.10.1`）
- 浏览器和版本
- 复现步骤
- 浏览器控制台的报错（F12 → Console）

**如果是样式问题**，附一张 DevTools 右侧样式面板的截图最有用 —— 能直接看到哪个属性被谁覆盖了。

**功能建议**请说明使用场景，而不只是想要什么按钮。

---

## 提交代码

### 1. Fork 并克隆

```bash
git clone https://github.com/<your-name>/sunpanel-mslx-monitor.git
cd sunpanel-mslx-monitor
npm install
```

### 2. 建分支

```bash
git checkout -b feat/your-feature
```

### 3. 开发

```bash
npm run dev     # 预览
npm run lint    # 检查
```

### 4. 自测清单

- [ ] `npm run lint` 通过
- [ ] `npm run pack` 成功，zip 体积没有异常增长
- [ ] **递增 `config/app.config.js` 的 `version`**（否则浏览器会用缓存，看起来像没生效）
- [ ] 新增/改动的样式在五套皮肤下都检查一遍
- [ ] 改动了文字颜色的话，跑 `python tools/check-contrast.py`，确保对比度 ≥ 4.5
- [ ] 涉及卡片布局的改动，至少在 1×1、2×2、2×1 三种尺寸下验证

### 5. 提交

```bash
git add .
git commit -m "feat: 一句话说明改了什么"
git push origin feat/your-feature
```

然后在 GitHub 上开 Pull Request。

---

## 提交信息格式

参考 Conventional Commits：

| 前缀 | 用途 |
|---|---|
| `feat:` | 新功能 |
| `fix:` | 修复 bug |
| `style:` | 样式调整（不影响逻辑） |
| `docs:` | 文档 |
| `refactor:` | 重构 |
| `chore:` | 构建、依赖等杂项 |

例：

```
fix: 卡片圆角被父级容器裁剪
feat: 新增拟态皮肤
style: 液态玻璃悬停改为提亮而非叠白
```

---

## 代码约定

### 注释

**写清楚「为什么」，不写「是什么」**。

好注释：

```javascript
/*
 * 过渡只给颜色/阴影：backdrop-filter 的过渡会让浏览器逐帧重算模糊，
 * 鼠标移开时亮度回落非常拖沓，所以那一项不做过渡，直接切换。
 */
```

坏注释：

```javascript
// 设置过渡
transition: none;
```

踩过的坑、反直觉的做法、被覆盖的样式，都值得记下来 —— 下一个维护的人（可能就是三个月后的你）会感谢。

### 样式

- 颜色不写死，走 CSS 变量
- 圆角必须 20px（与父级容器对齐）
- 边框用 inset 阴影，不用 `border`
- 新皮肤要覆盖卡片、页面、按钮、面板、输入框、文字、状态色七类选择器

详见 [皮肤系统文档](docs/04-skins.md)。

### 兼容性

- 不要用原生 `setInterval`，用 `spCtx.api.timer`
- 网络请求必须走 `spCtx.api.network.request`
- `spCtx` 在 `onInitialized` 之后才可用

---

## 不接受的改动

- 引入重量级依赖（UI 框架、状态管理库）
- 把皮肤颜色改回硬编码
- 降低刷新间隔到 30 秒以下（会触发 MSLX 的防爆破封禁）
- 提交第三方字体文件（版权原因，见 LICENSE）

---

## 协议

提交的代码默认以 [MIT](LICENSE) 协议授权。
