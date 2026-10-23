import { test } from "node:test";
import assert from "node:assert/strict";
import { comSituacao, materialVazio, normalizarMaterial, semSituacao, situacaoArte, topoDaArte } from "./material.ts";

test("Topo com véspera de feriado", () => {
  assert.equal(topoDaArte("2026-11-01", "22:00"), "01/11 - Domingo - 22h - véspera de feriado");
});

test("Topo em dia de feriado e com minutos", () => {
  assert.equal(topoDaArte("2026-11-20", "21:30"), "20/11 - Sexta - 21h30 - feriado");
});

test("Topo sem horário e sem feriado", () => {
  assert.equal(topoDaArte("2026-10-30"), "30/10 - Sexta");
});

test("Topo usa datas cadastradas pela equipe", () => {
  assert.equal(
    topoDaArte("2026-10-08", "23:00", [{ data: "2026-10-09", nome: "Feriado local", tipo: "feriado" }]),
    "08/10 - Quinta - 23h - véspera de feriado",
  );
});

test("material antigo com um link só vira lista", () => {
  const m = normalizarMaterial({ evento_id: "x", link_fotos: "https://a", marca_dagua: true, anexos: [], em_producao: false });
  assert.deepEqual(m.links_fotos, [{ url: "https://a" }]);
  assert.equal("marca_dagua" in m, false);
});

test("resumo da divulgação", async () => {
  const { resumoDivulgacao } = await import("./divulgacao.ts");
  assert.equal(resumoDivulgacao({ postagens: [], videos: [] }), "Informações para divulgação");
  assert.equal(
    resumoDivulgacao({
      postagens: [{ id: "a", rede: "Instagram", formato: "Feed", feito: true }, { id: "b", rede: "TikTok", formato: "Reels", feito: false }],
      videos: [{ id: "v", titulo: "Teaser", feito: false }],
    }),
    "1/2 postagens · 0/1 vídeos",
  );
});

test("situação das tarefas", async () => {
  const { montarTarefas, situacao } = await import("./tarefas.ts");
  const ev = { id: "e", data: "2026-11-01", casas: ["downtown" as const], nome: "X", status: "Confirmado" as const, atracoes: [] };
  const tarefas = montarTarefas([ev], {}, {
    e: {
      evento_id: "e", impulsionar: false, videos: [],
      postagens: [
        { id: "a", data: "2026-10-20", rede: "Instagram", formato: "Feed", feito: false },
        { id: "b", data: "2026-10-25", rede: "Instagram", formato: "Story", feito: false },
        { id: "c", data: "2026-10-20", rede: "Instagram", formato: "Reels", feito: true },
      ],
    },
  });
  assert.deepEqual(tarefas.map((t) => situacao(t, "2026-10-22")), ["sem_prazo", "atrasada", "semana", "feito"]);
});

test("situação da arte: aberto, produção e finalizado guardam quem marcou", () => {
  const m = materialVazio("e1");
  assert.equal(situacaoArte(m), "aberto");
  const p = comSituacao(m, "producao", "Agência");
  assert.equal(situacaoArte(p), "producao");
  assert.equal(p.em_producao_por, "Agência");
  const f = comSituacao(p, "finalizado", "Outra");
  assert.equal(situacaoArte(f), "finalizado");
  assert.equal(f.em_producao_por, "Agência", "mantém quem colocou em produção");
  assert.equal(f.finalizado_por, "Outra");
  const volta = comSituacao(f, "aberto");
  assert.equal(volta.em_producao, false);
  assert.equal(volta.finalizado_por, undefined);
  assert.deepEqual(Object.keys(semSituacao(f)).filter((k) => k.includes("producao") || k.includes("finaliz")), []);
});
