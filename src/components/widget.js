import { SunPanelWidgetElement } from '@sun-panel/micro-app';
import { html, css } from 'lit';
import {
  loadConfig,
  getInstanceInfo,
  getInstanceList,
  instanceAction,
  statusOf,
  formatMBShort,
  formatUptimeShort,
  skinClass,
  isMcSkin,
  isThemeSkin,
  instanceIdForWidget,
  setWidgetInstance,
} from '../api/mslx.js';
import { mcSkin } from '../styles/mcSkin.js';
import { neuSkin } from '../styles/neuSkin.js';
import { glassSkin } from '../styles/glassSkin.js';
import { ensureFontFaces, fontClass } from '../styles/fonts.js';
import { onSkinChange } from '../utils/skinBus.js';

/** 轮询间隔（毫秒）。MSLX 有防爆破，不宜过快。 */
const POLL_MS = 30000;

export class Widget extends SunPanelWidgetElement {
  static properties = {
    spCtx: { type: Object, attribute: false },
    data: { type: Object, state: true },
    list: { type: Array, state: true },
    error: { type: String, state: true },
    loading: { type: Boolean, state: true },
    busy: { type: Boolean, state: true },
    configured: { type: Boolean, state: true },
    crashed: { type: Boolean, state: true },
    skin: { type: String, state: true },
    font: { type: String, state: true },
    switching: { type: Boolean, state: true },
  };

  constructor() {
    super();
    this.data = null;
    this.list = [];
    this.error = '';
    this.loading = true;
    this.busy = false;
    this.configured = false;
    this.crashed = false;
    this.skin = 'default';
    this.font = 'default';
    this.switching = false;
    this._prevStatus = undefined;
    this._timerId = null;
    this._cfg = null;
    this._polling = false;
    this._size = null;
    this._ro = null;
  }

  /** 监听真实像素尺寸，用于自适应字号与布局 */
  connectedCallback() {
    super.connectedCallback();
    try {
      if (!this._ro && typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver((entries) => {
          for (const e of entries) {
            const cr = e.contentRect;
            const w = Math.round(cr.width);
            const h = Math.round(cr.height);
            if (!this._size || this._size.w !== w || this._size.h !== h) {
              this._size = { w, h };
              this.requestUpdate();
              // 卡片尺寸变了，地址行可用宽度也变了，重新适配字号
              this.updateComplete.then(() => this._fitAddress());
            }
          }
        });
        this._ro.observe(this);
      }
    } catch (e) {
      /* 忽略 */
    }

    // 配置页改了皮肤/字体，这里即时跟随，不需要刷新页面
    if (!this._unsubSkin) {
      this._unsubSkin = onSkinChange((d) => {
        if (d.skin !== undefined && d.skin !== null) {
          this.skin = d.skin;
          if (this._cfg) this._cfg.skin = d.skin;
        }
        if (d.font !== undefined && d.font !== null) {
          this.font = d.font;
          if (this._cfg) this._cfg.font = d.font;
        }
      });
    }
  }

  /**
   * 让连接地址在固定行宽内完整显示。
   *
   * 做法：先清空内联字号（回到 CSS 计算值），量出内容自然宽度 scrollWidth，
   * 若超过容器宽度 clientWidth，就按比例缩小 font-size。
   * 相比 text-overflow: ellipsis，这样地址永远不会被截断。
   */
  _fitAddress() {
    const root = this.renderRoot;
    if (!root) return;
    const el = root.querySelector('.addrline');
    if (!el) return;

    // 复位，拿 CSS 里的基准字号
    el.style.fontSize = '';
    const avail = el.clientWidth;
    if (!avail) return;
    const need = el.scrollWidth;
    if (need > avail) {
      const base = parseFloat(getComputedStyle(el).fontSize) || 12;
      // 留 1.5% 余量，避免亚像素四舍五入后又溢出
      const next = Math.max(6, base * (avail / need) * 0.985);
      el.style.fontSize = next.toFixed(2) + 'px';
    }
  }

  onInitialized() {
    this._bootstrap();
  }

  onWidgetInfoChanged(_newInfo, _oldInfo) {
    this._bootstrap();
  }

  onDisconnected() {
    this._stopPolling();
    try {
      this._ro?.disconnect();
    } catch (e) {
      /* 忽略 */
    }
    this._ro = null;
    try {
      this._unsubSkin?.();
    } catch (e) {
      /* 忽略 */
    }
    this._unsubSkin = null;
  }

