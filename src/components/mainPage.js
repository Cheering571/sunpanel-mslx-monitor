import { html, css } from 'lit';
import { SunPanelPageElement } from '@sun-panel/micro-app';
import {
  loadConfig,
  getInstanceList,
  getInstanceInfo,
  getDaemonStatus,
  getOnlinePlayers,
  instanceAction,
  statusOf,
  formatMB,
  formatUptime,
  skinClass,
} from '../api/mslx.js';
import { mcSkin } from '../styles/mcSkin.js';
import { neuSkin } from '../styles/neuSkin.js';
import { glassSkin } from '../styles/glassSkin.js';
import { ensureFontFaces, fontClass } from '../styles/fonts.js';
import { onSkinChange } from '../utils/skinBus.js';

/** 玩家接口返回结构归一化（兼容字符串数组 / 对象数组） */
function normalizePlayers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => {
      if (typeof p === 'string') return { name: p };
      if (!p || typeof p !== 'object') return null;
      return {
        name: p.name || p.playerName || p.username || p.displayName || '?',
        uuid: p.uuid || p.UUID || '',
      };
    })
    .filter(Boolean);
}

const POLL_MS = 30000;

export class MainPage extends SunPanelPageElement {
  static properties = {
    spCtx: { type: Object, attribute: false },
    customParam: { type: Object },
    instances: { type: Array, state: true },
    daemon: { type: Object, state: true },
    loading: { type: Boolean, state: true },
    refreshing: { type: Boolean, state: true },
    error: { type: String, state: true },
    configured: { type: Boolean, state: true },
    lastUpdate: { type: String, state: true },
    pending: { type: Object, state: true },
    busyId: { type: Object, state: true },
    skin: { type: String, state: true },
    font: { type: String, state: true },
  };

  constructor() {
    super();
    this.instances = [];
    this.daemon = null;
    this.loading = true;
    this.refreshing = false;
    this.error = '';
    this.configured = false;
    this.lastUpdate = '';
    this.pending = null; // { id, action }
    this.busyId = null;
    this._timerId = null;
    this.skin = 'default';
    this.font = 'default';
  }

  async onInitialized(_param) {
    try {
      const api = this.spCtx?.api;
      if (!api?.dataNode) {
        this.loading = false;
        this.requestUpdate();
        return;
      }
      const cfg = await loadConfig(api);
      this._baseUrl = cfg.baseUrl || '';
      this.skin = cfg.skin || 'default';
      this.font = cfg.font || 'default';
      ensureFontFaces(this.spCtx?.staticPath);
      // 配置页改皮肤后即时跟随，不用刷新
      if (!this._unsubSkin) {
        this._unsubSkin = onSkinChange((d) => {
          if (d.skin !== undefined && d.skin !== null) this.skin = d.skin;
          if (d.font !== undefined && d.font !== null) this.font = d.font;
        });
      }
      this.configured = !!(cfg.baseUrl && cfg.token);
      if (!this.configured) {
        this.loading = false;
        this.requestUpdate();
        return;
      }
      await this.refresh();
      this._timerId = this.spCtx.api.timer.setInterval(() => this.refresh(true), POLL_MS);
    } catch (e) {
      this.error = e?.message || '初始化失败';
      this.loading = false;
      this.requestUpdate();
    }
  }

  onDisconnected() {
    if (this._timerId !== null) {
      this.spCtx.api.timer.clearInterval(this._timerId);
      this._timerId = null;
    }
    try {
      this._unsubSkin?.();
    } catch (e) {
      /* 忽略 */
    }
    this._unsubSkin = null;
  }

