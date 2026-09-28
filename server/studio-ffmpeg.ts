import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import type { StudioVideoInput } from "../shared/studio.js";

export const OUTPUT_WIDTH = 720;
export const OUTPUT_HEIGHT = 1280;
let fontLoaded = false;

// Measured word wrapping, including long unbroken strings. Captions remain data:
// they are never interpolated into a shell command or FFmpeg filter expression.
export function wrapCaption(text: string, measure: (value: string) => number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && measure(`${line} ${word}`) <= maxWidth) { line += ` ${word}`; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)) {
        if (line && measure(line + segment) > maxWidth) { lines.push(line); line = ""; }
        line += segment;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function captionImage(text: string, position: "top" | "middle" | "bottom") {
  if (!fontLoaded) {
    const font = resolve("node_modules/@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf");
    if (!GlobalFonts.registerFromPath(font, "HypeJuiceCaption")) throw new Error("Caption font is missing. Run npm install on the server.");
    fontLoaded = true;
  }
  const canvas = createCanvas(OUTPUT_WIDTH, OUTPUT_HEIGHT);
  const ctx = canvas.getContext("2d");
  let fontSize = 32;
  let lines: string[] = [];
  for (; fontSize >= 18; fontSize--) {
    ctx.font = `${fontSize}px HypeJuiceCaption`;
    lines = wrapCaption(text, (value) => ctx.measureText(value).width, OUTPUT_WIDTH * 0.84);
    if (lines.length * fontSize * 1.2 <= OUTPUT_HEIGHT * 0.22) break;
  }
  if (fontSize < 18) throw new Error("Caption has too many lines. Shorten it before rendering.");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  const center = OUTPUT_HEIGHT * { top: 0.18, middle: 0.5, bottom: 0.78 }[position];
  const first = center - (lines.length - 1) * fontSize * 1.2 / 2;
  lines.forEach((line, index) => {
    const y = first + index * fontSize * 1.2;
    ctx.strokeText(line, OUTPUT_WIDTH / 2, y);
    ctx.fillText(line, OUTPUT_WIDTH / 2, y);
  });
  return canvas.encode("png");
}

export function runVideoTool(command: string, args: string[], cwd: string) {
  return new Promise<string>((resolveResult, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    // Don't expose process arguments or stderr, which may include local paths.
    child.stdout.on("data", (data) => { if (stdout.length < 1024 * 1024) stdout += data.toString(); });
    child.stderr.resume();
    const timeout = setTimeout(() => child.kill("SIGKILL"), 180000);
    child.once("error", () => { clearTimeout(timeout); reject(new Error("FFmpeg/ffprobe could not start. Install FFmpeg on the API server.")); });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveResult(stdout);
      else reject(new Error("Local video rendering failed or timed out. Check that the clips are playable and FFmpeg supports libx264 and overlay."));
    });
  });
}

export async function probeVideo(path: string, cwd: string) {
  return JSON.parse(await runVideoTool(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], cwd)) as {
    streams: { codec_type: string; width?: number; height?: number; duration?: string }[];
    format: { duration?: string };
  };
}

// Files in cwd: creator.mp4, demo.mp4. Uses local files only, never remote URLs.
export async function renderWithFFmpeg(input: StudioVideoInput, cwd: string) {
  let duration = input.demoSeconds;
  const hookSeconds = input.hookSeconds ?? 5; // Existing queued jobs retain their original timing.
  if (!Number.isFinite(duration) || duration < 1 || duration > 10) throw new Error("Demo duration must be between 1 and 10 seconds.");
  const [creator, demo] = await Promise.all([probeVideo("creator.mp4", cwd), probeVideo("demo.mp4", cwd)]);
  if (![creator, demo].every((media) => media.streams.some((stream) => stream.codec_type === "video"))) throw new Error("Both clips must contain a video stream.");
  const demoDuration = Number(demo.streams.find((stream) => stream.codec_type === "video")?.duration || demo.format.duration);
  if (input.clampDemoDuration && Number.isFinite(demoDuration)) duration = Math.min(duration, demoDuration);
  if (duration < 1) throw new Error("Demo clips must contain at least one second of video.");
  const creatorDuration = Number(creator.streams.find((stream) => stream.codec_type === "video")?.duration || creator.format.duration);
  if (!Number.isFinite(creatorDuration) || creatorDuration + 0.1 < hookSeconds) throw new Error("The saved creator clip is too short for this hook.");
  if (!Number.isFinite(demoDuration) || demoDuration + 0.1 < duration) throw new Error("The demo clip is shorter than the selected duration.");
  await Promise.all([
    captionImage(input.hook, "middle").then((bytes) => writeFile(join(cwd, "hook.png"), bytes)),
    captionImage(input.demoCaption, input.demoTextPosition).then((bytes) => writeFile(join(cwd, "demo.png"), bytes)),
  ]);
  const graph = [
    `[0:v:0]trim=duration=${hookSeconds},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=${hookSeconds},format=yuv420p[hook]`,
    `[1:v:0]trim=duration=${duration},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=${duration},format=yuv420p[demo]`,
    "[hook][2:v]overlay=0:0:shortest=1[h]",
    "[demo][3:v]overlay=0:0:shortest=1[d]",
    "[h][d]concat=n=2:v=1:a=0,format=yuv420p[out]",
  ].join(";");
  await runVideoTool(process.env.FFMPEG_PATH || "ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
    "-protocol_whitelist", "file,pipe", "-i", "creator.mp4",
    "-protocol_whitelist", "file,pipe", "-i", "demo.mp4",
    "-loop", "1", "-framerate", "30", "-i", "hook.png",
    "-loop", "1", "-framerate", "30", "-i", "demo.png",
    "-filter_complex", graph, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "fast",
    "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-t", String(hookSeconds + duration), "output.mp4",
  ], cwd);
  const result = await probeVideo("output.mp4", cwd);
  const video = result.streams.find((stream) => stream.codec_type === "video");
  if (video?.width !== OUTPUT_WIDTH || video.height !== OUTPUT_HEIGHT || result.streams.some((stream) => stream.codec_type === "audio") || Math.abs(Number(result.format.duration) - (hookSeconds + duration)) > 0.15) {
    throw new Error("Rendered video did not pass the resolution, duration, and silent-audio checks.");
  }
  return join(cwd, "output.mp4");
}
