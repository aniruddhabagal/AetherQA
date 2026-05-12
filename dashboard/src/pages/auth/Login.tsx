import { useState, type FormEvent, type ReactElement } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth.js";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--color-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    fontFamily: "var(--font-body)",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    padding: "32px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  brandName: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "var(--text-xl)",
    color: "var(--color-text)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: "var(--text-sm)",
    color: "var(--color-text-sub)",
    marginBottom: "28px",
  },
  fieldGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    color: "var(--color-text)",
    marginBottom: "6px",
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-body)",
    color: "var(--color-text)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  inputWithToggle: {
    paddingRight: "40px",
  },
  toggle: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--color-text-sub)",
    padding: "2px",
    display: "flex",
    alignItems: "center",
  },
  forgotRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "6px",
    marginBottom: "4px",
  },
  forgotLink: {
    fontSize: "var(--text-sm)",
    color: "var(--color-accent)",
    textDecoration: "none",
  },
  error: {
    fontSize: "var(--text-sm)",
    color: "var(--color-fail)",
    marginBottom: "12px",
    padding: "10px 12px",
    background: "rgba(217,48,37,0.06)",
    borderRadius: "6px",
    border: "1px solid rgba(217,48,37,0.15)",
  },
  btn: {
    width: "100%",
    padding: "11px",
    background: "var(--color-accent)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background 0.15s",
    marginTop: "8px",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "24px 0",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "var(--color-border)",
  },
  dividerText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-text-sub)",
    whiteSpace: "nowrap" as const,
  },
  footer: {
    textAlign: "center" as const,
    fontSize: "var(--text-sm)",
    color: "var(--color-text-sub)",
  },
  footerLink: {
    color: "var(--color-accent)",
    textDecoration: "none",
    fontWeight: 500,
  },
  spin: {
    animation: "spin 0.8s linear infinite",
  },
};

export function Login(): ReactElement {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-input:focus { border-color: var(--color-accent) !important; box-shadow: 0 0 0 3px var(--color-accent-light); }
        .auth-btn:hover:not(:disabled) { background: var(--color-accent-hover) !important; }
        .auth-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .auth-link:hover { text-decoration: underline; }
      `}</style>
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>
            <LayoutDashboard size={20} color="var(--color-accent)" strokeWidth={1.5} />
            <span style={styles.brandName}>AetherQA</span>
          </div>
          <p style={styles.subtitle}>Sign in to your workspace</p>

          <form onSubmit={handleSubmit} noValidate>
            <div style={styles.fieldGroup}>
              <label htmlFor="email" style={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                className="auth-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                style={{
                  ...styles.input,
                  borderColor: focused === "email" ? "var(--color-accent)" : "var(--color-border)",
                }}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="password" style={styles.label}>Password</label>
              <div style={styles.inputWrap}>
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  className="auth-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  style={{
                    ...styles.input,
                    ...styles.inputWithToggle,
                    borderColor: focused === "password" ? "var(--color-accent)" : "var(--color-border)",
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  style={styles.toggle}
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw
                    ? <EyeOff size={16} strokeWidth={1.5} />
                    : <Eye size={16} strokeWidth={1.5} />}
                </button>
              </div>
              <div style={styles.forgotRow}>
                <Link to="/auth/forgot-password" style={styles.forgotLink} className="auth-link">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && <p style={styles.error} role="alert">{error}</p>}

            <button
              type="submit"
              className="auth-btn"
              style={styles.btn}
              disabled={loading}
            >
              {loading && <Loader2 size={16} strokeWidth={1.5} style={styles.spin} />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or</span>
            <div style={styles.dividerLine} />
          </div>

          <p style={styles.footer}>
            Don't have an account?{" "}
            <Link to="/auth/register" style={styles.footerLink} className="auth-link">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
