import { createServerFn } from "@tanstack/react-start";
import { isAdminUser } from "@/lib/authz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contarAtendentesAtrasados } from "@/lib/retomada.functions";
import { contarFichasNovas } from "@/lib/biblioteca.functions";
import { contarSugestoesPendentes } from "@/lib/mensagens-vendem.functions";
import { contarMudancasSemConfirmar } from "@/lib/changelog.functions";
import { contarExerciciosParaAprovar } from "@/lib/aquecimento-admin.functions";
import { contarPendenciasExtensao } from "@/lib/extensao-admin.functions";
import { contarDuvidasRascunho } from "@/lib/duvidas.functions";

async function requireAdmin(ctx: { supabase: unknown; userId: string }) {
  const s = ctx.supabase as { rpc: (n: string, p: unknown) => Promise<{ data: boolean | null }> };
  const ok = await isAdminUser(s, ctx.userId);
  if (!ok) throw new Error("Apenas administradores.");
}

export interface AdminPendingItem {
  key: string;
  title: string;
  context: string;
  count: number;
  href: string;
  // Selo "novo aviso" (só na primeira versão dos avisos da Fase E; pode sair numa fase futura).
  novo?: boolean;
}

export interface AdminPendingCounts {
  items: AdminPendingItem[];
  total: number;
  // Pendências por tab_key, pra mostrar a pílula dourada nas linhas da grade
  // de seções e no seletor de dentro de uma seção.
  bySection: Record<string, number>;
}

const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

