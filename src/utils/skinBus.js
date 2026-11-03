/**
 * 皮肤变更广播
 *
 * 皮肤存在 dataNode 里，配置页保存后，其它已经渲染出来的卡片/页面
 * 不会自动重新读取，所以表现为"必须刷新才生效"。
 *
 * 这里用 window 自定义事件做即时广播：
 *   配置页保存 → emitSkinChange() → 所有监听者更新 this.skin/this.font
 * 微应用是同一页面里的 Web Component，共享 window，事件可直接送达。
 */

const EVT = 'mslx:skin-changed';

/** 广播皮肤变化 */
export function emitSkinChange(skin, font) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVT, { detail: { skin, font, at: Date.now() } })
    );
  } catch (e) {
    /* 忽略 */
  }
}

/**
 * 订阅皮肤变化
 * @returns {Function} 取消订阅
 */
export function onSkinChange(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') {
    return () => {};
  }
  const listener = (e) => {
    const d = e?.detail || {};
    try {
      handler(d);
    } catch (err) {
      /* 忽略回调异常，避免影响其它监听者 */
    }
  };
  window.addEventListener(EVT, listener);
  return () => window.removeEventListener(EVT, listener);
}
