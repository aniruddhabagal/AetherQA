import { useState, type FormEvent, type ReactElement } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LayoutDashboard, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth.js";

function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length === 0) return { level: 0, label: "", color: "transparent" };
  if (pw.length < 8) return { level: 1, label: "Too short", color: "var(--color-fail)" };
  if (pw.length < 12) return { level: 2, label: "Fair", color: "var(--color-warn)" };
  return { level: 3, label: "Strong", color: "var(--color-pass)" };
}

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
  labelOptional: {
    fontWeight: 400,
    color: "var(--color-text-sub)",
    marginLeft: "4px",
    fontSize: "var(--text-xs)",
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
  strengthBar: {
    marginTop: "6px",
    height: "3px",
    borderRadius: "2px",
    background: "var(--color-border)",
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.2s, background 0.2s",
  },
  strengthLabel: {
    fontSize: "var(--text-xs)",
    marginTop: "4px",
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
  footer: {
    textAlign: "center" as const,
    fontSize: "var(--text-sm)",
    color: "var(--color-text-sub)",
    marginTop: "20px",
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

export function Register(): ReactElement {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const strength = getStrength(password);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    if (strength.level === 1) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register({ email, password, name, orgName: orgName || undefined });
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function inputStyle(field: string): React.CSSProperties {
    return {
      ...styles.input,
      borderColor: focused === field ? "var(--color-accent)" : "var(--color-border)",
    };
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
          <p style={styles.subtitle}>Create your account</p>

          <form onSubmit={handleSubmit} noValidate>
            <div style={styles.fieldGroup}>
              <label htmlFor="name" style={styles.label}>Full name</label>
              <input
                id="name"
                type="text"
                className="auth-input"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
                style={inputStyle("name")}
                placeholder="Ada Lovelace"
                autoComplete="name"
                required
              />
            </div>

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
                style={inputStyle("email")}
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
                    ...inputStyle("password"),
                    ...styles.inputWithToggle,
                  }}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
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
              {password.length > 0 && (
                <div>
                  <div style={styles.strengthBar}>
                    <div
                      style={{
                        ...styles.strengthFill,
                        width: `${(strength.level / 3) * 100}%`,
                        background: strength.color,
                      }}
                    />
                  </div>
                  <p style={{ ...styles.strengthLabel, color: strength.color }}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div style={styles.fieldGroup}>
              <label htmlFor="orgName" style={styles.label}>
                Organization
                <span style={styles.labelOptional}>optional</span>
              </label>
              <input
                id="orgName"
                type="text"
                className="auth-input"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                onFocus={() => setFocused("orgName")}
                onBlur={() => setFocused(null)}
                style={inputStyle("orgName")}
                placeholder="Personal workspace"
                autoComplete="organization"
              />
            </div>

            {error && <p style={styles.error} role="alert">{error}</p>}

            <button
              type="submit"
              className="auth-btn"
              style={styles.btn}
              disabled={loading}
            >
              {loading && <Loader2 size={16} strokeWidth={1.5} style={styles.spin} />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p style={styles.footer}>
            Already have an account?{" "}
            <Link to="/auth/login" style={styles.footerLink} className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
