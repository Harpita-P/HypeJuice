import { afterEach, describe, expect, it, vi } from "vitest";
import { studioProviders } from "./studio-providers.js";
import { ProviderHttpError, submissionFailure } from "./studio-errors.js";
import { StudioVideoInputSchema } from "../shared/studio.js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => ({
    createSignedUrl: async () => ({ data: { signedUrl: "https://media.test/clip.mp4" } }),
  }) } }),
}));
const input = StudioVideoInputSchema.parse({
  id: "4b7f07bc-d797-4c43-bc25-d721afcae600", uploadId: "4b7f07bc-d797-4c43-bc25-d721afcae601",
  appName: "Test", profileKey: "test", clipId: "clip", prompt: "An adult creator reacts",
  hook: "Hook", demoCaption: "Demo", demoSeconds: 5, approved: true,
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Creatomate submission contract (no live requests)", () => {
  it.each([
    { response: { id: "render-id", status: "planned" } },
    { response: [{ id: "render-id", status: "planned" }] },
  ])("keeps a returned render ID: $response", async ({ response }) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(response));
    vi.stubGlobal("fetch", fetchMock);
    expect(await studioProviders.startRender(input, "creator.mp4", "demo.mp4")).toBe("render-id");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.creatomate.com/v2/renders");
  });
  it("retains HTTP status without leaking response data or retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "private-provider-details" }, { status: 402 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(studioProviders.startRender(input, "creator.mp4", "demo.mp4")).rejects.toMatchObject({ statusCode: 402 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(submissionFailure(new ProviderHttpError(402), "Creatomate")).toContain("Creatomate: Payment required (HTTP 402)");
    expect(submissionFailure(new Error("Authorization: secret"), "Higgsfield")).not.toContain("secret");
  });
  it("stops on a response without an ID instead of submitting again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "planned" }));
    vi.stubGlobal("fetch", fetchMock);
    try { await studioProviders.startRender(input, "creator.mp4", "demo.mp4"); throw new Error("Expected missing ID failure"); }
    catch (reason) { expect(submissionFailure(reason, "Creatomate")).toContain("no usable render ID"); }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
