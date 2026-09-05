import { describe, expect, it } from "vitest";

import { describeOp, pendingFrom } from "./pendingOps";

describe("pendingFrom", () => {
  it("takes the whole queue out of the event", () => {
    const raw = JSON.stringify({
      type: "elevation_required",
      pending: [{ op: "hosts-apply", entries: [] }, { op: "trust-ca-install" }],
    });
    expect(pendingFrom(raw)).toHaveLength(2);
  });

  /* Một lô rỗng vẫn là một `elevation_required`: nó nghĩa là "không còn gì chờ", khác hẳn "sự
     kiện này không nói về quyền quản trị". */
  it("tells an empty queue from an event about something else", () => {
    expect(pendingFrom(JSON.stringify({ type: "elevation_required", pending: [] }))).toEqual([]);
    expect(pendingFrom(JSON.stringify({ type: "resync", missed: 1 }))).toBeNull();
    expect(pendingFrom("not json")).toBeNull();
  });
});

describe("describeOp", () => {
  /* Người dùng phải thấy thao tác sẽ đổi *cái gì*, không phải một chữ "elevation". */
  it("names the hosts lines it would write", () => {
    const described = describeOp({
      op: "hosts-apply",
      entries: [{ address: "127.0.0.1", name: "blog.test" }],
    });
    expect(described.kind).toBe("hosts-apply");
    expect(described.detail).toContain("blog.test");
    expect(described.detail).toContain("127.0.0.1");
  });

  /* 13 biến thể, và một cái chưa biết vẫn phải hiện ra — giấu nó đi là xin quyền cho một thao tác
     người dùng không được xem. */
  it("still describes an op it has no special wording for", () => {
    expect(describeOp({ op: "audit-log-remove" }).kind).toBe("audit-log-remove");
    expect(describeOp({}).kind).toBe("unknown");
    expect(describeOp(null).kind).toBe("unknown");
  });

  it("shows a plan or a target as it came", () => {
    const described = describeOp({ op: "port-access-grant", plan: { port: 443 } });
    expect(described.detail).toContain("443");
  });
});