  /**
   * 根据卡片真实尺寸推算缩放因子与布局方向
   * 基准：短边 150px 对应 s=1
   */
  _metrics() {
    const w = this._size?.w || 0;
    const h = this._size?.h || 0;
    const min = Math.min(w, h) || 150;
    const max = Math.max(w, h);
    const ratio = h > 0 ? w / h : 1;
    const wide = ratio > 1.5;
    const tall = ratio < 0.72;

    // 基准维度：
    //   接近方形 -> 用短边
    //   宽扁 / 窄高 -> 长短边折中，避免短边把字号拖得过小
    const base = wide || tall ? max * 0.45 + min * 0.55 : min;

    // 下限 1.1 保证小卡片也有可读字号；上限 2.0
    const s = Math.max(1.1, Math.min(2.0, base / 145));

    return { w, h, s, ratio, wide, tall, base };
  }

  /** 首次进入：读配置 → 拉数据 → 起轮询 */
  async _bootstrap() {
    this._stopPolling();
    try {
      const api = this.spCtx?.api;
      if (!api?.dataNode) {
        this.loading = false;
        this.requestUpdate();
        return;
      }
      this._cfg = await loadConfig(api);
      this.configured = !!(this._cfg.baseUrl && this._cfg.token);
      this.skin = this._cfg.skin || 'default';
      this.font = this._cfg.font || 'default';
      ensureFontFaces(this.spCtx?.staticPath);

      if (!this.configured) {
        this.loading = false;
        this.data = null;
        this.list = [];
        this.requestUpdate();
        return;
      }
      await this._refresh();
      this._startPolling();
    } catch (e) {
      this.error = e?.message || '初始化失败';
      this.loading = false;
      this.requestUpdate();
    }
  }

  _startPolling() {
    if (this._timerId !== null) return;
    this._timerId = this.spCtx.api.timer.setInterval(() => this._refresh(), POLL_MS);
  }

  _stopPolling() {
    if (this._timerId !== null) {
      this.spCtx.api.timer.clearInterval(this._timerId);
      this._timerId = null;
    }
  }

  /** 拉取一次数据 */
  async _refresh() {
    if (this._polling) return;
    this._polling = true;
    try {
      const api = this.spCtx.api;
      // 每次都重新读，这样在配置页保存后，下一轮轮询就能生效
      const cfg = await loadConfig(api);
      this._cfg = cfg;

      // 列表模式需要全量，卡片模式也需要它来兜底选实例
      const rawList = (await getInstanceList(api)) || [];
      this.list = rawList;

      const wantedId = this._widgetInstanceId();
      let target = null;

      if (wantedId) {
        const hit = rawList.find((x) => String(x.id) === String(wantedId));
        target = hit || null;
      } else {
        target = rawList.find((x) => x.status === 2) || rawList[0] || null;
      }

      // 补一次详情，拿到端口 / 运行时长 / 内存
      if (target && target.id != null) {
        try {
          const detail = await getInstanceInfo(api, target.id);
          if (detail) target = detail;
        } catch (e) {
          /* 详情失败则沿用列表项 */
        }
      }

      this.data = target;
      this.error = '';

      // 状态变化检测：运行中(2) -> 未启动(0) 视为异常停止
      if (target) {
        const was = this._prevStatus;
        if (was === 2 && target.status === 0) this.crashed = true;
        if (target.status === 2) this.crashed = false;
        this._prevStatus = target.status;
      }
    } catch (e) {
      this.error = e?.message || '请求失败';
    } finally {
      this.loading = false;
      this._polling = false;
      this.requestUpdate();
      // 渲染完成后按实际宽度适配地址字号
      this.updateComplete.then(() => {
        this._fitAddress();
        // 字体异步加载完成后字宽会变，再适配一次
        if (typeof document !== 'undefined' && document.fonts) {
          document.fonts.ready.then(() => this._fitAddress()).catch(() => {});
        }
      });
    }
  }

  /** 当前卡片的唯一 ID（平台注入），用于按卡片存各自的服务器选择 */
  _widgetId() {
    const wi = this.spCtx?.widgetInfo;
    return wi?.widgetId || wi?.id || '';
  }

  /**
   * 本卡片要显示的实例 ID
   * 优先用这张卡片自己选的，其次回退到全局默认
   */
  _widgetInstanceId() {
    const own = instanceIdForWidget(this._cfg, this._widgetId());
    if (own !== undefined && own !== null && own !== '') return own;
    // 兼容平台传入的 widget 配置
    const v = this.spCtx?.widgetInfo?.config?.instanceId;
    return v === undefined || v === null || v === '' ? null : v;
  }

  /** 打开服务器选择面板 */
  _openPicker(ev) {
    if (ev) ev.stopPropagation();
    if (!this.list.length) return;
    this.switching = true;
    this.requestUpdate();
  }

