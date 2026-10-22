import { test } from "node:test";
import assert from "node:assert/strict";
import { topoDaArte } from "./material.ts";

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