// Uma função só de servidor devolve todas as pendências de uma vez — usada na
// entrada do Admin, no seletor de seções e na pílula do menu lateral do site.
export const getAdminPendingCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPendingCounts> => {
    await requireAdmin(context);
    const db = context.supabase as any;
    const bySection: Record<string, number> = {};
    const items: AdminPendingItem[] = [];

    // 1) Sugestões e dúvidas em análise
    {
      const { data, error } = await db
        .from("suggestions")
        .select("created_at")
        .in("status", ["pendente", "em_analise"])
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      const count = data?.length ?? 0;
      bySection.suggestions = count;
      items.push({
        key: "suggestions",
        title: "Sugestões e dúvidas em análise",
        context: count > 0 ? `A mais antiga é de ${fmtData(data[0].created_at)}` : "Tudo em dia",
        count,
        href: "/admin/suggestions",
      });
    }

    // 2) Scripts enviados para revisar (Criar Scripts)
    {
      const { data, error } = await db
        .from("message_drafts")
        .select("criado_por, category:categories!message_drafts_category_id_fkey(name)")
        .eq("status", "pendente");
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const count = rows.length;
      bySection.messages = count;
      let context = "Tudo em dia";
      if (count > 0) {
        const authorIds = Array.from(new Set(rows.map((r: any) => r.criado_por)));
        const { data: profiles } = await db.from("profiles").select("id,display_name,email").in("id", authorIds);
        const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name || p.email]));
        const authorNames = Array.from(new Set(authorIds.map((id) => nameById.get(id) || "—"))).slice(0, 2);
        const catName = rows.find((r: any) => r.category?.name)?.category?.name;
        context = [authorNames.join(" e "), catName].filter(Boolean).join(" · ");
      }
      items.push({ key: "scriptreview", title: "Scripts enviados para revisar", context, count, href: "/admin/messages" });
    }

    // 2b) Objeções novas para revisar (fila do "O cliente disse…")
    {
      const { data, error } = await db
        .from("objecoes_pendentes")
        .select("fala_exemplo, ocorrencias")
        .eq("status", "pendente")
        .order("ocorrencias", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const count = rows.length;
      bySection.objecoesnovas = count;
      items.push({
        key: "objecoesnovas",
        title: "Objeções novas para revisar",
        context: count > 0 ? `"${rows[0].fala_exemplo}"` : "Tudo em dia",
        count,
        href: "/admin/objecoesnovas",
      });
    }

    // 2c) Atendentes com retomadas atrasadas há mais de 1 dia
    {
      // Se a migração das retomadas ainda não rodou, não derruba as outras pendências.
      const { atendentes, tickets } = await contarAtendentesAtrasados(db).catch(() => ({ atendentes: 0, tickets: 0 }));
      bySection.cadencia = atendentes;
      items.push({
        key: "cadencia",
        title: "Atendentes com retomadas atrasadas",
        context: atendentes > 0 ? `${tickets} ${tickets === 1 ? "retomada atrasada" : "retomadas atrasadas"} há mais de 1 dia` : "Tudo em dia",
        count: atendentes,
        href: "/admin/cadencia",
      });
    }

    // 2d) Fase B: conversas novas para revisar e mensagens abaixo do esperado (se a migração
    // ainda não rodou, não derruba as outras pendências).
    {
      const { total, primeira } = await contarFichasNovas(db).catch(() => ({ total: 0, primeira: null as string | null }));
      bySection.conversasenviadas = total;
      items.push({
        key: "conversasenviadas",
        title: "Conversas para revisar",
        context: total > 0 && primeira ? `"${primeira}"` : "Tudo em dia",
        count: total,
        href: "/admin/conversasenviadas",
      });
      const sugestoes = await contarSugestoesPendentes(db).catch(() => 0);
      bySection.mensagensvendem = sugestoes;
      items.push({
        key: "mensagensvendem",
        title: "Mensagens abaixo do esperado",
        context: sugestoes > 0 ? "Com sugestão de nova versão" : "Tudo em dia",
        count: sugestoes,
        href: "/admin/mensagensvendem",
      });
    }

    // 2e) Fase B bloco 2: exercícios do aquecimento (rascunhos da IA) esperando a sua aprovação.
    {
      const count = await contarExerciciosParaAprovar(db).catch(() => 0);
      bySection.bancoexercicios = count;
      items.push({
        key: "bancoexercicios",
        title: "Exercícios para aprovar",
        context: count > 0 ? "Rascunhos da IA no Banco de exercícios" : "Tudo em dia",
        count,
        href: "/admin/bancoexercicios",
      });
    }

    // 2f) Fase B bloco 3: mudanças importantes em vigor que ainda faltam confirmar.
    {
      const { total, primeira } = await contarMudancasSemConfirmar(db).catch(() => ({ total: 0, primeira: null as string | null }));
      bySection.changelog = total;
      items.push({
        key: "changelog",
        title: "Mudanças sem confirmar",
        context: total > 0 && primeira ? primeira : "Tudo em dia",
        count: total,
        href: "/admin/changelog",
      });
    }

    // 2g) Fase C · extensão 2: tempo de resposta acima da meta (semana) e atendentes sem a extensão
    // (só contagens; se a migração ainda não rodou, não derruba as outras pendências).
    {
      const ext = await contarPendenciasExtensao(context).catch(() => ({ semExtensao: 0, acimaDaMeta: 0, meta: 5 }));
      bySection.extensaoadmin = ext.acimaDaMeta + ext.semExtensao;
      items.push({
        key: "extensao_tempo",
        title: "Tempo de resposta acima da meta (semana)",
        context: ext.acimaDaMeta > 0 ? `Média da semana acima de ${ext.meta} min` : "Tudo em dia",
        count: ext.acimaDaMeta,
        href: "/admin/extensaoadmin",
      });
      items.push({
        key: "extensao_sem",
        title: "Atendentes sem a extensão",
        context: ext.semExtensao > 0 ? "Ainda não usaram a extensão do WhatsApp" : "Todos já usam",
        count: ext.semExtensao,
        href: "/admin/extensaoadmin",
      });
    }

    // 3) Perguntas sem boa resposta na MarcIAna (feedback 👎 ainda não resolvido)
    {
      const { data, error } = await db
        .from("marciana_feedback")
        .select("motivos")
        .eq("tipo", "nao_util")
        .is("resolvido_em", null);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const count = rows.length;
      bySection.marciana = count;
      let context = "Tudo em dia";
      if (count > 0) {
        const tally = new Map<string, number>();
        for (const r of rows) for (const m of r.motivos ?? []) tally.set(m, (tally.get(m) ?? 0) + 1);
        const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
        context = top ? `Mais citado: "${top[0]}"` : "Sem motivo informado";
      }
      items.push({ key: "marciana", title: "Perguntas sem boa resposta na MarcIAna", context, count, href: "/admin/marciana" });
    }

    // 4) Artigos da Central marcados "Não ajudou" (ainda não tratados)
    {
      const { data, error } = await db
        .from("ajuda_feedback")
        .select("content_item_id, content_item:content_items(id,title,section)")
        .eq("util", false)
        .is("resolvido_em", null);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      const count = rows.length;
      let context = "Tudo em dia";
      let href = "/admin/procedimentos";
      if (count > 0) {
        const tally = new Map<string, { title: string; section: string; n: number }>();
        for (const r of rows) {
          const item = r.content_item as { id: string; title: string; section: string } | null;
          if (!item) continue;
          const cur = tally.get(item.id) ?? { title: item.title, section: item.section, n: 0 };
          cur.n += 1;
          tally.set(item.id, cur);
        }
        const bySectionLocal: Record<string, number> = { procedimentos: 0, problemastecnicos: 0 };
        for (const v of tally.values()) {
          bySectionLocal[v.section === "problemas" ? "problemastecnicos" : "procedimentos"] += v.n;
        }
        bySection.procedimentos = bySectionLocal.procedimentos;
        bySection.problemastecnicos = bySectionLocal.problemastecnicos;
        const top = [...tally.values()].sort((a, b) => b.n - a.n)[0];
        context = top ? `"${top.title}"` : "—";
        href = top?.section === "problemas" ? "/admin/problemastecnicos" : "/admin/procedimentos";
      }
      items.push({ key: "ajuda", title: 'Artigos da Central marcados "Não ajudou"', context, count, href });
    }

    // 5) Itens da Amor Saúde sem clínica vinculada
    {
      const [consultas, exames, procedimentos] = await Promise.all([
        db.from("pricing_items").select("specialty, clinicas:pricing_item_clinicas(clinica_id)"),
        db.from("exames").select("nome, clinicas:exame_clinicas(clinica_id)"),
        db.from("procedimentos_odontologicos").select("nome, clinicas:procedimento_clinicas(clinica_id)"),
      ]);
      for (const r of [consultas, exames, procedimentos]) if (r.error) throw new Error(r.error.message);
      const semClinica = [
        ...(consultas.data ?? []).filter((i: any) => !(i.clinicas ?? []).length).map((i: any) => i.specialty),
        ...(exames.data ?? []).filter((i: any) => !(i.clinicas ?? []).length).map((i: any) => i.nome),
        ...(procedimentos.data ?? []).filter((i: any) => !(i.clinicas ?? []).length).map((i: any) => i.nome),
      ];
      const count = semClinica.length;
      bySection.pricing = count;
      items.push({
        key: "amorsaude",
        title: "Itens da Amor Saúde sem clínica vinculada",
        context: count > 0 ? semClinica[0] : "Tudo em dia",
        count,
        href: "/admin/pricing",
      });
    }

    // 6) Contatos sem atualização há mais de 90 dias
    {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db
        .from("contatos_enderecos")
        .select("nome_regiao, updated_at")
        .in("tipo", ["cartao_de_todos", "outros"])
        .lt("updated_at", since)
        .order("updated_at", { ascending: true });
      if (error) throw new Error(error.message);
      const count = data?.length ?? 0;
      bySection.contatos = count;
      items.push({
        key: "contatos",
        title: "Contatos sem atualização há mais de 90 dias",
        context: count > 0 ? data[0].nome_regiao : "Tudo em dia",
        count,
        href: "/admin/contatos",
      });
    }

    // 7) Dúvidas frequentes em rascunho (o Paulo revisa e publica)
    {
      let count = 0;
      try { count = await contarDuvidasRascunho(db); } catch { /* tabela ainda não criada */ }
      bySection.duvidas = count;
      items.push({
        key: "duvidas",
        title: "Dúvidas frequentes para revisar e publicar",
        context: count > 0 ? "Rascunhos esperando resposta ou publicação" : "Tudo em dia",
        count,
        href: "/admin/duvidas",
      });
    }

    // 8) Fase E: Roteiros de áudio em rascunho (se a tabela ainda não existir, não derruba as outras).
    {
      let count = 0;
      let semAudio = 0;
      try {
        const { data, error } = await db.from("roteiros_audio").select("audio_url").eq("status", "rascunho");
        if (error) throw new Error(error.message);
        count = data?.length ?? 0;
        semAudio = (data ?? []).filter((r: any) => !r.audio_url).length;
      } catch { /* tabela ainda não criada */ }
      bySection.roteirosaudio = count;
      items.push({
        key: "roteirosaudio",
        title: "Roteiros de áudio em rascunho",
        context: count === 0 ? "Tudo em dia" : semAudio > 0 ? "Sem áudio de exemplo" : "Revise e publique",
        count,
        href: "/admin/roteirosaudio",
        novo: true,
      });
    }

    // 9) Fase E: Scripts de ligação em rascunho (só aparece se houver).
    {
      let count = 0;
      try {
        const { data, error } = await db.from("roteiros_ligacao").select("id").eq("status", "rascunho");
        if (error) throw new Error(error.message);
        count = data?.length ?? 0;
      } catch { /* tabela ainda não criada */ }
      bySection.scriptsligacao = count;
      items.push({
        key: "scriptsligacao",
        title: "Scripts de ligação em rascunho",
        context: count > 0 ? "Revise e publique" : "Tudo em dia",
        count,
        href: "/admin/scriptsligacao",
        novo: true,
      });
    }

    // 10) Fase E: Teleconsulta sem nenhuma especialidade cadastrada (contagem 1 quando está vazia).
    {
      let count = 0;
      try {
        const { count: n, error } = await db
          .from("telemedicina_itens")
          .select("id", { count: "exact", head: true })
          .eq("tipo", "teleconsulta");
        if (error) throw new Error(error.message);
        count = n === 0 ? 1 : 0;
      } catch { /* tabela ainda não criada */ }
      bySection.pricing = (bySection.pricing ?? 0) + count;
      items.push({
        key: "teleconsulta_vazia",
        title: "Teleconsulta sem especialidades",
        context: count > 0 ? "Cadastre as especialidades em Amor Saúde > Teleconsulta" : "Tudo em dia",
        count,
        href: "/admin/telemedicina",
        novo: true,
      });
    }

    const total = items.reduce((sum, i) => sum + i.count, 0);
    return { items, total, bySection };
  });
