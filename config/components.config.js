/**
 * 组件配置文件
 * 类似于 vue 路由配置，name 值全局不可以重复
 */

// 导入组件对象（只在浏览器环境使用）
import { Widget as MslxWidget } from '../src/components/widget.js';
import { WidgetConfig as MslxConfig } from '../src/components/widgetConfig.js';
import { MainPage as MslxMain } from '../src/components/mainPage.js';
import { PlayersPage as MslxPlayers } from '../src/components/playersPage.js';

export default {
  // =======================
  // 页面注册
  // =======================
  pages: {
    // 小部件配置页（添加/编辑小部件时以窗口形式打开）
    'mslx-config': {
      component: MslxConfig,
      background: 'linear-gradient(135deg, #e8f4ff 0%, #f0f0f5 100%)',
      backgroundDark: '#1f1f1f',
      headerTextColor: '#1890ff',
      headerTextColorDark: '#4da3ff',
    },

    // 主页面（微应用列表处统一入口打开）
    'mslx-main': {
      component: MslxMain,
      type: 'main',
      background: '#f5f6f8',
      backgroundDark: '#181818',
      headerTextColor: 'black',
      headerTextColorDark: 'white',
      showFullscreenBtn: true,
    },

    // 玩家管理（OP / 白名单 / 封禁），从主页面实例卡片的「玩家」按钮打开
    'mslx-players': {
      component: MslxPlayers,
      background: '#f5f6f8',
      backgroundDark: '#181818',
      headerTextColor: 'black',
      headerTextColorDark: 'white',
      showFullscreenBtn: true,
    },
  },

  // =======================
  // 小部件（卡片）注册
  // =======================
  widgets: {
    'mslx-widget': {
      component: MslxWidget,
      // 绑定的小部件配置页
      configComponentName: 'mslx-config',
      // 支持的卡片尺寸
      size: ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull'],
      background: '',
      widgetName: '$t:WIDGET_MSLX_NAME',
      widgetDescription: '$t:WIDGET_MSLX_DESCRIPTION',
      sort: 10,
    },
  },
};