  async refresh(silent = false) {
    if (this.refreshing) return;
    this.refreshing = true;
    if (!silent) this.loading = true;
    this.requestUpdate();
    try {
      const api = this.spCtx.api;
      const [listRaw, daemon] = await Promise.all([
        getInstanceList(api),
        getDaemonStatus(api).catch(() => null),
      ]);

      const list = (listRaw || []).map((x) => ({ ...x }));

      // 状态变化检测：运行中(2) -> 未启动(0) 视为异常停止（崩溃）
      const prev = this._prevStatus || {};
      list.forEach((inst) => {
        const was = prev[inst.id];
        if (was === 2 && inst.status === 0) inst._crashed = true;
        if (inst.status === 2) inst._crashed = false;
      });
      this._prevStatus = {};
      list.forEach((x) => {
        this._prevStatus[x.id] = x.status;
      });

      // 只对运行中的实例拉在线玩家，避免无谓请求
      const runningOnes = list.filter((x) => x.status === 2);
      await Promise.all(
        runningOnes.map(async (inst) => {
          try {
            const raw = await getOnlinePlayers(api, inst.id);
            inst._players = normalizePlayers(raw);
          } catch (e) {
            inst._players = [];
          }
        })
      );

      this.instances = list;
      this.daemon = daemon;
      this.error = '';
      const d = new Date();
      this.lastUpdate = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
        2,
        '0'
      )}:${String(d.getSeconds()).padStart(2, '0')}`;
    } catch (e) {
      this.error = e?.message || '请求失败';
    } finally {
      this.loading = false;
      this.refreshing = false;
      this.requestUpdate();
    }
  }

  /** 从主页面直接打开配置页 */
  openConfig() {
    try {
      this.spCtx.api.window.open({
        componentName: 'mslx-config',
        title: '配置 MSLX',
      });
    } catch (e) {
      /* 忽略 */
    }
  }

  /** 打开玩家管理页 */
  openPlayers(inst, ev) {
    if (ev) ev.stopPropagation();
    try {
      this.spCtx.api.window.open({
        componentName: 'mslx-players',
        title: `玩家管理 - ${inst.name}`,
        customParam: { instanceId: inst.id },
      });
    } catch (e) {
      /* 忽略 */
    }
  }

  /** 两步确认：停止/重启需要确认，启动和备份直接执行 */
  async handleAction(inst, action) {
    if (this.busyId != null) return;

    const needConfirm = action === 'stop' || action === 'restart';
    if (needConfirm) {
      const p = this.pending;
      if (!p || p.id !== inst.id || p.action !== action) {
        this.pending = { id: inst.id, action };
        this.requestUpdate();
        this.spCtx.api.timer.setTimeout(() => {
          if (this.pending && this.pending.id === inst.id) {
            this.pending = null;
            this.requestUpdate();
          }
        }, 4000);
        return;
      }
    }

    this.pending = null;
    this.busyId = inst.id;
    this.requestUpdate();
    try {
      await instanceAction(this.spCtx.api, inst.id, action);
      // 状态切换需要时间，稍后再拉一次
      this.spCtx.api.timer.setTimeout(() => this.refresh(true), 2500);
    } catch (e) {
      this.error = e?.message || '操作失败';
    } finally {
      this.busyId = null;
      this.requestUpdate();
    }
  }

  /** 展开实例详情（端口/内存/运行时长需要单独请求） */
  async expand(inst, ev) {
    if (ev) ev.stopPropagation();
    try {
      const detail = await getInstanceInfo(this.spCtx.api, inst.id);
      if (detail) {
        this.instances = this.instances.map((x) => (x.id === inst.id ? { ...x, ...detail } : x));
        this.requestUpdate();
      }
    } catch (e) {
      this.error = e?.message || '读取详情失败';
      this.requestUpdate();
    }
  }

  _label(inst, action) {
    const p = this.pending;
    if (p && p.id === inst.id && p.action === action) {
      return action === 'stop'
        ? '确认停止'
        : action === 'restart'
        ? '确认重启'
        : action === 'backup'
        ? '确认备份'
        : '确认';
    }
    return action === 'stop'
      ? '停止'
      : action === 'restart'
      ? '重启'
      : action === 'start'
      ? '启动'
      : action === 'backup'
      ? '备份'
      : action;
  }

  renderInstance(inst) {
    const st = statusOf(inst.status);
    const running = inst.status === 2;
    const busy = this.busyId === inst.id;
    const port = inst.mcConfig?.serverPort;
    const mem = inst.maxM;
    const uptime = inst.uptime;

    return html`
      <div class="inst ${inst._crashed ? 'crashed' : ''}">
        <div class="inst-head">
          <span class="dot" style="background:${st.color}"></span>
          <span class="inst-name">${inst.name}</span>
          <span class="inst-badge" style="color:${st.color};border-color:color-mix(in srgb, ${st.color} 30%, transparent)">
            ${st.text}
          </span>
          ${inst._crashed
            ? html`<span class="crash-badge">异常停止</span>`
            : ''}
          <span class="spacer"></span>
          <button class="mini-btn" @click=${(e) => this.expand(inst, e)} title="加载详情">⋯</button>
        </div>

