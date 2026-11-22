// §9 Setup wizard — pure service layer tests.
import { describe, it, expect, vi } from "vitest";
import { SetupService } from "./service.js";
import type { SetupState } from "./schemas.js";

const baseDeps = () => ({
  getSetupState: vi.fn().mockResolvedValue(null),
  setSetupState: vi.fn().mockResolvedValue(undefined),
  deleteSetupState: vi.fn().mockResolvedValue(undefined),
});

const fullState = (overrides: Partial<SetupState> = {}): SetupState => ({
  step: 1,
  staffRoles: { admin: [], moderator: [], helper: [] },
  channels: {},
  modules: {},
  ...overrides,
});

describe("SetupService", () => {
  describe("applyPreset", () => {
    it("applies preset strictness and modules", () => {
      const service = new SetupService(baseDeps());
      const state = fullState();
      const next = service.applyPreset(state, "Gaming");
      expect(next.preset).toBe("Gaming");
      expect(next.strictness).toBe("BALANCED");
      expect(next.modules["automod"]).toBe(true);
      expect(next.modules["antiraid"]).toBe(true);
      expect(next.modules["logging"]).toBe(true);
    });

    it("applies Study preset with XP off", () => {
      const service = new SetupService(baseDeps());
      const state = fullState();
      const next = service.applyPreset(state, "Study");
      expect(next.modules["xp"]).toBeUndefined();
      expect(next.modules["tickets"]).toBe(true);
    });

    it("applies Large public preset with STRICT strictness", () => {
      const service = new SetupService(baseDeps());
      const state = fullState();
      const next = service.applyPreset(state, "Large public");
      expect(next.strictness).toBe("STRICT");
      expect(next.modules["antiraid"]).toBe(true);
      expect(next.modules["verification"]).toBe(true);
    });

    it("does not mutate the input state", () => {
      const service = new SetupService(baseDeps());
      const state = fullState();
      service.applyPreset(state, "Gaming");
      expect(state.preset).toBeUndefined();
      expect(state.strictness).toBeUndefined();
    });
  });

  describe("nextStep", () => {
    it("advances to the next step", () => {
      const service = new SetupService(baseDeps());
      const state = fullState({ step: 1 });
      expect(service.nextStep(state).step).toBe(2);
    });

    it("caps at step 8", () => {
      const service = new SetupService(baseDeps());
      const state = fullState({ step: 8 });
      expect(service.nextStep(state).step).toBe(8);
    });
  });

  describe("prevStep", () => {
    it("goes to the previous step", () => {
      const service = new SetupService(baseDeps());
      const state = fullState({ step: 4 });
      expect(service.prevStep(state).step).toBe(3);
    });

    it("floors at step 1", () => {
      const service = new SetupService(baseDeps());
      const state = fullState({ step: 1 });
      expect(service.prevStep(state).step).toBe(1);
    });
  });

  describe("resolveSizeTier", () => {
    it("maps member count to tiers", () => {
      const service = new SetupService(baseDeps());
      expect(service.resolveSizeTier(10)).toBe("TINY");
      expect(service.resolveSizeTier(50)).toBe("SMALL");
      expect(service.resolveSizeTier(499)).toBe("SMALL");
      expect(service.resolveSizeTier(500)).toBe("MEDIUM");
      expect(service.resolveSizeTier(4999)).toBe("MEDIUM");
      expect(service.resolveSizeTier(5000)).toBe("LARGE");
      expect(service.resolveSizeTier(49999)).toBe("LARGE");
      expect(service.resolveSizeTier(50000)).toBe("MASSIVE");
    });
  });

  describe("getPreviewLines", () => {
    it("returns describeProfile lines", () => {
      const service = new SetupService(baseDeps());
      const lines = service.getPreviewLines("SMALL", "BALANCED", "en");
      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
    });

    it("defaults locale to en when undefined", () => {
      const service = new SetupService(baseDeps());
      const lines = service.getPreviewLines("SMALL", "BALANCED", undefined);
      expect(Array.isArray(lines)).toBe(true);
    });
  });

  describe("computeFinalConfig", () => {
    it("computes final config from state", () => {
      const service = new SetupService(baseDeps());
      const state = fullState({
        step: 8,
        locale: "es",
        sizeTier: "LARGE",
        strictness: "STRICT",
        staffRoles: { admin: ["r1"], moderator: [], helper: [] },
        channels: { modLogChannelId: "ch1", welcomeChannelId: "ch2" },
        modules: { automod: true, antiraid: false },
      });
      const config = service.computeFinalConfig(state);
      expect(config.locale).toBe("es");
      expect(config.sizeTier).toBe("LARGE");
      expect(config.sizeTierLocked).toBe(true);
      expect(config.strictness).toBe("STRICT");
      expect(config.staffRoles).toEqual({ admin: ["r1"], moderator: [], helper: [] });
      expect(config.modLogChannelId).toBe("ch1");
      expect(config.logChannels).toEqual({ modLog: "ch1" });
      expect(config.modules).toEqual({ automod: true, antiraid: false });
    });

    it("applies defaults when state fields are missing", () => {
      const service = new SetupService(baseDeps());
      const state = fullState({ step: 1 });
      const config = service.computeFinalConfig(state);
      expect(config.locale).toBe("en");
      expect(config.sizeTier).toBe("SMALL");
      expect(config.strictness).toBe("BALANCED");
      expect(config.modLogChannelId).toBeUndefined();
      expect(config.logChannels).toEqual({});
    });
  });

  describe("updateState / getOrCreateState", () => {
    it("creates initial state when none exists", async () => {
      const deps = baseDeps();
      deps.getSetupState.mockResolvedValue(null);
      deps.setSetupState.mockResolvedValue(undefined);
      const service = new SetupService(deps);

      const result = await service.getOrCreateState("g1", "u1");
      expect(deps.setSetupState).toHaveBeenCalledTimes(1);
      expect(deps.setSetupState.mock.calls[0][0]).toBe("g1");
      expect(deps.setSetupState.mock.calls[0][1]).toBe("u1");
      expect(deps.setSetupState.mock.calls[0][2]).toMatchObject({ step: 1 });
      expect(result.step).toBe(1);
      expect(result.step).toBe(1);
    });

    it("returns existing state when present", async () => {
      const deps = baseDeps();
      const existing: SetupState = fullState({ step: 3, locale: "de" });
      deps.getSetupState.mockResolvedValue(existing);
      const service = new SetupService(deps);

      const result = await service.getOrCreateState("g1", "u1");
      expect(result).toBe(existing);
      expect(deps.setSetupState).not.toHaveBeenCalled();
    });

    it("updates and persists state", async () => {
      const deps = baseDeps();
      deps.getSetupState.mockResolvedValue(fullState({ step: 1 }));
      const service = new SetupService(deps);

      const result = await service.updateState("g1", "u1", { sizeTier: "MEDIUM" });
      expect(result.sizeTier).toBe("MEDIUM");
      expect(deps.setSetupState).toHaveBeenCalledTimes(1);
      expect(deps.setSetupState.mock.calls[0][0]).toBe("g1");
      expect(deps.setSetupState.mock.calls[0][1]).toBe("u1");
      expect(deps.setSetupState.mock.calls[0][2]).toMatchObject({ sizeTier: "MEDIUM" });
    });
  });
});
