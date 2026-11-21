import { describe, it, expect } from "vitest";
import { encodeId, decodeId } from "./componentIds.js";

describe("componentIds", () => {
  it("roundtrips mod:undo:4821", () => {
    const id = encodeId("mod", "undo", "4821");
    expect(id).toBe("mod:undo:4821");
    expect(decodeId(id)).toEqual({ module: "mod", action: "undo", args: ["4821"] });
  });

  it("roundtrips tix:close:<channelId>", () => {
    const id = encodeId("tix", "close", "123");
    expect(decodeId(id)).toEqual({ module: "tix", action: "close", args: ["123"] });
  });

  it("roundtrips shop:buy:oven:5", () => {
    const id = encodeId("shop", "buy", "oven", "5");
    expect(id).toBe("shop:buy:oven:5");
    expect(decodeId(id)).toEqual({ module: "shop", action: "buy", args: ["oven", "5"] });
  });

  it("throws on invalid customId", () => {
    expect(() => decodeId("onlyone")).toThrow();
    expect(() => decodeId("")).toThrow();
  });
});
