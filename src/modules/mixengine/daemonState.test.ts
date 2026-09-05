import { describe, expect, it } from "vitest";

import { applyEvent, type ServiceRow } from "./daemonState";

const rows: ServiceRow[] = [
  { id: "mariadb@main", state: "running", port: 3306 },
  { id: "caddy@main", state: "stopped", port: null },
];

describe("applyEvent", () => {
  /* Trạng thái được thông báo, không bao giờ được suy ra: hàng đổi vì stream nói, không vì ai bấm. */
  it("moves a row when the stream says the service changed", () => {
    const raw = JSON.stringify({ type: "service_state_changed", id: "caddy@main", to: "starting" });
    const next = applyEvent(rows, raw);
    expect(next.rows.find((r) => r.id === "caddy@main")?.state).toBe("starting");
    expect(next.rows.find((r) => r.id === "mariadb@main")?.state).toBe("running");
    expect(next.resync).toBe(false);
  });

  /* `resync` nghĩa là bus 1024 message bên kia đã tràn. Con số `missed` chỉ để ghi log — cách xử
     lý giống nhau dù lỡ một hay một nghìn. */
  it("asks for a resync when the bus overflowed", () => {
    expect(applyEvent(rows, JSON.stringify({ type: "resync", missed: 900 })).resync).toBe(true);
  });

  it("asks for a resync when the connection dropped", () => {
    expect(applyEvent(rows, JSON.stringify({ type: "mixdb_disconnected" })).resync).toBe(true);
  });

  /* Một biến thể sinh ra ở phiên bản sau phải tới đây như một object bỏ qua được — không ném, và
     không làm mất hàng nào. Đó là toàn bộ lý do sự kiện được internally tagged. */
  it("ignores an event type it has never heard of", () => {
    const next = applyEvent(rows, JSON.stringify({ type: "quantum_flux", whatever: 1 }));
    expect(next.rows).toEqual(rows);
    expect(next.resync).toBe(false);
  });

  it("ignores something that is not even JSON", () => {
    expect(applyEvent(rows, "<html>").rows).toEqual(rows);
  });

  /* Một service chưa có trong bảng: không dựng hàng giả, đợi `service.list` nói nó là gì. */
  it("does not invent a row for a service it does not know", () => {
    const raw = JSON.stringify({ type: "service_state_changed", id: "redis@main", to: "running" });
    expect(applyEvent(rows, raw).rows).toHaveLength(2);
  });

  /* Một `service_state_changed` thiếu nửa nào cũng không được đụng vào bảng. */
  it("ignores a state change that names no service or no state", () => {
    expect(applyEvent(rows, JSON.stringify({ type: "service_state_changed", to: "running" })).rows)
      .toEqual(rows);
    expect(applyEvent(rows, JSON.stringify({ type: "service_state_changed", id: "caddy@main" })).rows)
      .toEqual(rows);
  });
});
