import type { Papel } from "./banco.ts";

/** Uma pessoa da equipe: quem pode ser mencionada e ser responsável por tarefas. */
export interface Membro {
  id: string;
  nome: string;
  /** O que a pessoa faz (Marketing, Agência, Audiovisual…). Não muda o que ela pode ver. */
  funcao?: string;
  papel: Papel;
}

export const FUNCOES = ["Gestão", "Marketing", "Agência", "Audiovisual", "Produção", "Outro"];

/** Equipe inicial do modo demonstração: funções no lugar de nomes, para a Gestão renomear. */
export const EQUIPE_EXEMPLO: Membro[] = [
  { id: "master", nome: "Master", funcao: "Gestão", papel: "gestao" },
  { id: "marketing", nome: "Marketing", funcao: "Marketing", papel: "producao" },
  { id: "agencia", nome: "Agência", funcao: "Agência", papel: "producao" },
  { id: "audiovisual", nome: "Audiovisual", funcao: "Audiovisual", papel: "producao" },
];

/** O texto que se digita depois do @: o nome sem espaços (ex.: "Ana Paula" vira "AnaPaula"). */
export function arroba(m: Pick<Membro, "nome">): string {
  return m.nome.normalize("NFC").replace(/\s+/g, "");
}

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Quem foi mencionado no texto (cada pessoa uma vez). */
export function mencionados(texto: string | undefined, equipe: Membro[]): Membro[] {
  if (!texto) return [];
  const achados = new Set<string>();
  for (const [, nome] of texto.matchAll(/@([\p{L}\p{N}_.-]+)/gu)) {
    const alvo = normalizar(nome).replace(/[.-]+$/, "");
    const m = equipe.find((x) => normalizar(arroba(x)) === alvo);
    if (m) achados.add(m.id);
  }
  return equipe.filter((m) => achados.has(m.id));
}

/** Mencionados no texto novo que não estavam no antigo. */
export function novasMencoes(antes: string | undefined, depois: string | undefined, equipe: Membro[]): Membro[] {
  const ja = new Set(mencionados(antes, equipe).map((m) => m.id));
  return mencionados(depois, equipe).filter((m) => !ja.has(m.id));
}

/** Se o cursor está logo depois de um "@algo", devolve o que foi digitado e onde começa. */
export function arrobaNoCursor(texto: string, cursor: number): { busca: string; inicio: number } | null {
  const antes = texto.slice(0, cursor);
  const m = antes.match(/(^|\s)@([\p{L}\p{N}_.-]*)$/u);
  if (!m) return null;
  return { busca: m[2], inicio: cursor - m[2].length - 1 };
}

export function filtrarEquipe(equipe: Membro[], busca: string): Membro[] {
  const b = normalizar(busca);
  return equipe.filter((m) => normalizar(arroba(m)).startsWith(b) || normalizar(m.funcao ?? "").startsWith(b));
}
