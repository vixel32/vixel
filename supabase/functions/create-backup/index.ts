import { createClient } from "@supabase/supabase-js";
import {
  BlobWriter,
  TextReader,
  ZipWriter,
} from "@zip.js/zip.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BACKUP_BUCKET = "system-backups";
const PAGE_SIZE = 1000;

/**
 * Tabel aplikasi yang akan dimasukkan ke backup.
 *
 * system_backups sengaja tidak dimasukkan karena tabel ini
 * menyimpan metadata/riwayat backup.
 */
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

type BackupTableName = (typeof BACKUP_TABLES)[number];

type TableResult = {
  name: string;
  rows: number;
  file: string;
};

type BackupManifest = {
  format: string;
  formatVersion: string;
  createdAt: string;
  createdBy: string;
  version: string;
  database: {
    schema: string;
  };
  tables: TableResult[];
  restore: {
    strategy: string;
    order: string[];
  };
};

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method tidak diizinkan. Gunakan POST.",
      },
      405,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(
      {
        success: false,
        error:
          "Environment variable Supabase belum lengkap.",
      },
      500,
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return jsonResponse(
      {
        success: false,
        error: "Authorization diperlukan.",
      },
      401,
    );
  }

  /**
   * Client dengan anon key digunakan untuk memastikan request
   * berasal dari user yang sedang login.
   */
  const supabaseAuth = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    },
  );

  const {
    data: {
      user,
    },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return jsonResponse(
      {
        success: false,
        error: "User belum login atau session tidak valid.",
      },
      401,
    );
  }

  /**
   * Service role hanya digunakan di server.
   * JANGAN pernah memasukkan key ini ke frontend.
   */
  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const timestamp = Date.now();
  const createdAt = new Date().toISOString();

  const version = `backup-${timestamp}`;
  const fileName = `vixel-backup-${timestamp}.zip`;
  const storagePath = `backups/${fileName}`;

  let backupId: string | null = null;

  try {
    console.log("=================================");
    console.log("CREATE BACKUP DIMULAI");
    console.log("User:", user.id);
    console.log("Version:", version);
    console.log("File:", fileName);
    console.log("=================================");

    /**
     * Catat backup terlebih dahulu.
     */
    const {
      data: backupRecord,
      error: insertError,
    } = await supabaseAdmin
      .from("system_backups")
      .insert({
        version,
        backup_name: fileName,
        backup_path: storagePath,
        backup_type: "manual",
        status: "uploading",
        notes: "Backup dibuat melalui Admin Vixel.",
        storage_path: storagePath,
        file_size: null,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(
        `Gagal membuat metadata backup: ${insertError.message}`,
      );
    }

    backupId = backupRecord.id;

    console.log("Backup ID:", backupId);

    const zipWriter = new ZipWriter(
      new BlobWriter("application/zip"),
    );

    const tableResults: TableResult[] = [];

    /**
     * Ambil tabel satu per satu.
     *
     * PAGE_SIZE digunakan supaya query tidak meminta seluruh
     * data sekaligus.
     */
    for (const tableName of BACKUP_TABLES) {
      console.log(`Mengambil tabel: ${tableName}`);

      const allRows: Record<string, unknown>[] = [];

      let from = 0;

      while (true) {
        const to = from + PAGE_SIZE - 1;

        const {
          data: rows,
          error: tableError,
        } = await supabaseAdmin
          .from(tableName)
          .select("*")
          .range(from, to);

        if (tableError) {
          throw new Error(
            `Gagal mengambil tabel ${tableName}: ${tableError.message}`,
          );
        }

        if (!rows || rows.length === 0) {
          break;
        }

        allRows.push(
          ...(rows as Record<string, unknown>[]),
        );

        console.log(
          `${tableName}: ${allRows.length} row`,
        );

        if (rows.length < PAGE_SIZE) {
          break;
        }

        from += PAGE_SIZE;
      }

      const filePath = `tables/${tableName}.json`;

      const json = JSON.stringify(
        allRows,
        null,
        2,
      );

      await zipWriter.add(
        filePath,
        new TextReader(json),
      );

      tableResults.push({
        name: tableName,
        rows: allRows.length,
        file: filePath,
      });

      console.log(
        `Selesai ${tableName}: ${allRows.length} row`,
      );
    }

    /**
     * Manifest menyimpan informasi isi backup.
     *
     * Restore akan menggunakan restore.order ini
     * agar foreign key tidak bermasalah.
     */
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

    const manifest: BackupManifest = {
      format: "vixel-backup",
      formatVersion: "1.0",
      createdAt,
      createdBy: user.id,
      version,
      database: {
        schema: "public",
      },
      tables: tableResults,
      restore: {
        strategy: "upsert",
        order: restoreOrder,
      },
    };

    await zipWriter.add(
      "manifest.json",
      new TextReader(
        JSON.stringify(manifest, null, 2),
      ),
    );

    console.log("manifest.json berhasil dibuat.");

    /**
     * Tutup ZIP dan dapatkan Blob.
     */
    const zipBlob = await zipWriter.close();

    if (!zipBlob) {
      throw new Error(
        "Gagal menghasilkan file ZIP.",
      );
    }

    const fileSize = zipBlob.size;

    console.log(
      "Ukuran ZIP:",
      fileSize,
      "bytes",
    );

    /**
     * Upload ZIP ke Supabase Storage.
     */
    const {
      error: uploadError,
    } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .upload(
        storagePath,
        zipBlob,
        {
          contentType: "application/zip",
          upsert: false,
        },
      );

    if (uploadError) {
      throw new Error(
        `Gagal upload ZIP ke Storage: ${uploadError.message}`,
      );
    }

    console.log(
      "ZIP berhasil diupload:",
      storagePath,
    );

    /**
     * Update metadata menjadi completed.
     */
    const {
      error: updateError,
    } = await supabaseAdmin
      .from("system_backups")
      .update({
        status: "completed",
        file_size: fileSize,
        storage_path: storagePath,
        backup_path: storagePath,
        notes:
          "Backup data aplikasi Vixel berhasil dibuat.",
      })
      .eq("id", backupId);

    if (updateError) {
      /**
       * ZIP sudah ada di Storage.
       * Jika metadata gagal diupdate, hapus ZIP
       * agar tidak meninggalkan file yatim.
       */
      await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .remove([storagePath]);

      throw new Error(
        `Gagal memperbarui metadata backup: ${updateError.message}`,
      );
    }

    console.log("=================================");
    console.log("CREATE BACKUP BERHASIL");
    console.log("=================================");

    return jsonResponse({
      success: true,
      message: "Backup berhasil dibuat.",
      backup: {
        id: backupId,
        backup_name: fileName,
        version,
        file_size: fileSize,
        storage_path: storagePath,
        status: "completed",
      },
      tables: tableResults,
      manifest,
    });
  } catch (error) {
    console.error(
      "CREATE BACKUP ERROR:",
      error,
    );

    /**
     * Bersihkan ZIP jika sudah sempat terupload.
     */
    try {
      await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .remove([storagePath]);
    } catch (cleanupError) {
      console.error(
        "Cleanup Storage gagal:",
        cleanupError,
      );
    }

    /**
     * Tandai metadata sebagai failed.
     */
    if (backupId) {
      await supabaseAdmin
        .from("system_backups")
        .update({
          status: "failed",
          notes:
            error instanceof Error
              ? error.message
              : "Create Backup gagal.",
        })
        .eq("id", backupId);
    }

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Create Backup gagal.",
      },
      500,
    );
  }
});