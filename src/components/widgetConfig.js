import { SunPanelPageElement } from '@sun-panel/micro-app';
import { html } from 'lit';
import appConfig from '../../config/app.config.js';
import {
  loadConfig,
  saveConfig,
  login as apiLogin,
  ping,
  getInstanceList,
  parseJwtExp,
  normalizeBase,
  K,
  SKINS,
  skinClass,
} from '../api/mslx.js';
import { mcSkin } from '../styles/mcSkin.js';
import { neuSkin } from '../styles/neuSkin.js';
import { glassSkin } from '../styles/glassSkin.js';
import { ensureFontFaces, fontClass, FONTS } from '../styles/fonts.js';
import { emitSkinChange } from '../utils/skinBus.js';

export class WidgetConfig extends SunPanelPageElement {
  // 皮肤样式走 Shadow DOM，与 render 里的 <style> 共存（后者优先级更高）
  static styles = [...mcSkin, neuSkin, glassSkin];

  static properties = {
    spCtx: { type: Object, attribute: false },
    widgetInfo: { type: Object },
    receivedCustomParam: { type: Object },

    baseUrl: { type: String, state: true },
    username: { type: String, state: true },
    password: { type: String, state: true },

    connState: { type: String, state: true },
    connMsg: { type: String, state: true },
    instances: { type: Array, state: true },
    instanceId: { type: String, state: true },
    tokenReady: { type: Boolean, state: true },

    useSystemBgColor: { type: Boolean, state: true },
    skin: { type: String, state: true },
    font: { type: String, state: true },
  };

  constructor() {
    super();
    this.baseUrl = '';
    this.username = '';
    this.password = '';
    this.connState = 'idle';
    this.connMsg = '';
    this.instances = [];
    this.instanceId = '';
    this.tokenReady = false;
    this.useSystemBgColor = false;
    this.skin = 'default';
    this.font = 'default';
  }

  async onInitialized(params) {
    const p = params || {};
    // 两种来源：平台作为"小部件配置"打开时传 widgetInfo；
    // 或小部件自己通过 window.open(customParam) 带过来
    this.widgetInfo = p.widgetInfo || (p.customParam && p.customParam.widgetInfo) || null;
    const platformCfg = this.widgetInfo?.config || {};

    try {
      const api = this.spCtx?.api;
      if (api?.dataNode) {
        const saved = await loadConfig(api);
        this.baseUrl = saved.baseUrl || '';
        this.username = saved.username || '';
        this.instanceId =
          saved.instanceId != null
            ? String(saved.instanceId)
            : platformCfg.instanceId != null
            ? String(platformCfg.instanceId)
            : '';
        this.useSystemBgColor = saved.useSystemBgColor ?? platformCfg.useSystemBgColor ?? false;
        this.skin = saved.skin === 'mc' ? 'mc-stone' : saved.skin || 'default';
        this.font = saved.font || 'default';
        ensureFontFaces(this.spCtx?.staticPath);
        this.tokenReady = !!saved.token && saved.tokenExpire > Date.now();
        if (this.tokenReady) {
          this.connState = 'ok';
          this.connMsg = '已连接（使用已保存的令牌）';
          await this._loadInstances();
        }
      }
    } catch (e) {
      this.connState = 'fail';
      this.connMsg = '初始化失败：' + (e?.message || e);
    }
    this.requestUpdate();
  }

