import { describe, expect, it } from "vitest";

import { parseMixEngineTabState } from "./tabState";

describe("parseMixEngineTabState", () => {
  it("keeps a screen it knows", () => {
    expect(parseMixEngineTabState({ screen: "dashboard" })).toEqual({ screen: "dashboard" });
  });

  /* localStorage là thứ ai cũng sửa được, và shell truyền slot này qua mà không kiểm — nên đây là
     chỗ việc kiểm sống. */
  it("keeps nothing it does not know", () => {
    expect(parseMixEngineTabState({ screen: "sites" })).toBeUndefined();
    expect(parseMixEngineTabState("dashboard")).toBeUndefined();
    expect(parseMixEngineTabState(null)).toBeUndefined();
    expect(parseMixEngineTabState(undefined)).toBeUndefined();
    expect(parseMixEngineTabState({ screen: 3 })).toBeUndefined();
    expect(parseMixEngineTabState([])).toBeUndefined();
  });
});
