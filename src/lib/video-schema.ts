import { z } from "zod";
import { duracaoValida, erroDoVideo } from "@/lib/video";

// Campos de vídeo validados no servidor (a mesma regra do formulário). Vazio vira null.
const vazioNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const VideoUrlField = z.preprocess(
  vazioNull,
  z.string().trim().max(500).nullable().optional().superRefine((v, ctx) => {
    const e = erroDoVideo(v);
    if (e) ctx.addIssue({ code: z.ZodIssueCode.custom, message: e });
  }),
);

export const VideoDuracaoField = z.preprocess(
  vazioNull,
  z.string().trim().max(10).nullable().optional().refine((v) => duracaoValida(v), { message: 'Duração no formato 2:14.' }),
);
