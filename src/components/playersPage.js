import { SunPanelPageElement } from '@sun-panel/micro-app';
import { html, css } from 'lit';
import {
  loadConfig,
  getInstanceInfo,
  getPlayerHistory,
  getOps,
  getWhitelist,
  getBannedPlayers,
  addWhitelist,
  removeWhitelist,
  addOp,
  removeOp,
  addBan,
  removeBan,
  statusOf,
  skinClass,
} from '../api/mslx.js';
import { mcSkin } from '../styles/mcSkin.js';
import { neuSkin } from '../styles/neuSkin.js';
import { glassSkin } from '../styles/glassSkin.js';
import { ensureFontFaces, fontClass } from '../styles/fonts.js';
import { onSkinChange } from '../utils/skinBus.js';

const TABS = [
  { key: 'history', label: '玩家历史' },
  { key: 'ops', label: 'OP' },
  { key: 'whitelist', label: '白名单' },
  { key: 'banned', label: '封禁' },
];

export class PlayersPage extends SunPanelPageElement {
  static properties = {
    spCtx: { type: Object, attribute: false },
    customParam: { type: Object },
    instanceId: { type: Object, state: true },
    instance: { type: Object, state: true },
    tab: { type: String, state: true },
    history: { type: Array, state: true },
    ops: { type: Array, state: true },
    whitelist: { type: Array, state: true },
    banned: { type: Array, state: true },
    loading: { type: Boolean, state: true },
    busy: { type: String, state: true },
    msg: { type: String, state: true },
    msgType: { type: String, state: true },
    skin: { type: String, state: true },
    font: { type: String, state: true },
  };

  constructor() {
    super();
    this.instanceId = null;
    this.instance = null;
    this.tab = 'history';
    this.history = [];
    this.ops = [];
    this.whitelist = [];
    this.banned = [];
    this.loading = true;
    this.busy = '';
    this.msg = '';
    this.msgType = 'ok';
    this.skin = 'default';
    this.font = 'default';
  }

  async onInitialized(params) {
    const p = params || {};
    this.instanceId = p.customParam?.instanceId ?? null;
    if (!this.instanceId) {
      this.loading = false;
      this.msg = '未指定实例，请从主页面实例卡片的「玩家」按钮进入';
      this.msgType = 'fail';
      this.requestUpdate();
      return;
    }
    await this.reloadAll();
  }

