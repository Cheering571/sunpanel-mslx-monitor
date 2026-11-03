import { css } from 'lit';

/**
 * 液态玻璃（Liquid Glass）
 *
 * 三层结构：
 *   1. 背景模糊      backdrop-filter: blur(24px) saturate(180%)
 *   2. 半透明叠加    冷蓝白 tint + 斜向高光渐变
 *   3. 边缘高光      inset 0 1px 0 rgba(255,255,255,.7) 模拟玻璃上沿反光
 *
 * 关于颜色：
 *   纯白半透明叠在深色底上会发灰，所以所有高光统一走 --glass-tint（冷蓝白）。
 *   页面底色带蓝调（rgba(20,23,34,.58)），不是中性灰。
 *
 * 关于悬停：
 *   单纯提高白色透明度只会越叠越灰。
 *   这里改成用 backdrop-filter 的 brightness 把背后的壁纸整体提亮，
 *   再叠一圈冷蓝外发光，让玻璃看起来被"点亮"。
 *
 * 性能：只给卡片和页面加 backdrop-filter，按钮用纯半透明 + 高光模拟。
 */

export const glassSkin = css`
  /* ================= 卡片本体 ================= */
  .skin-glass {
    /* 冷蓝白调，用于所有高光叠加 */
    --glass-tint: 205, 225, 255;

    --glass-border: rgba(var(--glass-tint), 0.3);
    --glass-hi: rgba(255, 255, 255, 0.72);
    --glass-text: #ffffff;
    --glass-text-dim: rgba(226, 236, 255, 0.78);
    --glass-shadow: rgba(0, 0, 0, 0.22);

    /* iOS 系统色 */
    --glass-accent: #64d2ff;
    --glass-ok: #30d158;
    --glass-danger: #ff453a;
    --glass-warn: #ffd60a;

    /* 页面 / 面板 */
    --glass-page-bg: rgba(20, 23, 34, 0.58);
    --glass-panel-bg: rgba(var(--glass-tint), 0.09);
    --glass-panel-border: rgba(var(--glass-tint), 0.18);

    /* 状态色：玻璃底下都是暗的，状态文字要用亮色 */
    --st-stopped: #c8d4e8;
    --st-running: #8dffa8;
    --st-starting: #ffd98a;
    --st-stopping: #ffd98a;

    border-radius: 20px;
    border: 1px solid var(--glass-border);
    color: var(--glass-text);

    /* 斜向高光 + 半透明底 */
    background-image: linear-gradient(
      140deg,
      rgba(255, 255, 255, 0.34) 0%,
      rgba(255, 255, 255, 0.06) 30%,
      rgba(255, 255, 255, 0.02) 55%,
      rgba(255, 255, 255, 0.09) 100%
    );
    background-color: rgba(var(--glass-tint), 0.14);

    -webkit-backdrop-filter: blur(24px) saturate(180%) brightness(1.08);
    backdrop-filter: blur(24px) saturate(180%) brightness(1.08);

    box-shadow: 0 10px 30px var(--glass-shadow), 0 2px 8px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 var(--glass-hi), inset 0 -1px 0 rgba(255, 255, 255, 0.1);

    /*
     * 不做任何过渡：backdrop-filter / 阴影的动画会让浏览器逐帧重算模糊，
     * 鼠标移开时亮度回落很拖沓。全部改成瞬时切换。
     */
    transition: none;
  }

  /* ================= 悬停：点亮玻璃，而不是叠灰 ================= */
  .skin-glass:hover {
    -webkit-backdrop-filter: blur(24px) saturate(210%) brightness(1.45);
    backdrop-filter: blur(24px) saturate(210%) brightness(1.45);
    background-color: rgba(var(--glass-tint), 0.18);
    border-color: rgba(var(--glass-tint), 0.6);
    box-shadow: 0 14px 36px rgba(0, 0, 0, 0.26), 0 3px 10px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 #ffffff, inset 0 -1px 0 rgba(var(--glass-tint), 0.18),
      0 0 22px rgba(150, 195, 255, 0.3);
  }

  /* ================= 深色玻璃 ================= */
  .skin-glass.dark {
    --glass-tint: 160, 190, 255;

    --glass-border: rgba(var(--glass-tint), 0.18);
    --glass-hi: rgba(255, 255, 255, 0.24);
    --glass-text: #ffffff;
    --glass-text-dim: rgba(210, 225, 255, 0.7);
    --glass-shadow: rgba(0, 0, 0, 0.45);

    --glass-page-bg: rgba(12, 15, 24, 0.76);
    --glass-panel-bg: rgba(var(--glass-tint), 0.07);
    --glass-panel-border: rgba(var(--glass-tint), 0.14);

    background-image: linear-gradient(
      140deg,
      rgba(200, 220, 255, 0.13) 0%,
      rgba(200, 220, 255, 0.02) 35%,
      rgba(0, 0, 0, 0.04) 100%
    );
    background-color: rgba(26, 30, 42, 0.42);

    -webkit-backdrop-filter: blur(24px) saturate(160%) brightness(0.96);
    backdrop-filter: blur(24px) saturate(160%) brightness(0.96);

    box-shadow: 0 10px 30px var(--glass-shadow), inset 0 1px 0 var(--glass-hi),
      inset 0 -1px 0 rgba(var(--glass-tint), 0.06);
  }
  .skin-glass.dark:hover {
    -webkit-backdrop-filter: blur(24px) saturate(190%) brightness(1.3);
    backdrop-filter: blur(24px) saturate(190%) brightness(1.3);
    background-color: rgba(var(--glass-tint), 0.14);
    border-color: rgba(var(--glass-tint), 0.42);
  }

  /* ================= 整页 ================= */
  .skin-glass.page,
  .skin-glass.container {
    border: none;
    border-radius: 0;
    box-shadow: none;
    background-color: var(--glass-page-bg) !important;
    /* 顶部一抹冷蓝高光，避免整片死灰 */
    background-image: linear-gradient(
      165deg,
      rgba(var(--glass-tint), 0.1) 0%,
      rgba(var(--glass-tint), 0.02) 38%,
      rgba(0, 0, 0, 0) 70%
    ) !important;
    -webkit-backdrop-filter: blur(40px) saturate(180%);
    backdrop-filter: blur(40px) saturate(180%);
    color: var(--glass-text) !important;
  }

  /* ================= 按钮：玻璃片 ================= */
  .skin-glass .btn,
  .skin-glass .act,
  .skin-glass .pbtn,
  .skin-glass .icon-btn,
  .skin-glass .btn-secondary,
  .skin-glass button.primary,
  .skin-glass .tab {
    border-radius: 10px;
    border: 1px solid rgba(var(--glass-tint), 0.26);
    background: rgba(var(--glass-tint), 0.13);
    color: var(--glass-text);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.32);
    box-shadow: inset 0 1px 0 var(--glass-hi), 0 1px 4px rgba(0, 0, 0, 0.14);
    transition: background 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
  }
  .skin-glass .btn:hover,
  .skin-glass .act:hover,
  .skin-glass .pbtn:hover,
  .skin-glass .icon-btn:hover,
  .skin-glass .btn-secondary:hover,
  .skin-glass button.primary:hover,
  .skin-glass .tab:hover {
    background: rgba(var(--glass-tint), 0.28);
    border-color: rgba(var(--glass-tint), 0.55);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 2px 10px rgba(90, 140, 230, 0.28);
  }
  .skin-glass .btn:active,
  .skin-glass .act:active,
  .skin-glass .pbtn:active,
  .skin-glass .icon-btn:active,
  .skin-glass .btn-secondary:active,
  .skin-glass button.primary:active,
  .skin-glass .tab:active {
    background: rgba(var(--glass-tint), 0.07);
    box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.24);
  }
  .skin-glass .btn:disabled,
  .skin-glass .act:disabled,
  .skin-glass .pbtn:disabled,
  .skin-glass .icon-btn:disabled {
    color: rgba(var(--glass-tint), 0.42);
    background: rgba(var(--glass-tint), 0.05);
    opacity: 1;
  }

  .skin-glass .btn.danger,
  .skin-glass .act.danger {
    color: var(--glass-danger);
    border-color: rgba(255, 69, 58, 0.45);
  }
  .skin-glass .btn.ok,
  .skin-glass .act.ok {
    color: var(--glass-ok);
    border-color: rgba(48, 209, 88, 0.45);
  }
  .skin-glass .pbtn.on {
    color: var(--glass-ok);
    border-color: rgba(48, 209, 88, 0.5);
    background: rgba(48, 209, 88, 0.14);
  }
  .skin-glass .pbtn.danger.on {
    color: var(--glass-danger);
    border-color: rgba(255, 69, 58, 0.5);
    background: rgba(255, 69, 58, 0.14);
  }
  .skin-glass .tab.active {
    color: var(--glass-accent);
    border-color: rgba(100, 210, 255, 0.55);
    background: rgba(100, 210, 255, 0.16);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
  }

  /* ================= 面板：更薄的玻璃片 ================= */
  .skin-glass .inst,
  .skin-glass .prow,
  .skin-glass .form-section,
  .skin-glass .players {
    border-radius: 14px;
    border: 1px solid var(--glass-panel-border);
    background: var(--glass-panel-bg);
    color: var(--glass-text);
    box-shadow: inset 0 1px 0 rgba(var(--glass-tint), 0.3);
  }
  .skin-glass .inst-name,
  .skin-glass .pname,
  .skin-glass .form-section .section-title,
  .skin-glass .form-section label,
  .skin-glass .hint,
  .skin-glass .checkbox-label {
    color: var(--glass-text);
  }
  .skin-glass .inst .inst-badge,
  .skin-glass .prow .pmeta,
  .skin-glass .form-section .hint {
    color: var(--glass-text-dim);
  }
  .skin-glass .form-section .section-title::before {
    background: var(--glass-accent);
    border-radius: 2px;
  }

  /* ================= 输入控件 ================= */
  .skin-glass .styled-input {
    border-radius: 10px;
    border: 1px solid rgba(var(--glass-tint), 0.2);
    background: rgba(8, 12, 20, 0.34);
    color: #ffffff;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35);
  }
  .skin-glass .styled-input:focus {
    border-color: rgba(100, 210, 255, 0.75);
    outline: none;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.35), 0 0 0 3px rgba(100, 210, 255, 0.22);
  }
  .skin-glass .checkbox-label {
    border-radius: 10px;
    border: 1px solid var(--glass-panel-border);
    background: rgba(var(--glass-tint), 0.07);
    color: var(--glass-text);
  }

  /* ================= 圆点 ================= */
  .skin-glass .dot {
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.55), 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* ================= 文字 ================= */
  .skin-glass .nm,
  .skin-glass .mini-title,
  .skin-glass .list-name,
  .skin-glass .list-title,
  .skin-glass .mv,
  .skin-glass .mini-num,
  .skin-glass .vnum,
  .skin-glass .num {
    color: var(--glass-text);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }
  .skin-glass .ml,
  .skin-glass .vlabel,
  .skin-glass .sub,
  .skin-glass .subline,
  .skin-glass .list-sub,
  .skin-glass .vsub,
  .skin-glass .addrline {
    color: var(--glass-text-dim);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .skin-glass.page .h-title,
  .skin-glass.page .title,
  .skin-glass.container h1 {
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }
  .skin-glass.page .h-sub,
  .skin-glass.page .subtitle {
    color: var(--glass-text-dim);
    text-shadow: none;
  }
  .skin-glass .inst .inst-name,
  .skin-glass .inst .chip,
  .skin-glass .prow .pname {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }

  /* ================= 标签 ================= */
  .skin-glass .chip,
  .skin-glass .pchip {
    border-radius: 9px;
    border: 1px solid var(--glass-panel-border);
    background: rgba(var(--glass-tint), 0.12);
    color: var(--glass-text-dim);
    box-shadow: inset 0 1px 0 rgba(var(--glass-tint), 0.24);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
  }
  .skin-glass .pchip {
    color: var(--glass-ok);
  }

  /* ================= 提示条 ================= */
  .skin-glass .msg,
  .skin-glass .conn-status,
  .skin-glass .err {
    border-radius: 10px;
    border: 1px solid var(--glass-panel-border);
    background: rgba(var(--glass-tint), 0.07);
    box-shadow: inset 0 1px 0 rgba(var(--glass-tint), 0.2);
  }
  .skin-glass .msg.ok {
    color: var(--glass-ok);
    border-color: rgba(48, 209, 88, 0.35);
    background: rgba(48, 209, 88, 0.12);
  }
  .skin-glass .msg.fail,
  .skin-glass .err {
    color: var(--glass-danger);
    border-color: rgba(255, 69, 58, 0.35);
    background: rgba(255, 69, 58, 0.12);
  }

  /* ================= 列表 ================= */
  .skin-glass .list-row {
    border-radius: 8px;
  }
  .skin-glass .list-row:hover {
    background: rgba(var(--glass-tint), 0.15);
  }

  /* ================= 服务器选择面板 ================= */
  .skin-glass .pick-item {
    border-radius: 9px;
    border: 1px solid transparent;
    color: var(--glass-text);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .skin-glass .pick-item:hover {
    background: rgba(var(--glass-tint), 0.15);
    border-color: rgba(var(--glass-tint), 0.24);
  }
  .skin-glass .pick-item.on {
    border-color: rgba(100, 210, 255, 0.55);
    background: rgba(100, 210, 255, 0.16);
    color: var(--glass-accent);
  }

  /* ================= 无边框图标 ================= */
  .skin-glass .mini-btn,
  .skin-glass .gear {
    color: rgba(var(--glass-tint), 0.72);
    background: transparent;
    border: none;
    box-shadow: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  }
  .skin-glass.page .mini-btn {
    color: rgba(var(--glass-tint), 0.75);
  }
`;
