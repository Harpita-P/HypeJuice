import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSourceDraft, generateBrief } from "./brief-generator.js";

const { createInteraction } = vi.hoisted(() => ({ createInteraction: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    interactions = { create: createInteraction };
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  createInteraction.mockReset();
});

describe("buildSourceDraft", () => {
  it("turns App Store metadata into a valid starter brief", () => {
    const brief = buildSourceDraft([
      {
        kind: "app_store",
        url: "https://apps.apple.com/us/app/focus-fox/id123456789",
        title: "Focus Fox",
        text: "Name: Focus Fox\nCategory: Productivity\nDescription: Plan one meaningful task and finish it without distractions.",
      },
    ]);

    expect(brief.appName).toBe("Focus Fox");
    expect(brief.category).toBe("Productivity");
    expect(brief.oneLiner).toContain("Plan one meaningful task");
    expect(brief.messagingAngles).toHaveLength(2);
    expect(brief.audiences.length).toBeGreaterThanOrEqual(5);
  });

  it("infers a product name from a plain founder note", () => {
    const brief = buildSourceDraft([
      {
        kind: "founder_note",
        url: null,
        title: "Founder context",
        text: "Focus Fox is a productivity app for solo founders who feel overwhelmed.",
      },
    ]);

    expect(brief.appName).toBe("Focus Fox");
  });
});

describe("Gemini brief generation", () => {
  const sources = [{ kind: "founder_note" as const, url: null, title: "Founder context", text: "Focus Fox is a focus timer for founders." }];

  it.each(["", "your_gemini_api_key_here"])("uses an honest source draft when the key is %j", async (key) => {
    vi.stubEnv("GEMINI_API_KEY", key);
    const result = await generateBrief(sources);
    expect(result.mode).toBe("source_draft");
    expect(createInteraction).not.toHaveBeenCalled();
  });

  it("requests structured JSON and validates the brief returned by Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "configured-model");
    const brief = buildSourceDraft(sources);
    createInteraction.mockResolvedValue({ status: "completed", output_text: JSON.stringify(brief) });
    await expect(generateBrief(sources)).resolves.toEqual({ brief, mode: "ai" });
    expect(createInteraction).toHaveBeenCalledWith(expect.objectContaining({
      model: "configured-model",
      store: false,
      input: expect.stringContaining(sources[0].text),
      response_format: expect.objectContaining({ mime_type: "application/json", schema: expect.objectContaining({ type: "object" }) }),
    }));
  });

  it.each(["not json", JSON.stringify({ appName: "Incomplete" })])("rejects invalid generated content: %s", async (output_text) => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    createInteraction.mockResolvedValue({ status: "completed", output_text });
    await expect(generateBrief(sources)).rejects.toThrow("invalid brief");
  });

  it("does not accept an incomplete response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    createInteraction.mockResolvedValue({ status: "failed" });
    await expect(generateBrief(sources)).rejects.toThrow("complete brief");
  });

  it("rejects a new AI brief with fewer than five audience hypotheses", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const brief = buildSourceDraft(sources);
    createInteraction.mockResolvedValue({ status: "completed", output_text: JSON.stringify({ ...brief, audiences: brief.audiences.slice(0, 4) }) });
    await expect(generateBrief(sources)).rejects.toThrow("invalid brief");
  });

  it("does not expose raw provider errors to the phone", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    createInteraction.mockRejectedValue(new Error("Request header contained test-key"));
    await expect(generateBrief(sources)).rejects.toThrow("The growth agent couldn't generate your brief right now. Please try again.");
  });
});