  async reloadAll() {
    const api = this.spCtx?.api;
    if (!api) return;
    this.loading = true;
    this.requestUpdate();
    try {
      const cfg = await loadConfig(api);
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
      const [info, hist, ops, wl, ban] = await Promise.all([
        getInstanceInfo(api, this.instanceId).catch(() => null),
        getPlayerHistory(api, this.instanceId).catch(() => ({ players: [] })),
        getOps(api, this.instanceId).catch(() => []),
        getWhitelist(api, this.instanceId).catch(() => []),
        getBannedPlayers(api, this.instanceId).catch(() => []),
      ]);
      this.instance = info;
      this.history = Array.isArray(hist?.players) ? hist.players : Array.isArray(hist) ? hist : [];
      this.ops = Array.isArray(ops) ? ops : [];
      this.whitelist = Array.isArray(wl) ? wl : [];
      this.banned = Array.isArray(ban) ? ban : [];
    } catch (e) {
      this.msg = '加载失败：' + (e?.message || e);
      this.msgType = 'fail';
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  _in(list, player) {
    const name = (player?.name || '').toLowerCase();
    return (list || []).some((x) => (x?.name || '').toLowerCase() === name);
  }

  async _do(key, fn, okText) {
    if (this.busy) return;
    this.busy = key;
    this.msg = '';
    this.requestUpdate();
    try {
      await fn();
      this.msg = okText;
      this.msgType = 'ok';
      await this.reloadAll();
    } catch (e) {
      this.msg = e?.message || '操作失败';
      this.msgType = 'fail';
    } finally {
      this.busy = '';
      this.requestUpdate();
    }
  }

  _toggleWhitelist(p) {
    const api = this.spCtx.api;
    const inList = this._in(this.whitelist, p);
    return this._do(
      `wl-${p.name}`,
      () => (inList ? removeWhitelist(api, this.instanceId, p) : addWhitelist(api, this.instanceId, p)),
      inList ? `已从白名单移除 ${p.name}` : `已把 ${p.name} 加入白名单`
    );
  }

  _toggleOp(p) {
    const api = this.spCtx.api;
    const inList = this._in(this.ops, p);
    return this._do(
      `op-${p.name}`,
      () => (inList ? removeOp(api, this.instanceId, p) : addOp(api, this.instanceId, p)),
      inList ? `已撤销 ${p.name} 的 OP` : `已给 ${p.name} OP 权限`
    );
  }

  _toggleBan(p) {
    const api = this.spCtx.api;
    const inList = this._in(this.banned, p);
    return this._do(
      `ban-${p.name}`,
      () => (inList ? removeBan(api, this.instanceId, p) : addBan(api, this.instanceId, p)),
      inList ? `已解封 ${p.name}` : `已封禁 ${p.name}`
    );
  }

  _renderRow(p, opts = {}) {
    const { showActions = true } = opts;
    const inWl = this._in(this.whitelist, p);
    const inOp = this._in(this.ops, p);
    const inBan = this._in(this.banned, p);
    return html`
      <div class="prow">
        <div class="pinfo">
          <div class="pname">${p.name || '?'}</div>
          <div class="pmeta">
            ${p.lastLoginTime ? html`<span>最后登录 ${p.lastLoginTime}</span>` : ''}
            ${p.loginCount !== undefined ? html`<span>登录 ${p.loginCount} 次</span>` : ''}
            ${p.lastIp ? html`<span>${p.lastIp}</span>` : ''}
            ${p.level !== undefined ? html`<span>等级 ${p.level}</span>` : ''}
          </div>
        </div>
        ${showActions
          ? html`
              <div class="pacts">
                <button
                  class="pbtn ${inWl ? 'on' : ''}"
                  ?disabled=${!!this.busy}
                  @click=${() => this._toggleWhitelist(p)}
                >
                  ${this.busy === `wl-${p.name}` ? '…' : inWl ? '移出白名单' : '白名单'}
                </button>
                <button
                  class="pbtn ${inOp ? 'on' : ''}"
                  ?disabled=${!!this.busy}
                  @click=${() => this._toggleOp(p)}
                >
                  ${this.busy === `op-${p.name}` ? '…' : inOp ? '撤销OP' : '给OP'}
                </button>
                <button
                  class="pbtn danger ${inBan ? 'on' : ''}"
                  ?disabled=${!!this.busy}
                  @click=${() => this._toggleBan(p)}
                >
                  ${this.busy === `ban-${p.name}` ? '…' : inBan ? '解封' : '封禁'}
                </button>
              </div>
            `
          : ''}
      </div>
    `;
  }

  _renderEmpty(text) {
    return html`<div class="empty">${text}</div>`;
  }

  renderContent() {
    if (this.loading) return html`<div class="empty">加载中…</div>`;

    if (this.tab === 'history') {
      if (!this.history.length) return this._renderEmpty('还没有玩家登录记录');
      return html`${this.history.map((p) => this._renderRow(p))}`;
    }
    if (this.tab === 'ops') {
      if (!this.ops.length) return this._renderEmpty('没有 OP');
      return html`${this.ops.map((p) => this._renderRow(p))}`;
    }
    if (this.tab === 'whitelist') {
      if (!this.whitelist.length) return this._renderEmpty('白名单为空');
      return html`${this.whitelist.map((p) => this._renderRow(p, { showActions: false }))}
        <div class="tip">要添加白名单，请到「玩家历史」里给对应玩家点「白名单」</div>`;
    }
    if (this.tab === 'banned') {
      if (!this.banned.length) return this._renderEmpty('没有封禁的玩家');
      return html`${this.banned.map((p) => this._renderRow(p))}`;
    }
    return '';
  }

  render() {
    const dark = this.spCtx?.darkMode ?? false;
    const st = statusOf(this.instance?.status);

    return html`
      <div class="page ${dark ? 'dark' : ''} ${skinClass(this.skin)} ${fontClass(this.font)}">
        <div class="header">
          <div class="h-left">
            <span class="dot" style="background:${st.color}"></span>
            <span class="title">${this.instance?.name || '玩家管理'}</span>
            <span class="status" style="color:${st.color}">${this.instance?.statusText || ''}</span>
          </div>
          <button class="btn" ?disabled=${this.loading} @click=${() => this.reloadAll()}>
            ${this.loading ? '刷新中' : '刷新'}
          </button>
        </div>

        <div class="tabs">
          ${TABS.map(
            (t) => html`
              <button
                class="tab ${this.tab === t.key ? 'active' : ''}"
                @click=${() => {
                  this.tab = t.key;
                  this.requestUpdate();
                }}
              >
                ${t.label}
                ${t.key === 'ops' && this.ops.length ? html`<i>${this.ops.length}</i>` : ''}
                ${t.key === 'whitelist' && this.whitelist.length
                  ? html`<i>${this.whitelist.length}</i>`
                  : ''}
                ${t.key === 'banned' && this.banned.length ? html`<i>${this.banned.length}</i>` : ''}
              </button>
            `
          )}
        </div>

        ${this.msg ? html`<div class="msg ${this.msgType}">${this.msg}</div>` : ''}

        <div class="list">${this.renderContent()}</div>
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
      box-sizing: border-box;
      padding: 14px;
      overflow-y: auto;
      background: #f5f6f8;
      color: #262626;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    }
    .page.dark { background: #181818; color: #e5e5e5; }

    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .h-left { display: flex; align-items: center; gap: 7px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .title { font-size: 16px; font-weight: 700; }
    .status { font-size: 11px; }
    .btn {
      background: transparent; border: 1px solid rgba(128,128,128,0.35);
      color: inherit; font-size: 12px; padding: 5px 14px; border-radius: 5px;
      cursor: pointer; font-family: inherit;
    }
    .btn:hover { border-color: #1890ff; color: #1890ff; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .tabs { display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
    .tab {
      background: transparent; border: 1px solid rgba(128,128,128,0.3);
      color: inherit; font-size: 12px; padding: 4px 12px; border-radius: 14px;
      cursor: pointer; font-family: inherit; opacity: 0.75;
    }
    .tab.active { border-color: #1890ff; color: #1890ff; opacity: 1; background: rgba(24,144,255,0.08); }
    .tab i { font-style: normal; font-size: 10px; opacity: 0.7; margin-left: 3px; }

    .msg {
      font-size: 12px; padding: 7px 11px; border-radius: 5px; margin-bottom: 10px;
    }
    .msg.ok { background: rgba(82,196,26,0.12); color: #52c41a; }
    .msg.fail { background: rgba(255,77,79,0.12); color: #ff4d4f; }

    .list { display: flex; flex-direction: column; gap: 8px; }

    .prow {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 9px 12px; border-radius: 7px;
      background: #fff; border: 1px solid rgba(0,0,0,0.06);
    }
    .page.dark .prow { background: #232323; border-color: rgba(255,255,255,0.08); }

    .pinfo { min-width: 0; flex: 1 1 auto; }
    .pname { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pmeta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 3px; font-size: 10px; opacity: 0.55; }

    .pacts { display: flex; gap: 5px; flex: 0 0 auto; }
    .pbtn {
      background: transparent; border: 1px solid rgba(128,128,128,0.35);
      color: inherit; font-size: 11px; padding: 3px 9px; border-radius: 4px;
      cursor: pointer; font-family: inherit; white-space: nowrap;
    }
    .pbtn:hover { background: rgba(128,128,128,0.12); }
    .pbtn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pbtn.on { border-color: #52c41a; color: #52c41a; background: rgba(82,196,26,0.1); }
    .pbtn.danger.on { border-color: #ff4d4f; color: #ff4d4f; background: rgba(255,77,79,0.1); }

    .empty { text-align: center; padding: 40px 0; font-size: 12px; opacity: 0.5; }
    .tip { font-size: 11px; opacity: 0.5; padding: 8px 2px; }
  `,
  ];
}
