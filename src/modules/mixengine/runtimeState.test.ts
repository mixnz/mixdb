import { describe, expect, it } from "vitest";

import { formatInstalledAt, jobFor, poolBanner, versionKey } from "./runtimeState";
import type { JobRow } from "./daemonState";

describe("versionKey", () => {
  it("joins kind and version with @", () => {
    expect(versionKey("php", "8.3.12")).toBe("php@8.3.12");
  });
});

describe("poolBanner", () => {
  it("maps reloaded to no banner", () => {
    expect(poolBanner("reloaded")).toBe("none");
  });
  it("maps restart_required to a restart banner", () => {
    expect(poolBanner("restart_required")).toBe("restartRequired");
  });
  it("maps pool_not_running to an apply-next-start message, not an error", () => {
    expect(poolBanner("pool_not_running")).toBe("appliesNextStart");
  });
});

describe("formatInstalledAt", () => {
  it("turns an epoch-millisecond Timestamp into the machine's own date/time, not a raw number", () => {
    const ms = Date.UTC(2026, 0, 15, 12, 0, 0);
    const formatted = formatInstalledAt(ms);
    expect(formatted).not.toBe(String(ms));
    expect(formatted).toBe(new Date(ms).toLocaleString());
  });
});

describe("jobFor", () => {
  const jobs: JobRow[] = [{ id: 1, kind: "runtime.install", percent: 40, message: "downloading" }];

  it("finds the job tracked for a version", () => {
    expect(jobFor(jobs, 1)).toEqual(jobs[0]);
  });

  it("returns undefined when nothing is tracked yet", () => {
    expect(jobFor(jobs, undefined)).toBeUndefined();
  });

  it("returns undefined once the job has finished and left the list", () => {
    expect(jobFor(jobs, 2)).toBeUndefined();
  });
});
