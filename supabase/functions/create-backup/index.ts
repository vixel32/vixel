import { createClient } from "@supabase/supabase-js";
import {
  BlobWriter,
  TextReader,
  ZipWriter,
  BlobReader,
} from "@zip.js/zip.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BACKUP_BUCKET = "system-backups";
const PAGE_SIZE = 1000;

const MAX_STORAGE_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_STORAGE_FILES = 500;

/**
 * Data buckets used by the website (excluding system buckets).
 * system-backups and system-updates are infrastructure, not website content.
 */
const DATA_BUCKETS = ["product-images"];

const BACKUP_TABLES = [
  "product_categories",
  "products",
  "product_images",
  "orders",
  "store_settings",
  "testimonials",
  "system_versions",
  "system_updates",
] as const;

type TableResult = {
  name: string;
  rows: number;
  file: string;
};

type StorageFileEntry = {
  bucket: string;
  path: string;
  size: number;
  contentType: string | null;
};

type StorageBucketResult = {
  bucket: string;
  files: number;
};

type BackupManifestV2 = {
  format: string;
  formatVersion: string;
  createdAt: string;
  createdBy: string;
  version: string;
  database: {
    schema: string;
    tables: TableResult[];
  };
  storage: StorageBucketResult[];
  storageFiles: StorageFileEntry[];
  sourceCode: {
    available: boolean;
  };
  restore: {
    strategy: string;
    order: string[];
  };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function listAllFilesInBucket(
  supabaseAdmin: ReturnType<typeof createClient>,
  bucket: string,
): Promise<{ path: string; size: number; contentType: string | null }[]> {
  const allFiles: { path: string; size: number; contentType: string | null }[] = [];
  let folder: string | undefined;

  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(folder ?? "", {
        limit: 1000,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      console.warn(`Gagal listing bucket ${bucket} folder ${folder}: ${error.message}`);
      break;
    }

    if (!data || data.length === 0) break;

    for (const item of data) {
      const itemPath = folder ? `${folder}/${item.name}` : item.name;

      if (item.metadata?.size !== undefined && item.id) {
        allFiles.push({
          path: itemPath,
          size: item.metadata.size,
          contentType: item.metadata.mimetype ?? null,
        });
      }

      // If it's a folder (no size), recurse into it
      if (item.metadata === null && !item.id) {
        const subFiles = await listAllFilesInBucket(supabaseAdmin, bucket);
        for (const sf of subFiles) {
          if (!allFiles.some((f) => f.path === sf.path)) {
            allFiles.push(sf);
          }
        }
      }
    }

    // Supabase list doesn't have pagination cursor — break after first page
    // since most folders are flat. For large buckets this is a known limitation.
    break;
  }

  return allFiles;
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

  const timestamp = Date.now();
  const createdAt = new Date().toISOString();
  const version = `backup-${timestamp}`;
  const fileName = `vixel-backup-${timestamp}.zip`;
  const storagePath = `backups/${fileName}`;

  let backupId: string | null = null;

  try {
    // Get current app version
    const { data: currentVersion } = await supabaseAdmin
      .from("system_versions")
      .select("version")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const appVersion = currentVersion?.version ?? "1.0.0";

    // Create backup record
    const { data: backupRecord, error: insertError } = await supabaseAdmin
      .from("system_backups")
      .insert({
        version,
        backup_name: fileName,
        backup_path: storagePath,
        backup_type: "manual",
        backup_scope: "full_data",
        status: "uploading",
        notes: "Backup database + storage dibuat melalui Admin Vixel.",
        storage_path: storagePath,
        file_size: null,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Gagal membuat metadata backup: ${insertError.message}`);
    }

    backupId = backupRecord.id;

    const zipWriter = new ZipWriter(new BlobWriter("application/zip"));

    // ============================================================
    // STEP 1: DATABASE BACKUP
    // ============================================================
    const tableResults: TableResult[] = [];

    for (const tableName of BACKUP_TABLES) {
      console.log(`Backup tabel: ${tableName}`);
      const allRows: Record<string, unknown>[] = [];
      let from = 0;

      while (true) {
        const to = from + PAGE_SIZE - 1;
        const { data: rows, error: tableError } = await supabaseAdmin
          .from(tableName)
          .select("*")
          .range(from, to);

        if (tableError) {
          throw new Error(`Gagal mengambil tabel ${tableName}: ${tableError.message}`);
        }

        if (!rows || rows.length === 0) break;

        allRows.push(...(rows as Record<string, unknown>[]));

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const filePath = `database/${tableName}.json`;
      const json = JSON.stringify(allRows, null, 2);
      await zipWriter.add(filePath, new TextReader(json));

      tableResults.push({ name: tableName, rows: allRows.length, file: filePath });
      console.log(`Selesai ${tableName}: ${allRows.length} row`);
    }

    // ============================================================
    // STEP 2: STORAGE BACKUP
    // ============================================================
    const storageFiles: StorageFileEntry[] = [];
    const storageBucketResults: StorageBucketResult[] = [];

    for (const bucket of DATA_BUCKETS) {
      console.log(`Backup storage bucket: ${bucket}`);

      const fileList = await listAllFilesInBucket(supabaseAdmin, bucket);
      let backedUpCount = 0;

      for (const file of fileList) {
        if (storageFiles.length >= MAX_STORAGE_FILES) {
          console.warn(`Mencapai batas maksimal file storage: ${MAX_STORAGE_FILES}`);
          break;
        }

        if (file.size > MAX_STORAGE_FILE_SIZE) {
          console.warn(`Skip file terlalu besar: ${file.path} (${file.size} bytes)`);
          continue;
        }

        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from(bucket)
          .download(file.path);

        if (dlError || !fileData) {
          console.warn(`Gagal download ${bucket}/${file.path}: ${dlError?.message ?? "no data"}`);
          continue;
        }

        const zipPath = `storage/${bucket}/${file.path}`;
        try {
          await zipWriter.add(zipPath, new BlobReader(new Blob([fileData])));
          storageFiles.push({
            bucket,
            path: file.path,
            size: file.size,
            contentType: file.contentType,
          });
          backedUpCount++;
        } catch (zipAddError) {
          console.warn(`Gagal menambah ${zipPath} ke ZIP: ${zipAddError}`);
        }
      }

      storageBucketResults.push({ bucket, files: backedUpCount });
      console.log(`Selesai storage ${bucket}: ${backedUpCount} file`);
    }

    // ============================================================
    // STEP 3: BUILD MANIFEST v2.0
    // ============================================================
    const restoreOrder = [
      "product_categories",
      "products",
      "product_images",
      "orders",
      "store_settings",
      "testimonials",
      "system_versions",
      "system_updates",
    ];

    const manifest: BackupManifestV2 = {
      format: "vixel-backup",
      formatVersion: "2.0",
      createdAt,
      createdBy: user.id,
      version: appVersion,
      database: {
        schema: "public",
        tables: tableResults,
      },
      storage: storageBucketResults,
      storageFiles,
      sourceCode: {
        available: false,
      },
      restore: {
        strategy: "upsert",
        order: restoreOrder,
      },
    };

    await zipWriter.add(
      "manifest.json",
      new TextReader(JSON.stringify(manifest, null, 2)),
    );

    // ============================================================
    // STEP 4: README.txt
    // ============================================================
    const readme = [
      "VIXEL BACKUP",
      "============",
      "",
      `Backup Version: 2.0`,
      `Application Version: ${appVersion}`,
      `Backup Type: Full Data (Database + Storage)`,
      `Created At: ${createdAt}`,
      `Created By: ${user.id}`,
      "",
      "Database Tables:",
      ...tableResults.map((t) => `  - ${t.name}: ${t.rows} rows`),
      "",
      "Storage Buckets:",
      ...storageBucketResults.map((s) => `  - ${s.bucket}: ${s.files} files`),
      "",
      "Source Code Versioning: Not connected",
      "",
      "Restore: Use Admin Vixel > Backup Sistem > Restore",
      "",
    ].join("\n");

    await zipWriter.add("README.txt", new TextReader(readme));

    // ============================================================
    // STEP 5: system/backup-info.json
    // ============================================================
    const backupInfo = {
      backupId,
      version: appVersion,
      createdAt,
      backupType: "full_data",
      tableCount: tableResults.length,
      totalRows: tableResults.reduce((sum, t) => sum + t.rows, 0),
      storageBuckets: storageBucketResults,
      totalStorageFiles: storageFiles.length,
    };

    await zipWriter.add(
      "system/backup-info.json",
      new TextReader(JSON.stringify(backupInfo, null, 2)),
    );

    // ============================================================
    // STEP 6: CLOSE ZIP & UPLOAD
    // ============================================================
    const zipBlob = await zipWriter.close();

    if (!zipBlob) {
      throw new Error("Gagal menghasilkan file ZIP.");
    }

    const fileSize = zipBlob.size;
    console.log(`Ukuran ZIP: ${fileSize} bytes`);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .upload(storagePath, zipBlob, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Gagal upload ZIP ke Storage: ${uploadError.message}`);
    }

    // Update metadata to completed
    const { error: updateError } = await supabaseAdmin
      .from("system_backups")
      .update({
        status: "completed",
        file_size: fileSize,
        storage_path: storagePath,
        backup_path: storagePath,
        notes: `Backup Full Data berhasil. ${tableResults.length} tabel, ${storageFiles.length} file storage.`,
      })
      .eq("id", backupId);

    if (updateError) {
      await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([storagePath]);
      throw new Error(`Gagal memperbarui metadata backup: ${updateError.message}`);
    }

    return jsonResponse({
      success: true,
      message: "Backup Full Data berhasil dibuat.",
      backup: {
        id: backupId,
        backup_name: fileName,
        version: appVersion,
        file_size: fileSize,
        storage_path: storagePath,
        status: "completed",
        backup_scope: "full_data",
      },
      database: {
        tables: tableResults,
        totalRows: tableResults.reduce((s, t) => s + t.rows, 0),
      },
      storage: {
        buckets: storageBucketResults,
        totalFiles: storageFiles.length,
      },
      manifest,
    });
  } catch (error) {
    console.error("CREATE BACKUP ERROR:", error);

    try {
      await supabaseAdmin.storage.from(BACKUP_BUCKET).remove([storagePath]);
    } catch (cleanupError) {
      console.error("Cleanup Storage gagal:", cleanupError);
    }

    if (backupId) {
      await supabaseAdmin
        .from("system_backups")
        .update({
          status: "failed",
          notes: error instanceof Error ? error.message : "Create Backup gagal.",
        })
        .eq("id", backupId);
    }

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Create Backup gagal.",
      },
      500,
    );
  }
});

