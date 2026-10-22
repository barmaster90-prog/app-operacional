import { useEffect, useState } from "react";
import { banco, type Usuario } from "./lib/banco.ts";
import { Login } from "./components/Login.tsx";
import { Agenda } from "./components/Agenda.tsx";

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);

  useEffect(() => {
    banco.usuarioAtual().then(setUsuario);
    return banco.aoMudarLogin(setUsuario);
  }, []);

  if (usuario === undefined) return <div className="carregando">Carregando…</div>;
  if (!usuario) return <Login />;
  return <Agenda usuario={usuario} />;
}
