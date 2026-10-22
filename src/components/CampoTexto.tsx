import { Fragment, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { arroba, arrobaNoCursor, filtrarEquipe, mencionados, normalizar } from "../lib/equipe.ts";
import { useEquipe } from "./Equipe.tsx";

interface Props {
  id?: string;
  value: string;
  onChange(v: string): void;
  rows?: number;
  placeholder?: string;
  /** Uma linha só (input) em vez de caixa de texto. */
  linha?: boolean;
  ariaLabel?: string;
  onEnter?(): void;
}

/** Caixa de texto que sugere pessoas da equipe ao digitar @. */
export function CampoTexto({ id, value, onChange, rows = 3, placeholder, linha, ariaLabel, onEnter }: Props) {
  const equipe = useEquipe();
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [busca, setBusca] = useState<{ busca: string; inicio: number } | null>(null);
  const [marcado, setMarcado] = useState(0);
  // Onde pôr o cursor depois de inserir uma menção (aplicado logo que o texto novo aparece).
  const cursorDepois = useRef<number | null>(null);
  const opcoes = busca ? filtrarEquipe(equipe, busca.busca).slice(0, 6) : [];

  function atualizar(texto: string, cursor: number) {
    onChange(texto);
    setBusca(arrobaNoCursor(texto, cursor));
    setMarcado(0);
  }

  function escolher(i: number) {
    const el = ref.current;
    const m = opcoes[i];
    if (!el || !busca || !m) return;
    const cursor = el.selectionStart ?? value.length;
    const inserido = `@${arroba(m)} `;
    const novo = value.slice(0, busca.inicio) + inserido + value.slice(cursor);
    onChange(novo);
    setBusca(null);
    cursorDepois.current = busca.inicio + inserido.length;
  }

  function tecla(e: KeyboardEvent) {
    if (opcoes.length > 0) {
      if (e.key === "ArrowDown") return (e.preventDefault(), setMarcado((marcado + 1) % opcoes.length));
      if (e.key === "ArrowUp") return (e.preventDefault(), setMarcado((marcado - 1 + opcoes.length) % opcoes.length));
      if (e.key === "Enter" || e.key === "Tab") return (e.preventDefault(), escolher(marcado));
      if (e.key === "Escape") return setBusca(null);
    }
    if (linha && e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  }

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && cursorDepois.current !== null) {
      el.focus();
      el.setSelectionRange(cursorDepois.current, cursorDepois.current);
      cursorDepois.current = null;
    }
  }, [value]);

  const comum = {
    id,
    ref,
    value,
    placeholder,
    "aria-label": ariaLabel,
    "aria-autocomplete": "list" as const,
    "aria-expanded": opcoes.length > 0,
    onChange: (e: { target: HTMLTextAreaElement | HTMLInputElement }) => atualizar(e.target.value, e.target.selectionStart ?? e.target.value.length),
    onKeyDown: tecla,
    onBlur: () => setTimeout(() => setBusca(null), 150),
  };

  return (
    <span className="campo-mencao">
      {linha ? <input {...comum} /> : <textarea rows={rows} {...comum} />}
      {opcoes.length > 0 && (
        <span className="sugestoes" role="listbox">
          {opcoes.map((m, i) => (
            <button
              type="button"
              role="option"
              aria-selected={i === marcado}
              key={m.id}
              className={i === marcado ? "marcada" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(i);
              }}
            >
              <span className="avatar">{m.nome.slice(0, 2).toUpperCase()}</span>
              <span>{m.nome}</span>
              {m.funcao && <small>{m.funcao}</small>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** Texto só de leitura, com as menções destacadas. */
export function TextoComMencoes({ texto, vazio = "—" }: { texto?: string; vazio?: string }) {
  const equipe = useEquipe();
  if (!texto?.trim()) return <span className="vazio-texto">{vazio}</span>;
  const validos = new Set(mencionados(texto, equipe).map((m) => normalizar(arroba(m))));
  const partes = texto.split(/(@[\p{L}\p{N}_]+)/u);
  return (
    <span className="texto-mencoes">
      {partes.map((p, i) =>
        p.startsWith("@") && validos.has(normalizar(p.slice(1))) ? (
          <strong key={i} className="mencao">{p}</strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}
