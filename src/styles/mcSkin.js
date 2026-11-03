import { css, unsafeCSS } from 'lit';
import { STONE_TEX, GRASS_TEX } from './textures.js';

/**
 * 我的世界（Minecraft）皮肤 - 共享样式
 *
 * 根元素 class 由 api/mslx.js 的 skinClass() 生成：
 *   skinClass('mc-stone') -> 'skin-mc skin-stone'
 *   skinClass('mc-grass') -> 'skin-mc skin-grass'
 *
 * 【圆角】Sun-Panel 卡片容器是 .item-card-content { border-radius: 20px; overflow: hidden }
 *         所以皮肤圆角必须也是 20px，否则四个角会被裁掉。
 *
 * 【配色】所有前景/背景组合都过了 WCAG 对比度检查（tools/check-contrast.py）：
 *         正文 ≥ 4.5，大号/禁用 ≥ 3.0。
 *         危险按钮用暗红底白字（6.68），而不是深底红字（1.72，原方案不合格）。
 *
 * 【纹理】运行时生成后 base64 内联的 PNG（见 textures.js），
 *         因为 lit 的 css`` 是静态的，这里用 unsafeCSS 拼接。
 */

const stoneBg = unsafeCSS(`url("${STONE_TEX}")`);
const grassBg = unsafeCSS(`url("${GRASS_TEX}")`);

