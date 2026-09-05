import type { ServiceState } from "./api/types/ServiceState";
import type { ServiceSummary } from "./api/types/ServiceSummary";

/**
 * Rút gọn stream sự kiện thành state của bảng.
 *
 * Thuần và không gọi gì — đó là lý do nó ở đây chứ không nằm trong component. Luật **"trạng thái
 * được thông báo, không bao giờ được suy ra"** là thứ đáng có test, và một `useEffect` thì không
 * test được.
 */

/** Một dòng của bảng service. Chỉ những gì bảng vẽ. */
export interface ServiceRow {
  id: string;
  state: ServiceState | null;
  port: number | null;
}

/** Một câu trả lời `service.list`, thành các dòng. */
export function rowsFrom(list: ServiceSummary[]): ServiceRow[] {
  return list.map((service) => ({
    id: service.id,
    state: service.state ?? null,
    port: service.port ?? null,
  }));
}

/**
 * Bảng sau một message.
 *
 * `resync` là `true` khi thứ vừa tới có nghĩa là "đừng tin cái đang có, đọc lại": bus bên kia tràn,
 * hoặc kết nối đứt. Sự kiện là best-effort và **không bao giờ là đường duy nhất biết trạng thái**.
 */
export function applyEvent(
  rows: ServiceRow[],
  raw: string,
): { rows: ServiceRow[]; resync: boolean } {
  let event: { type?: unknown; id?: unknown; to?: unknown };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return { rows, resync: false };
  }

  switch (event.type) {
    case "resync":
    case "mixdb_disconnected":
      return { rows, resync: true };

    case "service_state_changed": {
      const id = typeof event.id === "string" ? event.id : null;
      const to = typeof event.to === "string" ? (event.to as ServiceState) : null;
      if (id === null || to === null) return { rows, resync: false };
      // Không dựng hàng cho một service chưa biết: `service.list` là chỗ một hàng ra đời, và nó
      // biết những thứ sự kiện này không mang theo.
      return {
        rows: rows.map((row) => (row.id === id ? { ...row, state: to } : row)),
        resync: false,
      };
    }

    default:
      // Một biến thể của phiên bản sau. Bỏ qua là đúng hợp đồng, không phải bỏ sót: sự kiện được
      // internally tagged chính là để chuyện này xảy ra được.
      return { rows, resync: false };
  }
}
