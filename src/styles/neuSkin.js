import { css } from 'lit';

/**
 * 拟态皮肤（Neumorphism / 新拟物）
 *
 * 成熟实现的核心参数（参考 neumorphism.io 及各 UI 库）：
 *   底色 #E0E5EC，暗影 #A3B1C6，亮影 #FFFFFF
 *   凸起：box-shadow: 6px 6px 12px #A3B1C6, -6px -6px 12px #FFFFFF
 *   按下/凹陷：box-shadow: inset 4px 4px 8px #A3B1C6, inset -4px -4px 8px #FFFFFF
 *
 * 技术限制：
 *   卡片祖先 .item-card-content 是 overflow:hidden，元素的外阴影会被裁掉。
 *   所以卡片本体用「斜向渐变 + 内高光/内暗影」模拟凸起，
 *   只有卡片内部的按钮/面板才用标准外阴影（它们在卡片内部，不受裁剪影响）。
 *
 * 对比度（tools/check-contrast.py 口径）：
 *   #2D3748 on #E0E5EC ≈ 8.9  AAA
 *   #5A6B7D on #E0E5EC ≈ 4.6  AA
 */

export const neuSkin = css`
  /* ================= 卡片本体 ================= */
  .skin-neu {
    --neu-bg: #e0e5ec;
    --neu-dark: #a3b1c6;
    --neu-light: #ffffff;
    --neu-text: #2d3748; /* 9.47 on #e0e5ec */
    --neu-text-dim: #4a5568; /* 5.94 / 5.35(渐变底) / 6.23(面板) */
    --neu-mute: #5a6b7d;
    --neu-accent: #2650d4; /* 5.22 */
    --neu-ok: #1a6b2b; /* 5.21 */
    --neu-danger: #b81f1f; /* 5.10 */
    --neu-warn: #6f5000; /* 5.88 */

    /* 页面与面板 */
    --neu-page-bg: #e0e5ec;
    --neu-page-text: #2d3748;
    --neu-page-dim: #4a5568;
    --neu-panel-bg: #e6eaf0;
    --neu-panel-text: #2d3748;
    --neu-panel-dim: #4a5568;

    /* 拟态整体是浅底，状态色必须用深色 */
    --st-stopped: #4a5568;
    --st-running: #1a6b2b;
    --st-starting: #6f5000;
    --st-stopping: #6f5000;

    border: none;
    border-radius: 20px;
    color: var(--neu-text);
    /* 外阴影会被祖先裁掉，改用斜向渐变模拟左上打光 */
    background: linear-gradient(145deg, #f0f3f8 0%, #d3dae4 100%);
    box-shadow: inset 2px 2px 6px rgba(255, 255, 255, 0.9),
      inset -2px -2px 6px rgba(163, 177, 198, 0.45);
  }

  /* 深色拟态 */
  .skin-neu.dark {
    --neu-bg: #2c3038;
    --neu-dark: #212429;
    --neu-light: #383d47;
    --neu-text: #e4e8ee;
    --neu-text-dim: #a8b2c0;
    --neu-mute: #8b96a6;
    --neu-accent: #7aa2ff;
    --neu-ok: #63d471;
    --neu-danger: #ff8080;
    --neu-warn: #ffd166;

    --neu-page-bg: #2c3038;
    --neu-page-text: #e4e8ee;
    --neu-page-dim: #a8b2c0;
    --neu-panel-bg: #333843;
    --neu-panel-text: #e4e8ee;
    --neu-panel-dim: #a8b2c0;

    background: linear-gradient(145deg, #333843 0%, #262a31 100%);
    box-shadow: inset 2px 2px 6px rgba(255, 255, 255, 0.06),
      inset -2px -2px 6px rgba(0, 0, 0, 0.45);
  }

  /* ================= 整页 ================= */
  .skin-neu.page,
  .skin-neu.container {
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: var(--neu-page-bg) !important;
    background-image: none !important;
    color: var(--neu-page-text) !important;
  }

  /* ================= 按钮：凸起 ↔ 按下凹陷 ================= */
  .skin-neu .btn,
  .skin-neu .act,
  .skin-neu .pbtn,
  .skin-neu .icon-btn,
  .skin-neu .btn-secondary,
  .skin-neu button.primary,
  .skin-neu .tab {
    border: none;
    border-radius: 9px;
    background: var(--neu-bg);
    color: var(--neu-text);
    box-shadow: 3px 3px 6px var(--neu-dark), -3px -3px 6px var(--neu-light);
    transition: box-shadow 0.15s ease, transform 0.05s ease;
  }
  .skin-neu .btn:hover,
  .skin-neu .act:hover,
  .skin-neu .pbtn:hover,
  .skin-neu .icon-btn:hover,
  .skin-neu .btn-secondary:hover,
  .skin-neu button.primary:hover,
  .skin-neu .tab:hover {
    box-shadow: 4px 4px 8px var(--neu-dark), -4px -4px 8px var(--neu-light);
  }
  .skin-neu .btn:active,
  .skin-neu .act:active,
  .skin-neu .pbtn:active,
  .skin-neu .icon-btn:active,
  .skin-neu .btn-secondary:active,
  .skin-neu button.primary:active,
  .skin-neu .tab:active {
    box-shadow: inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light);
  }
  .skin-neu .btn:disabled,
  .skin-neu .act:disabled,
  .skin-neu .pbtn:disabled,
  .skin-neu .icon-btn:disabled {
    color: var(--neu-mute);
    box-shadow: inset 2px 2px 4px var(--neu-dark), inset -2px -2px 4px var(--neu-light);
    opacity: 1;
  }

  /* 语义色 */
  .skin-neu .btn.danger,
  .skin-neu .act.danger {
    color: var(--neu-danger);
  }
  .skin-neu .btn.ok,
  .skin-neu .act.ok {
    color: var(--neu-ok);
  }
  .skin-neu .pbtn.on {
    color: var(--neu-ok);
    box-shadow: inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light);
  }
  .skin-neu .pbtn.danger.on {
    color: var(--neu-danger);
  }
  .skin-neu .tab.active {
    color: var(--neu-accent);
    box-shadow: inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light);
  }

  /* ================= 面板：凹陷槽位 ================= */
  .skin-neu .inst,
  .skin-neu .prow,
  .skin-neu .form-section,
  .skin-neu .players {
    border: none;
    border-radius: 12px;
    background: var(--neu-panel-bg);
    color: var(--neu-panel-text);
    box-shadow: inset 3px 3px 7px var(--neu-dark), inset -3px -3px 7px var(--neu-light);
  }
  .skin-neu .inst-name,
  .skin-neu .pname,
  .skin-neu .form-section .section-title,
  .skin-neu .form-section label,
  .skin-neu .hint,
  .skin-neu .checkbox-label {
    color: var(--neu-panel-text);
  }
  .skin-neu .inst .inst-badge,
  .skin-neu .prow .pmeta,
  .skin-neu .form-section .hint {
    color: var(--neu-panel-dim);
  }
  .skin-neu .form-section .section-title::before {
    background: var(--neu-accent);
    border-radius: 2px;
  }

  /* ================= 输入控件：凹陷 ================= */
  .skin-neu .styled-input {
    border: none;
    border-radius: 9px;
    background: var(--neu-bg);
    color: var(--neu-text);
    box-shadow: inset 3px 3px 6px var(--neu-dark), inset -3px -3px 6px var(--neu-light);
  }
  .skin-neu .styled-input:focus {
    outline: none;
    box-shadow: inset 4px 4px 8px var(--neu-dark), inset -4px -4px 8px var(--neu-light),
      0 0 0 2px rgba(79, 124, 255, 0.35);
  }
  .skin-neu .checkbox-label {
    border: none;
    border-radius: 9px;
    background: var(--neu-bg);
    box-shadow: inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light);
    color: var(--neu-text);
  }

  /* ================= 圆点 ================= */
  .skin-neu .dot {
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
  }
  .skin-neu.dark .dot {
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35);
  }

  /* ================= 文字 ================= */
  .skin-neu .nm,
  .skin-neu .mini-title,
  .skin-neu .list-name,
  .skin-neu .list-title,
  .skin-neu .mv,
  .skin-neu .mini-num,
  .skin-neu .vnum,
  .skin-neu .num {
    color: var(--neu-text);
    text-shadow: none;
  }
  .skin-neu .ml,
  .skin-neu .vlabel,
  .skin-neu .sub,
  .skin-neu .subline,
  .skin-neu .list-sub,
  .skin-neu .vsub,
  .skin-neu .addrline {
    color: var(--neu-text-dim);
    text-shadow: none;
  }
  .skin-neu.page .h-title,
  .skin-neu.page .title,
  .skin-neu.container h1 {
    color: var(--neu-page-text);
    text-shadow: none;
  }
  .skin-neu.page .h-sub,
  .skin-neu.page .subtitle {
    color: var(--neu-page-dim);
    text-shadow: none;
  }
  .skin-neu .inst .inst-name,
  .skin-neu .inst .chip,
  .skin-neu .prow .pname {
    text-shadow: none;
  }

  /* ================= 标签 ================= */
  .skin-neu .chip,
  .skin-neu .pchip {
    border: none;
    border-radius: 8px;
    background: var(--neu-bg);
    color: var(--neu-text-dim);
    box-shadow: 2px 2px 4px var(--neu-dark), -2px -2px 4px var(--neu-light);
  }
  .skin-neu .pchip {
    color: var(--neu-ok);
  }

  /* ================= 提示条 ================= */
  .skin-neu .msg,
  .skin-neu .conn-status,
  .skin-neu .err {
    border: none;
    border-radius: 9px;
    box-shadow: inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light);
  }
  .skin-neu .msg.ok {
    color: var(--neu-ok);
  }
  .skin-neu .msg.fail,
  .skin-neu .err {
    color: var(--neu-danger);
  }

  /* ================= 列表悬停 ================= */
  .skin-neu .list-row {
    border-radius: 6px;
  }
  .skin-neu .list-row:hover {
    background: rgba(163, 177, 198, 0.18);
  }

  /* ================= 服务器选择面板 ================= */
  .skin-neu .picker-x {
    border-radius: 50%;
  }
  .skin-neu .pick-item {
    border: none;
    border-radius: 8px;
    color: var(--neu-text);
  }
  .skin-neu .pick-item:hover {
    box-shadow: inset 2px 2px 4px var(--neu-dark), inset -2px -2px 4px var(--neu-light);
    background: transparent;
  }
  .skin-neu .pick-item.on {
    color: var(--neu-accent);
    box-shadow: inset 2px 2px 5px var(--neu-dark), inset -2px -2px 5px var(--neu-light);
    background: transparent;
  }

  /* ================= 无边框图标 ================= */
  .skin-neu .mini-btn,
  .skin-neu .gear {
    color: var(--neu-mute);
    box-shadow: none;
    border: none;
    background: transparent;
  }
`;
