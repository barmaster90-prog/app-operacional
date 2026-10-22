import { useEffect, useRef, useState } from "react";
import { banco, type Usuario } from "../lib/banco.ts";
import type { Evento } from "../lib/tipos.ts";
import type { Comentario } from "../lib/avisos.ts";
import { avisosDeMencao, enviarAvisos } from "../lib/notificar.ts";
import { CampoTexto, TextoComMencoes } from "./CampoTexto.tsx";
import { useEquipe } from "./Equipe.tsx";

interface Props {
  evento: Evento;
  usuario: Usuario;
  onFechar(): void;
  onMudou(total: number): void;
}

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Conversa do evento: qualquer pessoa da equipe escreve e menciona com @. */
export function ConversaEvento({ evento, usuario, onFechar, onMudou }: Props) {
  const equipe = useEquipe();
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    banco.comentarios(evento.id).then(setLista).catch((e) => setErro(e instanceof Error ? e.message : "Erro ao abrir a conversa."));
  }, [evento.id]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [lista?.length]);

  async function enviar() {
    if (!texto.trim() || !lista) return;
    setEnviando(true);
    setErro("");
    try {
      const c = await banco.comentar(evento.id, texto.trim());
      const nova = [...lista, c];
      setLista(nova);
      setTexto("");
      onMudou(nova.length);
      await enviarAvisos(avisosDeMencao([{ onde: "Conversa", depois: c.texto }], equipe, usuario, evento, "conversa"));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fundo-modal" onClick={onFechar}>
      <div className="modal conversa" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>Conversa · {evento.nome}</h3>
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <div className="mensagens">
          {lista === null && <p className="vazio">{erro || "Carregando…"}</p>}
          {lista?.length === 0 && <p className="vazio">Ninguém escreveu ainda. Use @ para chamar alguém da equipe.</p>}
          {lista?.map((c) => (
            <div key={c.id} className={`mensagem ${c.autor_id === usuario.id ? "minha" : ""}`}>
              <small>{c.autor_nome} · {quando(c.criado_em)}</small>
              <p><TextoComMencoes texto={c.texto} /></p>
            </div>
          ))}
          <div ref={fimRef} />
        </div>
        {erro && lista && <p className="erro">{erro}</p>}
        <div className="escrever">
          <CampoTexto
            id="conversa-texto"
            linha
            ariaLabel="Escrever na conversa"
            value={texto}
            onChange={setTexto}
            onEnter={enviar}
            placeholder="Escreva… use @ para mencionar"
          />
          <button type="button" className="primario" disabled={enviando || !texto.trim()} onClick={enviar}>Enviar</button>
        </div>
      </div>
    </div>
  );
}
