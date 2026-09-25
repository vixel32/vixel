import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const { video_url, product_id } = await req.json();

    if (!video_url) {
      return new Response(
        JSON.stringify({ error: "video_url wajib diisi" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const githubToken = Deno.env.get("GITHUB_TOKEN");
    if (!githubToken) {
      throw new Error("GITHUB_TOKEN belum tersedia");
    }

    const response = await fetch(
      "https://api.github.com/repos/vixel32/youtube-video-processor/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          event_type: "process_video",
          client_payload: {
            video_url,
            product_id: product_id ?? null,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub error: ${response.status} ${text}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Video processing dimulai",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});