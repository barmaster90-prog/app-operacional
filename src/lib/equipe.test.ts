import { test } from "node:test";
import assert from "node:assert/strict";
import { EQUIPE_EXEMPLO, arrobaNoCursor, mencionados, novasMencoes } from "./equipe.ts";

const equipe = [...EQUIPE_EXEMPLO, { id: "ap", nome: "Ana Paula", papel: "producao" as const }];

test("acha menções sem ligar para acento e maiúscula", () => {
  const m = mencionados("@agencia sobe a arte. @AnaPaula vê o vídeo, @ninguem", equipe);
  assert.deepEqual(m.map((x) => x.id), ["agencia", "ap"]);
});

test("ignora pontuação no fim e repetição", () => {
  assert.deepEqual(mencionados("fala @Marketing. e @marketing!", equipe).map((x) => x.id), ["marketing"]);
});

test("só avisa menções novas", () => {
  assert.deepEqual(novasMencoes("@Master oi", "@Master oi @Audiovisual", equipe).map((x) => x.id), ["audiovisual"]);
});

test("detecta @ sendo digitado", () => {
  assert.deepEqual(arrobaNoCursor("oi @Mar", 7), { busca: "Mar", inicio: 3 });
  assert.equal(arrobaNoCursor("email@x", 7), null);
});
