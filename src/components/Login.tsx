import { useState, type FormEvent } from "react";
import { banco } from "../lib/banco.ts";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await banco.entrar(email.trim(), senha);
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
        <p className="sub">Downtown · Don Under Pub · Calçada</p>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        {!banco.demo && (
          <label>
            Senha
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          </label>
        )}
        {erro && <p className="erro">{erro}</p>}
        <button className="primario" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        {banco.demo && (
          <p className="aviso">
            Modo demonstração: qualquer e-mail entra, e o que você lançar fica salvo só neste navegador.
          </p>
        )}
      </form>
    </main>
  );
}
