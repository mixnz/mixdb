import { describe, expect, it } from "vitest";

import { applySharingChange, canEditSite, formatRemaining, type SiteRow } from "./siteState";

describe("canEditSite", () => {
  it("a project-owned site can be edited", () => {
    expect(canEditSite({ type: "project", name: "blog" })).toBe(true);
  });

  it("an extension-owned site cannot", () => {
    expect(canEditSite({ type: "extension", id: "ext.mailhog" })).toBe(false);
  });
});

describe("applySharingChange", () => {
  const rows: SiteRow[] = [
    { domain: "blog.test", sharing: { until: null } } as unknown as SiteRow,
    { domain: "shop.test", sharing: null } as unknown as SiteRow,
  ];

  it("ignores events of another type", () => {
    const raw = JSON.stringify({ type: "resync", missed: 1 });
    expect(applySharingChange(rows, raw)).toBe(rows);
  });

  it("clears sharing on the row named by the event, leaves the other alone", () => {
    const raw = JSON.stringify({
      type: "site_sharing_changed",
      domain: "blog.test",
      sharing: null,
      because: { kind: "expired" },
    });
    const next = applySharingChange(rows, raw);
    expect(next.find((r) => r.domain === "blog.test")?.sharing).toBeNull();
    expect(next.find((r) => r.domain === "shop.test")).toBe(rows[1]);
  });

  it("a garbage payload does not throw", () => {
    expect(() => applySharingChange(rows, "not json")).not.toThrow();
    expect(applySharingChange(rows, "not json")).toBe(rows);
  });
});

describe("formatRemaining", () => {
  const now = 1_000_000;

  it("shows minutes and seconds under an hour", () => {
    expect(formatRemaining(now + 65_000, now)).toBe("01:05");
  });

  it("shows hours once there is more than one", () => {
    expect(formatRemaining(now + 3_661_000, now)).toBe("01:01:01");
  });

  it("clamps a past deadline to zero rather than going negative", () => {
    expect(formatRemaining(now - 5_000, now)).toBe("00:00");
  });
});
