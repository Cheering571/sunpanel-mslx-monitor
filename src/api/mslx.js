/**
 * MSLX API 封装
 *
 * 所有网络请求必须通过平台 API network.request 发出，
 * 由 Sun-Panel 主应用后端代理，从而绕开浏览器 CORS 限制。
 *
 * MSLX 认证方式（从官方前端 bundle 中确认）：
 *   header: x-user-token: <JWT>
 *   而不是标准的 Authorization: Bearer
 */

/** 数据节点名称 */
export const NODE = 'mslx';

/** 数据节点中使用的键 */
export const K = {
  baseUrl: 'baseUrl',
  username: 'username',
  token: 'token',
  instanceId: 'instanceId',
  tokenExpire: 'tokenExpire',
  useSystemBgColor: 'useSystemBgColor',
  skin: 'skin',
  font: 'font',
  /**
   * 每张卡片各自选择的实例：{ [widgetId]: instanceId }
   * 不放在实例 ID 的单一键里，是为了让多个卡片能盯不同的服务器。
   */
  instances: 'instances',
};

/** 可选皮肤 */
export const SKINS = [
  { key: 'default', label: '默认（跟随 Sun-Panel）' },
  { key: 'mc-stone', label: '我的世界 - 石头' },
  { key: 'mc-grass', label: '我的世界 - 草方块' },
  { key: 'neu', label: '拟态（Neumorphism）' },
  { key: 'glass', label: '液态玻璃' },
];

/**
 * 把皮肤 key 映射成 root 上的 class
 * 兼容旧值 'mc'（历史配置里存过）
 */
export function skinClass(skin) {
  if (skin === 'mc' || skin === 'mc-stone') return 'skin-mc skin-stone';
  if (skin === 'mc-grass') return 'skin-mc skin-grass';
  if (skin === 'neu') return 'skin-neu';
  if (skin === 'glass') return 'skin-glass';
  return '';
}

/** 该皮肤是否属于 MC 系列 */
export function isMcSkin(skin) {
  return skin === 'mc' || skin === 'mc-stone' || skin === 'mc-grass';
}

/** 是否使用了任何自定义皮肤（非「默认」） */
export function isThemeSkin(skin) {
  return !!skin && skin !== 'default';
}

/**
 * 实例状态码映射
 * status: 0 = 未启动, 2 = 运行中
 *
 * color 用 CSS 变量 + 回退值：
 *   这些颜色是以内联 style 形式写进 DOM 的，会压过所有样式表，
 *   如果用固定色值，深色皮肤上「未启动」的 #8c8c8c 会看不清。
 *   改成 var(--st-xxx, 回退色) 后，各皮肤在根元素上定义变量即可整体替换。
 */
export const STATUS = {
  0: { text: '未启动', color: 'var(--st-stopped, #8c8c8c)', key: 'stopped' },
  1: { text: '启动中', color: 'var(--st-starting, #faad14)', key: 'starting' },
  2: { text: '运行中', color: 'var(--st-running, #52c41a)', key: 'running' },
  3: { text: '停止中', color: 'var(--st-stopping, #faad14)', key: 'stopping' },
};

export function statusOf(code) {
  return (
    STATUS[code] || { text: '未知', color: 'var(--st-stopped, #8c8c8c)', key: 'unknown' }
  );
}

/**
 * 读取连接配置
 * @param {object} api this.spCtx.api
 */
export async function loadConfig(api) {
  try {
    const data = await api.dataNode.user.getByKeys(NODE, [
      K.baseUrl,
      K.username,
      K.token,
      K.instanceId,
      K.tokenExpire,
      K.useSystemBgColor,
      K.skin,
      K.font,
      K.instances,
    ]);
    // instances 可能被存成对象或 JSON 字符串，两种都兼容
    let instances = data?.[K.instances] ?? {};
    if (typeof instances === 'string') {
      try {
        instances = JSON.parse(instances);
      } catch (e) {
        instances = {};
      }
    }
    if (!instances || typeof instances !== 'object') instances = {};

    return {
      baseUrl: data?.[K.baseUrl] || '',
      username: data?.[K.username] || '',
      token: data?.[K.token] || '',
      instanceId: data?.[K.instanceId] ?? null,
      tokenExpire: data?.[K.tokenExpire] || 0,
      useSystemBgColor: !!data?.[K.useSystemBgColor],
      skin: data?.[K.skin] || 'default',
      font: data?.[K.font] || 'default',
      instances,
    };
  } catch (e) {
    return {
      baseUrl: '',
      username: '',
      token: '',
      instanceId: null,
      tokenExpire: 0,
      useSystemBgColor: false,
      skin: 'default',
      font: 'default',
      instances: {},
    };
  }
}

/**
 * 取某张卡片绑定的实例 ID
 * 优先用卡片自己的选择，其次回退到全局默认
 */
export function instanceIdForWidget(cfg, widgetId) {
  const map = cfg?.instances || {};
  const own = widgetId ? map[widgetId] : undefined;
  if (own !== undefined && own !== null && own !== '') return own;
  return cfg?.instanceId ?? null;
}