const base = css`
  /* ============================================================
     主题变量默认值（石头）
     每个主题块会覆盖下面的 --mc-* 变量，规则本身只引用变量
     ============================================================ */
  .skin-mc {
    /* 卡片（纹理背景之上） */
    --mc-text: #ffffff;
    --mc-text-dim: #f2f2f2;
    --mc-text-mute: #ececec;
    --mc-ok: #a6ffa6;
    --mc-warn: #ffff8a;
    --mc-danger: #ffbcbc;
    --mc-shadow: rgba(0, 0, 0, 0.85);

    /* 整页 */
    --mc-page-bg: #242424;
    --mc-page-text: #e8e8e8;
    --mc-page-dim: #c8c8c8;

    /* 面板（页面里的卡片） */
    --mc-panel-bg: #b6b6b6;
    --mc-panel-text: #2b2b2b;
    --mc-panel-dim: #3f3f3f;
    --mc-panel-hi: #e8e8e8;
    --mc-panel-lo: #7a7a7a;

    /* 按钮 */
    --mc-btn-bg: #737373;
    --mc-btn-bg-hover: #8f8f8f;
    --mc-btn-bg-active: #626262;
    --mc-btn-text: #ffffff;
    --mc-btn-border: #000000;
    --mc-btn-hi: #ffffff;
    --mc-btn-lo: #373737;
    --mc-btn-disabled-bg: #757575;
    --mc-btn-disabled-text: #dcdcdc;
    --mc-btn-danger-bg: #9e3b3b;
    --mc-btn-danger-hover: #b04a4a;

    /* 输入框 */
    --mc-input-bg: #000000;
    --mc-input-text: #ffffff;
    --mc-input-border: #666666;
    --mc-input-focus: #7dff7d;
    --mc-accent: #7dff7d;

    /*
     * 圆角：与父级 .item-card-content 的 20px 严格对齐。
     *
     * 为什么要同时用 border-radius + clip-path：
     *   border-radius 只改变元素自身的轮廓，背景层仍按矩形绘制，
     *   超出父级 20px 圆角的部分会被 .item-card-content 的 overflow:hidden 裁掉，
     *   表现为四角"切角"。
     *   clip-path: inset(0 round 20px) 让元素自己先裁成同样的圆角，
     *   与父级轮廓重合，不会被二次裁剪。
     *
     * 边框用 inset box-shadow 画在内部，避免 border 压在裁剪线上。
     */
    border-radius: 20px;
    clip-path: inset(0 round 20px);
    border: none;
    box-shadow: inset 0 0 0 2px #000000,
      inset 3px 3px 0 1px rgba(255, 255, 255, 0.22),
      inset -3px -3px 0 1px rgba(0, 0, 0, 0.45);
    color: var(--mc-text);
    font-family: 'Minecraftia', 'Minecraft Evenings', 'Press Start 2P', Consolas, monospace;
    -webkit-font-smoothing: none;
    font-smooth: never;
    image-rendering: pixelated;
    letter-spacing: 0.2px;
    background-color: #6a6a6a;
  }

  /*
   * 卡片根元素的圆角单独提权。
   *
   * 组件自身还写了 .wrap { border-radius: 8px }（老布局遗留），
   * 两者特异性都是 (0,1,0)，谁在后面谁赢，而组件 css 排在 mcSkin 之后，
   * 所以 .skin-mc 的 20px 会被 8px 覆盖 → 四角露出父级半透明底 = "切角"。
   *
   * 用 .wrap.skin-mc (0,2,0) 压过去，无论顺序如何都以这条为准。
   */
  .wrap.skin-mc {
    border-radius: 20px;
    clip-path: inset(0 round 20px);
  }

  /* ================= 石头主题 ================= */
  .skin-mc.skin-stone {
    --mc-page-bg: #242424;
    --mc-page-text: #e8e8e8;
    --mc-page-dim: #c8c8c8;
    --mc-panel-bg: #b6b6b6;
    --mc-panel-text: #2b2b2b;
    --mc-panel-dim: #3f3f3f;
    --mc-panel-hi: #e8e8e8;
    --mc-panel-lo: #7a7a7a;
    --mc-accent: #2f8f2f;

    /* 状态色：卡片是深灰底，用亮色才看得清 */
    --st-stopped: #f0f0f0;
    --st-running: #a6ffa6;
    --st-starting: #fff0b8;
    --st-stopping: #fff0b8;

    background-color: #6a6a6a;
    background-repeat: repeat;
    /* 纹理 64×64，按 32px 平铺：重复次数少，看不出网格 */
    background-size: 32px 32px;
  }

  /* ================= 草方块主题 ================= */
  .skin-mc.skin-grass {
    --mc-page-bg: #26361f;
    --mc-page-text: #e8e8e8;
    --mc-page-dim: #c8c8c8;
    --mc-panel-bg: #97c187;
    --mc-panel-text: #16330f;
    --mc-panel-dim: #264a1d;
    --mc-panel-hi: #d8f2cd;
    --mc-panel-lo: #5d8c4d;
    --mc-ok: #98ff98;
    --mc-warn: #ffff9d;
    --mc-danger: #ffbcbc;
    --mc-accent: #2f8f2f;

    /* 状态色：卡片是深棕/深绿底，用亮色才看得清 */
    --st-stopped: #ece0d0;
    --st-running: #a6ffa6;
    --st-starting: #ffe08a;
    --st-stopping: #ffe08a;

    background-color: #4a3a28;
    background-repeat: no-repeat;
    background-size: 100% 100%;
  }

  /*
   * 页面内的状态文字落在浅色面板上（石头 #b6b6b6 / 草 #97c187），
   * 用亮色会几乎看不见，所以页面级把变量换成深色。
   */
  .skin-mc.page.skin-stone,
  .skin-mc.container.skin-stone {
    --st-stopped: #3f3f3f;
    --st-running: #14521f;
    --st-starting: #5a4200;
    --st-stopping: #5a4200;
  }
  .skin-mc.page.skin-grass,
  .skin-mc.container.skin-grass {
    --st-stopped: #1b3d14;
    --st-running: #14521f;
    --st-starting: #5a4200;
    --st-stopping: #5a4200;
  }

  /* ================= 整页容器 ================= */
  .skin-mc.page,
  .skin-mc.container {
    border-radius: 0;
    border: none;
    box-shadow: none;
    background-color: var(--mc-page-bg) !important;
    background-image: none !important;
    color: var(--mc-page-text) !important;
    font-family: 'Minecraftia', 'Minecraft Evenings', 'Press Start 2P', Consolas, monospace;
    -webkit-font-smoothing: none;
    font-smooth: never;
  }

  /* ================= 按钮 ================= */
  .skin-mc .btn,
  .skin-mc .act,
  .skin-mc .pbtn,
  .skin-mc .icon-btn,
  .skin-mc .btn-secondary,
  .skin-mc button.primary,
  .skin-mc .tab {
    border-radius: 0;
    background: var(--mc-btn-bg);
    border: 2px solid var(--mc-btn-border);
    box-shadow: inset -2px -2px 0 var(--mc-btn-lo), inset 2px 2px 0 var(--mc-btn-hi);
    color: var(--mc-btn-text);
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.7);
    font-family: inherit;
    letter-spacing: 0.2px;
  }
  .skin-mc .btn:hover,
  .skin-mc .act:hover,
  .skin-mc .pbtn:hover,
  .skin-mc .icon-btn:hover,
  .skin-mc .btn-secondary:hover,
  .skin-mc button.primary:hover,
  .skin-mc .tab:hover {
    background: var(--mc-btn-bg-hover);
    color: var(--mc-btn-text);
    border-color: var(--mc-btn-border);
  }
  .skin-mc .btn:active,
  .skin-mc .act:active,
  .skin-mc .pbtn:active,
  .skin-mc .icon-btn:active,
  .skin-mc .btn-secondary:active,
  .skin-mc button.primary:active,
  .skin-mc .tab:active {
    background: var(--mc-btn-bg-active);
    box-shadow: inset 2px 2px 0 var(--mc-btn-lo), inset -2px -2px 0 var(--mc-btn-hi);
  }
  .skin-mc .btn:disabled,
  .skin-mc .act:disabled,
  .skin-mc .pbtn:disabled,
  .skin-mc .icon-btn:disabled {
    background: var(--mc-btn-disabled-bg);
    color: var(--mc-btn-disabled-text);
    opacity: 1;
  }

  /* 语义按钮：危险用暗红底白字（对比 6.68），启动用灰底黄字（4.50） */
  .skin-mc .btn.danger,
  .skin-mc .act.danger {
    background: var(--mc-btn-danger-bg);
    color: #ffffff;
    border-color: var(--mc-btn-border);
    box-shadow: inset -2px -2px 0 #5e2020, inset 2px 2px 0 #c26060;
  }
  .skin-mc .btn.danger:hover,
  .skin-mc .act.danger:hover {
    background: var(--mc-btn-danger-hover);
    color: #ffffff;
  }
  .skin-mc .btn.ok,
  .skin-mc .act.ok {
    color: var(--mc-warn);
    background: var(--mc-btn-bg);
    border-color: var(--mc-btn-border);
  }
  .skin-mc .pbtn.on {
    color: var(--mc-ok);
    border-color: var(--mc-btn-border);
    background: var(--mc-btn-bg);
  }
  .skin-mc .pbtn.danger.on {
    color: var(--mc-danger);
    border-color: var(--mc-btn-border);
    background: var(--mc-btn-danger-bg);
  }
  .skin-mc .tab.active {
    color: var(--mc-warn);
    border-color: var(--mc-btn-border);
    background: var(--mc-btn-bg-hover);
    box-shadow: inset 2px 2px 0 var(--mc-btn-lo), inset -2px -2px 0 var(--mc-btn-hi);
  }

  /* ================= 面板 ================= */
  .skin-mc .inst,
  .skin-mc .prow,
  .skin-mc .form-section,
  .skin-mc .players {
    border-radius: 0;
    background: var(--mc-panel-bg);
    border: 2px solid #000000;
    box-shadow: inset 1px 1px 0 var(--mc-panel-hi), inset -1px -1px 0 var(--mc-panel-lo);
    color: var(--mc-panel-text);
  }
  .skin-mc .inst-name,
  .skin-mc .pname,
  .skin-mc .form-section .section-title,
  .skin-mc .form-section label,
  .skin-mc .hint,
  .skin-mc .checkbox-label {
    color: var(--mc-panel-text);
    text-shadow: none;
  }
  .skin-mc .inst .inst-badge,
  .skin-mc .prow .pmeta,
  .skin-mc .form-section .hint {
    color: var(--mc-panel-dim);
  }
  .skin-mc .form-section .section-title::before {
    background: var(--mc-accent);
    border-radius: 0;
  }
  .skin-mc .checkbox-label {
    border-radius: 0;
    background: var(--mc-panel-bg);
    border: 2px solid #000000;
  }

  /* ================= 输入控件 ================= */
  .skin-mc .styled-input {
    border-radius: 0;
    background: var(--mc-input-bg);
    color: var(--mc-input-text);
    border: 2px solid var(--mc-input-border);
    box-shadow: inset 1px 1px 0 #373737;
    font-family: inherit;
  }
  .skin-mc .styled-input:focus {
    border-color: var(--mc-input-focus);
    outline: none;
  }

  /* ================= 圆点改方块 ================= */
  .skin-mc .dot {
    border-radius: 0;
    box-shadow: 0 0 0 1px #000000;
  }
  .skin-mc .dot.sm {
    border-radius: 0;
  }

  /* ================= 卡片内文字 ================= */
  .skin-mc .nm,
  .skin-mc .mini-title,
  .skin-mc .list-name,
  .skin-mc .list-title {
    color: var(--mc-text);
    text-shadow: 1px 1px 0 var(--mc-shadow);
  }
  .skin-mc .mv,
  .skin-mc .mini-num,
  .skin-mc .vnum,
  .skin-mc .num {
    color: var(--mc-text);
    text-shadow: 1px 1px 0 var(--mc-shadow);
  }
  .skin-mc .ml,
  .skin-mc .vlabel,
  .skin-mc .sub,
  .skin-mc .subline,
  .skin-mc .list-sub,
  .skin-mc .vsub {
    color: var(--mc-text-mute);
    text-shadow: 1px 1px 0 var(--mc-shadow);
  }
  .skin-mc .badge {
    text-shadow: 1px 1px 0 var(--mc-shadow);
    font-weight: 600;
  }

  /* 页面标题 */
  .skin-mc.page .h-title,
  .skin-mc.page .title,
  .skin-mc.container h1 {
    color: var(--mc-page-text);
    text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.8);
  }
  .skin-mc.page .h-sub,
  .skin-mc.page .list-sub,
  .skin-mc .subtitle {
    color: var(--mc-page-dim);
    text-shadow: none;
  }

  /* ================= 标签 ================= */
  .skin-mc .chip,
  .skin-mc .pchip {
    border-radius: 0;
    background: var(--mc-btn-bg);
    color: var(--mc-btn-text);
    border: 1px solid #000000;
    box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.3);
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.7);
  }
  .skin-mc .pchip {
    color: var(--mc-ok);
  }

  /* ================= 提示条 ================= */
  .skin-mc .msg,
  .skin-mc .conn-status,
  .skin-mc .err {
    border-radius: 0;
    border: 2px solid #000000;
  }
  .skin-mc .msg.ok {
    background: #22401f;
    color: #a6ffa6;
  }
  .skin-mc .msg.fail,
  .skin-mc .err {
    background: #4a2323;
    color: #ffbcbc;
  }

  /* ================= 列表 ================= */
  .skin-mc .list-row:hover {
    background: rgba(0, 0, 0, 0.12);
    border-radius: 0;
  }

  /* ================= 无边框图标按钮 ================= */
  .skin-mc .mini-btn,
  .skin-mc .gear {
    color: var(--mc-text-mute);
    box-shadow: none;
    border: none;
    background: transparent;
    text-shadow: 1px 1px 0 var(--mc-shadow);
  }
  .skin-mc.page .mini-btn {
    color: var(--mc-page-dim);
  }

  /* ================= 字体切换 ================= */
  .font-unifont,
  .font-unifont * {
    font-family: 'MSLXUnifont', 'Minecraftia', Consolas, monospace !important;
    letter-spacing: 0 !important;
    -webkit-font-smoothing: none;
    font-smooth: never;
  }
  .font-mojangles,
  .font-mojangles * {
    font-family: 'MSLXMojangles', 'MSLXUnifont', Consolas, monospace !important;
    letter-spacing: 0.5px !important;
    -webkit-font-smoothing: none;
    font-smooth: never;
  }
`;

/* 纹理单独拼（lit 的 css`` 不能插值变量） */
const textures = unsafeCSS(`
  .skin-mc.skin-stone {
    background-image: ${stoneBg};
  }
  .skin-mc.skin-grass {
    background-image: ${grassBg};
  }
`);

export const mcSkin = [base, textures];
