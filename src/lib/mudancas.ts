import { z } from "zod";

// Aviso de mudanças (Novidades): tipos, pergunta de checagem e rótulos. Código compartilhado
// entre servidor e telas.

export const TIPOS_MUDANCA = ["informativa", "importante", "urgente"] as const;
export type TipoMudanca = (typeof TIPOS_MUDANCA)[number];
export const TIPO_MUDANCA_LABEL: Record<TipoMudanca, string> = {
  informativa: "Informativa",
  importante: "Importante",
  urgente: "Urgente",
};

export const ehImportante = (t: string): boolean => t === "importante" || t === "urgente";

export const AlternativaChecagemSchema = z.object({
  texto: z.string().trim().min(1).max(200),
  correta: z.boolean(),
});

/** {tema_id, pergunta, alternativas[{texto, correta}], explicacao} */
export const PerguntaChecagemSchema = z.object({
  tema_id: z.string().uuid(),
  pergunta: z.string().trim().min(3).max(400),
  alternativas: z.array(AlternativaChecagemSchema).length(3),
  explicacao: z.string().trim().min(1).max(600),
}).refine((p) => p.alternativas.filter((a) => a.correta).length === 1, {
  message: "Marque exatamente uma alternativa correta.",
});
export type PerguntaChecagem = z.infer<typeof PerguntaChecagemSchema>;

/** Rota interna segura para "Ver o que mudou". */
export const LinkInternoSchema = z.string().trim().max(200)
  .refine((v) => v === "" || (v.startsWith("/") && !v.startsWith("//")), "Use uma rota interna, como /scripts.");

/** Mudança já em vigor quando não tem data de início ou ela já chegou. */
export function emVigor(valeAPartir: string | null, hoje: string): boolean {
  return !valeAPartir || valeAPartir <= hoje;
}

/** Uma mudança deixa de pedir confirmação depois da validade. */
export function expirou(validade: string | null, hoje: string): boolean {
  return !!validade && validade < hoje;
}

/** Pergunta como vai para o navegador: sem a alternativa correta e sem a explicação. */
export interface PerguntaPublica {
  pergunta: string;
  alternativas: { texto: string }[];
}

export interface NovidadeView {
  id: string;
  title: string;
  summary: string;
  tipo: TipoMudanca;
  origem: "manual" | "auto";
  vale_a_partir: string | null;
  validade: string | null;
  link: string | null;
  publicada_em: string;
  pergunta: PerguntaPublica | null;
  confirmado_em: string | null;
  /** Importante ou urgente, ainda não confirmada e dentro da validade. */
  pendente: boolean;
}

export interface StatusMudancas {
  pendentes: number;
  mais_antiga: { id: string; title: string } | null;
  /** Urgentes pendentes, para a notificação do Chrome. */
  urgentes: { id: string; title: string; lembrete_em: string | null }[];
}

export const STATUS_MUDANCAS_VAZIO: StatusMudancas = { pendentes: 0, mais_antiga: null, urgentes: [] };
