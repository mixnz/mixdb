import { describe, expect, it } from "vitest";

import { parseMixEngineTabState } from "./tabState";

describe("parseMixEngineTabState", () => {
  it("accepts all three screens", () => {
    expect(parseMixEngineTabState({ screen: "dashboard" })?.screen).toBe("dashboard");
    expect(parseMixEngineTabState({ screen: "sites" })?.screen).toBe("sites");
    expect(parseMixEngineTabState({ screen: "domains" })?.screen).toBe("domains");
  });

  it("rejects a fourth screen and garbage", () => {
    expect(parseMixEngineTabState({ screen: "metrics" })).toBeUndefined();
    expect(parseMixEngineTabState("dashboard")).toBeUndefined();
    expect(parseMixEngineTabState(null)).toBeUndefined();
    expect(parseMixEngineTabState([])).toBeUndefined();
  });
});
