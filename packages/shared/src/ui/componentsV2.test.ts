import { describe, it, expect } from "vitest";
import {
  primaryButton,
  secondaryButton,
  dangerButton,
  linkButton,
  buttonRow,
  selectRow,
  shortTextInput,
  paragraphInput,
  createModal,
  customId,
  parseCustomId,
  isOurCustomId,
  disableAllComponents,
  enableAllComponents,
  setButtonLoading,
  validateButton,
  validateSelectMenu,
  validateModal,
  componentsV2Flag,
  COMPONENT_LIMITS,
} from "./componentsV2.js";

describe("button builders", () => {
  it("creates a primary button", () => {
    const btn = primaryButton("test:btn", "Click me");
    expect(btn.type).toBe(2);
    expect(btn.custom_id).toBe("test:btn");
    expect(btn.label).toBe("Click me");
    expect(btn.style).toBe(1);
  });

  it("creates a danger button", () => {
    const btn = dangerButton("test:del", "Delete");
    expect(btn.style).toBe(4);
  });

  it("creates a link button", () => {
    const btn = linkButton("https://example.com", "Visit");
    expect(btn.style).toBe(5);
    expect(btn.url).toBe("https://example.com");
  });
});

describe("buttonRow", () => {
  it("creates action row with buttons", () => {
    const row = buttonRow(primaryButton("a", "A"), secondaryButton("b", "B"));
    expect(row.type).toBe(1);
    expect(row.components).toHaveLength(2);
  });
});

describe("selectRow", () => {
  it("creates select menu row", () => {
    const row = selectRow("test:select", "Choose", [
      { label: "Opt 1", value: "1" },
      { label: "Opt 2", value: "2" },
    ]);
    expect(row.type).toBe(1);
    expect(row.components[0].type).toBe(3);
    expect(row.components[0].custom_id).toBe("test:select");
  });
});

describe("text inputs", () => {
  it("creates short text input", () => {
    const input = shortTextInput("test:name", "Name");
    expect(input.type).toBe(4);
    expect(input.custom_id).toBe("test:name");
    expect(input.label).toBe("Name");
  });

  it("creates paragraph input", () => {
    const input = paragraphInput("test:bio", "Bio");
    expect(input.style).toBe(2);
  });
});

describe("createModal", () => {
  it("creates modal with inputs", () => {
    const modal = createModal("test:modal", "Title", shortTextInput("a", "A"));
    expect(modal.custom_id).toBe("test:modal");
    expect(modal.title).toBe("Title");
    expect(modal.components).toHaveLength(1);
  });
});

describe("customId helpers", () => {
  it("encodes custom ID", () => {
    const id = customId("mod", "case", "view", "123");
    expect(id).toBe("mod:case:view:123");
    expect(id.length).toBeLessThanOrEqual(100);
  });

  it("escapes colons in args", () => {
    const id = customId("mod", "case", "view:123");
    expect(id).toBe("mod:case:view_123");
  });

  it("parses custom ID", () => {
    const parsed = parseCustomId("mod:case:view:123");
    expect(parsed).toEqual({ module: "mod", action: "case", args: ["view", "123"] });
  });

  it("returns null for invalid ID", () => {
    expect(parseCustomId("nomodules")).toBeNull();
  });

  it("checks if ID belongs to module", () => {
    expect(isOurCustomId("mod:case:view:123", "mod")).toBe(true);
    expect(isOurCustomId("mod:case:view:123", "other")).toBe(false);
  });
});

describe("validation", () => {
  it("validates button label length", () => {
    const btn = { label: "A".repeat(81), custom_id: "test" };
    expect(validateButton(btn)).toBe("Button label exceeds 80 characters");
  });

  it("validates button customId length", () => {
    const btn = { label: "OK", custom_id: "A".repeat(101) };
    expect(validateButton(btn)).toBe("Button customId exceeds 100 characters");
  });

  it("validates select menu options", () => {
    const select = {
      placeholder: "A".repeat(151),
      options: [{ label: "A", value: "1" }],
    };
    expect(validateSelectMenu(select)).toContain("exceeds 150 characters");
  });

  it("validates modal title", () => {
    const modal = { title: "A".repeat(46), components: [] };
    expect(validateModal(modal)).toContain("exceeds 45 characters");
  });
});

describe("component state helpers", () => {
  const rows = [
    {
      type: 1,
      components: [
        { type: 2, custom_id: "a", label: "A", disabled: false },
        { type: 2, custom_id: "b", label: "B", disabled: false },
      ],
    },
  ];

  it("disables all components", () => {
    const disabled = disableAllComponents(rows);
    expect(disabled[0].components[0].disabled).toBe(true);
    expect(disabled[0].components[1].disabled).toBe(true);
  });

  it("enables all components", () => {
    const enabled = enableAllComponents(rows);
    expect(enabled[0].components[0].disabled).toBe(false);
  });

  it("sets button loading state", () => {
    const loading = setButtonLoading(rows, "a");
    expect(loading[0].components[0].label).toBe("⏳ Working…");
    expect(loading[0].components[0].disabled).toBe(true);
    expect(loading[0].components[1].label).toBe("B");
  });
});

describe("limits and flags", () => {
  it("has component limits", () => {
    expect(COMPONENT_LIMITS.MAX_ACTION_ROWS).toBe(5);
    expect(COMPONENT_LIMITS.MAX_BUTTONS_PER_ROW).toBe(5);
  });

  it("returns components V2 flag", () => {
    expect(componentsV2Flag()).toBe(32768);
  });
});
