import { test } from "node:test";
import assert from "node:assert/strict";
import { lembretesDeArte, pedidoVazio, situacaoPedido } from "./pedidos.ts";
import type { DataEspecial } from "./feriados.ts";

const mulheres: DataEspecial = { data: "2027-03-08", nome: "Dia das Mulheres", tipo: "comercial", precisa_arte: true, avisar_dias: 21 };

test("Lembrete só aparece dentro da janela de aviso", () => {
  assert.equal(lembretesDeArte([mulheres], [], "2027-02-14").length, 0);
  const l = lembretesDeArte([mulheres], [], "2027-02-15");
  assert.equal(l.length, 1);
  assert.equal(l[0].faltam, 21);
});

test("Lembrete some quando já tem pedido para a data", () => {
  const p = pedidoVazio({ id: "p1", titulo: "Dia das Mulheres", uso: "2027-03-08" });
  assert.equal(lembretesDeArte([mulheres], [p], "2027-03-01").length, 0);
});

test("Data sem lembrete ou que já passou não aparece", () => {
  assert.equal(lembretesDeArte([{ ...mulheres, precisa_arte: false }], [], "2027-03-01").length, 0);
  assert.equal(lembretesDeArte([mulheres], [], "2027-03-09").length, 0);
});

test("Situação do pedido", () => {
  assert.equal(situacaoPedido({ entregue: false, em_producao: false }), "aberto");
  assert.equal(situacaoPedido({ entregue: false, em_producao: true }), "producao");
  assert.equal(situacaoPedido({ entregue: true, em_producao: true }), "entregue");
});