  /** 选中某台服务器（只影响当前卡片） */
  async _pickInstance(id, ev) {
    if (ev) ev.stopPropagation();
    this.switching = false;
    this.requestUpdate();
    try {
      await setWidgetInstance(this.spCtx.api, this._widgetId(), id);
      this._cfg = await loadConfig(this.spCtx.api);
      await this._refresh();
    } catch (e) {
      this.error = e?.message || '保存选择失败';
      this.requestUpdate();
    }
  }

  /** 渲染服务器选择面板（覆盖整张卡片） */
  _renderPicker() {
    const cur = this._widgetInstanceId();
    return html`
      <div class="picker" @click=${(e) => e.stopPropagation()}>
        <div class="picker-head">
          <span>选择服务器</span>
          <button class="picker-x" title="关闭" @click=${() => (this.switching = false)}>×</button>
        </div>
        <div class="picker-list">
          ${this.list.map(
            (it) => html`
              <button
                class="pick-item ${String(cur) === String(it.id) ? 'on' : ''}"
                @click=${(e) => this._pickInstance(it.id, e)}
              >
                <span class="dot sm" style="background:${statusOf(it.status).color}"></span>
                <span class="pick-name" title=${it.name}>${it.name}</span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  /** 执行启停操作 */
  async _action(action, ev) {
    if (ev) ev.stopPropagation();
    if (!this.data || this.busy) return;
    this.busy = true;
    this.requestUpdate();
    try {
      await instanceAction(this.spCtx.api, this.data.id, action);
      this.spCtx.api.timer.setTimeout(() => this._refresh(), 2500);
    } catch (e) {
      this.error = e?.message || '操作失败';
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  /** 拼出完整的「主机:端口」连接地址 */
  _addr() {
    const port = this.data?.mcConfig?.serverPort;
    if (!port) return '';
    let host = '';
    try {
      const u = new URL(this._cfg?.baseUrl || '');
      host = u.hostname;
    } catch (e) {
      host = '';
    }
    return host ? `${host}:${port}` : `:${port}`;
  }

  _openDetail(ev) {
    if (ev) ev.stopPropagation();
    try {
      this.spCtx.api.window.open({
        componentName: 'mslx-main',
        title: this.data?.name || 'MSLX',
      });
    } catch (e) {
      /* 忽略 */
    }
  }

  /** 打开配置页（把小部件自身信息一并带过去，保证能保存） */
  _openConfig(ev) {
    if (ev) ev.stopPropagation();
    try {
      this.spCtx.api.window.open({
        componentName: 'mslx-config',
        title: '配置 MSLX 小部件',
        customParam: { widgetInfo: this.spCtx?.widgetInfo },
      });
    } catch (e) {
      /* 忽略 */
    }
  }

  /* ============================ 渲染 ============================ */

  _bg() {
    // 任何自定义皮肤的背景都由 CSS 类控制，这里不要覆盖
    if (isThemeSkin(this.skin)) return '';
    const useSystem =
      this._cfg?.useSystemBgColor ?? this.spCtx?.widgetInfo?.config?.useSystemBgColor;
    if (useSystem) return 'transparent';
    return this.spCtx?.darkMode ? '#1a1a1a' : '#ffffff';
  }

  _fg() {
    // 自定义皮肤的文字色由皮肤变量控制，返回空交给 CSS
    if (isThemeSkin(this.skin)) return '';
    return this.spCtx?.darkMode ? '#e5e5e5' : '#262626';
  }

  _renderUnconfigured() {
    return html`
      <div class="empty" @click=${this._openConfig}>
        <div class="empty-icon">⚙</div>
        <div class="empty-text">未连接 MSLX</div>
        <div class="empty-hint">点击配置服务器</div>
      </div>
    `;
  }

  _renderError() {
    return html`
      <div class="empty">
        <div class="empty-icon" style="color:#ff4d4f">!</div>
        <div class="empty-text">连接异常</div>
        <div class="empty-hint">${this.error}</div>
      </div>
    `;
  }

  /** 1x1：状态 + 名称 + 人数（极简） */
  render1x1() {
    if (!this.configured) return html`<div class="mini empty-mini" @click=${this._openConfig}>⚙</div>`;
    if (this.loading) return html`<div class="mini">…</div>`;
    if (this.error && !this.data) return html`<div class="mini" style="color:#ff4d4f">×</div>`;

    const st = statusOf(this.data?.status);
    const running = this.data?.status === 2;
    const players = this.data?.onlinePlayers ?? 0;
    const name = this.data?.name || 'MSLX';

    return html`
      <div class="mini" @click=${this._openDetail}>
        <div class="mini-head">
          <span class="dot" style="background:${st.color}"></span>
          <span class="mini-title" title=${name}>${name}</span>
        </div>
        <div class="mini-num" style="color:${running ? st.color : 'inherit'}">
          ${running ? players : '—'}
        </div>
      </div>
    `;
  }

  /** 1x2：状态 + 人数 */
  render1x2() {
    if (!this.configured) return this._renderUnconfigured();
    if (this.loading) return html`<div class="row"><span class="muted">加载中…</span></div>`;
    if (this.error && !this.data) return this._renderError();

    const st = statusOf(this.data?.status);
    const running = this.data?.status === 2;
    const players = running ? this.data?.onlinePlayers ?? 0 : '—';
    const m = this._metrics();

    // 竖向窄卡片：改成上下堆叠
    if (m.tall) {
      return html`
        <div class="vcol" @click=${this._openDetail}>
          <div class="vrow">
            <span class="dot" style="background:${st.color}"></span>
            <span class="nm" title=${this.data?.name || ''}>${this.data?.name || 'MSLX'}</span>
          </div>
          <div class="vnum" style="color:${running ? st.color : 'inherit'}">${players}</div>
          <div class="vlabel">在线</div>
        </div>
      `;
    }

    // 横向：名称 · 状态 —— 人数
    return html`
      <div class="row" @click=${this._openDetail}>
        <span class="dot" style="background:${st.color}"></span>
        <span class="nm" title=${this.data?.name || ''}>${this.data?.name || 'MSLX'}</span>
        <span class="mid" style="color:${st.color}">${st.text}</span>
        <span class="num" style="color:${running ? st.color : 'inherit'}">${players}</span>
      </div>
    `;
  }

  /** 2x1：横向紧凑 / 竖向堆叠 */
  render2x1() {
    if (!this.configured) return this._renderUnconfigured();
    if (this.loading) return html`<div class="row"><span class="muted">加载中…</span></div>`;
    if (this.error && !this.data) return this._renderError();
    const st = statusOf(this.data?.status);
    const running = this.data?.status === 2;
    const m = this._metrics();

    // 竖向高卡片：上下堆叠，按钮放最底部
    if (m.tall) {
      return html`
        <div class="vcol" @click=${this._openDetail}>
          <div class="vrow">
            <span class="dot" style="background:${st.color}"></span>
            <span class="nm" title=${this.data?.name || ''}>${this.data?.name || 'MSLX'}</span>
          </div>
          <div class="vsub" style="color:${st.color}">${st.text}</div>
          <div class="vbtns">
            ${running
              ? html`
                  <button
                    class="btn danger"
                    ?disabled=${this.busy}
                    @click=${(e) => this._action('stop', e)}
                  >
                    ${this.busy ? '…' : '停止'}
                  </button>
                  <button class="btn" ?disabled=${this.busy} @click=${(e) => this._action('restart', e)}>
                    ${this.busy ? '…' : '重启'}
                  </button>
                `
              : html`<button class="btn ok" ?disabled=${this.busy} @click=${(e) => this._action('start', e)}>
                  ${this.busy ? '…' : '启动'}
                </button>`}
          </div>
        </div>
      `;
    }

    return html`
      <div class="hrow" @click=${this._openDetail}>
        <span class="dot" style="background:${st.color}"></span>
        <div class="hcol">
          <div class="nm" title=${this.data?.name || ''}>${this.data?.name || 'MSLX'}</div>
          <div class="sub">
            ${st.text} · ${running ? (this.data?.onlinePlayers ?? 0) + ' 在线' : '未运行'}
          </div>
        </div>
        <div class="btn-group vstack" @click=${(e) => e.stopPropagation()}>
          ${running
            ? html`
                <button class="btn danger" ?disabled=${this.busy} @click=${(e) => this._action('stop', e)}>
                  ${this.busy ? '…' : '停止'}
                </button>
                <button class="btn" ?disabled=${this.busy} @click=${(e) => this._action('restart', e)}>
                  ${this.busy ? '…' : '重启'}
                </button>
              `
            : html`<button class="btn ok" ?disabled=${this.busy} @click=${(e) => this._action('start', e)}>
                ${this.busy ? '…' : '启动'}
              </button>`}
        </div>
      </div>
    `;
  }

  /** 2x2：主卡片（四行布局：标题 / 副标题 / 指标 / 按钮） */
  render2x2() {
    if (!this.configured) return this._renderUnconfigured();
    if (this.loading) return html`<div class="card"><span class="muted">加载中…</span></div>`;
    if (this.error && !this.data) return this._renderError();

    const st = statusOf(this.data?.status);
    const running = this.data?.status === 2;
    const port = this.data?.mcConfig?.serverPort;
    const mem = this.data?.maxM;
    const players = this.data?.onlinePlayers ?? 0;

    return html`
      <div class="card" @click=${this._openDetail}>
        <div class="card-head">
          <span class="dot" style="background:${st.color}"></span>
          <span
            class="nm pickable"
            title="点击切换这台卡片显示的服务器"
            @click=${this._openPicker}
          >
            ${this.data?.name || 'MSLX'}<span class="caret">▾</span>
          </span>
          <button class="gear" title="配置" @click=${this._openConfig}>⚙</button>
        </div>

        <div class="subline">
          ${this.crashed
            ? html`<span class="st crash">⚠ 异常停止</span>`
            : html`<span class="st" style="color:${st.color}">${st.text}</span>`}
        </div>

        ${this._addr()
          ? html`<div class="addrline" title=${this._addr()}>${this._addr()}</div>`
          : ''}

        <div class="metrics">
          <div class="metric">
            <div class="mv" style="color:${running ? st.color : 'inherit'}">${running ? players : '—'}</div>
            <div class="ml">在线</div>
          </div>
          <div class="metric">
            <div class="mv">${formatUptimeShort(this.data?.uptime)}</div>
            <div class="ml">运行</div>
          </div>
          <div class="metric">
            <div class="mv">${formatMBShort(mem)}</div>
            <div class="ml">内存</div>
          </div>
        </div>

        <div class="card-foot" @click=${(e) => e.stopPropagation()}>
          ${running
            ? html`
                <button class="btn danger" ?disabled=${this.busy} @click=${(e) => this._action('stop', e)}>
                  ${this.busy ? '…' : '停止'}
                </button>
                <button class="btn" ?disabled=${this.busy} @click=${(e) => this._action('restart', e)}>
                  ${this.busy ? '…' : '重启'}
                </button>
                <button class="btn" ?disabled=${this.busy} @click=${(e) => this._action('backup', e)}>
                  ${this.busy ? '…' : '备份'}
                </button>
              `
            : html`<button class="btn ok wide" ?disabled=${this.busy} @click=${(e) => this._action('start', e)}>
                ${this.busy ? '…' : '启动'}
              </button>`}
        </div>
      </div>
    `;
  }

  /** 2x4 / 4x4 / 1xfull：多实例列表 */
  renderList() {
    if (!this.configured) return this._renderUnconfigured();
    if (this.loading) return html`<div class="card"><span class="muted">加载中…</span></div>`;
    if (this.error && !this.list.length) return this._renderError();

    const all = this.list || [];
    if (!all.length) return html`<div class="card"><span class="muted">暂无实例</span></div>`;

    // 依据卡片高度决定能放几行，避免矮卡片里文字重叠
    const m = this._metrics();
    const rowH = 22 * m.s;
    const headH = 20 * m.s;
    const avail = Math.max(rowH, m.h - 2 * 7 * m.s - headH);
    const maxRows = Math.max(1, Math.min(all.length, Math.floor(avail / rowH)));
    const list = all.slice(0, maxRows);
    const hidden = all.length - list.length;

    return html`
      <div class="list" style="--s:${Math.min(m.s, 1.3).toFixed(3)}">
        <div class="list-head">
          <span class="list-title">MSLX 实例</span>
          <span class="list-sub">
            ${all.filter((x) => x.status === 2).length} / ${all.length} 运行中
          </span>
        </div>
        ${list.map(
          (it) => html`
            <div class="list-row" @click=${this._openDetail} title=${it.name}>
              <span class="dot sm" style="background:${statusOf(it.status).color}"></span>
              <span class="list-name">${it.name}</span>
              <span class="list-status" style="color:${statusOf(it.status).color}">
                ${statusOf(it.status).text}
              </span>
              <span class="list-players">
                ${it.status === 2 ? it.extra?.onlinePlayers ?? 0 : '—'}
              </span>
            </div>
          `
        )}
        ${hidden > 0 ? html`<div class="list-more">还有 ${hidden} 个…</div>` : ''}
      </div>
    `;
  }

  render2x4() {
    return this.renderList();
  }

  render4x4() {
    return this.renderList();
  }

  render1xfull() {
    return this.renderList();
  }

  render() {
    const size = this.spCtx?.widgetInfo?.gridSize;
    const m = this._metrics();
    const bg = this._bg();
    const fg = this._fg();
    /*
     * 默认皮肤没有皮肤类，状态色只能在这里给：
     * 浅色卡片配深色状态字，深色卡片配亮色状态字。
     * 自定义皮肤不注入，交给各自样式表的 --st-* 变量。
     */
    const stVars = isThemeSkin(this.skin)
      ? ''
      : this.spCtx?.darkMode
      ? '--st-stopped:#b8b8b8;--st-running:#6ee787;--st-starting:#ffd166;--st-stopping:#ffd166;'
      : '--st-stopped:#5a5a5a;--st-running:#1a7f37;--st-starting:#8a5a00;--st-stopping:#8a5a00;';
    const style =
      (bg ? `background:${bg};` : '') +
      (fg ? `color:${fg};` : '') +
      stVars +
      `--s:${m.s.toFixed(3)};` +
      `--pad:${(7 * m.s).toFixed(1)}px;--gap:${(2.5 * m.s).toFixed(1)}px`;
    return html`
      <div
        class="wrap ${skinClass(this.skin)} ${fontClass(this.font)} ${this.spCtx?.darkMode
          ? 'dark'
          : ''}"
        style=${style}
      >
        ${this.switching
          ? this._renderPicker()
          : html`
              ${size === '1x1' ? this.render1x1() : ''}
              ${size === '1x2' ? this.render1x2() : ''}
              ${size === '2x1' ? this.render2x1() : ''}
              ${size === '2x2' ? this.render2x2() : ''}
              ${size === '2x4' ? this.render2x4() : ''}
              ${size === '4x4' ? this.render4x4() : ''}
              ${size === '1xfull' ? this.render1xfull() : ''}
            `}
      </div>
    `;
  }

  static styles = [
    ...mcSkin,
    neuSkin,
    glassSkin,
    css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei',
        sans-serif;
    }
    .wrap {
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
      /* 必须与父级 .item-card-content 的 20px 一致，否则四角露出父级背景 */
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--pad, 8px);
    }
    .muted {
      color: #8c8c8c;
      font-size: 12px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      flex: 0 0 auto;
    }
    .dot.sm {
      width: 6px;
      height: 6px;
    }

    .card {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      cursor: pointer;
      gap: 2px;
    }
    .card-head {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 0 0 auto;
      min-width: 0;
    }
    .nm {
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
      min-width: 0;
    }
    .subline {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 9.5px;
      line-height: 1.2;
      color: #8c8c8c;
      flex: 0 0 auto;
      overflow: hidden;
      white-space: nowrap;
      min-width: 0;
    }
    .subline .st {
      flex: 0 0 auto;
    }
    .subline .crash {
      color: #ff4d4f;
      font-weight: 600;
    }
    /* 连接地址：固定占满一行宽度，字号由 _fitAddress() 按实际文本长度缩放。
     * 这里给的是基准字号，溢出时 JS 会把它调小，所以不需要 text-overflow。
     */
    .addrline {
      font-family: monospace;
      font-size: calc(10px * var(--s, 1));
      line-height: 1.25;
      letter-spacing: -0.2px;
      color: inherit;
      opacity: 0.78;
      flex: 0 0 auto;
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      white-space: nowrap;
      min-width: 0;
      text-align: left;
    }
    .subline .sep {
      opacity: 0.45;
      flex: 0 0 auto;
    }
    .subline .addr {
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1 1 auto;
      min-width: 0;
    }
    .badge {
      font-size: 11px;
      font-weight: 500;
    }
    .gear {
      background: transparent;
      border: none;
      color: inherit;
      opacity: 0.45;
      cursor: pointer;
      font-size: 12px;
      padding: 0 2px;
      line-height: 1;
      font-family: inherit;
      flex: 0 0 auto;
    }
    .gear:hover {
      opacity: 1;
    }

    .metrics {
      display: flex;
      align-items: center;
      justify-content: space-around;
      margin: 0;
      flex: 1 1 auto;
      min-height: 0;
      /* 列之间留出间隔，避免 23h17m 和 10G 贴在一起 */
      gap: calc(3px * var(--s, 1));
    }
    .metric {
      text-align: center;
      min-width: 0;
      overflow: hidden;
    }
    /* 三列不等分：运行时长（如 23h17m）需要明显更多宽度 */
    .metric:nth-child(1) {
      flex: 0.72 1 0;
    }
    .metric:nth-child(2) {
      flex: 1.66 1 0;
    }
    .metric:nth-child(3) {
      flex: 0.82 1 0;
    }
    .mv {
      /* 指标数字按卡片缩放，长文本也不会溢出 */
      font-size: calc(13px * var(--s, 1));
      font-weight: 700;
      line-height: 1.15;
      white-space: nowrap;
      overflow: hidden;
    }
    .ml {
      font-size: 9px;
      color: #8c8c8c;
      margin-top: 1px;
      white-space: nowrap;
    }

    .card-foot {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
      /* 按钮组整体上移一点，避免贴底太紧 */
      margin-bottom: calc(3px * var(--s, 1));
    }
    .port {
      font-size: 11px;
      color: #8c8c8c;
      font-family: monospace;
    }

    .btn-group {
      display: flex;
      gap: 4px;
    }
    /* 2x1 右侧：按钮竖排，避免横向挤压 */
    .btn-group.vstack {
      flex-direction: column;
      gap: calc(3px * var(--s, 1));
      flex: 0 0 auto;
      align-items: stretch;
    }
    .btn-group.vstack .btn {
      flex: 0 0 auto;
      width: 100%;
      min-width: calc(46px * var(--s, 1));
      padding: calc(2px * var(--s, 1)) calc(6px * var(--s, 1));
    }
    .btn {
      flex: 1 1 0;
      min-width: 0;
      border: 1px solid rgba(128, 128, 128, 0.35);
      background: transparent;
      color: inherit;
      font-size: 10px;
      padding: 3px 2px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
      font-family: inherit;
      text-align: center;
      overflow: hidden;
    }
    .btn.wide {
      flex: 1 1 100%;
    }

    /* 2x1 横条里的按钮不参与均分，按内容宽度即可 */
    .hrow .btn-group {
      flex: 0 0 auto;
    }
    .hrow .btn {
      flex: 0 0 auto;
      padding: 3px 10px;
    }
    .hrow .nm {
      font-size: 13px;
    }
    .btn:hover {
      background: rgba(128, 128, 128, 0.15);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn.ok {
      color: #52c41a;
      border-color: rgba(82, 196, 26, 0.5);
    }
    .btn.ok:hover {
      background: rgba(82, 196, 26, 0.12);
    }
    .btn.danger {
      color: #ff4d4f;
      border-color: rgba(255, 77, 79, 0.5);
    }
    .btn.danger:hover {
      background: rgba(255, 77, 79, 0.12);
    }

    .mini {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: calc(2px * var(--s, 1));
      cursor: pointer;
      width: 100%;
      height: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .mini-head {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: calc(3px * var(--s, 1));
      max-width: 100%;
      min-width: 0;
    }
    .mini-title {
      font-size: calc(10px * var(--s, 1));
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
      line-height: 1.15;
    }
    .mini-num {
      font-size: calc(20px * var(--s, 1));
      font-weight: 700;
      line-height: 1.05;
    }
    .mini-num {
      font-size: 18px;
      font-weight: 700;
    }
    .empty-mini {
      font-size: 18px;
      opacity: 0.5;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      width: 100%;
    }
    .num {
      font-size: 16px;
      font-weight: 700;
      margin-left: auto;
    }

    .hrow {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      width: 100%;
    }
    .hcol {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex: 1;
    }
    .sub {
      font-size: 11px;
      color: #8c8c8c;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
    }
    .empty-icon {
      font-size: 20px;
      opacity: 0.6;
    }
    .empty-text {
      font-size: 13px;
      font-weight: 600;
    }
    .empty-hint {
      font-size: 11px;
      color: #8c8c8c;
    }

    .list {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .list-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 6px;
      flex: 0 0 auto;
    }
    .list-title {
      font-size: 13px;
      font-weight: 600;
    }
    .list-sub {
      font-size: 10px;
      color: #8c8c8c;
    }
    .list-row {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 4px 2px;
      border-radius: 4px;
      cursor: pointer;
      flex: 1;
      min-height: 0;
    }
    .list-row:hover {
      background: rgba(128, 128, 128, 0.1);
    }
    .list-name {
      font-size: 12px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .list-status {
      font-size: 10px;
      flex: 0 0 auto;
    }
    .list-players {
      font-size: 12px;
      font-weight: 600;
      min-width: 20px;
      text-align: right;
      font-family: monospace;
    }

    /* ================= 尺寸自适应覆盖 =================
       所有字号 / 间距由 --s 驱动（由 _metrics() 依据卡片真实像素计算）
       基准：短边 150px -> 1.0，范围 0.8 ~ 1.9
       ================================================ */
    .muted {
      font-size: calc(12px * var(--s, 1));
    }
    .dot {
      width: calc(8px * var(--s, 1));
      height: calc(8px * var(--s, 1));
    }
    .dot.sm {
      width: calc(6px * var(--s, 1));
      height: calc(6px * var(--s, 1));
    }
    .card {
      gap: var(--gap, 3px);
    }
    .card-head {
      gap: calc(5px * var(--s, 1));
    }
    .nm {
      font-size: calc(13px * var(--s, 1));
    }
    .gear {
      font-size: calc(12px * var(--s, 1));
    }
    .subline {
      font-size: calc(11px * var(--s, 1));
      gap: calc(4px * var(--s, 1));
    }
    .addrline {
      font-size: calc(10px * var(--s, 1));
      line-height: 1.25;
    }
    .mv {
      font-size: calc(13px * var(--s, 1));
    }
    .ml {
      font-size: calc(9px * var(--s, 1));
    }
    .btn {
      font-size: calc(10px * var(--s, 1));
      padding: calc(3px * var(--s, 1)) calc(6px * var(--s, 1));
    }
    .hrow .btn {
      padding: calc(3px * var(--s, 1)) calc(10px * var(--s, 1));
    }
    .mini-num,
    .empty-mini {
      font-size: calc(18px * var(--s, 1));
    }
    .empty-icon {
      font-size: calc(20px * var(--s, 1));
    }
    .empty-text {
      font-size: calc(13px * var(--s, 1));
    }
    .empty-hint {
      font-size: calc(11px * var(--s, 1));
    }
    .row {
      gap: calc(6px * var(--s, 1));
    }
    .num {
      font-size: calc(16px * var(--s, 1));
    }
    .hrow {
      gap: calc(8px * var(--s, 1));
    }
    .sub {
      font-size: calc(11px * var(--s, 1));
    }
    .list-head {
      margin-bottom: calc(5px * var(--s, 1));
    }
    .list-title {
      font-size: calc(13px * var(--s, 1));
    }
    .list-sub {
      font-size: calc(10px * var(--s, 1));
    }
    .list-row {
      gap: calc(7px * var(--s, 1));
      padding: calc(3px * var(--s, 1)) calc(2px * var(--s, 1));
    }
    .list-name {
      font-size: calc(12px * var(--s, 1));
    }
    .list-status {
      font-size: calc(10px * var(--s, 1));
    }
    .list-players {
      font-size: calc(12px * var(--s, 1));
      min-width: calc(20px * var(--s, 1));
    }
    .list-more {
      font-size: calc(10px * var(--s, 1));
      opacity: 0.45;
      text-align: center;
      padding: calc(2px * var(--s, 1)) 0;
      flex: 0 0 auto;
    }

    /* ================= 竖向卡片布局（tall） ================= */
    .vcol {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: calc(2px * var(--s, 1));
      cursor: pointer;
      min-width: 0;
      box-sizing: border-box;
    }
    .vrow {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: calc(5px * var(--s, 1));
      max-width: 100%;
      min-width: 0;
    }
    .vrow .nm {
      flex: 0 1 auto;
      text-align: center;
    }
    .vspacer {
      flex: 1 1 auto;
    }
    .vnum {
      font-size: calc(24px * var(--s, 1));
      font-weight: 700;
      line-height: 1.1;
    }
    .vlabel {
      font-size: calc(9px * var(--s, 1));
      color: #8c8c8c;
      margin-top: calc(-2px * var(--s, 1));
    }
    .vsub {
      font-size: calc(10px * var(--s, 1));
      margin-top: calc(-2px * var(--s, 1));
    }
    .vbtn {
      width: 100%;
      flex: 0 0 auto;
    }
    .vbtns {
      display: flex;
      flex-direction: column;
      gap: calc(4px * var(--s, 1));
      width: 100%;
      flex: 0 0 auto;
    }
    .vbtns .btn {
      width: 100%;
      flex: 0 0 auto;
      padding: calc(4px * var(--s, 1)) 0;
      font-size: calc(11px * var(--s, 1));
    }

    /* 横向 1x2：内容居中，不留两端大空白 */
    .row {
      justify-content: center;
    }
    .row .nm {
      flex: 0 1 auto;
    }
    .mid {
      font-size: calc(10px * var(--s, 1));
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 0 1 auto;
    }
    .row .num {
      margin-left: calc(10px * var(--s, 1));
    }

    /* ================= 卡片上的服务器切换 ================= */
    .pickable {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }
    .pickable:hover {
      text-decoration: underline;
    }
    .caret {
      font-size: 0.72em;
      opacity: 0.6;
      flex: 0 0 auto;
    }

    .picker {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: calc(3px * var(--s, 1));
      min-height: 0;
    }
    .picker-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      font-size: calc(10px * var(--s, 1));
      flex: 0 0 auto;
      opacity: 0.9;
    }
    .picker-x {
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      font-size: calc(13px * var(--s, 1));
      line-height: 1;
      padding: 0 2px;
      font-family: inherit;
      flex: 0 0 auto;
    }
    .picker-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: calc(2px * var(--s, 1));
      scrollbar-width: thin;
    }
    .picker-list::-webkit-scrollbar {
      width: 4px;
    }
    .picker-list::-webkit-scrollbar-thumb {
      background: rgba(128, 128, 128, 0.5);
      border-radius: 2px;
    }
    .pick-item {
      display: flex;
      align-items: center;
      gap: calc(4px * var(--s, 1));
      width: 100%;
      padding: calc(3px * var(--s, 1)) calc(5px * var(--s, 1));
      background: transparent;
      border: 1px solid transparent;
      border-radius: 3px;
      color: inherit;
      cursor: pointer;
      font-family: inherit;
      font-size: calc(10px * var(--s, 1));
      text-align: left;
      flex: 0 0 auto;
      min-width: 0;
    }
    .pick-item:hover {
      background: rgba(128, 128, 128, 0.22);
    }
    .pick-item.on {
      border-color: currentColor;
      background: rgba(128, 128, 128, 0.16);
    }
    .pick-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1 1 auto;
      min-width: 0;
    }
  `,
  ];
}
