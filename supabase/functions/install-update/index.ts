import { createClient } from "@supabase/supabase-js";
import { ZipReader, BlobReader, TextWriter, ZipWriter, BlobWriter, TextReader } from "@zip.js/zip.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UPDATES_BUCKET = "system-updates";
const BACKUP_BUCKET = "system-backups";

const VALID_UPDATE_TYPES = [
  "feature",
  "bugfix",
  "security",
  "database",
  "maintenance",
];

const SENSITIVE_FILE_PATTERNS = [
  /\.env$/i,
  /\.env\.local$/i,
  /credentials/i,
  /service-role/i,
  /secret/i,
  /password/i,
  /\.pem$/i,
  /\.key$/i,
];

const IN_PROGRESS_STATUSES = [
  "backing_up",
  "installing",
  "verifying",
  "rollback",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

type BackupManifestV2 = {
  format: string;
  formatVersion: string;
  tables: { name: string; rows: number; file: string }[];
  storage?: { bucket: string; files: number }[];
  storageFiles?: { bucket: string; path: string; size: number; contentType: string | null }[];
  restore: { strategy: string; order: string[] };
};

async function restoreBackup(
  backupId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<{ success: boolean; tables?: RestoreTableResult[]; error?: string }> {
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

    const results: RestoreTableResult[] = [];

    for (const tableName of restoreOrder) {
      const tableInfo = manifest.tables.find((t) => t.name === tableName);
      const file = tableInfo?.file ?? `database/${tableName}.json`;
      const oldFile = `tables/${tableName}.json`;
      let entry = entries.find((e) => e.filename === file);
      if (!entry) entry = entries.find((e) => e.filename === oldFile);

      if (!entry) {
        results.push({ table: tableName, rows: 0, insertedOrUpdated: 0 });
        continue;
      }

      const jsonText = await entry.getData(new TextWriter());
      const rows: Record<string, unknown>[] = JSON.parse(jsonText);

      if (rows.length === 0) {
        results.push({ table: tableName, rows: 0, insertedOrUpdated: 0 });
        continue;
      }

      const { data: upsertData, error: upsertError } = await supabaseAdmin
        .from(tableName)
        .upsert(rows, { onConflict: "id" })
        .select("id");

      if (upsertError) {
        throw new Error(`Gagal restore tabel ${tableName}: ${upsertError.message}`);
      }

      results.push({
        table: tableName,
        rows: rows.length,
        insertedOrUpdated: upsertData?.length ?? 0,
      });
    }

    // Storage restore for v2.0 backups
    if (formatVersion === "2.0" && manifest.storage && manifest.storage.length > 0) {
      for (const bucketInfo of manifest.storage) {
        const bucket = bucketInfo.bucket;
        const filesForBucket = manifest.storageFiles?.filter((f) => f.bucket === bucket) ?? [];

        for (const fileInfo of filesForBucket) {
          const zipEntryPath = `storage/${bucket}/${fileInfo.path}`;
          const entry = entries.find((e) => e.filename === zipEntryPath);
          if (!entry) continue;

          try {
            const fileBlob = await entry.getData(new BlobWriter());
            await supabaseAdmin.storage
              .from(bucket)
              .upload(fileInfo.path, fileBlob, {
                contentType: fileInfo.contentType ?? "application/octet-stream",
                upsert: true,
              });
          } catch (e) {
            console.warn(`Gagal restore storage ${bucket}/${fileInfo.path}: ${e}`);
          }
        }
      }
    }

    await zipReader.close();

    await supabaseAdmin
      .from("system_backups")
      .update({ status: "restored", notes: "Restore berhasil." })
      .eq("id", backupId);

    return { success: true, tables: results };
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

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((aParts[i] ?? 0) > (bParts[i] ?? 0)) return 1;
    if ((aParts[i] ?? 0) < (bParts[i] ?? 0)) return -1;
  }
  return 0;
}

function isUnsafePath(path: string): boolean {
  if (
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("../") ||
    path.includes("..\\") ||
    path.includes("\0") ||
    path.includes(":")
  ) {
    return true;
  }
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(path)) return true;
  }
  return false;
}

