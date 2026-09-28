import { Directory, File, Paths } from "expo-file-system";
import type { ImagePickerAsset } from "expo-image-picker";
import type { DemoClip } from "@shared/app-brief";
import { MAX_DEMO_BYTES } from "@shared/creative-profile";

export async function storeDemoClip(asset: ImagePickerAsset): Promise<DemoClip> {
  const source = new File(asset.uri);
  const sizeBytes = asset.fileSize ?? source.size;
  if (!sizeBytes || sizeBytes > MAX_DEMO_BYTES) throw new Error("Choose a recording under 250 MB. Short clips work best.");
  if (Paths.availableDiskSpace < sizeBytes * 1.1) throw new Error("Your device needs more free space to keep this recording.");
  const directory = new Directory(Paths.document, "demo-clips");
  directory.create({ idempotent: true, intermediates: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const extension = (asset.fileName ?? asset.uri).match(/\.(mp4|mov|m4v|webm)(?:\?|$)/i)?.[1]?.toLowerCase() ?? "mov";
  const localPath = `demo-clips/${id}.${extension}`;
  const destination = new File(Paths.document, localPath);
  source.copy(destination);
  return { id, localPath, storage: "device", name: asset.fileName ?? `Demo recording.${extension}`, durationMs: asset.duration ?? null, width: asset.width, height: asset.height, sizeBytes, shows: "", importedAt: new Date().toISOString() };
}

export async function getDemoClipUri(clip: DemoClip): Promise<string> {
  if (clip.storage !== "device" || !/^demo-clips\/[\w-]+\.(mp4|mov|m4v|webm)$/.test(clip.localPath)) throw new Error("Import this recording again on this device.");
  const file = new File(Paths.document, clip.localPath);
  if (!file.exists) throw new Error("This recording is no longer on this device. Please import it again.");
  return file.uri;
}

export function releaseDemoClipUri(_uri: string) {}