  /** 测试连通性并登录换取令牌 */
  async handleConnect() {
    if (this.connState === 'testing') return;
    const base = normalizeBase(this.baseUrl);
    if (!base) {
      this.connState = 'fail';
      this.connMsg = '请填写 MSLX 地址';
      return;
    }
    if (!this.username || !this.password) {
      this.connState = 'fail';
      this.connMsg = '请填写用户名和密码';
      return;
    }

    this.connState = 'testing';
    this.connMsg = '正在连接…';
    this.requestUpdate();

    try {
      await ping(this.spCtx.api, base);

      const data = await apiLogin(this.spCtx.api, base, this.username, this.password);
      const token = data && data.token;
      if (!token) {
        // 把实际拿到的结构暴露出来，便于定位
        let shape = '';
        try {
          shape = JSON.stringify(data);
        } catch (e) {
          shape = String(data);
        }
        throw new Error('登录返回中没有 token，实际返回：' + (shape || '空').slice(0, 260));
      }

      const exp = parseJwtExp(token);

      await saveConfig(this.spCtx.api, {
        [K.baseUrl]: base,
        [K.username]: this.username,
        [K.token]: token,
        [K.tokenExpire]: exp,
      });

      this.tokenReady = true;
      this.connState = 'ok';
      this.connMsg = '连接成功';

      await this._loadInstances();
    } catch (e) {
      this.connState = 'fail';
      const msg = e?.message || '连接失败';
      this.connMsg = msg.includes('封禁') ? msg : msg + '（请勿连续重试，MSLX 有防爆破）';
      this.tokenReady = false;
    } finally {
      this.requestUpdate();
    }
  }

  async _loadInstances() {
    try {
      const list = (await getInstanceList(this.spCtx.api)) || [];
      this.instances = list;
      if (!this.instanceId && list.length) {
        const running = list.find((x) => x.status === 2) || list[0];
        this.instanceId = String(running.id);
      }
    } catch (e) {
      this.connMsg = '已连接，但读取实例列表失败：' + (e?.message || '');
    }
    this.requestUpdate();
  }

  /**
   * 保存配置
   *
   * 不走 api.widget.save —— 它要求平台内部完整的 widgetInfo 结构，
   * 从卡片齿轮打开时会抛 "Cannot read properties of undefined (reading 'microAppId')"。
   * 直接把选中的实例写进数据节点，小部件轮询时自己读出来。
   */
  async handleSave() {
    try {
      await saveConfig(this.spCtx.api, {
        [K.instanceId]: this.instanceId === '' ? null : Number(this.instanceId),
        [K.useSystemBgColor]: this.useSystemBgColor,
        [K.skin]: this.skin,
        [K.font]: this.font,
      });
      // 立刻通知已渲染的卡片/页面切换，不必刷新
      emitSkinChange(this.skin, this.font);
      this.connState = 'ok';
      this.connMsg = '已保存 — 卡片已即时切换，无需刷新';
    } catch (e) {
      this.connState = 'fail';
      this.connMsg = '保存失败：' + (e?.message || e);
    }
    this.requestUpdate();
  }

  getTitle() {
    return this.widgetInfo?.id !== 0 ? '编辑 MSLX 小部件' : '添加 MSLX 小部件';
  }

  /** 版本号，用于确认浏览器加载的是不是最新构建 */
  getVersionTag() {
    return `v${appConfig.version}`;
  }

  getButtonTitle() {
    return this.widgetInfo?.id !== 0 ? '保存小部件' : '创建小部件';
  }

  _renderStatus() {
    const map = {
      idle: { color: '#8c8c8c', icon: '○' },
      testing: { color: '#1890ff', icon: '◌' },
      ok: { color: '#52c41a', icon: '●' },
      fail: { color: '#ff4d4f', icon: '●' },
    };
    const s = map[this.connState] || map.idle;
    if (!this.connMsg) return html``;
    return html`
      <div class="conn-status" style="color:${s.color}">
        <span>${s.icon}</span><span>${this.connMsg}</span>
      </div>
    `;
  }

