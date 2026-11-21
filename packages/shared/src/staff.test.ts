import { describe, it, expect } from "vitest";
import {
  STAFF_LEVEL_ORDER,
  staffLevelIndex,
  levelName,
  checkHierarchy,
  levelSatisfies,
} from "./staff.js";

describe("staffLevelIndex", () => {
  it("maps levels to indices", () => {
    expect(staffLevelIndex("none")).toBe(0);
    expect(staffLevelIndex("helper")).toBe(1);
    expect(staffLevelIndex("moderator")).toBe(2);
    expect(staffLevelIndex("admin")).toBe(3);
    expect(staffLevelIndex("owner")).toBe(4);
  });
});

describe("levelName", () => {
  it("capitalizes first letter", () => {
    expect(levelName("none")).toBe("None");
    expect(levelName("moderator")).toBe("Moderator");
    expect(levelName("owner")).toBe("Owner");
  });
});

describe("checkHierarchy", () => {
  const base = {
    targetIsGuildOwner: false,
    targetIsSelf: false,
    targetHighestRoleGeActor: false,
    targetHighestRoleGeBot: false,
    actorIsOwner: false,
  };

  it("allows normal action", () => {
    expect(checkHierarchy(base)).toBeNull();
  });

  it("refuses guild owner (unless actor is owner)", () => {
    expect(checkHierarchy({ ...base, targetIsGuildOwner: true })).toBe("Cannot moderate the server owner.");
    expect(
      checkHierarchy({ ...base, targetIsGuildOwner: true, actorIsOwner: true }),
    ).toBeNull();
  });

  it("refuses self", () => {
    expect(checkHierarchy({ ...base, targetIsSelf: true })).toBe("Cannot moderate yourself.");
  });

  it("refuses target role >= actor role", () => {
    expect(
      checkHierarchy({ ...base, targetHighestRoleGeActor: true }),
    ).toContain("Move your role above theirs");
  });

  it("refuses target role >= bot role", () => {
    expect(
      checkHierarchy({ ...base, targetHighestRoleGeBot: true }),
    ).toContain("Move my role above theirs");
  });

  it("owner bypasses role hierarchy", () => {
    expect(
      checkHierarchy({ ...base, targetHighestRoleGeActor: true, actorIsOwner: true }),
    ).toBeNull();
  });
});

describe("levelSatisfies", () => {
  it("returns true when actual meets required", () => {
    expect(levelSatisfies("moderator", "moderator")).toBe(true);
    expect(levelSatisfies("moderator", "admin")).toBe(true);
    expect(levelSatisfies("moderator", "owner")).toBe(true);
  });
  it("returns false when actual is below required", () => {
    expect(levelSatisfies("admin", "moderator")).toBe(false);
    expect(levelSatisfies("owner", "admin")).toBe(false);
    expect(levelSatisfies("helper", "none")).toBe(false);
  });
});

describe("STAFF_LEVEL_ORDER", () => {
  it("is in ascending order", () => {
    expect(STAFF_LEVEL_ORDER).toEqual(["none", "helper", "moderator", "admin", "owner"]);
  });
});
