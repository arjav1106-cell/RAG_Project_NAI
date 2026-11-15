import { useState, type FormEvent } from "react";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export function AuthPage({
  createAccount = false,
}: {
  createAccount?: boolean;
}) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(createAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signIn(email, password, isRegistering);
      navigate("/");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "We couldn't connect. Check the server and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <div className="brand-mark">
            <ShieldCheck size={21} />
          </div>
          <span>vahana</span>
        </div>
        <div className="auth-story">
          <span className="eyebrow light">
            <Sparkles size={14} /> INSURANCE, WITH CLARITY
          </span>
          <h1>
            Every vehicle.
            <br />
            One clear view.
          </h1>
          <p>
            Keep your policies together, understand the details, and know what
            needs attention next.
          </p>
          <div className="auth-points">
            <div>
              <Check size={15} /> One garage for every vehicle
            </div>
            <div>
              <Check size={15} /> Policy answers with source citations
            </div>
            <div>
              <Check size={15} /> Your documents stay in your workspace
            </div>
          </div>
        </div>
        <div className="auth-brand-foot">
          MADE FOR THE ROAD AHEAD <span>INDIA · MOTOR INSURANCE</span>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <div className="brand-mark">
              <ShieldCheck size={21} />
            </div>
            <span>vahana</span>
          </div>
          <span className="eyebrow">YOUR PRIVATE INSURANCE SPACE</span>
          <h2>{isRegistering ? "Create your account" : "Welcome back"}</h2>
          <p className="auth-subtitle">
            {isRegistering
              ? "Start bringing all your vehicle cover into one place."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <div className="password-label">
              <label htmlFor="password">Password</label>
              {isRegistering && <span>10 characters or more</span>}
            </div>
            <input
              id="password"
              type="password"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={isRegistering ? 10 : undefined}
              required
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && (
              <div role="alert" className="inline-error">
                {error}
              </div>
            )}
            <button
              className="button button-primary auth-submit"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Please wait…"
                : isRegistering
                  ? "Create account"
                  : "Sign in"}
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="auth-switch">
            {isRegistering ? "Already have an account?" : "New to Vahana?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegistering((value) => !value);
                setError("");
              }}
            >
              {isRegistering ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="auth-privacy">
            <ShieldCheck size={16} /> Private by design. Your policy files
            aren't public links.
          </div>
        </div>
      </section>
    </main>
  );
}
