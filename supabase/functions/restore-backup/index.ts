import { createClient } from "@supabase/supabase-js";
import { ZipReader, BlobReader, TextWriter, BlobWriter } from "@zip.js/zip.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BACKUP_BUCKET = "system-backups";

type RestoreTableResult = {
  table: string;
  rows: number;
  insertedOrUpdated: number;
};

type RestoreStorageResult = {
  bucket: string;
  files: number;
  restored: number;
  failed: number;
};

type BackupManifestV1 = {
  format: string;
  formatVersion: string;
  tables: { name: string; rows: number; file: string }[];
  restore: { strategy: string; order: string[] };
};

type BackupManifestV2 = BackupManifestV1 & {
  storage?: { bucket: string; files: number }[];
  storageFiles?: { bucket: string; path: string; size: number; contentType: string | null }[];
  sourceCode?: { available: boolean };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function restoreBackup(
  backupId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{
  success: boolean;
  tables?: RestoreTableResult[];
  storage?: RestoreStorageResult[];
  totalRows?: number;
  error?: string;
}> {
  const { data: backup, error: backupError } = await supabaseAdmin
    .from("system_backups")
    .select("*")
    .eq("id", backupId)
    .maybeSingle();

  if (backupError || !backup) {
    return {
      success: false,
      error: `Backup tidak ditemukan: ${backupError?.message ?? "ID tidak ada"}`,
    };
  }

  if (!backup.storage_path && !backup.backup_path) {
    return { success: false, error: "Backup tidak memiliki path Storage." };
  }

  const storagePath = backup.storage_path ?? backup.backup_path;

  await supabaseAdmin
    .from("system_backups")
    .update({ status: "restoring" })
    .eq("id", backupId);

  const { data: zipData, error: downloadError } = await supabaseAdmin.storage
    .from(BACKUP_BUCKET)
    .download(storagePath);

  if (downloadError || !zipData) {
    await supabaseAdmin
      .from("system_backups")
      .update({ status: "failed", notes: `Download gagal: ${downloadError?.message ?? "no data"}` })
      .eq("id", backupId);
    return {
      success: false,
      error: `Gagal mengunduh backup: ${downloadError?.message ?? "file tidak ditemukan"}`,
    };
  }

  const zipBlob = new Blob([zipData]);

  try {
    const zipReader = new ZipReader(new BlobReader(zipBlob));
    const entries = await zipReader.getEntries();

    const manifestEntry = entries.find((e) => e.filename === "manifest.json");
    if (!manifestEntry) {
      throw new Error("manifest.json tidak ditemukan di backup ZIP.");
    }

    const manifestText = await manifestEntry.getData(new TextWriter());
    const manifest: BackupManifestV2 = JSON.parse(manifestText);

    if (manifest.format !== "vixel-backup") {
      throw new Error(`Format backup tidak dikenali: ${manifest.format}`);
    }

    const formatVersion = manifest.formatVersion ?? "1.0";
    const restoreOrder = manifest.restore?.order ?? [];

    if (restoreOrder.length === 0) {
      throw new Error("Restore order kosong di manifest.");
    }

    // ============================================================
    // DATABASE RESTORE (v1.0 and v2.0)
    // ============================================================
    const dbResults: RestoreTableResult[] = [];

    for (const tableName of restoreOrder) {
      const tableInfo = manifest.tables?.find((t) => t.name === tableName);
      // Support both old path (tables/) and new path (database/)
      const file = tableInfo?.file ?? `database/${tableName}.json`;
      const oldFile = `tables/${tableName}.json`;

      let entry = entries.find((e) => e.filename === file);
      if (!entry) entry = entries.find((e) => e.filename === oldFile);

      if (!entry) {
        console.warn(`File ${file} tidak ditemukan di ZIP, skip ${tableName}`);
        dbResults.push({ table: tableName, rows: 0, insertedOrUpdated: 0 });
        continue;
      }

      const jsonText = await entry.getData(new TextWriter());
      const rows: Record<string, unknown>[] = JSON.parse(jsonText);

      if (rows.length === 0) {
        dbResults.push({ table: tableName, rows: 0, insertedOrUpdated: 0 });
        continue;
      }

      const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from(tableName)
        .upsert(rows, { onConflict: "id" })
        .select("id");

      if (upsertError) {
        throw new Error(`Gagal restore tabel ${tableName}: ${upsertError.message}`);
      }

      dbResults.push({
        table: tableName,
        rows: rows.length,
        insertedOrUpdated: upsertData?.length ?? 0,
      });
    }

    // ============================================================
    // STORAGE RESTORE (v2.0 only)
    // ============================================================
    let storageResults: RestoreStorageResult[] = [];
    let storageErrors = false;

    if (formatVersion === "2.0" && manifest.storage && manifest.storage.length > 0) {
      for (const bucketInfo of manifest.storage) {
        const bucket = bucketInfo.bucket;
        const result: RestoreStorageResult = { bucket, files: 0, restored: 0, failed: 0 };

        // Get all files for this bucket from manifest
        const filesForBucket = manifest.storageFiles?.filter((f) => f.bucket === bucket) ?? [];

        result.files = filesForBucket.length;

        for (const fileInfo of filesForBucket) {
          const zipEntryPath = `storage/${bucket}/${fileInfo.path}`;
          const entry = entries.find((e) => e.filename === zipEntryPath);

          if (!entry) {
            console.warn(`File ${zipEntryPath} tidak ditemukan di ZIP`);
            result.failed++;
            continue;
          }

          try {
            const fileBlob = await entry.getData(new BlobWriter());
            const { error: uploadError } = await supabaseAdmin.storage
              .from(bucket)
              .upload(fileInfo.path, fileBlob, {
                contentType: fileInfo.contentType ?? "application/octet-stream",
                upsert: true,
              });

            if (uploadError) {
              console.warn(`Gagal restore ${bucket}/${fileInfo.path}: ${uploadError.message}`);
              result.failed++;
              storageErrors = true;
            } else {
              result.restored++;
            }
          } catch (e) {
            console.warn(`Error restore ${zipEntryPath}: ${e}`);
            result.failed++;
            storageErrors = true;
          }
        }

        storageResults.push(result);
      }
    }

    await zipReader.close();

    // Update backup status
    const hasStorageRestore = storageResults.length > 0;
    const allStorageOk = !storageErrors;
    const notes = hasStorageRestore
      ? allStorageOk
        ? "Restore database + storage berhasil."
        : "Restore selesai dengan error pada Storage."
      : "Restore database berhasil.";

    await supabaseAdmin
      .from("system_backups")
      .update({ status: "restored", notes })
      .eq("id", backupId);

    return {
      success: true,
      tables: dbResults,
      storage: storageResults,
      totalRows: dbResults.reduce((s, t) => s + t.rows, 0),
    };
  } catch (error) {
    await supabaseAdmin
      .from("system_backups")
      .update({
        status: "failed",
        notes: error instanceof Error ? error.message : "Restore gagal.",
      })
      .eq("id", backupId);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Restore gagal.",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Method tidak diizinkan. Gunakan POST." },
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(
      { success: false, error: "Environment variable Supabase belum lengkap." },
      500,
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return jsonResponse(
      { success: false, error: "Authorization diperlukan." },
      401,
    );
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return jsonResponse(
      { success: false, error: "User belum login atau session tidak valid." },
      401,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { backupId } = await req.json();

    if (!backupId || typeof backupId !== "string") {
      return jsonResponse(
        { success: false, error: "backupId wajib diisi." },
        400,
      );
    }

    const result = await restoreBackup(backupId, supabaseAdmin);

    if (!result.success) {
      return jsonResponse(
        { success: false, error: result.error },
        500,
      );
    }

    return jsonResponse({
      success: true,
      message: "Restore berhasil.",
      database: {
        tables: result.tables,
        totalRows: result.totalRows,
      },
      storage: result.storage ?? [],
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Restore gagal.",
      },
      500,
    );
  }
});

