"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Mode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ displayName, email, username, password })
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
        <div className="eyebrow">CarKeeper</div>
        <h1>Vehicle records, without the clutter.</h1>
        <p>Sign in to manage mileage, service history, and maintenance planning in one place.</p>

        <div className="feature-list">
          <div className="feature-item">
            <strong>Private by default</strong>
            <span>Each garage stays tied to its owner account.</span>
          </div>
          <div className="feature-item">
            <strong>Clear maintenance view</strong>
            <span>Recent service, reminders, and mileage live in one workflow.</span>
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
              ? "Access your dashboard."
              : "Create an account to start your garage."}
          </p>

          {error ? <div className="status-card error">{error}</div> : null}

          <form className="form-grid" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <>
                <div className="field-group">
                  <label htmlFor="displayName">Display Name</label>
                  <input
                    autoComplete="name"
                    id="displayName"
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    type="text"
                    value={displayName}
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="email">Email</label>
                  <input
                    autoComplete="email"
                    id="email"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>
              </>
            ) : null}

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