  render() {
    const darkMode = this.spCtx?.darkMode ?? false;
    return html`
      <style>
        :host { height: 100%; width: 100%; display: block; }
        .container {
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
          height: 100%;
          width: 100%;
          box-sizing: border-box;
          color: ${darkMode ? '#e5e5e5' : '#262626'};
          display: flex;
          flex-direction: column;
        }
        .content-wrapper { flex: 1; overflow-y: auto; padding-right: 4px; }
        .content-wrapper::-webkit-scrollbar { width: 6px; }
        .content-wrapper::-webkit-scrollbar-thumb {
          background: ${darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'};
          border-radius: 3px;
        }
        h1 { color: #1890ff; margin: 0 0 4px; font-size: 18px; font-weight: 600; }
        .ver {
          font-size: 11px;
          font-weight: 400;
          opacity: 0.55;
          margin-left: 6px;
          border: 1px solid currentColor;
          border-radius: 3px;
          padding: 1px 5px;
          vertical-align: middle;
        }
        .subtitle { color: #8c8c8c; margin-bottom: 16px; font-size: 12px; }

        .form-section {
          background: ${darkMode ? 'rgba(38,38,38,0.7)' : 'rgba(250,250,250,0.7)'};
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
          border: 1px solid ${darkMode ? 'rgba(48,48,48,0.8)' : 'rgba(232,232,232,0.8)'};
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          color: ${darkMode ? '#e5e5e5' : '#262626'};
        }
        .section-title::before {
          content: '';
          width: 3px;
          height: 14px;
          background: #1890ff;
          margin-right: 6px;
          border-radius: 2px;
        }
        .form-group { margin: 12px 0; }
        .form-group:first-child { margin-top: 0; }
        .form-group:last-child { margin-bottom: 0; }
        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 13px;
          color: ${darkMode ? '#d9d9d9' : '#595959'};
        }
        .hint { font-size: 11px; color: #8c8c8c; margin-top: 4px; line-height: 1.5; }
        input.styled-input, select.styled-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid ${darkMode ? '#303030' : '#d9d9d9'};
          border-radius: 4px;
          font-size: 13px;
          color: ${darkMode ? '#e5e5e5' : '#262626'};
          background: ${darkMode ? '#1a1a1a' : '#fff'};
          box-sizing: border-box;
        }
        input.styled-input:focus, select.styled-input:focus {
          outline: none;
          border-color: #1890ff;
          box-shadow: 0 0 0 3px rgba(24,144,255,0.1);
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 4px;
          background: ${darkMode ? '#1a1a1a' : '#fff'};
          border: 1px solid ${darkMode ? '#303030' : '#d9d9d9'};
          font-size: 12px;
        }
        .checkbox-label input { margin-right: 8px; width: 16px; height: 16px; accent-color: #1890ff; }
        .row-btn { display: flex; gap: 8px; margin-top: 12px; }
        .btn-secondary {
          padding: 8px 18px;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          background: transparent;
          font-weight: 500;
          color: ${darkMode ? '#e5e5e5' : '#262626'};
          border: 1px solid ${darkMode ? '#303030' : '#d9d9d9'};
        }
        .btn-secondary:hover { border-color: #1890ff; color: #1890ff; }
        .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
        .conn-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          margin-top: 10px;
          padding: 8px 10px;
          border-radius: 4px;
          background: ${darkMode ? 'rgba(24,144,255,0.08)' : 'rgba(24,144,255,0.06)'};
        }
        .button-container {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid ${darkMode ? '#303030' : '#e8e8e8'};
          flex-shrink: 0;
        }
        .debug-line {
          font-size: 10px;
          opacity: 0.45;
          text-align: right;
          padding: 6px 2px 0;
          font-family: monospace;
        }
        button.primary {
          padding: 8px 24px;
          background: #1890ff;
          color: #fff;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(24,144,255,0.15);
        }
        button.primary:hover { background: #40a9ff; }
      </style>

      <div
        class="container ${darkMode ? 'dark' : ''} ${skinClass(this.skin)} ${fontClass(this.font)}"
      >
        <div class="content-wrapper">
          <h1>${this.getTitle()} <span class="ver">${this.getVersionTag()}</span></h1>
          <p class="subtitle">连接到你的 MSLX 守护进程，监控并管理 Minecraft 服务器</p>

          <form @submit="${(e) => e.preventDefault()}">
            <div class="form-section">
              <div class="section-title">连接设置</div>

              <div class="form-group">
                <label>MSLX 地址</label>
                <input
                  class="styled-input"
                  type="text"
                  placeholder="http://192.168.1.100:1027"
                  .value="${this.baseUrl}"
                  @input="${(e) => (this.baseUrl = e.target.value)}"
                />
                <div class="hint">
                  需在微应用 networkDomains 白名单内（含端口）
                </div>
              </div>

              <div class="form-group">
                <label>用户名</label>
                <input
                  class="styled-input"
                  type="text"
                  placeholder="MSLX 登录用户名"
                  .value="${this.username}"
                  @input="${(e) => (this.username = e.target.value)}"
                />
              </div>

              <div class="form-group">
                <label>密码</label>
                <input
                  class="styled-input"
                  type="password"
                  placeholder="MSLX 登录密码"
                  .value="${this.password}"
                  @input="${(e) => (this.password = e.target.value)}"
                />
                <div class="hint">密码只在连接时用一次，不保存；保存的是登录后的令牌</div>
              </div>

              <div class="row-btn">
                <button
                  type="button"
                  class="btn-secondary"
                  ?disabled=${this.connState === 'testing'}
                  @click=${this.handleConnect}
                >
                  ${this.connState === 'testing' ? '连接中…' : '测试连接并登录'}
                </button>
              </div>

              ${this._renderStatus()}
            </div>

            <div class="form-section">
              <div class="section-title">选择服务器</div>
              <div class="form-group">
                <div class="hint" style="margin-top:0">
                  服务器选择已移到卡片上：<b>点卡片左上角的服务器名</b>即可切换，
                  每张卡片各自独立记忆，可以同时盯不同的服务器。
                </div>
                ${this.instances.length
                  ? html`<div class="hint">
                      当前账号下共 ${this.instances.length} 个实例，其中
                      ${this.instances.filter((x) => x.status === 2).length} 个运行中
                    </div>`
                  : ''}
              </div>
            </div>

            <div class="form-section">
              <div class="section-title">外观</div>

              <div class="form-group">
                <label>卡片皮肤</label>
                <select
                  class="styled-input"
                  .value="${this.skin}"
                  @change="${(e) => { this.skin = e.target.value; emitSkinChange(this.skin, this.font); }}"
                >
                  ${SKINS.map(
                    (s) => html`<option value="${s.key}" ?selected=${this.skin === s.key}>
                      ${s.label}
                    </option>`
                  )}
                </select>
                <div class="hint">
                  选「我的世界」会切换成原版 GUI 风格：像素边框、方块按钮、MC 配色、石头纹理
                </div>
              </div>

              <div class="form-group">
                <label>字体</label>
                <select
                  class="styled-input"
                  .value="${this.font}"
                  @change="${(e) => { this.font = e.target.value; emitSkinChange(this.skin, this.font); }}"
                >
                  ${FONTS.map(
                    (f) => html`<option value="${f.key}" ?selected=${this.font === f.key}>
                      ${f.label}
                    </option>`
                  )}
                </select>
                <div class="hint">
                  Mojangles 是 Minecraft 原版字体（仅英文/数字），中文自动回退 Unifont；
                  Unifont 是像素等宽字体，中英文统一
                </div>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    .checked="${this.useSystemBgColor}"
                    @change="${(e) => (this.useSystemBgColor = e.target.checked)}"
                  />
                  使用系统背景色（取消则跟随深浅色自动切换）
                </label>
              </div>
            </div>
          </form>
        </div>

        <div class="debug-line">
          构建 ${this.getVersionTag()} ｜ 令牌 ${this.tokenReady ? '有效' : '无'} ｜ 实例
          ${this.instanceId || '未选'} ｜ 状态 ${this.connState}
        </div>

        <div class="button-container">
          <button type="button" class="primary" @click=${this.handleSave}>
            ${this.getButtonTitle()}
          </button>
        </div>
      </div>
    `;
  }
}
