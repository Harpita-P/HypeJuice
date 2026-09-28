import { File, Paths } from "expo-file-system";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { getStudioJob, studioRequestId } from "./studio-api";

export type PreparedVideoShare = { share: () => Promise<void>; dispose: () => void };

async function downloadVideo(jobId: string) {
  const file = new File(Paths.cache, `hypejuice-${studioRequestId()}.mp4`);
  const dispose = () => { try { if (file.exists) file.delete(); } catch { /* Cache cleanup is best effort. */ } };
  try {
    // Refresh the private playback URL; Library items may have an expired one.
    const job = await getStudioJob(jobId);
    if (job.status !== "succeeded" || !job.videoUrl) throw new Error("Video not ready");
    await File.downloadFileAsync(job.videoUrl, file);
    return { file, dispose };
  } catch {
    dispose();
    throw new Error("Couldn’t download the video. Check your connection and that the API server is running, then try again.");
  }
}

export async function saveVideo(jobId: string): Promise<string> {
  const permission = await requestPermissionsAsync(true, ["video"]);
  if (!permission.granted) {
    throw new Error("Allow photo-library access in Settings to save the video, or use Share instead.");
  }
  const { file, dispose } = await downloadVideo(jobId);
  try {
    await Asset.create(file.uri);
    return "Saved to your photo library.";
  } catch {
    throw new Error("Couldn’t save the video to your photo library. Check your available storage or try Share.");
  } finally { dispose(); }
}

export async function prepareVideoShare(jobId: string): Promise<PreparedVideoShare> {
  if (!await Sharing.isAvailableAsync()) throw new Error("Sharing isn’t available on this device. Use Download instead.");
  const { file, dispose } = await downloadVideo(jobId);
  return {
    dispose,
    share: () => Sharing.shareAsync(file.uri, {
      mimeType: "video/mp4", UTI: "public.mpeg-4", dialogTitle: "Share your HypeJuice video",
    }),
  };
}
