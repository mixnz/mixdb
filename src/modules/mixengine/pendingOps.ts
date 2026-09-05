/**
 * Những thao tác đang chờ quyền quản trị, đọc ra khỏi một sự kiện.
 *
 * `elevation_required` mang **mọi** thao tác đang chờ, cũ nhất trước, mỗi cái kèm thứ nó sẽ đổi
 * cụ thể — đúng những dòng `hosts`, đúng cổng, đúng kho tin cậy. UI hiện danh sách đó rồi mới gọi
 * `elevation.grant`, thứ bật đúng một prompt cho cả lô. Từ chối là một kết cục API mô hình hóa
 * được, không phải một lỗi; `elevation.drop` là đường ra.
 *
 * Daemon **không bao giờ** tự bật prompt — chỉ client gọi `grant`. Đó chính là thứ làm cho "giải
 * thích trước khi xin" nói ra được thay vì là thứ phải sắp xếp sau.
 */

/** `pending` của một `elevation_required`, hoặc `null` khi message nói về chuyện khác. */
export function pendingFrom(raw: string): unknown[] | null {
  try {
    const event = JSON.parse(raw) as { type?: unknown; pending?: unknown };
    if (event.type !== "elevation_required") return null;
    // Một lô rỗng vẫn là một câu trả lời: nó nghĩa là không còn gì chờ.
    return Array.isArray(event.pending) ? event.pending : [];
  } catch {
    return null;
  }
}

/**
 * Một thao tác, thành hai chuỗi để vẽ.
 *
 * `detail` **không dịch**: đó là đường dẫn, địa chỉ và cổng thật — thứ người ta đối chiếu, không
 * phải thứ để đọc cho xuôi.
 */
export function describeOp(op: unknown): { kind: string; detail: string } {
  const value = (op ?? {}) as {
    op?: unknown;
    entries?: unknown;
    plan?: unknown;
    target?: unknown;
  };
  const kind = typeof value.op === "string" ? value.op : "unknown";

  if (kind === "hosts-apply" && Array.isArray(value.entries)) {
    const lines = value.entries
      .map((entry) => {
        const row = entry as { address?: unknown; name?: unknown };
        return `${String(row.address ?? "")} ${String(row.name ?? "")}`.trim();
      })
      .filter(Boolean);
    return { kind, detail: lines.join("\n") };
  }

  // Mọi biến thể còn lại hiện nguyên hình dạng của nó. Một thao tác không có lời lẽ riêng vẫn phải
  // hiện ra: giấu nó đi là xin quyền cho một thứ người dùng không được xem.
  const extra = value.plan ?? value.target;
  return { kind, detail: extra === undefined ? "" : JSON.stringify(extra, null, 2) };
}
