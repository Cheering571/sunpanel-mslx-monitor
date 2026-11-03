/**
 * 微应用配置文件 - MSLX 服务器监控
 * 应用基础配置
 */

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
  version: '1.10.1',
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
  // 微应用只能访问这里列出的主机。
  //
  // 重要：Sun-Panel 的白名单精确匹配 URL 里的 host，而 host 是带端口的。
  // 只写 IP 匹配不上 IP:端口，必须把带端口的写法也列进去，否则会报：
  // "No permission to access: http://192.168.1.100:1027/api/ping"
  //
  // 若 MSLX 换地址或端口，这里要同步修改后重新打包。
  // =======================
  networkDomains: ['192.168.1.100', '192.168.1.100:1027'],

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