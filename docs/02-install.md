# 安装与配置

## 前置条件

- Sun-Panel **v2.0.0+**，且已开启微应用功能
- 一个可访问的 MSLX 面板实例（知道地址、账号、密码）
- Sun-Panel 与 MSLX 之间网络互通（微应用的请求由 Sun-Panel 后端代理发出）

---

## 方式一：微应用商店安装（推荐）

1. Sun-Panel → 设置 → **微应用** → 进入**微应用商店**
2. 搜索「MSLX 监控」→ 安装
3. 回到导航页 → 右键 → 添加小部件 → 选「MSLX 服务器监控」→ 选尺寸
4. 点卡片右上角 ⚙ 填写连接信息

---

## 方式二：开发者模式离线上传

适用于自己改代码，或商店里还没有你需要的版本。

### 1. 开启开发者模式

Sun-Panel → 设置 → 开启**开发者模式**。

### 2. 准备 zip

**用现成包**：从 Releases 下载 `cheering-mslx-monitor-<version>.zip`

**自己构建**：

```bash
git clone https://github.com/Cheering571/sunpanel-mslx-monitor.git
cd sunpanel-mslx-monitor
npm install
npm run pack
```

产物在 `packages/cheering-mslx-monitor-<version>.zip`。

> 如果 `npm install` 卡在 `@sun-panel/micro-app`，换国内镜像：
> `npm install --registry=https://registry.npmmirror.com`

### 3. 上传

微应用 → **上传离线包** → 选择 zip。

上传成功后，微应用列表里会出现「MSLX 服务器监控」。

### 4. 添加到导航页

回到导航页 → 空白处右键 → 添加小部件 → 选「MSLX 服务器监控」→ 选择尺寸 → 确认。

---

## 配置连接

点卡片右上角的 ⚙：

| 字段 | 说明 | 示例 |
|---|---|---|
| MSLX 地址 | 完整 URL，带协议，**不带结尾斜杠** | `http://192.168.1.100:1027` |
| 用户名 | MSLX 登录账号 | `admin` |
| 密码 | MSLX 登录密码 | `••••••` |

点「测试连接」→ 成功后点「保存」。

MSLX 地址支持这些写法，都会自动补全协议：

```
192.168.1.100:1027          → http://192.168.1.100:1027
http://192.168.1.100:1027   → 保持不变
https://mslx.example.com    → 保持不变
```

---

## 网络白名单

### 为什么需要

Sun-Panel 要求微应用在 `app.config.js` 里声明可访问的主机（`networkDomains`），
**这是打包期的静态声明，平台不提供运行期修改接口** —— 属于安全边界，防止微应用偷偷访问任意站点。

### 本项目的处理

默认声明为 `'*'`（放开）：

```javascript
networkDomains: ['*']
```

这样商店分发的包能适配任意用户的 MSLX 地址 —— **地址是用户在配置页填的，不是写死在代码里**。

### 想收紧权限

构建时用环境变量指定：

```bash
# Windows
set MSLX_HOSTS=192.168.1.100,192.168.1.100:1027
npm run pack

# macOS / Linux
MSLX_HOSTS="192.168.1.100,192.168.1.100:1027" npm run pack
```

生成的白名单会写进 `app.json`：

```json
"networkDomains": ["192.168.1.100", "192.168.1.100:1027"]
```

**注意**：平台精确匹配 URL 里的 host，而 host **带端口**。
只写 `192.168.1.100` 匹配不上 `192.168.1.100:1027`，两种写法都要列。

### 如果出现「无权限访问」

```
No permission to access: http://<host>:<port>/api/ping
```

说明当前包的 `networkDomains` 不包含你要访问的地址。两种解决方式：

1. **重新打包**：按上面的方式用 `MSLX_HOSTS` 指定地址
2. **换回默认放开**：不加环境变量直接 `npm run pack`，白名单是 `'*'`

