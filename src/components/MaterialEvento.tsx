import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { banco, ehAgencia, ehGestao, type Usuario } from "../lib/banco.ts";
import { CASAS, casa, type CasaId, type Evento } from "../lib/tipos.ts";
import { FORMATOS_ANIMADO, NOME_SITUACAO_ARTE, situacaoArte, situacaoGravada, topoDaArte, type Animado, type Material, type SituacaoArte } from "../lib/material.ts";
import type { DataEspecial } from "../lib/feriados.ts";
import { baixarArquivo } from "../lib/baixar.ts";
import { dataPorExtenso } from "../lib/datas.ts";
import { PECAS, materialDoPedido, type Pedido } from "../lib/pedidos.ts";
import { avisoDeTarefa, avisoParaAgencia, avisosDeMencao, enviarAvisos, type Alvo } from "../lib/notificar.ts";
import type { AvisoNovo } from "../lib/avisos.ts";
import { CampoTexto, TextoComMencoes } from "./CampoTexto.tsx";
import { nomeDe, useEquipe } from "./Equipe.tsx";

interface Props {
  /** O briefing é de um evento… */
  evento?: Evento;
  /** …ou de um pedido de arte sem evento (novo quando o id está vazio). */
  pedido?: Pedido;
  usuario: Usuario;
  datasExtras: DataEspecial[];
  onFechar(): void;
  onMudou?(m: Material): void;
  onPedido?(p: Pedido): void;
  onPedidoApagado?(id: string): void;
}

/** O Material já tem algo para a agência trabalhar? */
const temBriefing = (m: Material | null | undefined) =>
  Boolean(m && (m.descricao?.trim() || m.ideia?.trim() || m.anexos.length || m.links_fotos.length));
const trechoBriefing = (m: Material) => (m.descricao?.trim() || m.ideia?.trim() || "").slice(0, 120) || undefined;

type Cabecalho = Pick<Pedido, "titulo" | "casas" | "pecas" | "uso" | "criado_por" | "criado_por_id" | "criado_em">;

const dataCurta = (d?: string) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "");

export const nomeDasCasas = (casas: CasaId[]) => (casas.length === 0 ? "Todas as casas" : casas.map((c) => casa(c).nome).join(" + "));

/** "Finalizado por Fulano em 23/10, 20:33", sem pedaços vazios. */
const marcadoPor = (oque: string, por?: string, em?: string) => [oque, por && `por ${por}`, em && `em ${quando(em)}`].filter(Boolean).join(" ") + ".";

