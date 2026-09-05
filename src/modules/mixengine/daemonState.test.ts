import { describe, expect, it } from "vitest";

import { applyEvent, applyJob, type JobRow, type ServiceRow } from "./daemonState";

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

describe("applyJob", () => {
  const running: JobRow[] = [{ id: 7, kind: "elevation", percent: 20, message: "asking" }];

  it("adds a job the first time it reports", () => {
    const raw = JSON.stringify({
      type: "job_progress",
      job: 9,
      kind: "install",
      percent: 5,
      message: "downloading",
    });
    const next = applyJob([], raw);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 9, percent: 5, message: "downloading" });
  });

  /* Tiến độ là thứ duy nhất trên stream được phép lặp lại — nó cập nhật hàng cũ, không đẻ hàng mới. */
  it("updates a job it already has instead of adding a second row", () => {
    const raw = JSON.stringify({ type: "job_progress", job: 7, percent: 80, message: "granted" });
    const next = applyJob(running, raw);
    expect(next).toHaveLength(1);
    expect(next[0].percent).toBe(80);
  });

  /* `kind` chỉ có ở message đầu; một message sau không được xoá nó. */
  it("keeps the kind a later message does not repeat", () => {
    const raw = JSON.stringify({ type: "job_progress", job: 7, percent: 80 });
    expect(applyJob(running, raw)[0].kind).toBe("elevation");
  });

  it("takes a finished job off the list", () => {
    expect(applyJob(running, JSON.stringify({ type: "job_finished", job: 7 }))).toHaveLength(0);
  });

  it("leaves the list alone for anything else", () => {
    expect(applyJob(running, JSON.stringify({ type: "resync", missed: 2 }))).toEqual(running);
    expect(applyJob(running, "not json")).toEqual(running);
    expect(applyJob(running, JSON.stringify({ type: "job_progress" }))).toEqual(running);
  });
});
