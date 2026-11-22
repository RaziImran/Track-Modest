import { describe, it, expect } from "vitest";
import {
  buildPanel,
  buildErrorPanel,
  buildLoadingPanel,
  buildConfirmationPanel,
  buildPaginationSelect,
  buildNavigationRow,
  buildExpiredPanel,
  PANEL_COLORS,
  PanelColor,
} from "./panels.js";

describe("PANEL_COLORS", () => {
  it("has all required colors", () => {
    const expectedColors: PanelColor[] = ["brand", "success", "danger", "warning", "info", "gold", "rep"];
    for (const color of expectedColors) {
      expect(PANEL_COLORS[color]).toBeDefined();
      expect(typeof PANEL_COLORS[color]).toBe("number");
    }
  });

  it("brand color is Nova purple", () => {
    expect(PANEL_COLORS.brand).toBe(0x7c5cff);
  });

  it("success color is green", () => {
    expect(PANEL_COLORS.success).toBe(0x3ba55d);
  });

  it("danger color is red", () => {
    expect(PANEL_COLORS.danger).toBe(0xed4245);
  });
});

describe("buildPanel", () => {
  const t = (key: string) => key;

  it("builds a basic panel with title only", () => {
    const result = buildPanel({ title: "Test Title" }, t);
    expect(result.embed).toBeDefined();
    expect(result.rows).toHaveLength(0);
    expect(result.embed.data.title).toBe("Test Title");
  });

  it("includes description when provided", () => {
    const result = buildPanel({ title: "Test", description: "Description here" }, t);
    expect(result.embed.data.description).toBe("Description here");
  });

  it("includes fields when provided", () => {
    const result = buildPanel({
      title: "Test",
      fields: [
        { name: "Field 1", value: "Value 1" },
        { name: "Field 2", value: "Value 2", inline: true },
      ],
    }, t);
    expect(result.embed.data.fields).toHaveLength(2);
  });

  it("includes actions as buttons", () => {
    const result = buildPanel({
      title: "Test",
      actions: [
        { label: "Primary", customId: "test:primary", style: 1 },
        { label: "Secondary", customId: "test:secondary", style: 2 },
      ],
    }, t);
    expect(result.rows).toHaveLength(1);
    const buttons = result.rows[0].components;
    expect(buttons.length).toBe(2);
  });

  it("includes selects when provided", () => {
    const result = buildPanel({
      title: "Test",
      selects: [
        {
          customId: "test:select",
          placeholder: "Choose...",
          options: [
            { label: "Option 1", value: "1" },
            { label: "Option 2", value: "2" },
          ],
        },
      ],
    }, t);
    expect(result.rows).toHaveLength(1);
    const selectMenu = result.rows[0].components[0];
    expect(selectMenu.type).toBe(3);
  });

  it("includes footer when provided", () => {
    const result = buildPanel({ title: "Test", footer: "Footer text" }, t);
    expect(result.embed.data.footer?.text).toContain("Footer text");
  });

  it("uses custom accent color when provided", () => {
    const result = buildPanel({ title: "Test", accentColor: 0xff0000 }, t);
    expect(result.embed.data.color).toBe(0xff0000);
  });

  it("uses color mapping when accentColor not provided", () => {
    const result = buildPanel({ title: "Test", color: "success" }, t);
    expect(result.embed.data.color).toBe(PANEL_COLORS.success);
  });

  it("applies i18n translation function", () => {
    const customT = (key: string) => `translated:${key}`;
    const result = buildPanel({ title: "title.key", description: "desc.key" }, customT);
    expect(result.embed.data.title).toBe("translated:title.key");
    expect(result.embed.data.description).toBe("translated:desc.key");
  });
});

describe("buildErrorPanel", () => {
  const t = (key: string) => key;

  it("builds error panel with title, description, and error code", () => {
    const result = buildErrorPanel("Error", "Something went wrong", "ERR_001", undefined, t);
    expect(result.embed.data.color).toBe(PANEL_COLORS.danger);
    expect(result.embed.data.title).toBe("Error");
    expect(result.embed.data.description).toBe("Something went wrong");
  });

  it("includes retry action when provided", () => {
    const retryAction = { label: "Retry", customId: "test:retry", style: 1 };
    const result = buildErrorPanel("Error", "Failed", "ERR_001", retryAction, t);
    expect(result.rows).toHaveLength(1);
  });

  it("always includes dismiss button", () => {
    const result = buildErrorPanel("Error", "Failed", "ERR_001", undefined, t);
    expect(result.rows).toHaveLength(1);
    const buttons = result.rows[0].components;
    const hasDismiss = buttons.some((b: any) => b.custom_id === "core:dismiss");
    expect(hasDismiss).toBe(true);
  });
});

describe("buildLoadingPanel", () => {
  const t = (key: string) => key;

  it("builds loading panel with info color", () => {
    const result = buildLoadingPanel("Loading", "Please wait...", t);
    expect(result.embed.data.color).toBe(PANEL_COLORS.info);
  });
});

describe("buildConfirmationPanel", () => {
  const t = (key: string) => key;

  it("builds confirmation panel with warning color", () => {
    const result = buildConfirmationPanel(
      "Confirm",
      "Are you sure?",
      { label: "Yes", customId: "test:confirm", style: 3 },
      { label: "No", customId: "test:cancel", style: 2 },
      t,
    );
    expect(result.embed.data.color).toBe(PANEL_COLORS.warning);
  });

  it("includes both confirm and cancel actions", () => {
    const result = buildConfirmationPanel(
      "Confirm",
      "Are you sure?",
      { label: "Yes", customId: "test:confirm" },
      { label: "No", customId: "test:cancel" },
      t,
    );
    expect(result.rows).toHaveLength(1);
    const buttons = result.rows[0].components;
    expect(buttons.length).toBe(2);
  });
});

describe("buildPaginationSelect", () => {
  const t = (key: string) => key;

  it("creates select menu with page options", () => {
    const select = buildPaginationSelect("test:page", 2, 5, "Page", t);
    expect(select.customId).toBe("test:page");
    expect(select.placeholder).toBe("Page");
    expect(select.options).toHaveLength(5);
    expect(select.options[1]!.default).toBe(true);
    expect(select.options[0]!.default).toBe(false);
  });
});

describe("buildNavigationRow", () => {
  const t = (key: string) => key;

  it("creates action row with back and home buttons", () => {
    const row = buildNavigationRow("test:back", "test:home", t);
    expect(row.type).toBe(1);
    expect(row.components).toHaveLength(2);
    expect(row.components[0].custom_id).toBe("test:back");
    expect(row.components[1].custom_id).toBe("test:home");
  });

  it("uses default home customId when not provided", () => {
    const row = buildNavigationRow("test:back", undefined, t);
    expect(row.components[1].custom_id).toBe("core:hub");
  });
});

describe("buildExpiredPanel", () => {
  const t = (key: string) => key;

  it("builds expired panel with warning color", () => {
    const result = buildExpiredPanel("My Panel", { label: "Reopen", customId: "test:reopen" }, t);
    expect(result.embed.data.color).toBe(PANEL_COLORS.warning);
  });

  it("includes reopen action", () => {
    const result = buildExpiredPanel("My Panel", { label: "Reopen", customId: "test:reopen" }, t);
    expect(result.rows).toHaveLength(1);
    const buttons = result.rows[0].components;
    expect(buttons.some((b: any) => b.custom_id === "test:reopen")).toBe(true);
  });
});