/**
 * 保存某张卡片绑定的实例 ID
 */
export async function setWidgetInstance(api, widgetId, instanceId) {
  if (!widgetId) return;
  const cfg = await loadConfig(api);
  const map = { ...(cfg.instances || {}) };
  map[widgetId] = instanceId === null || instanceId === undefined ? null : Number(instanceId);
  await saveConfig(api, { [K.instances]: map });
}

/**
 * 保存连接配置
 */
export async function saveConfig(api, patch) {
  const items = {};
  Object.keys(patch).forEach((k) => {
    if (patch[k] !== undefined) items[k] = patch[k];
  });
  await api.dataNode.user.setByKeys(NODE, items);
}

/**
 * 清除令牌
 */
export async function clearToken(api) {
  try {
    await api.dataNode.user.delByKey(NODE, K.token);
    await api.dataNode.user.delByKey(NODE, K.tokenExpire);
  } catch (e) {
    /* ignore */
  }
}

/**
 * 规范化 baseUrl：去掉结尾斜杠
 */
export function normalizeBase(url) {
  if (!url) return '';
  let u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  return u.replace(/\/+$/, '');
}

/**
 * 用明文地址发请求（用于登录，此时还没有 token）
 */
async function requestPlain(api, targetUrl, { method = 'GET', headers = {}, body } = {}) {
  const res = await api.network.request({
    request: {
      targetUrl,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  });
  return unwrap(res, targetUrl);
}

/**
 * 用数据节点中的 baseUrl + token 发请求（推荐）
 * 敏感信息不出现在组件状态里，由主应用在代理阶段替换。
 */
async function requestAuth(api, path, { method = 'GET', body, extraHeaders = {} } = {}) {
  const res = await api.network.request({
    request: {
      targetUrl: '{{base}}' + path,
      method,
      headers: { 'Content-Type': 'application/json', 'x-user-token': '{{token}}', ...extraHeaders },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    templateReplacements: [
      { placeholder: '{{base}}', fields: ['targetUrl'], dataNodeKey: `${NODE}.${K.baseUrl}` },
      { placeholder: '{{token}}', fields: ['headers'], dataNodeKey: `${NODE}.${K.token}` },
    ],
  });
  return unwrap(res, path);
}

/**
 * 统一解包响应
 *
 * 实测发现实际返回可能是三层叠加：
 *   第1层  { data: ... }                                          ← 平台外壳，没有 code
 *   第2层    { code:200, message:'登录成功', data: ... }            ← MSLX 业务层
 *   第3层      { token:'...', userInfo:{...} }                     ← 真正的数据
 *
 * 规则：只要是对象，就剥掉外层（有 code 先校验 code，没 code 就取 data），
 * 直到拿到既没有 code 也没有 data 的业务数据为止。
 */
function unwrap(res, label) {
  let cur = res;

  // 有的实现会把 JSON 作为字符串返回
  if (typeof cur === 'string') {
    try {
      cur = JSON.parse(cur);
    } catch (e) {
      throw new Error(`响应不是 JSON (${label})`);
    }
  }

  for (let depth = 0; depth < 6; depth++) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return cur;

    if ('code' in cur) {
      if (cur.code !== 200) {
        const msg = cur.message || `请求失败 (code=${cur.code})`;
        const err = new Error(msg);
        err.code = cur.code;
        err.raw = cur;
        throw err;
      }
      cur = cur.data;
      continue;
    }

    if ('data' in cur) {
      cur = cur.data;
      continue;
    }

    return cur;
  }
  return cur;
}

/* ============================================================
 * 具体接口
 * ============================================================ */

/**
 * 登录，返回 { token, userInfo }
 */
export async function login(api, baseUrl, username, password) {
  const base = normalizeBase(baseUrl);
  const data = await requestPlain(api, base + '/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  return data;
}

/**
 * 存活检测（公开接口，无需登录）
 */
export async function ping(api, baseUrl) {
  const base = normalizeBase(baseUrl);
  return requestPlain(api, base + '/api/ping');
}

/**
 * 守护进程状态
 */
export async function getDaemonStatus(api) {
  return requestAuth(api, '/api/status');
}

/**
 * 实例列表
 */
export async function getInstanceList(api) {
  return requestAuth(api, '/api/instance/list');
}

/**
 * 单个实例详情
 * @param {number|string} id
 */
export async function getInstanceInfo(api, id) {
  return requestAuth(api, `/api/instance/info?id=${encodeURIComponent(id)}`);
}

/**
 * 实例操作
 * @param {number|string} id
 * @param {'start'|'stop'|'restart'} action
 */
export async function instanceAction(api, id, action) {
  return requestAuth(api, '/api/instance/action', {
    method: 'POST',
    body: { id: Number(id), action },
  });
}

/**
 * 备份列表
 */
export async function getBackups(api) {
  return requestAuth(api, '/api/instance/backups/all');
}

/**
 * 触发一次备份
 *
 * 实测 action 支持：start / stop / restart / backup
 * （kill / forceStop / command 均返回 "不支持的参数"）
 */
export async function instanceBackup(api, id) {
  return requestAuth(api, '/api/instance/action', {
    method: 'POST',
    body: { id: Number(id), action: 'backup' },
  });
}

/**
 * 在线玩家列表
 */
export async function getOnlinePlayers(api, id) {
  return requestAuth(api, `/api/instance/players/online/${encodeURIComponent(id)}`);
}

/**
 * 玩家登录历史
 */
export async function getPlayerHistory(api, id) {
  return requestAuth(api, `/api/instance/players/history/${encodeURIComponent(id)}`);
}

/**
 * OP 列表
 */
export async function getOps(api, id) {
  return requestAuth(api, `/api/instance/players/ops/${encodeURIComponent(id)}`);
}

/**
 * 白名单
 */
export async function getWhitelist(api, id) {
  return requestAuth(api, `/api/instance/players/whitelist/${encodeURIComponent(id)}`);
}

/**
 * 封禁玩家列表
 */
export async function getBannedPlayers(api, id) {
  return requestAuth(api, `/api/instance/players/banplayer/${encodeURIComponent(id)}`);
}

/**
 * 封禁 IP 列表
 */
export async function getBannedIps(api, id) {
  return requestAuth(api, `/api/instance/players/banip/${encodeURIComponent(id)}`);
}

/* ---------------- 玩家管理写操作 ----------------
 * 实测规则（2026-11 于 MSLX 1.7.6）：
 *   add    需要 { name, uuid }，只给 name 会报
 *          "未提供UUID，且在 usercache 中未找到玩家的历史记录"
 *   remove 需要 { name }
 * 因此界面上一律从「玩家历史」里选人，uuid 直接带过去。
 * ---------------------------------------------- */

function playerBody(player, extra) {
  const body = { name: player?.name || '' };
  if (player?.uuid) body.uuid = player.uuid;
  return extra ? { ...body, ...extra } : body;
}

export async function addWhitelist(api, id, player) {
  return requestAuth(api, `/api/instance/players/whitelist/add/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: playerBody(player),
  });
}

export async function removeWhitelist(api, id, player) {
  return requestAuth(api, `/api/instance/players/whitelist/remove/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: playerBody(player),
  });
}

export async function addOp(api, id, player, level = 4) {
  return requestAuth(api, `/api/instance/players/ops/add/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: playerBody(player, { level }),
  });
}

export async function removeOp(api, id, player) {
  return requestAuth(api, `/api/instance/players/ops/remove/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: playerBody(player),
  });
}

