import type { SiteOwner } from "./api/types/SiteOwner";
import type { SiteSummary } from "./api/types/SiteSummary";

export type SiteRow = SiteSummary;

/**
 * Chỉ site thuộc một project mới sửa được.
 *
 * Site của một extension chỉ xem/liệt kê được ở đây — `site.update` gửi thẳng vào nó vẫn bị daemon
 * từ chối dù UI có cho phép, nhưng để nút bấm luôn hỏng là hứa một hành động không giữ được.
 */
export function canEditSite(owner: SiteOwner): boolean {
  return owner.type === "project";
}

/**
 * Áp `site_sharing_changed` lên bảng site.
 *
 * Cùng luật Dashboard đã theo cho `service_state_changed`: sự kiện là best-effort, nhưng khi tới nó
 * là nguồn thật, không phải suy đoán. `type` lạ hoặc payload hỏng bị bỏ qua, không ném — một biến
 * thể sinh ra ở phiên bản sau phải tới được một MixDB cũ như một object bỏ qua được.
 */
export function applySharingChange(rows: SiteRow[], raw: string): SiteRow[] {
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return rows;
  }
  if (
    typeof event !== "object" ||
    event === null ||
    (event as { type?: unknown }).type !== "site_sharing_changed"
  ) {
    return rows;
  }
  const { domain, sharing } = event as { domain: string; sharing: SiteRow["sharing"] };
  return rows.map((row) => (row.domain === domain ? { ...row, sharing } : row));
}

/** `mm:ss`, hay `hh:mm:ss` một khi còn hơn một giờ. Quá hạn kẹp về 0, không âm. */
export function formatRemaining(untilMs: number, nowMs: number = Date.now()): string {
  const totalSeconds = Math.max(0, Math.round((untilMs - nowMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
