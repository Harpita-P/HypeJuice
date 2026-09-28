import { getStudioJob } from "./studio-api";

export type PreparedVideoShare = { share: () => Promise<void>; dispose: () => void };

async function downloadVideo(jobId: string) {
  try {
    const job = await getStudioJob(jobId);
    if (job.status !== "succeeded" || !job.videoUrl) throw new Error("Video not ready");
    const response = await fetch(job.videoUrl);
    if (!response.ok) throw new Error("Download failed");
    return new File([await response.blob()], "growthbanana-video.mp4", { type: "video/mp4" });
  } catch {
    throw new Error("Couldn’t download the video. Check your connection and that the API server is running, then try again.");
  }
}

export async function saveVideo(jobId: string): Promise<string> {
  const file = await downloadVideo(jobId);
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url; link.download = file.name;
  document.body.appendChild(link);
  link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "Download started.";
}

export async function prepareVideoShare(jobId: string): Promise<PreparedVideoShare> {
  if (!navigator.share || !navigator.canShare) throw new Error("This browser doesn’t support video sharing. Use Download instead.");
  const file = await downloadVideo(jobId);
  if (!navigator.canShare({ files: [file] })) throw new Error("This browser doesn’t support video sharing. Use Download instead.");
  // The UI requests a second tap so sharing retains the required user gesture.
  return { share: () => navigator.share({ files: [file] }), dispose: () => {} };
}
