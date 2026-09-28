import { CREATOR_GENERATION_SECONDS, type StudioVideoInput } from "../shared/studio.js";

export function creatorRequest(prompt: string) {
  return { prompt: `${prompt}\nA fictional adult creator, vertical smartphone selfie footage, one continuous candid shot, natural light. No speaking, text, captions, logos, graphics or cuts.`,
    duration: CREATOR_GENERATION_SECONDS, resolution: "720p", aspect_ratio: "9:16", generate_audio: false };
}

export function renderScript(input: StudioVideoInput, creatorUrl: string, demoUrl: string) {
  const hookSeconds = input.hookSeconds ?? 5;
  const caption = (text: string, time: number, duration: number, y: string) => ({
    type: "text", track: 2, time, duration, text,
    x: "50%", y, width: "84%", height: "22%", x_alignment: "50%", y_alignment: "50%",
    font_family: "Arial", font_weight: "700", font_size: "4.5 vmin", font_size_minimum: "3.5 vmin",
    fill_color: "#ffffff", stroke_color: "#000000", stroke_width: "0.7 vmin",
    line_height: "115%", text_wrap: true, animations: [],
  });
  return { output_format: "mp4", width: 720, height: 1280, frame_rate: 30, duration: hookSeconds + input.demoSeconds,
    elements: [
      { type: "video", track: 1, time: 0, duration: hookSeconds, trim_start: 0, trim_duration: hookSeconds, source: creatorUrl, fit: "cover", volume: "0%" },
      { type: "video", track: 1, time: hookSeconds, duration: input.demoSeconds, trim_start: 0, trim_duration: input.demoSeconds, source: demoUrl, fit: "contain", volume: "0%" },
      caption(input.hook, 0, hookSeconds, "50%"),
      caption(input.demoCaption, hookSeconds, input.demoSeconds, { top: "18%", middle: "50%", bottom: "78%" }[input.demoTextPosition]),
    ],
  };
}
