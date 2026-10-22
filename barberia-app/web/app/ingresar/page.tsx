"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Modo = "ingresar" | "registro" | "recuperar";

export default function Ingresar() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("ingresar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cargando, setCargando] = useState(false);

  const callback = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setMsg(null);
    const supabase = createClient();

    if (modo === "ingresar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ tipo: "error", texto: "Mail o contraseña incorrectos, o el mail aún no está confirmado." });
      else {
        router.push("/panel");
        router.refresh();
      }
    } else if (modo === "registro") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callback },
      });
      if (error) setMsg({ tipo: "error", texto: error.message });
      else setMsg({ tipo: "ok", texto: "Te enviamos un mail para confirmar tu cuenta. Revisá también el spam." });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${callback}?next=/panel`,
      });
      if (error) setMsg({ tipo: "error", texto: error.message });
      else setMsg({ tipo: "ok", texto: "Si el mail existe, te enviamos un link para recuperar la contraseña." });
    }
    setCargando(false);
  }

  async function conGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback } });
  }

  const titulos: Record<Modo, string> = {
    ingresar: "Ingresá a tu barbería",
    registro: "Creá tu cuenta de barbero",
    recuperar: "Recuperar contraseña",
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-4 py-10">
      <h1 className="text-2xl font-semibold">{titulos[modo]}</h1>

      {modo !== "recuperar" && (
        <button
          type="button"
          onClick={conGoogle}
          className="rounded-lg border border-zinc-300 px-4 py-3 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Continuar con Google
        </button>
      )}

      <form onSubmit={enviar} className="flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {modo !== "recuperar" && (
          <input
            type="password"
            required
            minLength={8}
            autoComplete={modo === "registro" ? "new-password" : "current-password"}
            placeholder="Contraseña (mínimo 8 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
        )}
        <button
          disabled={cargando}
          className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {modo === "ingresar" ? "Ingresar" : modo === "registro" ? "Crear cuenta" : "Enviar link"}
        </button>
      </form>

      {msg && (
        <p role="status" className={msg.tipo === "ok" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
          {msg.texto}
        </p>
      )}

      <div className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        {modo !== "ingresar" && <button className="text-left underline" onClick={() => setModo("ingresar")}>Ya tengo cuenta</button>}
        {modo !== "registro" && <button className="text-left underline" onClick={() => setModo("registro")}>Crear una cuenta</button>}
        {modo === "ingresar" && <button className="text-left underline" onClick={() => setModo("recuperar")}>Olvidé mi contraseña</button>}
      </div>
    </main>
  );
}