        <div class="inst-meta">
          ${port ? html`<span class="chip">端口 ${port}</span>` : ''}
          ${mem ? html`<span class="chip">内存 ${formatMB(mem)}</span>` : ''}
          ${uptime ? html`<span class="chip">运行 ${formatUptime(uptime)}</span>` : ''}
          <span class="chip">在线 ${running ? inst.onlinePlayers ?? inst.extra?.onlinePlayers ?? 0 : '—'}</span>
          ${inst.mcConfig?.gamemode ? html`<span class="chip">${inst.mcConfig.gamemode}</span>` : ''}
          ${inst.mcConfig?.difficulty ? html`<span class="chip">${inst.mcConfig.difficulty}</span>` : ''}
        </div>

        ${running && inst._players && inst._players.length
          ? html`
              <div class="players">
                <span class="players-label">玩家</span>
                ${inst._players.map((p) => html`<span class="pchip" title=${p.uuid || ''}>${p.name}</span>`)}
              </div>
            `
          : ''}

        <div class="inst-actions">
          <button class="act" @click=${(e) => this.openPlayers(inst, e)}>玩家</button>
          ${running
            ? html`
                <button
                  class="act"
                  ?disabled=${busy}
                  @click=${() => this.handleAction(inst, 'backup')}
                >
                  ${busy ? '…' : this._label(inst, 'backup')}
                </button>
                <button
                  class="act"
                  ?disabled=${busy}
                  @click=${() => this.handleAction(inst, 'restart')}
                >
                  ${busy ? '…' : this._label(inst, 'restart')}
                </button>
                <button
                  class="act danger"
                  ?disabled=${busy}
                  @click=${() => this.handleAction(inst, 'stop')}
                >
                  ${busy ? '…' : this._label(inst, 'stop')}
                </button>
              `
            : html`
                <button
                  class="act ok"
                  ?disabled=${busy}
                  @click=${() => this.handleAction(inst, 'start')}
                >
                  ${busy ? '…' : this._label(inst, 'start')}
                </button>
              `}
        </div>
      </div>
    `;
  }

  render() {
    const dark = this.spCtx?.darkMode ?? false;
    const skinCls = skinClass(this.skin) + ' ' + fontClass(this.font);

    if (!this.configured) {
      return html`
        <div class="page ${dark ? 'dark' : ''} ${skinCls}">
          <div class="center">
            <div class="big-icon">⚙</div>
            <div class="center-title">尚未连接 MSLX</div>
            <div class="center-hint">请回到导航页，点击 MSLX 卡片上的齿轮按钮完成配置</div>
            <button class="icon-btn" style="margin-top:14px" @click=${this.openConfig}>打开配置</button>
          </div>
        </div>
      `;
    }

    const running = this.instances.filter((x) => x.status === 2).length;
    const total = this.instances.length;

    return html`
      <div class="page ${dark ? 'dark' : ''} ${skinCls}">
        <div class="header">
          <div class="h-left">
            <div class="h-title">MSLX 服务器</div>
            <div class="h-sub">
              ${running} / ${total} 运行中
              ${this.daemon?.systemInfo?.hostname ? html` · ${this.daemon.systemInfo.hostname}` : ''}
              ${this.lastUpdate ? html` · ${this.lastUpdate}` : ''}
            </div>
          </div>
          <div class="h-right">
            ${this._baseUrl
              ? html`<a
                  class="icon-btn"
                  href="${this._baseUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="text-decoration:none;"
                  >控制台</a
                >`
              : ''}
            <button class="icon-btn" ?disabled=${this.refreshing} @click=${() => this.refresh()}>
              ${this.refreshing ? '刷新中' : '刷新'}
            </button>
          </div>
        </div>

        ${this.error
          ? html`<div class="err">${this.error}</div>`
          : ''}

        ${this.loading
          ? html`<div class="center"><div class="center-hint">加载中…</div></div>`
          : this.instances.length === 0
          ? html`<div class="center"><div class="center-hint">暂无服务器实例</div></div>`
          : html`<div class="list">${this.instances.map((x) => this.renderInstance(x))}</div>`}