type UpdateManifest = {
  format: string;
  formatVersion: string;
  version: string;
  previousVersion?: string;
  type: string;
  description?: string;
  package?: {
    path: string;
    files: number;
  };
  requirements?: {
    minVersion?: string;
  };
  files?: string[];
  database?: {
    required?: boolean;
    migrations?: string[];
  };
};

function validateManifest(raw: unknown): UpdateManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("manifest.json tidak berisi object JSON yang valid.");
  }

  const data = raw as Record<string, unknown>;

  if (data.format !== "vixel-update" && data.format !== undefined) {
    // Accept existing format too (name/version/type/files) or new format
  }

  if (data.format === "vixel-update") {
    if (
      typeof data.formatVersion !== "string" ||
      !data.formatVersion.startsWith("1.")
    ) {
      throw new Error("formatVersion tidak didukung.");
    }
    if (typeof data.version !== "string" || !isValidVersion(data.version)) {
      throw new Error("version di manifest tidak valid. Gunakan format 1.2.0.");
    }
    if (typeof data.type !== "string" || !VALID_UPDATE_TYPES.includes(data.type)) {
      throw new Error(`Tipe update tidak valid. Gunakan: ${VALID_UPDATE_TYPES.join(", ")}.`);
    }
    if (data.previousVersion !== undefined && (typeof data.previousVersion !== "string" || !isValidVersion(data.previousVersion))) {
      throw new Error("previousVersion di manifest tidak valid.");
    }
    if (data.package !== undefined) {
      if (typeof data.package !== "object") {
        throw new Error("package di manifest harus berupa object.");
      }
      const pkg = data.package as Record<string, unknown>;
      if (typeof pkg.path !== "string" || !pkg.path.trim()) {
        throw new Error("package.path di manifest tidak valid.");
      }
      if (isUnsafePath(pkg.path)) {
        throw new Error("package.path di manifest tidak aman.");
      }
    }
    return {
      format: data.format,
      formatVersion: data.formatVersion,
      version: data.version,
      previousVersion: typeof data.previousVersion === "string" ? data.previousVersion : undefined,
      type: data.type,
      description: typeof data.description === "string" ? data.description : undefined,
      package: data.package as UpdateManifest["package"],
      requirements: data.requirements as UpdateManifest["requirements"],
      database: data.database as UpdateManifest["database"],
    };
  }

  // Legacy format: name, version, type, files
  if (typeof data.version !== "string" || !isValidVersion(data.version)) {
    throw new Error("version di manifest tidak valid. Gunakan format 1.2.0.");
  }
  if (typeof data.type !== "string" || !VALID_UPDATE_TYPES.includes(data.type)) {
    throw new Error(`Tipe update tidak valid. Gunakan: ${VALID_UPDATE_TYPES.join(", ")}.`);
  }
  return {
    format: "vixel-update",
    formatVersion: "1.0",
    version: data.version,
    type: data.type,
    description: typeof data.description === "string" ? data.description : undefined,
    requirements: data.minimum_version
      ? { minVersion: data.minimum_version as string }
      : undefined,
    files: Array.isArray(data.files) ? (data.files as string[]) : undefined,
  };
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
      { success: false, status: "failed", message: "Sesi login tidak valid." },
      401,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { updateId } = await req.json();

    if (!updateId || typeof updateId !== "string") {
      return jsonResponse(
        { success: false, status: "failed", message: "updateId wajib diisi." },
        400,
      );
    }

    // ============================================================
    // STEP 1: Ambil data update dari database (jangan percaya frontend)
    // ============================================================
    const {
      data: updateRecord,
      error: updateFetchError,
    } = await supabaseAdmin
      .from("system_updates")
      .select("*")
      .eq("id", updateId)
      .maybeSingle();

    if (updateFetchError || !updateRecord) {
      return jsonResponse(
        {
          success: false,
          status: "failed",
          message: "Data update tidak ditemukan.",
        },
        404,
      );
    }

    if (updateRecord.status !== "validated") {
      return jsonResponse(
        {
          success: false,
          status: updateRecord.status,
          message: `Update tidak dapat diinstall. Status saat ini: ${updateRecord.status}.`,
        },
        400,
      );
    }

    // ============================================================
    // STEP 2: Cegah dua update bersamaan
    // ============================================================
    const { data: inProgress } = await supabaseAdmin
      .from("system_updates")
      .select("id, version, status")
      .in("status", IN_PROGRESS_STATUSES);

    if (inProgress && inProgress.length > 0) {
      const other = inProgress.find((u) => u.id !== updateId);
      if (other) {
        return jsonResponse(
          {
            success: false,
            status: "failed",
            message: "Update lain sedang berjalan. Tunggu sampai proses selesai.",
          },
          409,
        );
      }
    }

    // ============================================================
    // STEP 3: Ambil versi sistem saat ini
    // ============================================================
    const { data: currentVersion } = await supabaseAdmin
      .from("system_versions")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

    const currentVer = currentVersion?.version ?? "1.0.0";

    // ============================================================
    // STEP 4: Ambil package_path dari database, download ZIP
    // ============================================================
    const packagePath = updateRecord.package_path;

    if (!packagePath) {
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: "Package path tidak ditemukan." })
        .eq("id", updateId);

      return jsonResponse(
        { success: false, status: "failed", message: "Package path tidak ditemukan." },
        400,
      );
    }

    // package_path is stored as "system-updates/updates/..." but the bucket is "system-updates"
    // We need to extract the path within the bucket
    const bucketPath = packagePath.startsWith("system-updates/")
      ? packagePath.substring("system-updates/".length)
      : packagePath;

    const { data: zipData, error: zipDownloadError } = await supabaseAdmin.storage
      .from(UPDATES_BUCKET)
      .download(bucketPath);

    if (zipDownloadError || !zipData) {
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: "Gagal mengunduh paket update." })
        .eq("id", updateId);

      return jsonResponse(
        { success: false, status: "failed", message: "Gagal mengunduh paket update." },
        500,
      );
    }

    // ============================================================
    // STEP 5: Validasi server-side — baca ZIP dan manifest ulang
    // ============================================================
    const zipBlob = new Blob([zipData]);
    const zipReader = new ZipReader(new BlobReader(zipBlob));
    const entries = await zipReader.getEntries();

    const manifestEntry = entries.find((e) => e.filename === "manifest.json");

    if (!manifestEntry) {
      await zipReader.close();
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: "manifest.json tidak ditemukan di paket." })
        .eq("id", updateId);

      return jsonResponse(
        { success: false, status: "failed", message: "Package update tidak valid: manifest.json tidak ditemukan." },
        400,
      );
    }

    const manifestText = await manifestEntry.getData(new TextWriter());
    let rawManifest: unknown;
    try {
      rawManifest = JSON.parse(manifestText);
    } catch {
      await zipReader.close();
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: "manifest.json bukan JSON valid." })
        .eq("id", updateId);
      return jsonResponse(
        { success: false, status: "failed", message: "manifest.json bukan JSON valid." },
        400,
      );
    }

    let manifest: UpdateManifest;
    try {
      manifest = validateManifest(rawManifest);
    } catch (e) {
      await zipReader.close();
      const msg = e instanceof Error ? e.message : "Manifest tidak valid.";
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: msg })
        .eq("id", updateId);
      return jsonResponse(
        { success: false, status: "failed", message: `Package update tidak valid: ${msg}` },
        400,
      );
    }

    // Validasi versi
    if (manifest.version !== updateRecord.version) {
      await zipReader.close();
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: `Versi manifest (${manifest.version}) berbeda dengan database (${updateRecord.version}).` })
        .eq("id", updateId);
      return jsonResponse(
        { success: false, status: "failed", message: "Versi manifest tidak sesuai dengan database." },
        400,
      );
    }

    // Cegah downgrade
    const versionComparison = compareVersions(manifest.version, currentVer);
    if (versionComparison <= 0) {
      await zipReader.close();
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: `Paket ${manifest.version} <= versi sistem ${currentVer}.` })
        .eq("id", updateId);
      return jsonResponse(
        {
          success: false,
          status: "failed",
          message: "Update ditolak karena versi paket lebih rendah daripada versi sistem saat ini.",
        },
        400,
      );
    }

    // Validasi previousVersion jika ada
    if (manifest.previousVersion && manifest.previousVersion !== currentVer) {
      await zipReader.close();
      await supabaseAdmin
        .from("system_updates")
        .update({ status: "failed", error_message: `previousVersion (${manifest.previousVersion}) != current (${currentVer}).` })
        .eq("id", updateId);
      return jsonResponse(
        {
          success: false,
          status: "failed",
          message: "Update tidak dapat dilakukan karena versi paket tidak sesuai dengan versi sistem.",
        },
        400,
      );
    }

    // Validasi semua path di ZIP
    for (const entry of entries) {
      if (entry.directory) continue;
      if (isUnsafePath(entry.filename)) {
        await zipReader.close();
        await supabaseAdmin
          .from("system_updates")
          .update({ status: "failed", error_message: `Path tidak aman di ZIP: ${entry.filename}` })
          .eq("id", updateId);
        return jsonResponse(
          { success: false, status: "failed", message: "Package update ditolak: ditemukan path file yang tidak aman." },
          400,
        );
      }
    }

    // Validasi files dari manifest (legacy format)
    if (manifest.files) {
      const zipPaths = new Set(entries.map((e) => e.filename));
      for (const file of manifest.files) {
        if (isUnsafePath(file)) {
          await zipReader.close();
          await supabaseAdmin
            .from("system_updates")
            .update({ status: "failed", error_message: `Path tidak aman di manifest: ${file}` })
            .eq("id", updateId);
          return jsonResponse(
            { success: false, status: "failed", message: "Package update ditolak: ditemukan path file yang tidak aman." },
            400,
          );
        }
        if (!zipPaths.has(file)) {
          await zipReader.close();
          await supabaseAdmin
            .from("system_updates")
            .update({ status: "failed", error_message: `File manifest tidak ditemukan di ZIP: ${file}` })
            .eq("id", updateId);
          return jsonResponse(
            { success: false, status: "failed", message: `File yang tercantum di manifest tidak ditemukan: ${file}` },
            400,
          );
        }
      }
    }

    await zipReader.close();

    // ============================================================
    // STEP 6: Cek database migration requirement
    // ============================================================
    if (manifest.database?.required && manifest.database.migrations?.length) {
      // Database migrations via edge functions are not safe to execute
      // from raw SQL files. We do NOT pretend it succeeded.
      await supabaseAdmin
        .from("system_updates")
        .update({
          status: "failed",
          error_message: "Database migration belum didukung oleh installer. Tidak ada perubahan dilakukan.",
        })
        .eq("id", updateId);
      return jsonResponse(
        {
          success: false,
          status: "failed",
          message: "Paket ini memerlukan database migration yang belum didukung oleh sistem installer. Tidak ada perubahan dilakukan.",
        },
        400,
      );
    }

    // ============================================================
    // STEP 7: PRE-UPDATE BACKUP (safety gate)
    // ============================================================
    await supabaseAdmin
      .from("system_updates")
      .update({ status: "backing_up", error_message: null })
      .eq("id", updateId);

    const backupTimestamp = Date.now();
    const backupFileName = `vixel-pre-update-${backupTimestamp}.zip`;
    const backupStoragePath = `backups/${backupFileName}`;

    // Create backup record
    const { data: backupRecord, error: backupInsertError } = await supabaseAdmin
      .from("system_backups")
      .insert({
        version: `pre-update-${manifest.version}`,
        backup_name: backupFileName,
        backup_path: backupStoragePath,
        storage_path: backupStoragePath,
        backup_type: "pre_update",
        status: "uploading",
        notes: `Backup otomatis sebelum update ke ${manifest.version}.`,
        update_id: updateId,
      })
      .select("id")
      .single();

    if (backupInsertError || !backupRecord) {
      await supabaseAdmin
        .from("system_updates")
        .update({
          status: "failed",
          error_message: "Gagal membuat metadata backup sebelum update.",
        })
        .eq("id", updateId);
      return jsonResponse(
        {
          success: false,
          status: "failed",
          message: "Update dihentikan karena backup sebelum update gagal. Tidak ada perubahan sistem yang dilakukan.",
        },
        500,
      );
    }

    const backupId = backupRecord.id;

    // Build backup ZIP (reuse same logic as create-backup)
    const BACKUP_TABLES = [
      "product_categories",
      "products",
      "product_images",
      "orders",
      "store_settings",
      "testimonials",
      "system_versions",
      "system_updates",
    ];

    const PAGE_SIZE = 1000;
    const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

    const tableResults: { name: string; rows: number; file: string }[] = [];

    for (const tableName of BACKUP_TABLES) {
      const allRows: Record<string, unknown>[] = [];
      let from = 0;

      while (true) {
        const to = from + PAGE_SIZE - 1;
        const { data: rows, error: tableError } = await supabaseAdmin
          .from(tableName)
          .select("*")
          .range(from, to);

        if (tableError) {
          // Cleanup backup
          await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([backupStoragePath]);
          await supabaseAdmin
            .from("system_backups")
            .update({ status: "failed", notes: `Gagal backup tabel ${tableName}: ${tableError.message}` })
            .eq("id", backupId);
          await supabaseAdmin
            .from("system_updates")
            .update({
              status: "failed",
              error_message: `Backup sebelum update gagal: tabel ${tableName}.`,
              backup_id: backupId,
            })
            .eq("id", updateId);
          return jsonResponse(
            {
              success: false,
              status: "failed",
              message: "Update dihentikan karena backup sebelum update gagal. Tidak ada perubahan sistem yang dilakukan.",
            },
            500,
          );
        }

        if (!rows || rows.length === 0) break;

        allRows.push(...(rows as Record<string, unknown>[]));

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const filePath = `tables/${tableName}.json`;
      await zipWriter.add(filePath, new TextReader(JSON.stringify(allRows, null, 2)));
      tableResults.push({ name: tableName, rows: allRows.length, file: filePath });
    }

    // ============================================================
    // STEP 7b: STORAGE BACKUP (part of pre-update full backup)
    // ============================================================
    const DATA_BUCKETS = ["product-images"];
    const MAX_STORAGE_FILE_SIZE = 50 * 1024 * 1024;
    const MAX_STORAGE_FILES = 500;
    const storageFiles: { bucket: string; path: string; size: number; contentType: string | null }[] = [];
    const storageBucketResults: { bucket: string; files: number }[] = [];

    for (const bucketName of DATA_BUCKETS) {
      let folder: string | undefined;
      const bucketFileList: { path: string; size: number; contentType: string | null }[] = [];

      while (true) {
        const { data: listData, error: listError } = await supabaseAdmin.storage
          .from(bucketName)
          .list(folder ?? "", { limit: 1000, offset: 0 });

        if (listError || !listData || listData.length === 0) break;

        for (const item of listData) {
          const itemPath = folder ? `${folder}/${item.name}` : item.name;
          if (item.metadata?.size !== undefined && item.id) {
            bucketFileList.push({
              path: itemPath,
              size: item.metadata.size,
              contentType: item.metadata.mimetype ?? null,
            });
          }
        }
        break;
      }

      let backedUpCount = 0;
      for (const file of bucketFileList) {
        if (storageFiles.length >= MAX_STORAGE_FILES || file.size > MAX_STORAGE_FILE_SIZE) continue;

        const { data: fileData, error: dlErr } = await supabaseAdmin.storage
          .from(bucketName)
          .download(file.path);

        if (dlErr || !fileData) continue;

        const zipPath = `storage/${bucketName}/${file.path}`;
        try {
          await zipWriter.add(zipPath, new BlobReader(new Blob([fileData])));
          storageFiles.push({ bucket: bucketName, path: file.path, size: file.size, contentType: file.contentType });
          backedUpCount++;
        } catch {
          // skip failed file
        }
      }
      storageBucketResults.push({ bucket: bucketName, files: backedUpCount });
    }

    const backupManifest = {
      format: "vixel-backup",
      formatVersion: "2.0",
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      version: `pre-update-${manifest.version}`,
      database: { schema: "public", tables: tableResults },
      storage: storageBucketResults,
      storageFiles,
      sourceCode: { available: false },
      restore: {
        strategy: "upsert",
        order: BACKUP_TABLES,
      },
    };

    await zipWriter.add("manifest.json", new TextReader(JSON.stringify(backupManifest, null, 2)));

    const backupZipBlob = await zipWriter.close();

    if (!backupZipBlob) {
      await supabaseAdmin
        .from("system_backups")
        .update({ status: "failed", notes: "Gagal menghasilkan ZIP backup." })
        .eq("id", backupId);
      await supabaseAdmin
        .from("system_updates")
        .update({
          status: "failed",
          error_message: "Backup sebelum update gagal: tidak dapat membuat ZIP.",
          backup_id: backupId,
        })
        .eq("id", updateId);
      return jsonResponse(
        {
          success: false,
          status: "failed",
          message: "Update dihentikan karena backup sebelum update gagal. Tidak ada perubahan sistem yang dilakukan.",
        },
        500,
      );
    }

    const { error: backupUploadError } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .upload(backupStoragePath, backupZipBlob, {
        contentType: "application/zip",
        upsert: false,
      });

    if (backupUploadError) {
      await supabaseAdmin
        .from("system_backups")
        .update({ status: "failed", notes: `Upload backup gagal: ${backupUploadError.message}` })
        .eq("id", backupId);
      await supabaseAdmin
        .from("system_updates")
        .update({
          status: "failed",
          error_message: "Backup sebelum update gagal: upload ke storage error.",
          backup_id: backupId,
        })
        .eq("id", updateId);
      return jsonResponse(
        {
          success: false,
          status: "failed",
          message: "Update dihentikan karena backup sebelum update gagal. Tidak ada perubahan sistem yang dilakukan.",
        },
        500,
      );
    }

    // Mark backup as completed
    await supabaseAdmin
      .from("system_backups")
      .update({
        status: "completed",
        file_size: backupZipBlob.size,
        notes: `Backup otomatis sebelum update ke ${manifest.version}.`,
      })
      .eq("id", backupId);

    // Link backup to update
    await supabaseAdmin
      .from("system_updates")
      .update({ backup_id: backupId })
      .eq("id", updateId);

    // ============================================================
    // STEP 8: PENDING DEPLOYMENT
    //
    // Source code deployment belum terhubung. Edge Function tidak
    // memiliki filesystem source-code website yang persisten, sehingga
    // mengekstrak file paket ke "server" tidak akan mengubah website.
    //
    // Yang DAPAT dilakukan di sini:
    //   - Pre-update backup (sudah selesai di atas)
    //   - Validasi paket (sudah selesai)
    //
    // Yang TIDAK dilakukan:
    //   - Version bump database (tidak boleh mengklaim source code berubah)
    //   - Ekstraksi file ke filesystem
    //   - Status "installed" (source code belum benar-benar berubah)
    //
    // Update ditandai sebagai "pending_deployment" — paket telah
    // tervalidasi dan backup telah dibuat, tetapi deploy source code
    // harus dilakukan melalui repository/deployment system yang aman.
    // ============================================================
    await supabaseAdmin
      .from("system_updates")
      .update({
        status: "pending_deployment",
        backup_id: backupId,
        error_message: null,
        installed_at: null,
      })
      .eq("id", updateId);

    return jsonResponse({
      success: true,
      status: "pending_deployment",
      updateId,
      version: manifest.version,
      previousVersion: currentVer,
      backupId,
      message:
        "Paket tervalidasi dan backup Full Data telah dibuat. " +
        "Source Code Deployment belum terhubung — source code website belum berubah. " +
        "Deploy paket melalui repository/deployment system untuk menyelesaikan update.",
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Install update gagal.";

    // Try to mark as failed if we have updateId
    try {
      const body = await req.clone().json();
      if (body.updateId) {
        await supabaseAdmin
          .from("system_updates")
          .update({ status: "failed", error_message: errMsg })
          .eq("id", body.updateId);
      }
    } catch {
      // ignore
    }

    return jsonResponse(
      { success: false, status: "failed", message: errMsg },
      500,
    );
  }
});


