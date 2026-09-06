/**
 * Thứ một tab MixEngine mang sang lần chạy sau.
 *
 * **Ids only.** Đây là `localStorage`: không host, không mật khẩu, không URL, không endpoint. Shell
 * truyền slot này qua mà không kiểm gì, nên `parseMixEngineTabState` là chỗ việc kiểm sống — xem
 * `docs/superpowers/specs/2026-08-23-tab-session-context-design.md`.
 */
export interface MixEngineTabState {
  screen: "dashboard";
}

/** Slot shell trả lại từ lần chạy trước, đã kiểm. `undefined` nghĩa là không dùng được. */
export function parseMixEngineTabState(value: unknown): MixEngineTabState | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const screen = (value as { screen?: unknown }).screen;
  return screen === "dashboard" ? { screen } : undefined;
}
