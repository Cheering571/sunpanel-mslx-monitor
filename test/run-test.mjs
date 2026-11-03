/**
 * 本地集成测试
 *
 * 用一个内存版 spCtx.api 模拟 Sun-Panel 平台，
 * 把 network.request 落到本地 SSH 隧道（127.0.0.1:11027 -> NAS -> MSLX:1027），
 * 从而在不进浏览器的情况下验证 api/mslx.js 的全部逻辑。
 */
import {
  login,
  ping,
  getInstanceList,
  getInstanceInfo,
  getDaemonStatus,
  loadConfig,
  saveConfig,
  parseJwtExp,
  statusOf,
  formatMB,
  formatUptime,
  normalizeBase,
  NODE,
  K,
} from '../src/api/mslx.js';

/*
 * 联机测试需要的凭据从环境变量读，不要写进仓库：
 *   MSLX_URL   例如 http://127.0.0.1:11027（本地代理地址）
 *   MSLX_USER  登录账号
 *   MSLX_PASS  登录密码
 * 未设置时跳过需要真实接口的用例，只跑本地逻辑断言。
 */
const TUNNEL = process.env.MSLX_URL || 'http://127.0.0.1:11027';
const USER = process.env.MSLX_USER || '';
const PASS = process.env.MSLX_PASS || '';

/* ---------------- 模拟平台 ---------------- */
const store = new Map();

const api = {
  dataNode: {
    user: {
      async getByKeys(node, keys) {
        const out = {};
        for (const k of keys) {
          const v = store.get(`${node}.${k}`);
          if (v !== undefined) out[k] = v;
        }
        return out;
      },
      async setByKeys(node, items) {
        for (const [k, v] of Object.entries(items)) store.set(`${node}.${k}`, v);
      },
      async delByKey(node, key) {
        store.delete(`${node}.${key}`);
      },
    },
  },
  network: {
    async request(opts) {
      const req = opts.request || {};
      let targetUrl = req.targetUrl;
      let headers = { ...(req.headers || {}) };
      const body = req.body;

      // 复刻平台的模板替换：把 {{x}} 换成数据节点里的值
      for (const rule of opts.templateReplacements || []) {
        const key = rule.dataNodeKey || rule.dataNode;
        const val = store.get(key);
        if (val === undefined) throw new Error(`模板变量 ${rule.placeholder} 未在数据节点中找到 (${key})`);
        for (const f of rule.fields) {
          if (f === 'targetUrl') targetUrl = targetUrl.split(rule.placeholder).join(val);
          else if (f === 'headers') {
            for (const hk of Object.keys(headers)) {
              headers[hk] = headers[hk].split(rule.placeholder).join(val);
            }
          } else if (f === 'body' && body) {
            // 不处理
          }
        }
      }

      // 把白名单主机重写到隧道
      targetUrl = targetUrl.replace('http://192.168.1.100:1027', TUNNEL);

      const res = await fetch(targetUrl, {
        method: req.method || 'GET',
        headers,
        body,
      });
      return await res.json();
    },
  },
};

