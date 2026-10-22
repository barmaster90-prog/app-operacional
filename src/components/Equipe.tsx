import { createContext, useContext, useState } from "react";
import { banco, NOME_PAPEL, type Papel } from "../lib/banco.ts";
import { FUNCOES, arroba, type Membro } from "../lib/equipe.ts";

export const EquipeContexto = createContext<Membro[]>([]);
export const useEquipe = () => useContext(EquipeContexto);

export function nomeDe(equipe: Membro[], id?: string): string | undefined {
  return equipe.find((m) => m.id === id)?.nome;
}

interface Props {
  onFechar(): void;
  onMudou(): void;
}

/** Cadastro da equipe (só Gestão): nome, função e acesso de cada pessoa. */
export function GerenciarEquipe({ onFechar, onMudou }: Props) {
  const equipe = useEquipe();
  const [lista, setLista] = useState<Membro[]>(equipe);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const mudar = (i: number, mudanca: Partial<Membro>) => setLista(lista.map((m, j) => (j === i ? { ...m, ...mudanca } : m)));

  async function salvar() {
    setErro("");
    if (lista.some((m) => !m.nome.trim())) return setErro("Toda pessoa precisa de um nome.");
    const nomes = lista.map((m) => arroba(m).toLowerCase());
    if (new Set(nomes).size !== nomes.length) return setErro("Duas pessoas com o mesmo nome: o @ não saberia quem é.");
    try {
      for (const m of lista) {
        const antes = equipe.find((x) => x.id === m.id);
        if (!antes || antes.nome !== m.nome || antes.funcao !== m.funcao || antes.papel !== m.papel) {
          await banco.salvarMembro({ ...m, nome: m.nome.trim() });
        }
      }
      setAviso("Equipe salva.");
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="fundo-modal" onClick={onFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>Equipe</h3>
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        <p className="sub-evento">
          A função é como a pessoa aparece no @ e nas tarefas. O acesso define se ela vê valores e edita.
        </p>
        <div className="equipe-lista">
          {lista.map((m, i) => (
            <div className="membro" key={m.id || i}>
              <label>
                Nome
                <input value={m.nome} onChange={(e) => mudar(i, { nome: e.target.value })} />
                <small>@{arroba(m) || "…"}</small>
              </label>
              <label>
                Função
                <input list="funcoes" value={m.funcao ?? ""} onChange={(e) => mudar(i, { funcao: e.target.value })} />
              </label>
              <label>
                Acesso
                <select value={m.papel} onChange={(e) => mudar(i, { papel: e.target.value as Papel })}>
                  {(Object.keys(NOME_PAPEL) as Papel[]).map((p) => <option key={p} value={p}>{NOME_PAPEL[p]}</option>)}
                </select>
              </label>
            </div>
          ))}
          <datalist id="funcoes">{FUNCOES.map((f) => <option key={f} value={f} />)}</datalist>
        </div>
        {banco.demo ? (
          <button type="button" className="link" onClick={() => setLista([...lista, { id: "", nome: "", funcao: "", papel: "producao" }])}>
            + Pessoa
          </button>
        ) : (
          <small className="sub-evento">Para incluir alguém, crie o login dela no Supabase; ela aparece aqui depois.</small>
        )}
        {erro && <p className="erro">{erro}</p>}
        {aviso && !erro && <p className="ok">{aviso}</p>}
        <div className="modal-rodape">
          <span className="espaco" />
          <button type="button" onClick={onFechar}>Fechar</button>
          <button type="button" className="primario" onClick={salvar}>Salvar equipe</button>
        </div>
      </div>
    </div>
  );
}
