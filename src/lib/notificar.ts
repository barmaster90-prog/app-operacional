import { banco, type Usuario } from "./banco.ts";
import { novasMencoes, type Membro } from "./equipe.ts";
import { trecho, type AvisoNovo, type Destino } from "./avisos.ts";

/** Um texto que pode ter menções: o que estava salvo e o que vai ser salvo. */
export interface TextoMudado {
  onde: string;
  antes?: string;
  depois?: string;
}

/** Do que é o aviso: um evento ou um pedido de arte. */
export interface Alvo {
  id: string;
  nome: string;
  data?: string;
  pedido?: boolean;
}

const base = (alvo: Alvo, autor: Usuario, abrir: Destino) => ({
  de_nome: autor.nome,
  ...(alvo.pedido ? { pedido_id: alvo.id } : { evento_id: alvo.id, evento_data: alvo.data }),
  abrir,
});

/** Avisa quem foi mencionado pela primeira vez em algum dos textos (nunca o próprio autor). */
export function avisosDeMencao(
  textos: TextoMudado[],
  equipe: Membro[],
  autor: Usuario,
  evento: Alvo,
  abrir: Destino,
): AvisoNovo[] {
  const lista: AvisoNovo[] = [];
  const ja = new Set<string>();
  for (const t of textos) {
    for (const m of novasMencoes(t.antes, t.depois, equipe)) {
      if (m.id === autor.id || ja.has(m.id)) continue;
      ja.add(m.id);
      lista.push({
        ...base(evento, autor, abrir),
        para_id: m.id,
        tipo: "mencao",
        titulo: `${autor.nome} mencionou você · ${evento.nome}`,
        texto: `${t.onde}: "${trecho(t.depois ?? "")}"`,
      });
    }
  }
  return lista;
}

/** Avisa quem acabou de virar responsável por uma tarefa. */
export function avisoDeTarefa(
  paraId: string | undefined,
  antesId: string | undefined,
  autor: Usuario,
  evento: Alvo,
  abrir: Destino,
  oque: string,
  prazo?: string,
): AvisoNovo[] {
  if (!paraId || paraId === antesId || paraId === autor.id) return [];
  const quando = prazo ? `, prazo ${prazo.split("-").reverse().slice(0, 2).join("/")}` : "";
  return [{ ...base(evento, autor, abrir), para_id: paraId, tipo: "tarefa", titulo: `Nova tarefa para você · ${evento.nome}`, texto: `${oque}${quando}` }];
}

/** Avisa todo mundo com perfil Agência (menos quem fez e quem já recebeu outro aviso). */
export function avisoParaAgencia(
  equipe: Membro[],
  autor: Usuario,
  alvo: Alvo,
  abrir: Destino,
  titulo: string,
  texto?: string,
  exceto: (string | undefined)[] = [],
): AvisoNovo[] {
  return equipe
    .filter((m) => m.papel === "agencia" && m.id !== autor.id && !exceto.includes(m.id))
    .map((m) => ({ ...base(alvo, autor, abrir), para_id: m.id, tipo: "novo" as const, titulo, texto }));
}

/** Manda os avisos sem travar quem está salvando, se der erro. */
export async function enviarAvisos(lista: AvisoNovo[]): Promise<void> {
  try {
    await banco.avisar(lista);
  } catch {
    /* o conteúdo já foi salvo; o aviso não é essencial */
  }
}
