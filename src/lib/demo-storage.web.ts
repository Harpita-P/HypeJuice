import type { ImagePickerAsset } from "expo-image-picker";
import type { DemoClip } from "@shared/app-brief";
import { MAX_DEMO_BYTES } from "@shared/creative-profile";

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("growthbanana-demo-clips", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("clips");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Browser storage is unavailable. Try importing on your phone."));
  });
}

export async function storeDemoClip(asset: ImagePickerAsset): Promise<DemoClip> {
  const blob = asset.file ?? await (await fetch(asset.uri)).blob();
  if (!blob.size || blob.size > MAX_DEMO_BYTES) throw new Error("Choose a recording under 250 MB. Short clips work best.");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("clips", "readwrite");
      transaction.objectStore("clips").put(blob, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error("Couldn’t save the recording. Your browser may be out of storage."));
    });
  } finally { db.close(); }
  return { id, localPath: id, storage: "browser", name: asset.fileName ?? "Demo recording", durationMs: asset.duration ?? null, width: asset.width, height: asset.height, sizeBytes: blob.size, shows: "", importedAt: new Date().toISOString() };
}

export async function getDemoClipUri(clip: DemoClip): Promise<string> {
  if (clip.storage !== "browser") throw new Error("Import this recording again in this browser.");
  const db = await database();
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction("clips").objectStore("clips").get(clip.id);
      request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("Recording missing. Please import it again."));
      request.onerror = () => reject(new Error("Couldn’t read this recording."));
    });
    return URL.createObjectURL(blob);
  } finally { db.close(); }
}

export function releaseDemoClipUri(uri: string) { URL.revokeObjectURL(uri); }
