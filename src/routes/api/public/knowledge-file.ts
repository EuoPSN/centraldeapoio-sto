import { createFileRoute } from "@tanstack/react-router";
import { verifyKnowledgeFileToken } from "@/lib/knowledge-file-token.server";

export const Route = createFileRoute("/api/public/knowledge-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("t");
        if (!token) return new Response("Missing token", { status: 400 });
        const v = verifyKnowledgeFileToken(token);
        if (!v) return new Response("Invalid or expired token", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage
          .from("knowledge-files")
          .download(v.path);
        if (error || !data) return new Response("Not found", { status: 404 });

        const headers = new Headers();
        headers.set("content-type", data.type || "application/octet-stream");
        headers.set("cache-control", "private, max-age=3600");
        const filename = v.path.split("/").pop() ?? "file";
        headers.set("content-disposition", `inline; filename="${filename}"`);
        return new Response(data, { status: 200, headers });
      },
    },
  },
});
