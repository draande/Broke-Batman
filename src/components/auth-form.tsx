"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import { Field, Mark } from "@/components/ui";
export function AuthForm({ register = false }: { register?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`auth/${register ? "register" : "login"}`, "POST", data);
      window.location.assign("/app");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError("");
    try {
      await api("auth/demo", "POST");
      window.location.assign("/app");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <Mark size={44} />
        <span>
          BROKE BATMAN<small>GOTHAM ISN&apos;T PAYING THE BILLS.</small>
        </span>
      </Link>
      <section className="panel auth-card">
        <div className="eyebrow">SECURE ACCESS</div>
        <h1>
          {register ? "Begin your next chapter." : "Welcome to the Batcave."}
        </h1>
        <p>
          {register
            ? "Your search. Your command center."
            : "A little less crime fighting. A little more career building."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <Field label="Name">
              <input name="name" autoComplete="name" required maxLength={100} />
            </Field>
          )}
          <Field label="Email">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </Field>
          <Field label="Password" hint="At least 12 characters.">
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={72}
              autoComplete={register ? "new-password" : "current-password"}
              required
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <ArrowRight size={17} />
            )}{" "}
            {register ? "Create account" : "Enter the Batcave"}
          </button>
        </form>
        <div className="auth-divider">OR EXPLORE FIRST</div>
        <button
          className="button secondary full"
          onClick={demo}
          disabled={busy}
        >
          Open a private demo workspace
        </button>
        <p className="auth-link">
          {register ? "Already have an account?" : "New to the Batcave?"}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <small className="muted">
          Demo uses fictional companies and an isolated temporary identity.
        </small>
      </section>
    </main>
  );
}
