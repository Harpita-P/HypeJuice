import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import * as cheerio from "cheerio";

import type { BriefRequest, SourceSummary } from "../shared/app-brief.js";

const MAX_HTML_BYTES = 1_500_000;
const MAX_SOURCE_CHARS = 18_000;

export type ExtractedSource = SourceSummary & { text: string };

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function normalizePublicUrl(value: string) {
  const url = new URL(withProtocol(value.trim()));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only http and https links are supported.");
  if (url.username || url.password) throw new Error("Links with embedded credentials are not supported.");
  return url;
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "0.0.0.0" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const mapped = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
  if (!isIP(mapped) || mapped.includes(":")) return false;
  const [a, b] = mapped.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

async function assertPublicHost(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local network links are not supported.");
  }
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("That link resolves to a private network address.");
  }
}

async function fetchPublicHtml(initialUrl: URL) {
  let current = initialUrl;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertPublicHost(current);
    const response = await fetch(current, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "HypeJuiceBot/0.1 (+product-context-reader)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Website redirected without a destination.");
      current = new URL(location, current);
      if (!['http:', 'https:'].includes(current.protocol)) throw new Error("Unsupported redirect protocol.");
      continue;
    }

    if (!response.ok) throw new Error(`Website returned ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("Website did not return an HTML page.");
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_HTML_BYTES) throw new Error("Website page is too large to analyze.");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_HTML_BYTES) throw new Error("Website page is too large to analyze.");
    return { html: new TextDecoder().decode(bytes), finalUrl: current.toString() };
  }
  throw new Error("Website redirected too many times.");
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function extractWebsiteSource(rawUrl: string): Promise<ExtractedSource> {
  const url = normalizePublicUrl(rawUrl);
  const { html, finalUrl } = await fetchPublicHtml(url);
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, footer").remove();
  const title = compact($("meta[property='og:title']").attr("content") || $("title").text() || url.hostname);
  const description = compact(
    $("meta[name='description']").attr("content") || $("meta[property='og:description']").attr("content") || "",
  );
  const headings = $("h1, h2, h3")
    .map((_, element) => compact($(element).text()))
    .get()
    .filter(Boolean)
    .slice(0, 30);
  const body = compact($("main, article, body").first().text()).slice(0, MAX_SOURCE_CHARS);
  const text = [`Title: ${title}`, description && `Description: ${description}`, headings.length && `Headings: ${headings.join(" | ")}`, `Page copy: ${body}`]
    .filter(Boolean)
    .join("\n");
  return { kind: "website", url: finalUrl, title, text };
}

function getAppleId(rawUrl: string) {
  const match = rawUrl.match(/\/id(\d+)/i) ?? rawUrl.match(/[?&]id=(\d+)/i);
  return match?.[1] ?? null;
}

// Media comes from Apple's response, never model-generated URLs. Retain only
// HTTPS Apple CDN assets, excluding malformed entries and duplicate screenshots.
export function extractAppStoreMedia(app: Record<string, unknown>): NonNullable<SourceSummary["appStoreMedia"]> {
  function assetUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password &&
        (url.hostname === "mzstatic.com" || url.hostname.endsWith(".mzstatic.com"))
        ? url.toString() : null;
    } catch {
      return null;
    }
  }
  function screenshots(value: unknown): string[] {
    return Array.isArray(value) ? value.flatMap((item) => {
      const url = assetUrl(item);
      return url ? [url] : [];
    }) : [];
  }
  const phoneScreenshots = screenshots(app.screenshotUrls);
  return {
    iconUrl: assetUrl(app.artworkUrl512) ?? assetUrl(app.artworkUrl100) ?? assetUrl(app.artworkUrl60),
    screenshotUrls: [...new Set(phoneScreenshots.length ? phoneScreenshots : screenshots(app.ipadScreenshotUrls))].slice(0, 10),
  };
}

export async function extractAppStoreSource(rawUrl: string): Promise<ExtractedSource> {
  const submitted = normalizePublicUrl(rawUrl);
  if (submitted.hostname !== "apple.com" && !submitted.hostname.endsWith(".apple.com")) {
    throw new Error("Use a valid Apple App Store link.");
  }
  const appId = getAppleId(submitted.toString());
  if (!appId) throw new Error("Could not find an App Store ID in that link.");

  const lookupUrl = new URL(`https://itunes.apple.com/lookup?id=${appId}`);
  const country = submitted.pathname.split("/")[1];
  if (/^[a-z]{2}$/i.test(country)) lookupUrl.searchParams.set("country", country.toLowerCase());
  const response = await fetch(lookupUrl, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("Apple metadata lookup failed.");
  const payload = (await response.json()) as { resultCount: number; results: Array<Record<string, unknown>> };
  const app = payload.results[0];
  if (!app) throw new Error("Apple did not return an app for that link.");

  const name = String(app.trackName ?? "App Store app");
  const text = [
    `Name: ${name}`,
    `Developer: ${String(app.sellerName ?? "")}`,
    `Category: ${String(app.primaryGenreName ?? "")}`,
    `Genres: ${Array.isArray(app.genres) ? app.genres.join(", ") : ""}`,
    `Description: ${String(app.description ?? "")}`,
    `Latest release notes: ${String(app.releaseNotes ?? "")}`,
    `Version: ${String(app.version ?? "")}`,
    `Content rating: ${String(app.trackContentRating ?? "")}`,
  ].join("\n");
  return {
    kind: "app_store", url: submitted.toString(), title: name,
    text: text.slice(0, MAX_SOURCE_CHARS), appStoreMedia: extractAppStoreMedia(app),
  };
}

export async function extractSources(input: BriefRequest) {
  const jobs: Array<Promise<ExtractedSource>> = [];
  if (input.appStoreUrl) jobs.push(extractAppStoreSource(input.appStoreUrl));
  if (input.websiteUrl) jobs.push(extractWebsiteSource(input.websiteUrl));
  if (input.founderNote) {
    jobs.push(
      Promise.resolve({
        kind: "founder_note" as const,
        url: null,
        title: "Founder context",
        text: input.founderNote,
      }),
    );
  }

  const settled = await Promise.allSettled(jobs);
  const sources = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const warnings = settled.flatMap((result) =>
    result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : "A source could not be read."]
      : [],
  );
  if (!sources.length) throw new Error(warnings[0] ?? "No readable context was provided.");
  return { sources, warnings };
}
