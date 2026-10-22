import { useEffect, useState, type FormEvent } from "react";
import { banco, NOME_PAPEL } from "../lib/banco.ts";
import type { Membro } from "../lib/equipe.ts";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [membro, setMembro] = useState("");

  useEffect(() => {
    if (banco.demo) banco.equipe().then((eq) => {
      setEquipe(eq);
      setMembro(eq[0]?.id ?? "");
    });
  }, []);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await banco.entrar(email.trim(), senha, membro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <form className="login-caixa" onSubmit={enviar}>
        <h1>Agenda das casas</h1>
        <p className="sub">Downtown · Don Under Pub · Calçada · Praça</p>
        {!banco.demo && (
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
        )}
        {!banco.demo && (
          <label>
            Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          </label>
        )}
        {banco.demo && (
          <label>
            Entrar como
            <select id="login-membro" value={membro} onChange={(e) => setMembro(e.target.value)}>
              {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome} · {NOME_PAPEL[m.papel]}</option>)}
            </select>
          </label>
        )}
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        {banco.demo && (
          <p className="aviso">
            Modo demonstração: escolha quem você é para testar. O que você lançar fica salvo só neste navegador. No app de verdade cada pessoa entra com o próprio e-mail e senha.
          </p>
        )}
      </form>
    </main>
  );
}
