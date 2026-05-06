"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { trackEvent } from "@/lib/analytics";

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
  const passwordStrength = getPasswordStrength(password);

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

      trackEvent(mode === "login" ? "login_success" : "sign_up", {
        identifier_type: username.includes("@") ? "email" : "username"
      });
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
        <div className="brand-lockup">
          <div className="brand-mark">CarKeeper</div>
          <div className="brand-subheader">Maintenance made easy</div>
        </div>

        <div className="feature-list">
          <div className="feature-item">
            <strong>Clear maintenance view</strong>
            <span>Track service history, reminders, and mileage in one organized workflow.</span>
          </div>
          <div className="feature-item">
            <strong>Built for everyday use</strong>
            <span>Open the dashboard, update the record, and move on.</span>
          </div>
          <div className="feature-item">
            <strong>Analytics</strong>
            <span>Trends, costs, and overall garage activity all in one place.</span>
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
                placeholder={mode === "login" ? "Username or email" : "e.g. sebdriver"}
                required
                type="text"
                value={username}
              />
              <div className="field-hint">
                {mode === "login"
                  ? "You can sign in with either your username or your email address."
                  : "Pick a simple username people can recognize."}
              </div>
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
              {mode === "register" ? (
                <div className="password-guidance">
                  <span className={`password-strength password-strength-${passwordStrength.tone}`}>
                    {passwordStrength.label}
                  </span>
                  <span>Use at least 8 characters with a mix of uppercase, lowercase, numbers, and symbols.</span>
                </div>
              ) : null}
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

function getPasswordStrength(password: string) {
  if (!password) {
    return { label: "Use a strong password", tone: "neutral" as const };
  }

  let score = 0;

  if (password.length >= 8) {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  if (score <= 2) {
    return { label: "Weak password", tone: "weak" as const };
  }

  if (score === 3 || score === 4) {
    return { label: "Good password", tone: "good" as const };
  }

  return { label: "Strong password", tone: "strong" as const };
}
