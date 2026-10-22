import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { banco, ehGestao, type Usuario } from "../lib/banco.ts";
import { casa, type Evento } from "../lib/tipos.ts";
import { FORMATOS_ANIMADO, topoDaArte, type Animado, type Material } from "../lib/material.ts";
import type { DataEspecial } from "../lib/feriados.ts";
import { baixarArquivo } from "../lib/baixar.ts";

interface Props {
  evento: Evento;
  usuario: Usuario;
  datasExtras: DataEspecial[];
  onFechar(): void;
  onMudou(m: Material): void;
}

function quando(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function MaterialEvento({ evento, usuario, datasExtras, onFechar, onMudou }: Props) {
  const [m, setM] = useState<Material | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  // Produção só lê, baixa e marca "em produção"; quem preenche é a Gestão.
  const leitura = !ehGestao(usuario);

  useEffect(() => {
    banco.material(evento.id).then(setM).catch((e) => setErro(e instanceof Error ? e.message : "Erro ao abrir o material."));
  }, [evento.id]);

  if (!m) {
    return (
      <div className="fundo-modal" onClick={onFechar}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>{erro || "Carregando…"}</div>
      </div>
    );
  }

  const set = <K extends keyof Material>(k: K, v: Material[K]) => setM((x) => (x ? { ...x, [k]: v } : x));
  const topo = topoDaArte(evento.data, evento.horario, datasExtras);
  const casas = evento.casas.map((c) => casa(c).nome).join(" + ") + (evento.local ? ` · ${evento.local}` : "");
  const atracoes = evento.atracoes.map((a) => a.nome).join(" - ");

  async function gravar(novo: Material, msg: string) {
    setSalvando(true);
    setErro("");
    try {
      const salvo = await banco.salvarMaterial(novo);
      setM(salvo);
      setAviso(msg);
      onMudou(salvo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarProducao() {
    if (!m) return;
    const valor = !m.em_producao;
    setSalvando(true);
    setErro("");
    try {
      const salvo = await banco.marcarProducao(evento.id, valor);
      // Guarda o que a Gestão ainda não salvou nos outros campos.
      const novo = { ...m, em_producao: salvo.em_producao, em_producao_por: salvo.em_producao_por, em_producao_em: salvo.em_producao_em };
      setM(novo);
      setAviso(valor ? "Marcado como em produção." : "Voltou para em aberto.");
      onMudou(novo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível marcar.");
    } finally {
      setSalvando(false);
    }
  }

  async function anexar(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!m || arquivos.length === 0) return;
    setEnviando(true);
    setErro("");
    try {
      const novos = [];
      for (const a of arquivos) novos.push(await banco.enviarAnexo(evento.id, a));
      await gravar({ ...m, anexos: [...m.anexos, ...novos] }, novos.length > 1 ? "Imagens anexadas." : "Imagem anexada.");
    } catch (er) {
      setErro(er instanceof Error ? er.message : "Não foi possível anexar.");
    } finally {
      setEnviando(false);
    }
  }

  async function removerAnexo(i: number) {
    if (!m) return;
    const anexo = m.anexos[i];
    try {
      await banco.removerAnexo(anexo);
      await gravar({ ...m, anexos: m.anexos.filter((_, j) => j !== i) }, "Imagem removida.");
    } catch (er) {
      setErro(er instanceof Error ? er.message : "Não foi possível remover.");
    }
  }

  const links = m.links_fotos.filter((l) => l.url.trim());
  const an = m.animado;
  const setAnimado = (mudanca: Partial<Animado>) => set("animado", { ...an, ...mudanca });
  const linksAnimado = an.links.filter((l) => l.trim());
  const temAnimado = Boolean(an.formato || an.duracao || an.trilha || linksAnimado.length || an.obs);
  const mudarLink = (i: number, campo: "artista" | "url", v: string) =>
    set("links_fotos", m.links_fotos.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));

  const briefing = [
    `${topo.split(" - ")[0]} - ${casas} - ${evento.nome}`,
    "",
    m.descricao && `Descrição\n${m.descricao}`,
    m.ideia && `Ideia para a arte\n${m.ideia}`,
    "— — — — —",
    `Topo\n${topo}`,
    "",
    evento.nome,
    atracoes,
    evento.entrada && `Entrada: ${evento.entrada}`,
    evento.promocao && `Promoção: ${evento.promocao}`,
    "— — — — —",
    links.length > 0 && `Links com fotos / press kit\n${links.map((l) => (l.artista ? `${l.artista}: ${l.url}` : l.url)).join("\n")}`,
    m.logotipo && `Logotipo\n${m.logotipo}`,
    m.referencia && `Referência para criação\n${m.referencia}`,
    m.importante && `Importante\n${m.importante}`,
    temAnimado && "— — — — —",
    temAnimado &&
      [
        "Animado",
        an.formato && `Formato: ${an.formato}`,
        an.duracao && `Duração: ${an.duracao}`,
        an.trilha && `Trilha sonora: ${an.trilha}`,
        linksAnimado.length > 0 && `Links:\n${linksAnimado.join("\n")}`,
        an.obs && `Obs.: ${an.obs}`,
      ]
        .filter(Boolean)
        .join("\n"),
  ]
    .filter((x): x is string => typeof x === "string")
    // Sem nada entre dois separadores, fica um só.
    .filter((x, i, todos) => !(x === "— — — — —" && todos[i + 1] === "— — — — —"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  async function baixar(url: string, nome: string) {
    setErro("");
    try {
      await baixarArquivo(url, nome);
    } catch (er) {
      const codigo = (er as { code?: string }).code;
      if (codigo !== "declined") setErro("Não foi possível baixar a imagem. Abra a imagem e salve por lá.");
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(briefing);
      setAviso("Briefing copiado.");
    } catch {
      textoRef.current?.select();
      setAviso("Não deu para copiar sozinho: o texto está selecionado, use Ctrl+C.");
    }
  }

  return (
    <div className="fundo-modal" onClick={onFechar}>
      <div className="modal material" onClick={(e) => e.stopPropagation()}>
        <div className="modal-topo">
          <h3>Material · {evento.nome}</h3>
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <div className={`producao ${m.em_producao ? "sim" : "nao"}`}>
          <span className="sinal" aria-hidden="true" />
          <div>
            <strong>{m.em_producao ? "Em produção" : "Em aberto"}</strong>
            <small>
              {m.em_producao
                ? `Marcado por ${m.em_producao_por ?? "—"} em ${quando(m.em_producao_em)}`
                : "Esta arte ainda não foi colocada em produção."}
            </small>
          </div>
          <button type="button" className={m.em_producao ? "" : "primario"} onClick={alternarProducao} disabled={salvando}>
            {m.em_producao ? "Voltar para em aberto" : "Coloquei em produção"}
          </button>
        </div>

        <section className="do-evento">
          <h4>Do evento</h4>
          <dl>
            <dt>Topo</dt><dd>{topo}</dd>
            <dt>Casa</dt><dd>{casas}</dd>
            <dt>Evento</dt><dd>{evento.nome}</dd>
            {atracoes && (<><dt>Atrações</dt><dd>{atracoes}</dd></>)}
            {evento.entrada && (<><dt>Entrada</dt><dd>{evento.entrada}</dd></>)}
            {evento.promocao && (<><dt>Promoção</dt><dd>{evento.promocao}</dd></>)}
          </dl>
          <small>Esses dados vêm da ficha do evento.{leitura ? "" : " Para mudar, edite a ficha."}</small>
        </section>

        <div className="campos">
          <label className="inteiro">
            Breve descrição do evento
            <textarea id="mat-descricao" readOnly={leitura} rows={3} value={m.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} placeholder={leitura ? "" : "Ex.: outra arte da label Original Funk Hits, anos 2010 a 2020"} />
          </label>
          <label className="inteiro">
            Ideia para a arte (fundo e elementos)
            <textarea id="mat-ideia" readOnly={leitura} rows={4} value={m.ideia ?? ""} onChange={(e) => set("ideia", e.target.value)} placeholder={leitura ? "" : "Ex.: 3 artistas em destaque, cenário de favela ao fundo, destacar o open bar"} />
          </label>
          <fieldset className="inteiro">
            <legend>Links com fotos / press kit dos artistas</legend>
            {leitura ? (
              links.length ? (
                <ul className="links-leitura">
                  {links.map((l, i) => (
                    <li key={i}>
                      {l.artista && <strong>{l.artista}: </strong>}
                      <a href={l.url} target="_blank" rel="noreferrer">{l.url}</a>
                    </li>
                  ))}
                </ul>
              ) : <small>Nenhum link.</small>
            ) : m.links_fotos.map((l, i) => (
              <div className="link-artista" key={i}>
                <input aria-label="Artista" value={l.artista ?? ""} onChange={(e) => mudarLink(i, "artista", e.target.value)} placeholder="Artista" />
                <input aria-label="Link" value={l.url} onChange={(e) => mudarLink(i, "url", e.target.value)} placeholder="https://drive.google.com/…" />
                <button type="button" className="link" onClick={() => set("links_fotos", m.links_fotos.filter((_, j) => j !== i))}>remover</button>
              </div>
            ))}
            {!leitura && (
              <button type="button" className="link" onClick={() => set("links_fotos", [...m.links_fotos, { artista: "", url: "" }])}>
                + Adicionar link
              </button>
            )}
          </fieldset>
          <label>
            Logotipo
            <input id="mat-logo" readOnly={leitura} value={m.logotipo ?? ""} onChange={(e) => set("logotipo", e.target.value)} placeholder={leitura ? "" : "Link da logo da label"} />
          </label>
          <label>
            Referência para criação
            <input id="mat-ref" readOnly={leitura} value={m.referencia ?? ""} onChange={(e) => set("referencia", e.target.value)} placeholder={leitura ? "" : "Link ou descrição"} />
          </label>
          <label className="inteiro">
            Informação extra / importante
            <textarea id="mat-importante" readOnly={leitura} rows={2} value={m.importante ?? ""} onChange={(e) => set("importante", e.target.value)} />
          </label>

          <fieldset className="inteiro">
            <legend>Imagens</legend>
            {m.anexos.length > 0 && (
              <div className="anexos">
                {m.anexos.map((a, i) => (
                  <figure key={`${a.nome}-${i}`}>
                    <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.nome} /></a>
                    <figcaption>
                      <span>{a.nome}</span>
                      <span className="acoes-anexo">
                        <button type="button" className="link" onClick={() => baixar(a.url, a.nome)}>baixar</button>
                        {!leitura && <button type="button" className="link" onClick={() => removerAnexo(i)}>remover</button>}
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            {leitura && m.anexos.length === 0 && <small>Nenhuma imagem.</small>}
            {!leitura && <label className="botao-arquivo">
              <input id="mat-anexo" type="file" accept="image/*" multiple onChange={anexar} disabled={enviando} />
              {enviando ? "Enviando…" : "+ Anexar imagens"}
            </label>}
          </fieldset>

          <fieldset className="inteiro animado">
            <legend>Animado</legend>
            <div className="campos">
              <label>
                Formato
                <input id="mat-anim-formato" list="formatos-animado" readOnly={leitura} value={an.formato ?? ""} onChange={(e) => setAnimado({ formato: e.target.value })} placeholder={leitura ? "" : "Escolha ou escreva"} />
                <datalist id="formatos-animado">
                  {FORMATOS_ANIMADO.map((f) => <option key={f} value={f} />)}
                </datalist>
              </label>
              <label>
                Duração
                <input id="mat-anim-duracao" readOnly={leitura} value={an.duracao ?? ""} onChange={(e) => setAnimado({ duracao: e.target.value })} placeholder={leitura ? "" : "Ex.: 15 segundos"} />
              </label>
              <label className="inteiro">
                Trilha sonora
                <input id="mat-anim-trilha" readOnly={leitura} value={an.trilha ?? ""} onChange={(e) => setAnimado({ trilha: e.target.value })} placeholder={leitura ? "" : "Música, artista ou estilo"} />
              </label>
              <div className="inteiro">
                <span className="rotulo">Links (trilha, YouTube, referência)</span>
                {leitura ? (
                  linksAnimado.length ? (
                    <ul className="links-leitura">
                      {linksAnimado.map((l, i) => <li key={i}><a href={l} target="_blank" rel="noreferrer">{l}</a></li>)}
                    </ul>
                  ) : <small>Nenhum link.</small>
                ) : (
                  <>
                    {an.links.map((l, i) => (
                      <div className="link-simples" key={i}>
                        <input aria-label="Link do animado" value={l} onChange={(e) => setAnimado({ links: an.links.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="https://youtube.com/…" />
                        <button type="button" className="link" onClick={() => setAnimado({ links: an.links.filter((_, j) => j !== i) })}>remover</button>
                      </div>
                    ))}
                    <button type="button" className="link" onClick={() => setAnimado({ links: [...an.links, ""] })}>+ Adicionar link</button>
                  </>
                )}
              </div>
              <label className="inteiro">
                Observação
                <textarea id="mat-anim-obs" rows={2} readOnly={leitura} value={an.obs ?? ""} onChange={(e) => setAnimado({ obs: e.target.value })} />
              </label>
            </div>
          </fieldset>

          <details className="inteiro briefing">
            <summary>Ver briefing em texto (para colar no Trello ou mandar para a agência)</summary>
            <textarea ref={textoRef} readOnly rows={12} value={briefing} />
            <button type="button" onClick={copiar}>Copiar briefing</button>
          </details>
        </div>

        {erro && <p className="erro">{erro}</p>}
        {aviso && !erro && <p className="ok">{aviso}</p>}

        <div className="modal-rodape">
          <span className="espaco" />
          <button type="button" onClick={onFechar}>Fechar</button>
          {!leitura && (
            <button type="button" className="primario" disabled={salvando} onClick={() => gravar(m, "Material salvo.")}>
              {salvando ? "Salvando…" : "Salvar material"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
