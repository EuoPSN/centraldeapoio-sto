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

        const EXT_MIME: Record<string, string> = {
          pdf: "application/pdf",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          txt: "text/plain",
        };
        const filename = v.path.split("/").pop() ?? "file";
        const ext = filename.split(".").pop()?.toLowerCase() ?? "";
        const isGeneric = !data.type || data.type === "application/octet-stream" || data.type === "text/plain;charset=UTF-8";
        const contentType = isGeneric && EXT_MIME[ext] ? EXT_MIME[ext] : (data.type || "application/octet-stream");

        const headers = new Headers();
        headers.set("content-type", contentType);
        headers.set("cache-control", "private, max-age=3600");
        headers.set("content-disposition", `inline; filename="${filename}"`);
        return new Response(data, { status: 200, headers });
      },
    },
  },
});
