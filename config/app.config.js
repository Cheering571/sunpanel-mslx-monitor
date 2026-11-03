/**
 * 微应用配置文件 - MSLX 服务器监控
 * 应用基础配置
 */

/**
 * 解析网络白名单。
 *
 * Sun-Panel 的白名单在打包时写入 app.json，平台不提供运行期修改接口，
 * 所以「用户自己填 MSLX 地址」这件事只能靠两种方式落地：
 *
 *   1. 构建时用环境变量 MSLX_HOSTS 覆盖（自建 / 自用推荐）
 *   2. 默认放开为 '*'（商店分发必须如此，否则无法适配未知地址）
 */
function resolveNetworkDomains() {
  const raw = typeof process !== 'undefined' ? process.env?.MSLX_HOSTS : '';
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ['*'];
}

export default {
  // =======================
  // 应用基础信息
  // =======================
  // 配置文件格式版本
  appJsonVersion: '1.1',
  // 作者标识
  author: 'cheering',
  // 应用唯一标识（作者标识-应用标识）
  microAppId: 'cheering-mslx-monitor',
  // 应用版本
  version: '1.10.2',
  // 入口文件
  entry: 'main.js',
  // 图标
  icon: 'icon.png',
  // 调试模式（测试打包时自动强制为 true；正式发布请设置为 false）
  debug: false,

  // 应用信息（使用 '$t: xxx' 可以引用翻译）
  appInfo: {
    appName: '$t:APP_NAME',
    description: '$t:APP_DESCRIPTION',
    networkDescription: '$t:NETWORK_DESCRIPTION',
  },

  // 语言文件映射（appJsonVersion:1.1 新增）
  locales: {
    'zh-CN': 'zh-CN.json',
    'en-US': 'en-US.json',
  },

  // 默认语言
  defaultLocale: 'zh-CN',

  // =======================
  // 权限配置
  // =======================
  permissions: ['network', 'dataNode'],

  // =======================
  // 网络域名白名单
  //
  // 这是打包期的静态声明，平台在运行时不提供修改接口（安全边界），
  // 所以这里按「一种默认 + 两种覆盖」处理：
  //
  //   1. 默认放开：'*'
  //      微应用商店分发时分发者无法预知使用者的 MSLX 地址，
  //      地址由用户在配置页填写，白名单必须能覆盖任意主机。
  //
  //   2. 构建时指定（推荐自建用户）：
  //      set MSLX_HOSTS=192.168.1.100,192.168.1.100:1027
  //      npm run pack
  //
  //   3. 注意：Sun-Panel 精确匹配 URL 里的 host，而 host 带端口。
  //      只写 IP 匹配不上 IP:端口，两种写法都要列，否则会报
  //      "No permission to access: http://<host>:<port>/api/ping"
  // =======================
  networkDomains: resolveNetworkDomains(),

  // =======================
  // 数据节点配置
  // 必须在这里注册，否则平台不会授予该节点的读写权限
  // =======================
  dataNodes: {
    // 存放 MSLX 地址、用户名、JWT 令牌、选中的实例 ID
    // USER 级别：每个账号各自独立；isPublic=false：公开访问模式下不可读
    mslx: {
      scope: 'user',
      isPublic: false,
    },
  },
};