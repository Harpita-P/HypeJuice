import { mkdir, readFile, readdir, rename, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { adminDb, authenticatedMode, ownerId } from "./identity.js";

// Private server documents: every database access includes the verified owner, never a body-supplied ID.
export const recordDirectory = () => resolve(process.env.STUDIO_DATA_DIR || ".studio-data");
const safeKey = (key: string) => { if (!/^[a-zA-Z0-9_.-]+\.json$/.test(key)) throw new Error("Invalid record key."); return key; };
export async function readRecord<T>(key: string): Promise<T | null> {
  safeKey(key);
  if (authenticatedMode()) {
    const { data, error } = await adminDb().from("gb_records").select("data").eq("owner_id", ownerId()).eq("key", key).maybeSingle();
    if (error) throw new Error("Could not read your saved data."); return data?.data as T ?? null;
  }
  try { return JSON.parse(await readFile(join(recordDirectory(), key), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function saveRecord<T>(key: string, value: T, exclusive = false): Promise<T> {
  safeKey(key);
  if (authenticatedMode()) {
    const row = { owner_id: ownerId(), key, data: value, updated_at: new Date().toISOString() };
    const result = exclusive ? await adminDb().from("gb_records").insert(row) : await adminDb().from("gb_records").upsert(row, { onConflict: "owner_id,key" });
    if (exclusive && result.error?.code === "23505") return (await readRecord<T>(key))!;
    if (result.error) throw new Error("Could not save your data."); return value;
  }
  await mkdir(recordDirectory(), { recursive: true });
  const path = join(recordDirectory(), key);
  if (exclusive) {
    try { await writeFile(path, JSON.stringify(value), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return (await readRecord<T>(key))!; throw error; }
  } else {
    const temp = `${path}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await rename(temp, path);
  }
  return value;
}
export async function listRecords<T>(matches: (key: string) => boolean): Promise<T[]> {
  if (authenticatedMode()) {
    const values: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await adminDb().from("gb_records").select("key,data").eq("owner_id", ownerId()).order("key").range(offset, offset + 499);
      if (error) throw new Error("Could not list your saved data.");
      values.push(...data.filter((row) => matches(row.key)).map((row) => row.data as T));
      if (data.length < 500) return values;
    }
  }
  await mkdir(recordDirectory(), { recursive: true });
  const files = (await readdir(recordDirectory())).filter(matches);
  return (await Promise.all(files.map((key) => readRecord<T>(key)))).filter((row): row is NonNullable<T> => row !== null);
}
export async function deleteRecord(key: string) {
  safeKey(key);
  if (authenticatedMode()) {
    const { error } = await adminDb().from("gb_records").delete().eq("owner_id", ownerId()).eq("key", key);
    if (error) throw new Error("Could not delete your saved data.");
  } else { try { await unlink(join(recordDirectory(), key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
}