function quando(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function MaterialEvento({ evento, pedido, usuario, datasExtras, onFechar, onMudou, onPedido, onPedidoApagado }: Props) {
  const [m, setM] = useState<Material | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const textoRef = useRef<HTMLTextAreaElement>(null);
  // Última versão salva: para saber quem foi mencionado ou virou responsável agora.
  const salvoRef = useRef<Material | null>(null);
  const equipe = useEquipe();
  // No Material do evento, a Produção só lê, baixa e marca "em produção".
  // Pedido de arte a Gestão e a Produção criam e editam (o marketing pede direto à agência).
  // A Agência só lê, copia, baixa e marca "em produção".
  const leitura = evento ? !ehGestao(usuario) : ehAgencia(usuario);
  const [pedidoId, setPedidoId] = useState(pedido?.id ?? "");
  const [cab, setCab] = useState<Cabecalho>(() => ({
    titulo: pedido?.titulo ?? "",
    casas: pedido?.casas ?? [],
    pecas: pedido?.pecas ?? [],
    uso: pedido?.uso,
    criado_por: pedido?.criado_por,
    criado_por_id: pedido?.criado_por_id,
    criado_em: pedido?.criado_em,
  }));
  const [apagar, setApagar] = useState(false);
  const agencia = ehAgencia(usuario);
  const alvo: Alvo = evento ? { id: evento.id, nome: evento.nome, data: evento.data } : { id: pedidoId, nome: cab.titulo || "Pedido de arte", pedido: true };
  const destino = evento ? "material" : "pedido";

  useEffect(() => {
    if (pedido) {
      const x = materialDoPedido(pedido);
      salvoRef.current = pedido.id ? x : null;
      setM(x);
      return;
    }
    if (!evento) return;
    banco
      .material(evento.id)
      .then((x) => {
        salvoRef.current = x;
        setM(x);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao abrir o material."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evento?.id, pedido?.id]);

  if (!m) {
    return (
      <div className="fundo-modal" onClick={onFechar}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>{erro || "Carregando…"}</div>
      </div>
    );
  }

  const situacao = situacaoArte(m);
  const set = <K extends keyof Material>(k: K, v: Material[K]) => setM((x) => (x ? { ...x, [k]: v } : x));
  const topo = evento ? topoDaArte(evento.data, evento.horario, datasExtras) : "";
  const casas = evento ? evento.casas.map((c) => casa(c).nome).join(" + ") + (evento.local ? ` · ${evento.local}` : "") : nomeDasCasas(cab.casas);
  const atracoes = evento ? evento.atracoes.map((a) => a.nome).join(" - ") : "";

  /** Grava o Material do evento ou o pedido inteiro (cabeçalho + briefing). */
  async function gravarNoBanco(novo: Material): Promise<Material> {
    if (evento) return banco.salvarMaterial(novo);
    if (!cab.titulo.trim()) throw new Error("Diga o que é o pedido (ex.: Dia das Mulheres).");
    const { evento_id: _id, ...briefing } = novo;
    const p = await banco.salvarPedido({ ...briefing, ...cab, titulo: cab.titulo.trim(), id: pedidoId });
    setPedidoId(p.id);
    setCab((c) => ({ ...c, criado_por: p.criado_por, criado_por_id: p.criado_por_id, criado_em: p.criado_em }));
    onPedido?.(p);
    return materialDoPedido(p);
  }

  async function gravar(novo: Material, msg: string) {
    setSalvando(true);
    setErro("");
    try {
      const salvo = await gravarNoBanco(novo);
      const antes = salvoRef.current;
      salvoRef.current = salvo;
      setM(salvo);
      setAviso(msg);
      onMudou?.(salvo);
      const alvoSalvo: Alvo = evento ? alvo : { ...alvo, id: salvo.evento_id };
      // Briefing novo para a agência: pedido salvo pela primeira vez, ou Material do evento que estava vazio.
      const briefingNovo = evento ? !temBriefing(antes) && temBriefing(salvo) : !antes;
      const novoResp = salvo.responsavel_id !== antes?.responsavel_id ? salvo.responsavel_id : undefined;
      await enviarAvisos([
        ...(briefingNovo
          ? avisoParaAgencia(equipe, usuario, alvoSalvo, destino, `Briefing novo · ${alvoSalvo.nome}`,
              trechoBriefing(salvo), [novoResp])
          : []),
        ...avisosDeMencao(
          [
            { onde: "Descrição", antes: antes?.descricao, depois: salvo.descricao },
            { onde: "Ideia para a arte", antes: antes?.ideia, depois: salvo.ideia },
            { onde: "Referência", antes: antes?.referencia, depois: salvo.referencia },
            { onde: "Importante", antes: antes?.importante, depois: salvo.importante },
            { onde: "Trilha do animado", antes: antes?.animado.trilha, depois: salvo.animado.trilha },
            { onde: "Animado", antes: antes?.animado.obs, depois: salvo.animado.obs },
          ],
          equipe,
          usuario,
          alvoSalvo,
          destino,
        ),
        ...avisoDeTarefa(
          salvo.responsavel_id,
          antes?.responsavel_id,
          usuario,
          alvoSalvo,
          destino,
          evento ? "Entregar a arte" : `Pedido de arte${cab.pecas.length ? ` (${cab.pecas.join(", ")})` : ""}`,
          salvo.prazo,
        ),
      ]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagarPedido() {
    if (!apagar) return setApagar(true);
    try {
      await banco.apagarPedido(pedidoId);
      onPedidoApagado?.(pedidoId);
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível apagar.");
    }
  }

  /** Só a Agência muda a situação: em aberto, em produção ou finalizado. */
  async function marcar(nova: SituacaoArte) {
    if (!m) return;
    setSalvando(true);
    setErro("");
    try {
      const salvo = evento ? await banco.marcarArte(evento.id, nova) : materialDoPedido(await banco.marcarArtePedido(pedidoId, nova));
      // Guarda o que ainda não foi salvo nos outros campos.
      const novo = { ...m, ...situacaoGravada(salvo) } as Material;
      setM(novo);
      setAviso(nova === "finalizado" ? "Marcado como finalizado." : nova === "producao" ? "Marcado como em produção." : "Voltou para em aberto.");
      onMudou?.(novo);
      if (!evento) onPedido?.({ ...(novo as unknown as Pedido), ...cab, id: pedidoId });
      if (nova !== "aberto") {
        // Avisa a Gestão, quem é responsável pela arte e quem fez o pedido.
        const para = new Set([...equipe.filter((x) => x.papel === "gestao").map((x) => x.id), m.responsavel_id ?? "", cab.criado_por_id ?? ""]);
        para.delete(usuario.id);
        para.delete("");
        const fim = nova === "finalizado";
        const lista: AvisoNovo[] = [...para].map((id) => ({
          para_id: id,
          de_nome: usuario.nome,
          tipo: "producao",
          titulo: `${fim ? "Arte finalizada" : "Arte em produção"} · ${alvo.nome}`,
          texto: `${usuario.nome} ${fim ? "finalizou a arte" : "colocou a arte em produção"}.`,
          ...(evento ? { evento_id: evento.id, evento_data: evento.data } : { pedido_id: pedidoId }),
          abrir: destino,
        }));
        await enviarAvisos(lista);
      }
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
      for (const a of arquivos) novos.push(await banco.enviarAnexo(evento?.id ?? `pedidos/${pedidoId || "novo"}`, a));
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

  const cabecalhoBriefing = evento
    ? [
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
      ]
    : [
        [cab.uso && dataCurta(cab.uso), casas, cab.pecas.join(" + "), cab.titulo].filter(Boolean).join(" - "),
        "",
        m.descricao && `Descrição\n${m.descricao}`,
        m.ideia && `Ideia para a arte\n${m.ideia}`,
        "— — — — —",
        cab.uso && `Vai ser postado em: ${dataPorExtenso(cab.uso)}`,
        m.prazo && `Prazo de entrega da arte: ${dataPorExtenso(m.prazo)}`,
        cab.pecas.length > 0 && `Peças: ${cab.pecas.join(", ")}`,
      ];
  const briefing = [
    ...cabecalhoBriefing,
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
          <h3>{evento ? `Material · ${evento.nome}` : pedidoId ? `Pedido de arte · ${cab.titulo}` : "Novo pedido de arte"}</h3>
          <button type="button" className="link" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        {!evento && (
          <section className="cabecalho-pedido">
            {leitura ? (
              <dl className="ficha">
                <dt>Casa</dt><dd>{casas}</dd>
                <dt>Peças</dt><dd>{cab.pecas.join(", ") || "—"}</dd>
                <dt>Vai ser postado</dt><dd>{cab.uso ? dataPorExtenso(cab.uso) : "sem data"}</dd>
              </dl>
            ) : (
              <div className="campos">
                <label className="inteiro">
                  O que é
                  <input id="ped-titulo" value={cab.titulo} onChange={(e) => setCab({ ...cab, titulo: e.target.value })} placeholder="Ex.: Dia das Mulheres, cardápio novo, vagas de emprego" autoFocus={!pedidoId} />
                </label>
                <div className="inteiro">
                  <span className="rotulo">Para qual casa</span>
                  <div className="escolhas" role="group" aria-label="Casas">
                    <button type="button" className={cab.casas.length === 0 ? "ativo" : ""} aria-pressed={cab.casas.length === 0} onClick={() => setCab({ ...cab, casas: [] })}>Todas</button>
                    {CASAS.map((c) => {
                      const on = cab.casas.includes(c.id);
                      return (
                        <button key={c.id} type="button" className={on ? "ativo" : ""} aria-pressed={on} onClick={() => setCab({ ...cab, casas: on ? cab.casas.filter((x) => x !== c.id) : [...cab.casas, c.id] })}>
                          <i style={{ background: c.cor }} aria-hidden="true" />{c.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="inteiro">
                  <span className="rotulo">Peças</span>
                  <div className="escolhas" role="group" aria-label="Peças">
                    {PECAS.map((x) => {
                      const on = cab.pecas.includes(x);
                      return (
                        <button key={x} type="button" className={on ? "ativo" : ""} aria-pressed={on} onClick={() => setCab({ ...cab, pecas: on ? cab.pecas.filter((y) => y !== x) : [...cab.pecas, x] })}>{x}</button>
                      );
                    })}
                  </div>
                </div>
                <label>
                  Vai ser postado em
                  <input id="ped-uso" type="date" value={cab.uso ?? ""} onChange={(e) => setCab({ ...cab, uso: e.target.value || undefined })} />
                  <small>Deixe vazio se não tem data (ex.: cardápio).</small>
                </label>
              </div>
            )}
          </section>
        )}

        <div className={`producao arte-${situacao}`}>
          <span className="sinal" aria-hidden="true" />
          <div>
            <strong>{NOME_SITUACAO_ARTE[situacao]}</strong>
            <small>
              {situacao === "finalizado"
                ? marcadoPor("Finalizado", m.finalizado_por, m.finalizado_em)
                : situacao === "producao"
                  ? marcadoPor("Colocado em produção", m.em_producao_por, m.em_producao_em)
                  : "Esta arte ainda não foi colocada em produção."}
            </small>
          </div>
          {!agencia ? (
            <small className="so-agencia">Só a agência muda a situação.</small>
          ) : !evento && !pedidoId ? null : (
            <span className="botoes-situacao">
              {situacao === "aberto" && <button type="button" className="primario" onClick={() => marcar("producao")} disabled={salvando}>Coloquei em produção</button>}
              {situacao === "producao" && (
                <>
                  <button type="button" onClick={() => marcar("aberto")} disabled={salvando}>Voltar para em aberto</button>
                  <button type="button" className="primario" onClick={() => marcar("finalizado")} disabled={salvando}>Finalizei</button>
                </>
              )}
              {situacao === "finalizado" && <button type="button" onClick={() => marcar("producao")} disabled={salvando}>Voltar para em produção</button>}
            </span>
          )}
        </div>

        <div className="responsavel-linha">
          {leitura ? (
            <p>
              <span className="rotulo">{evento ? "Responsável pela arte" : "Quem faz"}</span>
              {nomeDe(equipe, m.responsavel_id) ? `@${nomeDe(equipe, m.responsavel_id)}` : "—"}
              {m.prazo && <> · prazo de entrega da arte: {dataPorExtenso(m.prazo)}</>}
            </p>
          ) : (
            <>
              <label>
                {evento ? "Responsável pela arte" : "Quem faz"}
                <select id="mat-responsavel" value={m.responsavel_id ?? ""} onChange={(e) => set("responsavel_id", e.target.value || undefined)}>
                  <option value="">—</option>
                  {equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.funcao && x.funcao !== x.nome ? ` (${x.funcao})` : ""}</option>)}
                </select>
              </label>
              <label>
                Prazo de entrega da arte
                <input id="mat-prazo" type="date" value={m.prazo ?? ""} onChange={(e) => set("prazo", e.target.value || undefined)} />
              </label>
            </>
          )}
        </div>

        {evento && <section className="do-evento">
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
        </section>}

        <div className="campos">
          <label className="inteiro">
            {evento ? "Breve descrição do evento" : "Breve descrição"}
            {leitura ? <div className="texto-lido"><TextoComMencoes texto={m.descricao} /></div> : (
              <CampoTexto id="mat-descricao" rows={3} value={m.descricao ?? ""} onChange={(v) => set("descricao", v)} placeholder={evento ? "Ex.: outra arte da label Original Funk Hits. Use @ para chamar alguém." : "Ex.: arte única para todas as casas, com os horários. Use @ para chamar alguém."} />
            )}
          </label>
          <label className="inteiro">
            Ideia para a arte (fundo e elementos)
            {leitura ? <div className="texto-lido"><TextoComMencoes texto={m.ideia} /></div> : (
              <CampoTexto id="mat-ideia" rows={4} value={m.ideia ?? ""} onChange={(v) => set("ideia", v)} placeholder="Ex.: 3 artistas em destaque, cenário de favela ao fundo, destacar o open bar" />
            )}
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
            {leitura ? (
              <input id="mat-ref" readOnly value={m.referencia ?? ""} />
            ) : (
              <CampoTexto id="mat-ref" linha value={m.referencia ?? ""} onChange={(v) => set("referencia", v)} placeholder="Link ou descrição" />
            )}
          </label>
          <label className="inteiro">
            Informação extra / importante
            {leitura ? <div className="texto-lido"><TextoComMencoes texto={m.importante} /></div> : (
              <CampoTexto id="mat-importante" rows={2} value={m.importante ?? ""} onChange={(v) => set("importante", v)} />
            )}
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
                {leitura ? (
                  <input id="mat-anim-trilha" readOnly value={an.trilha ?? ""} />
                ) : (
                  <CampoTexto id="mat-anim-trilha" linha value={an.trilha ?? ""} onChange={(v) => setAnimado({ trilha: v })} placeholder="Música, artista ou estilo" />
                )}
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
                {leitura ? <div className="texto-lido"><TextoComMencoes texto={an.obs} /></div> : (
                  <CampoTexto id="mat-anim-obs" rows={2} value={an.obs ?? ""} onChange={(v) => setAnimado({ obs: v })} />
                )}
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
          {!evento && pedidoId && !leitura && (ehGestao(usuario) || cab.criado_por_id === usuario.id) && (
            <button type="button" className="perigo" onClick={apagarPedido}>{apagar ? "Confirmar: apagar" : "Apagar"}</button>
          )}
          <button type="button" onClick={onFechar}>Fechar</button>
          {!leitura && (
            <button type="button" className="primario" disabled={salvando} onClick={() => gravar(m, evento ? "Material salvo." : pedidoId ? "Pedido salvo." : "Pedido enviado.")}>
              {salvando ? "Salvando…" : evento ? "Salvar material" : pedidoId ? "Salvar pedido" : "Enviar pedido"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