        ${this.daemon
          ? html`
              <div class="footer">
                <span>${this.daemon.clientName} v${this.daemon.version}</span>
                <span>${this.daemon.systemInfo?.osType ?? ''} ${this.daemon.systemInfo?.osVersion ?? ''}</span>
                <span>${this.daemon.systemInfo?.netVersion ?? ''}</span>
              </div>
            `
          : ''}
      </div>
    `;
  }

  static styles = [
    ...mcSkin,
    neuSkin,
    glassSkin,
    css`
    :host { display: block; height: 100%; width: 100%; }
    /* 默认皮肤下的状态色（浅底用深色字 / 深底用亮色字） */
    .page:not(.skin-mc):not(.skin-neu):not(.skin-glass) {
      --st-stopped: #5a5a5a;
      --st-running: #1a7f37;
      --st-starting: #8a5a00;
      --st-stopping: #8a5a00;
    }
    .page.dark:not(.skin-mc):not(.skin-neu):not(.skin-glass) {
      --st-stopped: #b8b8b8;
      --st-running: #6ee787;
      --st-starting: #ffd166;
      --st-stopping: #ffd166;
    }
    .page {
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      padding: 16px;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background: #f5f6f8;
      color: #262626;
    }
    .page.dark { background: #181818; color: #e5e5e5; }

    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
    .h-title { font-size: 17px; font-weight: 700; }
    .h-sub { font-size: 11px; opacity: 0.6; margin-top: 3px; }
    .icon-btn {
      background: transparent; border: 1px solid rgba(128,128,128,0.35);
      color: inherit; font-size: 12px; padding: 5px 14px; border-radius: 5px;
      cursor: pointer; font-family: inherit;
    }
    .icon-btn:hover { border-color: #1890ff; color: #1890ff; }
    .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .err {
      background: rgba(255,77,79,0.1); color: #ff4d4f;
      font-size: 12px; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px;
    }

    .list { display: flex; flex-direction: column; gap: 10px; }

    .inst {
      border-radius: 8px; padding: 12px 14px;
      background: #fff; border: 1px solid rgba(0,0,0,0.06);
    }
    .page.dark .inst { background: #232323; border-color: rgba(255,255,255,0.08); }

    .inst.crashed {
      border-color: rgba(255, 77, 79, 0.6);
      box-shadow: 0 0 0 1px rgba(255, 77, 79, 0.25), 0 0 12px rgba(255, 77, 79, 0.12);
    }
    .crash-badge {
      font-size: 10px;
      color: #ff4d4f;
      border: 1px solid rgba(255, 77, 79, 0.4);
      background: rgba(255, 77, 79, 0.1);
      padding: 1px 6px;
      border-radius: 10px;
      white-space: nowrap;
      animation: crashblink 1.6s ease-in-out infinite;
    }
    @keyframes crashblink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    .inst-head { display: flex; align-items: center; gap: 7px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
    .inst-name { font-size: 14px; font-weight: 600; }
    .inst-badge { font-size: 10px; border: 1px solid; padding: 1px 6px; border-radius: 10px; }
    .spacer { flex: 1; }
    .mini-btn {
      background: transparent; border: none; color: inherit; opacity: 0.5;
      cursor: pointer; font-size: 14px; padding: 0 4px; font-family: inherit;
    }
    .mini-btn:hover { opacity: 1; }

    .inst-meta { display: flex; flex-wrap: wrap; gap: 6px; margin: 9px 0; }
    .chip {
      font-size: 11px; padding: 2px 8px; border-radius: 4px;
      background: rgba(128,128,128,0.12); color: inherit; opacity: 0.85;
    }

    .players {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
      margin: 0 0 9px;
      padding: 7px 9px;
      border-radius: 6px;
      background: rgba(82, 196, 26, 0.08);
      border: 1px solid rgba(82, 196, 26, 0.18);
    }
    .players-label {
      font-size: 10px;
      opacity: 0.6;
      margin-right: 2px;
    }
    .pchip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(82, 196, 26, 0.16);
      color: #52c41a;
      border: 1px solid rgba(82, 196, 26, 0.3);
    }

    .inst-actions { display: flex; gap: 6px; justify-content: flex-end; }
    .act {
      background: transparent; border: 1px solid rgba(128,128,128,0.35);
      color: inherit; font-size: 12px; padding: 4px 14px; border-radius: 4px;
      cursor: pointer; font-family: inherit;
    }
    .act:hover { background: rgba(128,128,128,0.12); }
    .act:disabled { opacity: 0.5; cursor: not-allowed; }
    .act.ok { color: #52c41a; border-color: rgba(82,196,26,0.5); }
    .act.ok:hover { background: rgba(82,196,26,0.12); }
    .act.danger { color: #ff4d4f; border-color: rgba(255,77,79,0.5); }
    .act.danger:hover { background: rgba(255,77,79,0.12); }

    .center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 6px; }
    .big-icon { font-size: 32px; opacity: 0.4; }
    .center-title { font-size: 15px; font-weight: 600; }
    .center-hint { font-size: 12px; opacity: 0.6; }

    .footer {
      display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px;
      font-size: 10px; opacity: 0.45;
    }
  `,
  ];
}