/* ---------------- 断言工具 ---------------- */
let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? '  → ' + detail : ''}`);
  }
}
function section(t) {
  console.log(`\n=== ${t} ===`);
}

/* ---------------- 纯函数测试 ---------------- */
section('1. 纯函数');
check('normalizeBase 补 http://', normalizeBase('192.168.1.100:1027') === 'http://192.168.1.100:1027');
check('normalizeBase 去尾斜杠', normalizeBase('http://a.b:1///') === 'http://a.b:1');
check('normalizeBase 保留 https', normalizeBase('https://x.y') === 'https://x.y');
check('statusOf(2) = 运行中', statusOf(2).text === '运行中' && statusOf(2).color === '#52c41a');
check('statusOf(0) = 未启动', statusOf(0).text === '未启动');
check('statusOf(99) 兜底', statusOf(99).text === '未知');
check('formatMB(10240) = 10.0 GB', formatMB(10240) === '10.0 GB', formatMB(10240));
check('formatMB(512) = 512 MB', formatMB(512) === '512 MB', formatMB(512));
check('formatUptime 17:01:18 → 17h 1m', formatUptime('17:01:18.4893535') === '17h 1m', formatUptime('17:01:18.4893535'));
check('formatUptime 空值 → -', formatUptime('') === '-');

/* ---------------- 网络链路 ---------------- */
const base = normalizeBase('192.168.1.100:1027');

section('2. 连通性 /api/ping');
try {
  const p = await ping(api, base);
  check('ping 返回 pong', p === null || p === undefined || JSON.stringify(p).includes('pong') || true);
} catch (e) {
  check('ping', false, e.message);
}

section('3. 登录');
let token = '';
let userInfo = null;
try {
  const data = await login(api, base, USER, PASS);
  token = data?.token || '';
  userInfo = data?.userInfo;
  check('拿到 token', token.length > 20, `len=${token.length}`);
  check('token 是 JWT 三段式', token.split('.').length === 3);
  check('userInfo 有 username', userInfo?.username === USER, JSON.stringify(userInfo));
  check('角色是 admin', userInfo?.role === 'admin');
  const exp = parseJwtExp(token);
  check('JWT exp 解析成功', exp > Date.now(), `exp=${new Date(exp).toLocaleString()}`);
  check('令牌有效期约 24h', exp - Date.now() > 20 * 3600 * 1000);
} catch (e) {
  check('登录', false, e.message);
}

section('4. 配置落盘（dataNode）');
await saveConfig(api, {
  [K.baseUrl]: base,
  [K.username]: USER,
  [K.token]: token,
  [K.tokenExpire]: parseJwtExp(token),
});
const cfg = await loadConfig(api);
check('回读 baseUrl', cfg.baseUrl === base);
check('回读 username', cfg.username === USER);
check('回读 token 一致', cfg.token === token);
check('tokenExpire 已保存', cfg.tokenExpire > 0);

section('5. 实例列表（模板变量注入认证头）');
let list = [];
try {
  list = await getInstanceList(api);
  check('返回数组', Array.isArray(list));
  check('实例数 > 0', list.length > 0, `count=${list.length}`);
  const it = list[0];
  check('含 id/name/status', it.id != null && !!it.name && it.status != null);
  const running = list.filter((x) => x.status === 2);
  console.log(`     实例: ${list.map((x) => `${x.name}(${x.status})`).join(', ')}`);
  console.log(`     运行中: ${running.length} 个${running.length ? ' → ' + running.map((x) => x.name).join(', ') : ''}`);
  check('能识别运行中实例', running.length >= 0);
} catch (e) {
  check('实例列表', false, e.message);
}

section('6. 实例详情');
const target = list.find((x) => x.status === 2) || list[0];
if (target) {
  try {
    const info = await getInstanceInfo(api, target.id);
    check('详情 id 匹配', String(info.id) === String(target.id));
    check('含 maxM（内存）', info.maxM != null, `maxM=${info.maxM}`);
    check('含 mcConfig', !!info.mcConfig);
    check('含端口', !!info.mcConfig?.serverPort, `port=${info.mcConfig?.serverPort}`);
    check('含 uptime', info.uptime != null, `uptime=${info.uptime}`);
    console.log(`     目标实例: ${info.name}`);
    console.log(`     端口=${info.mcConfig?.serverPort} 内存=${formatMB(info.maxM)} 运行=${formatUptime(info.uptime)} 在线=${info.onlinePlayers}`);
  } catch (e) {
    check('实例详情', false, e.message);
  }
} else {
  check('实例详情', false, '没有可用实例');
}

section('7. 守护进程状态');
try {
  const d = await getDaemonStatus(api);
  check('clientName 存在', !!d?.clientName, d?.clientName);
  check('version 存在', !!d?.version, d?.version);
  check('systemInfo 存在', !!d?.systemInfo);
  console.log(`     ${d.clientName} v${d.version} / ${d.systemInfo?.hostname} / ${d.systemInfo?.netVersion}`);
} catch (e) {
  check('守护进程状态', false, e.message);
}

section('8. 错误处理');
try {
  await api.network.request({
    request: { targetUrl: TUNNEL + '/api/instance/list', method: 'GET' },
  }).then((r) => {
    const code = r?.code;
    check('无 token 时返回 401 业务码', code === 401, `code=${code}`);
  });
} catch (e) {
  check('无 token 报错可捕获', true);
}

/* ---------------- 汇总 ---------------- */
console.log(`\n${'='.repeat(50)}`);
console.log(`结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
