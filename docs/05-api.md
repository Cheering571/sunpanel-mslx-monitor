# MSLX API 说明

本项目对接的 MSLX 接口整理。基于 MSLX Daemon `v1.7.6` 实测。

---

## 认证

### 登录

```
POST /api/auth/login
Content-Type: application/json

{ "username": "...", "password": "..." }
```

响应：

```json
{
  "code": 200,
  "message": "ok",
  "data": { "token": "<JWT>" }
}
```

JWT 有效期 **24 小时**。

### 后续请求

**注意**：MSLX 用的不是标准的 `Authorization: Bearer`，而是自定义头：

```
x-user-token: <JWT>
```

这是从官方前端 bundle 里确认的，用错头会一直返回 401。

---

## 响应结构

统一为：

```json
{ "code": 200, "message": "...", "data": ... }
```

但**部分接口会多包一层**：

```json
{ "data": { "code": 200, "data": { ... } } }
```

所以 `src/api/mslx.js` 里有个递归的 `unwrap()`，最多下钻 6 层，遇到 `code` 字段就停：

```javascript
function unwrap(res, depth = 0) {
  if (!res || typeof res !== 'object' || depth > 6) return res;
  if (res.code !== undefined) return res;
  if (res.data) return unwrap(res.data, depth + 1);
  return res;
}
```

---

## 实例

### 列表

```
GET /api/instance/list
```

返回实例数组，每项含 `id` / `name` / `status` / `core` / `port` 等。

### 详情

```
GET /api/instance/info?id=<id>
```

含更完整的运行时数据：内存占用、启动时间、在线人数等。

### 操作

```
POST /api/instance/action
{ "id": 9, "action": "start" }
```

**`action` 只接受这四个值**：

| 值 | 说明 |
|---|---|
| `start` | 启动 |
| `stop` | 停止 |
| `restart` | 重启 |
| `backup` | 备份 |

传 `kill` / `forceStop` / `command` 都会返回：

```
操作 (action) 错误：不支持的参数
```

---

## 状态码

| code | 含义 |
|---|---|
| 0 | 未启动 |
| 1 | 启动中 |
| 2 | 运行中 |
| 3 | 停止中 |

`src/api/mslx.js` 的 `STATUS` 映射了这个表，颜色用 CSS 变量以便皮肤接管：

```javascript
export const STATUS = {
  0: { text: '未启动', color: 'var(--st-stopped, #8c8c8c)', key: 'stopped' },
  1: { text: '启动中', color: 'var(--st-starting, #faad14)', key: 'starting' },
  2: { text: '运行中', color: 'var(--st-running, #52c41a)', key: 'running' },
  3: { text: '停止中', color: 'var(--st-stopping, #faad14)', key: 'stopping' },
};
```

---

## 玩家

所有玩家接口都是 `/api/instance/players/<动作>/<实例id>` 的形式。

| 接口 | 方法 | 说明 |
|---|---|---|
| `/players/online/{id}` | GET | 在线玩家 |
| `/players/history/{id}` | GET | 登录历史 |
| `/players/ops/{id}` | GET | OP 列表 |
| `/players/whitelist/{id}` | GET | 白名单 |
| `/players/banplayer/{id}` | GET | 封禁玩家 |
| `/players/banip/{id}` | GET | 封禁 IP |

### 添加

```
POST /api/instance/players/whitelist/add/{id}
{ "name": "Steve", "uuid": "..." }
```

**必须同时提供 `name` 和 `uuid`**，只给 `name` 会失败。

UUID 必须真实存在 —— 只能在 `usercache.json` 里有的玩家才加得进去，也就是**必须登录过服务器**。

### 移除

```
POST /api/instance/players/whitelist/remove/{id}
{ "name": "Steve" }
```

移除只认 `name`。

`ops` / `banplayer` / `banip` 的增删规则同上。

---

## 备份

```
GET /api/instance/backups/all
```

返回按实例分组：

```json
[
  {
    "id": 9,
    "name": "无限",
    "core": "NeoForge 21.1.262",
    "backupPath": "...",
    "backups": [ { "fileName": "...", "size": 123456, "createTime": "..." } ]
  }
]
```

---

## 健康检查

```
GET /api/ping
```

公开接口，不需要 token。响应 `{"code":200,"message":"pong"}`。

配置页的「测试连接」用它验证地址是否可达，再用登录接口验证账号。

---

## 不可用的能力

### 实时日志 / 控制台

MSLX 的日志推送走 **SignalR**，微应用无法建立 WebSocket 连接到平台后端代理，所以：

- 看不到服务器控制台输出
- 不能执行任意命令

这也是本项目没有做「命令输入」功能的原因。

### 玩家 UUID 查询

没有「按名字查 UUID」的接口。添加白名单时只能：

1. 从历史记录里找（`/players/history` 返回的条目带 UUID）
2. 或者让玩家先登录一次

---

## 防爆破

MSLX 对失败请求有速率限制，短时间内大量失败会**临时封禁来源 IP 约 60 分钟**。

**关键**：微应用的请求是由 **Sun-Panel 后端**代理发出的，所以被封的是 Sun-Panel 所在机器的 IP，不是浏览器的 IP。

排查问题时如果发现突然全部请求失败，先确认是不是触发了封禁，而不是代码问题。

同样因为这个机制，本项目的轮询间隔设为 **30 秒**，不建议调低。
