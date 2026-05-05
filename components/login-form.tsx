"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Mode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const serverError = typeof payload.error === "string" ? payload.error : "";

        if (response.status === 503) {
          throw new Error(
            "CarKeeper is temporarily unavailable because the database connection is offline. Please try again shortly."
          );
        }

        throw new Error(serverError || "Authentication failed.");
      }

      router.push("/");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="eyebrow">Secure Vehicle Records</div>
        <h1>Professional car tracking, now built for a modern full-stack workflow.</h1>
        <p>
          CarKeeper runs on Next.js and MongoDB so your UI, API routes, and deployment path
          live in one cleaner application.
        </p>

        <div className="feature-list">
          <div className="feature-item">
            <strong>Protected account access</strong>
            <span>Passwords are hashed and sessions are stored in secure HTTP-only cookies.</span>
          </div>
          <div className="feature-item">
            <strong>AWS-friendly deployment</strong>
            <span>Designed for HTTPS hosting on Amplify or another managed Next.js runtime.</span>
          </div>
          <div className="feature-item">
            <strong>One codebase</strong>
            <span>Frontend and backend now share a single React and TypeScript foundation.</span>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-switch">
            <button
              className={mode === "login" ? "switch-chip active" : "switch-chip"}
              onClick={() => setMode("login")}
              type="button"
            >
              Log In
            </button>
            <button
              className={mode === "register" ? "switch-chip active" : "switch-chip"}
              onClick={() => setMode("register")}
              type="button"
            >
              Create Account
            </button>
          </div>

          <h2>{mode === "login" ? "Sign in to CarKeeper" : "Create your CarKeeper account"}</h2>
          <p>
            {mode === "login"
              ? "Access your private dashboard to manage vehicles and service records."
              : "Start with a secure account so each vehicle record stays tied to its owner."}
          </p>

          {error ? <div className="status-card error">{error}</div> : null}

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="field-group">
              <label htmlFor="username">Username</label>
              <input
                autoComplete="username"
                id="username"
                onChange={(event) => setUsername(event.target.value)}
                required
                type="text"
                value={username}
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                id="password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            <button className="btn btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? "Working..."
                : mode === "login"
                  ? "Log In"
                  : "Create Account"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