export async function addBan(api, id, player) {
  return requestAuth(api, `/api/instance/players/banplayer/add/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: playerBody(player),
  });
}

export async function removeBan(api, id, player) {
  return requestAuth(api, `/api/instance/players/banplayer/remove/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: playerBody(player),
  });
}

/**
 * 确保 token 可用：过期前 5 分钟自动重新登录
 * @returns {Promise<boolean>} 是否处于可用状态
 */
export async function ensureAuth(api, cfgRef) {
  const cfg = cfgRef || (await loadConfig(api));
  if (!cfg.baseUrl || !cfg.username) return false;

  const now = Date.now();
  // tokenExpire 存的是毫秒时间戳
  if (cfg.token && cfg.tokenExpire && cfg.tokenExpire - now > 5 * 60 * 1000) {
    return true;
  }
  return false;
}

/**
 * 解析 JWT 的 exp，返回毫秒时间戳
 */
export function parseJwtExp(token) {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const obj = JSON.parse(json);
    return obj.exp ? obj.exp * 1000 : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 把字节数格式化为可读文本
 */
export function formatMB(mb) {
  if (!mb && mb !== 0) return '-';
  if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
  return Math.round(mb) + ' MB';
}

/**
 * uptime 形如 "17:01:18.4893535" -> "17h 1m"
 */
export function formatUptime(str) {
  if (!str) return '-';
  const m = String(str).match(/^(\d+):(\d+):(\d+)/);
  if (!m) return str;
  const d = 0;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}

/* ============================================================
 * 紧凑格式（给卡片小尺寸用，避免文字被截断）
 * ============================================================ */

/** 10240 -> "10G"；512 -> "512M" */
export function formatMBShort(mb) {
  if (mb === null || mb === undefined || mb === '') return '-';
  const n = Number(mb);
  if (!Number.isFinite(n)) return '-';
  if (n >= 1024) {
    const g = n / 1024;
    return (g >= 10 ? Math.round(g) : g.toFixed(1).replace(/\.0$/, '')) + 'G';
  }
  return Math.round(n) + 'M';
}

/** "19:02:33.123" -> "19h2m"；"00:05:00" -> "5m"；"50:00:00" -> "2d2h" */
export function formatUptimeShort(str) {
  if (!str) return '-';
  const m = String(str).match(/^(\d+):(\d+):(\d+)/);
  if (!m) return String(str).slice(0, 6);
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h >= 24) return `${Math.floor(h / 24)}d${h % 24}h`;
  if (h > 0) return `${h}h${min}m`;
  return `${min}m`;
}
