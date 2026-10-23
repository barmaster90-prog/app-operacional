import { test } from "node:test";
import assert from "node:assert/strict";
import { pascoa, feriadosNacionais } from "./feriados.ts";
import { gradeDoMes, diaDaSemana } from "./datas.ts";

test("Páscoa em anos conhecidos", () => {
  assert.equal(pascoa(2024), "2024-03-31");
  assert.equal(pascoa(2025), "2025-04-20");
  assert.equal(pascoa(2026), "2026-04-05");
  assert.equal(pascoa(2027), "2027-03-28");
  assert.equal(pascoa(2030), "2030-04-21");
});

test("Datas móveis de 2026", () => {
  const f = feriadosNacionais(2026);
  const achar = (nome: string) => f.filter((x) => x.nome === nome).map((x) => x.data);
  assert.deepEqual(achar("Carnaval"), ["2026-02-16", "2026-02-17"]);
  assert.deepEqual(achar("Sexta-feira Santa"), ["2026-04-03"]);
  assert.deepEqual(achar("Corpus Christi"), ["2026-06-04"]);
});

test("Consciência Negra só a partir de 2024", () => {
  assert.ok(feriadosNacionais(2026).some((x) => x.data === "2026-11-20"));
  assert.ok(!feriadosNacionais(2023).some((x) => x.data === "2023-11-20"));
});

test("Grade do mês começa no domingo", () => {
  const g = gradeDoMes(2026, 10);
  assert.equal(g.length, 42);
  assert.equal(diaDaSemana(g[0]), 0);
  assert.ok(g.includes("2026-10-01"));
  assert.ok(g.includes("2026-10-31"));
});