---

## 字体（可选）

卡片支持 Minecraft 风格字体，但**字体文件不随仓库分发**，原因见 [LICENSE](../LICENSE) 的第三方资源说明。

### 需要准备的文件

| 文件 | 用途 | 说明 |
|---|---|---|
| `Mojangles.ttf` | MC 原版字体 | 仅含 ASCII，中文回退 Unifont |
| `unifont-*.ttf` | 像素等宽字体 | 含中文，从 [unifoundry.com](https://unifoundry.com/unifont/) 下载 |

### 生成子集

原始字体很大（Unifont 约 5 MB，Mojangles 约 15 MB），直接打包会让微应用膨胀到 20 MB。需要先子集化：

1. 把两个字体放到任意位置
2. 编辑 `tools/subset-fonts.py` 顶部的路径
3. 运行：

```bash
pip install fonttools
python tools/subset-fonts.py
```

脚本会把字体裁剪成只含实际用到的字符，输出到 `public/fonts/`：

```
unifont-subset.ttf    约 400 KB   （ASCII + 常见汉字）
mojangles-subset.ttf  约 7 KB     （仅 ASCII）
```

4. 重新 `npm run pack`

### 不用字体也能跑

不提供字体文件时，微应用照常工作，只是字体下拉里的两个选项会回退到系统字体。

---

## 配置项说明

配置保存在 Sun-Panel 的 dataNode 里（`mslx` 节点，用户级、非公开）。

| 键 | 说明 |
|---|---|
| `baseUrl` | MSLX 地址 |
| `username` | 登录账号 |
| `token` | 登录后拿到的 JWT，有效期 24 小时 |
| `tokenExpire` | token 过期时间戳 |
| `skin` | 皮肤：`default` / `mc-stone` / `mc-grass` / `neu` / `glass` |
| `font` | 字体：`default` / `mojangles` / `unifont` |
| `instances` | 每张卡片绑定的服务器 `{ widgetId: instanceId }` |

### 多卡片绑定不同服务器

不需要额外配置。每张卡片点自己的服务器名（带 ▾）选择即可，选择结果写进 `instances[widgetId]`。

如果某张卡片没选过，会回退到全局默认实例。

---

## 常见问题

### 卡片提示「无权限访问」

见上面的 [网络白名单](#如果出现无权限访问)。

### 升级后样式没变化

微应用的 `main.js` 被浏览器缓存了。**关闭标签页重新打开**，按 F5 不够。

装好后可以在配置页顶部确认版本号（如 `v1.10.2`），确保加载的是新构建。

### 登录提示「返回中没有 token」

如果响应结构是 `{"data":{"code":200,"data":{"token":"..."}}}`，说明响应被包了多层。`unwrap()` 函数会递归解析，正常情况下不需要手动处理。

如果仍然失败，把实际返回结构发出来。

### 请求被 MSLX 封禁

MSLX 有防爆破机制，短时间内大量失败请求会临时封禁来源 IP（约 60 分钟）。

**排查时注意**：微应用的请求是从 **Sun-Panel 后端**发出的，所以被封的是 NAS 的 IP，不是你浏览器的 IP。

调试时建议拉长刷新间隔，或在测试环境操作。

### 卡片显示「⚠ 异常停止」

这是预期行为：卡片发现实例从「运行中」变成了「未启动」，说明服务异常掉线，用红色提示引起注意。

如果只是你手动停的服，看到这个提示会有点多余 —— 目前还没有区分「手动停止」和「异常崩溃」的能力（MSLX 没有提供停机原因）。

---

## 升级

1. 商店安装的：在商店里更新；离线安装的：下载新 zip 重新上传（会自动覆盖同 ID 的旧版本）
2. **关闭标签页重新打开**
3. 配置页确认版本号变了

配置（地址、token、皮肤、卡片绑定）会保留，因为存在 dataNode 里而不是包里。
