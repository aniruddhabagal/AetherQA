import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  Code2,
  ShieldCheck,
  Mic,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  Github,
  Copy,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "./Landing.css";

gsap.registerPlugin(ScrollTrigger);

/* ─── Landing Page ─────────────────────────────────────────────────────────── */

export function Landing() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    /* ── Lenis smooth scroll ── */
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    /* ── Anchor links via Lenis ── */
    root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const target = document.querySelector(a.getAttribute("href")!);
        if (target) {
          e.preventDefault();
          lenis.scrollTo(target as HTMLElement, { offset: -72 });
        }
      });
    });

    /* ── Hero parallax ── */
    gsap.to("[data-hero-grid]", {
      yPercent: 30,
      ease: "none",
      scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
    });

    gsap.to("[data-hero-glow]", {
      yPercent: 20,
      scale: 1.15,
      ease: "none",
      scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
    });

    gsap.to("[data-hero-terminal]", {
      y: 80,
      ease: "none",
      scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true },
    });

    /* ── Hero entrance timeline ── */
    const heroTl = gsap.timeline({ delay: 0.15 });
    heroTl
      .from("[data-hero-badge]", { y: 20, opacity: 0, duration: 0.6, ease: "power2.out" })
      .from("[data-hero-title]", { y: 30, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.3")
      .from("[data-hero-sub]", { y: 20, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.35")
      .from("[data-hero-actions]", { y: 20, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.3")
      .from("[data-hero-terminal]", { y: 50, opacity: 0, duration: 0.9, ease: "power2.out" }, "-=0.3");

    /* ── Terminal lines typewriter ── */
    gsap.from("[data-terminal-line]", {
      opacity: 0, x: -8, duration: 0.4, stagger: 0.1, ease: "power2.out", delay: 1.1,
    });

    /* ── Proof bar ── */
    gsap.from("[data-proof]", {
      y: 20, opacity: 0, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: "[data-proof]", start: "top 92%", toggleActions: "play none none none" },
    });

    /* ── Section headers ── */
    root.querySelectorAll("[data-section-header]").forEach((el) => {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 0.8, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
      });
    });

    /* ── Feature cards with parallax offset ── */
    root.querySelectorAll<HTMLElement>("[data-feature-card]").forEach((card) => {
      const yOffset = Number(card.dataset.featureCard) || 20;
      gsap.from(card, {
        y: 50, opacity: 0, duration: 0.7, ease: "power2.out",
        scrollTrigger: { trigger: card, start: "top 88%", toggleActions: "play none none none" },
      });
      gsap.to(card, {
        y: yOffset,
        ease: "none",
        scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    /* ── Pipeline section parallax bg ── */
    gsap.to("[data-pipeline-grid]", {
      yPercent: 20,
      ease: "none",
      scrollTrigger: { trigger: "[data-pipeline]", start: "top bottom", end: "bottom top", scrub: true },
    });

    /* ── Pipeline steps stagger ── */
    gsap.from("[data-pipeline-step]", {
      y: 30, opacity: 0, duration: 0.5, stagger: 0.08, ease: "power2.out",
      scrollTrigger: { trigger: "[data-pipeline-flow]", start: "top 80%", toggleActions: "play none none none" },
    });

    gsap.from("[data-pipeline-parallel]", {
      y: 30, opacity: 0, duration: 0.6, ease: "power2.out",
      scrollTrigger: { trigger: "[data-pipeline-parallel]", start: "top 85%", toggleActions: "play none none none" },
    });

    /* ── How it works steps ── */
    gsap.from("[data-step]", {
      y: 40, opacity: 0, duration: 0.6, stagger: 0.12, ease: "power2.out",
      scrollTrigger: { trigger: "[data-steps]", start: "top 80%", toggleActions: "play none none none" },
    });

    /* ── Metrics parallax bg + cards ── */
    gsap.to("[data-metrics-grid-bg]", {
      yPercent: 20,
      ease: "none",
      scrollTrigger: { trigger: "[data-metrics]", start: "top bottom", end: "bottom top", scrub: true },
    });

    gsap.from("[data-metric-card]", {
      y: 30, opacity: 0, duration: 0.6, stagger: 0.1, ease: "power2.out",
      scrollTrigger: { trigger: "[data-metrics-grid]", start: "top 80%", toggleActions: "play none none none" },
    });

    /* ── CTA ── */
    gsap.from("[data-cta-content]", {
      y: 40, opacity: 0, duration: 0.8, ease: "power2.out",
      scrollTrigger: { trigger: "[data-cta]", start: "top 80%", toggleActions: "play none none none" },
    });

    /* ── Nav solidify ── */
    ScrollTrigger.create({
      start: "top -80",
      onUpdate(self) {
        const nav = document.getElementById("landing-nav");
        if (!nav) return;
        nav.style.backgroundColor = self.scroll() > 80
          ? "rgba(248, 247, 244, 0.96)"
          : "rgba(248, 247, 244, 0.8)";
      },
    });

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((st) => st.kill());
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  return (
    <div ref={rootRef} className="landing">

      {/* ── NAV ── */}
      <nav className="l-nav" id="landing-nav">
        <div className="l-nav__inner">
          <a href="#hero" className="l-nav__logo">
            <span className="l-nav__logo-mark">A</span>
            <span className="l-nav__logo-text">AetherQA</span>
          </a>
          <div className="l-nav__links">
            <a href="#features">Features</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#how-it-works">How It Works</a>
            <button className="l-nav__cta" onClick={() => navigate("/app")}>
              Open Dashboard
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="l-hero" id="hero" data-hero>
        <div className="l-hero__grid" data-hero-grid />
        <div className="l-hero__glow" data-hero-glow />

        <div className="l-hero__content">
          <div className="l-hero__badge" data-hero-badge>
            <span className="l-hero__badge-dot" />
            Autonomous QA System
          </div>
          <h1 className="l-hero__title" data-hero-title>
            QA that writes tests,<br />
            runs them, and <span className="l-hero__accent">heals itself.</span>
          </h1>
          <p className="l-hero__sub" data-hero-sub>
            A five-agent pipeline that crawls your app, generates test specs,
            writes Playwright scripts, self-heals broken selectors, and
            learns from every run.
          </p>
          <div className="l-hero__actions" data-hero-actions>
            <button className="l-btn l-btn--primary l-btn--lg" onClick={() => navigate("/app")}>
              Open Dashboard
              <ArrowRight size={16} strokeWidth={2} />
            </button>
            <a href="#pipeline" className="l-btn l-btn--ghost l-btn--lg">See the Pipeline</a>
          </div>
        </div>

        <div className="l-hero__terminal" data-hero-terminal>
          <div className="l-terminal">
            <div className="l-terminal__bar">
              <div className="l-terminal__dots">
                <span className="l-terminal__dot l-terminal__dot--r" />
                <span className="l-terminal__dot l-terminal__dot--y" />
                <span className="l-terminal__dot l-terminal__dot--g" />
              </div>
              <span className="l-terminal__title">aetherqa — run monitor</span>
            </div>
            <div className="l-terminal__body">
              {TERMINAL_LINES.map((line, i) => (
                <code key={i} data-terminal-line dangerouslySetInnerHTML={{ __html: line }} />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── PROOF ── */}
      <section className="l-proof" data-proof>
        <div className="l-proof__inner">
          <p className="l-proof__label">Built with</p>
          <div className="l-proof__items">
            {["LangGraph", "Playwright", "Mem0", "Gemini", "TypeScript"].map((t, i) => (
              <span key={t}>
                {i > 0 && <span className="l-proof__dot" />}
                <span className="l-proof__item">{t}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="l-section" id="features">
        <div className="l-section__inner">
          <div className="l-section__header" data-section-header>
            <span className="l-tag">Capabilities</span>
            <h2 className="l-section__title">Everything your QA team needs.<br />Nothing they don't.</h2>
            <p className="l-section__sub">Six capabilities, tightly integrated into a single pipeline. Each learns from every run.</p>
          </div>

          <div className="l-features">
            {FEATURES.map((f, i) => (
              <div key={i} className="l-feature" data-feature-card={f.parallax}>
                <div className="l-feature__icon">{f.icon}</div>
                <h3 className="l-feature__title">{f.title}</h3>
                <p className="l-feature__desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PIPELINE ── */}
      <section className="l-section l-pipeline-section" id="pipeline" data-pipeline>
        <div className="l-pipeline__grid-bg" data-pipeline-grid />
        <div className="l-section__inner">
          <div className="l-section__header" data-section-header>
            <span className="l-tag">Architecture</span>
            <h2 className="l-section__title">Five agents. One pipeline.</h2>
            <p className="l-section__sub">Each agent is a LangGraph subgraph with its own memory scope. They read context before acting and write learnings back after.</p>
          </div>

          <div className="l-pipeline" data-pipeline-flow>
            {PIPELINE_STEPS.map((step, i) => (
              <div key={i}>
                {i > 0 && <div className="l-pipeline__connector" data-pipeline-step />}
                <div className="l-pipeline__step" data-pipeline-step>
                  <div className="l-pipeline__num">{step.num}</div>
                  <div className="l-pipeline__content">
                    <h3>{step.title}</h3>
                    <p>{step.desc}</p>
                    {step.tag && <span className={`l-pipeline__tag ${step.tagClass ?? ""}`}>{step.tag}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="l-pipeline__parallel" data-pipeline-parallel>
            <div className="l-pipeline__parallel-label">Runs in parallel</div>
            <div className="l-pipeline__step">
              <div className="l-pipeline__num">5</div>
              <div className="l-pipeline__content">
                <h3>API Tester</h3>
                <p>Fetches OpenAPI spec, diffs against last run, generates contract + auth + validation tests for every endpoint.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="l-section" id="how-it-works">
        <div className="l-section__inner">
          <div className="l-section__header" data-section-header>
            <span className="l-tag">Workflow</span>
            <h2 className="l-section__title">From trigger to results in minutes.</h2>
          </div>

          <div className="l-steps" data-steps>
            {WORKFLOW_STEPS.map((s) => (
              <div key={s.num} className="l-step" data-step>
                <div className="l-step__num">{s.num}</div>
                <div className="l-step__line" />
                <div className="l-step__content">
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── METRICS ── */}
      <section className="l-section l-metrics-section" id="metrics" data-metrics>
        <div className="l-metrics__grid-bg" data-metrics-grid-bg />
        <div className="l-section__inner">
          <div className="l-section__header" data-section-header>
            <span className="l-tag">Impact</span>
            <h2 className="l-section__title">What changes for your QA team.</h2>
          </div>

          <div className="l-metrics" data-metrics-grid>
            {METRICS.map((m, i) => (
              <div key={i} className="l-metric" data-metric-card>
                <div className="l-metric__label">{m.label}</div>
                <div className="l-metric__row">
                  <span className="l-metric__before">{m.before}</span>
                  <ArrowRight size={18} strokeWidth={1.5} className="l-metric__arrow" />
                  <span className="l-metric__after">{m.after}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="l-section l-cta" id="get-started" data-cta>
        <div className="l-section__inner">
          <div className="l-cta__content" data-cta-content>
            <h2 className="l-cta__title">Stop writing tests by hand.</h2>
            <p className="l-cta__sub">AetherQA runs as a standalone Docker service. No changes to your codebase. Connect it to your staging URL and let it learn.</p>

            <div className="l-cta__code">
              <code><span className="t-dim">$</span> docker compose up -d</code>
              <button
                className="l-cta__copy"
                aria-label="Copy command"
                onClick={() => navigator.clipboard.writeText("docker compose up -d")}
              >
                <Copy size={14} strokeWidth={1.5} />
              </button>
            </div>

            <div className="l-cta__buttons">
              <a href="https://github.com/aniruddhabagal/aetherqa" className="l-btn l-btn--primary l-btn--lg" target="_blank" rel="noopener noreferrer">
                <Github size={18} strokeWidth={1.5} />
                View on GitHub
              </a>
              <button className="l-btn l-btn--ghost l-btn--lg" onClick={() => navigate("/app")}>
                Open Dashboard
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="l-footer">
        <div className="l-footer__inner">
          <div className="l-footer__brand">
            <span className="l-nav__logo-mark">A</span>
            <span>AetherQA</span>
          </div>
          <div className="l-footer__links">
            <a href="#features">Features</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#how-it-works">How It Works</a>
            <a href="https://github.com/aniruddhabagal/aetherqa" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <div className="l-footer__copy">Built for QA engineers who'd rather think than click.</div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const TERMINAL_LINES = [
  '<span class="t-dim">$</span> aetherqa run --mode feature --target staging.app.com',
  '<span class="t-accent">[Scoper]</span>    Mapped blast radius: /lessons, /dashboard, /api/progress',
  '<span class="t-accent">[Explorer]</span>  Crawled 12 routes, found voice input on /pronunciation',
  '<span class="t-accent">[TestCase]</span>  Generated 24 specs (18 feature, 6 regression)',
  '<span class="t-warn">[Waiting]</span>   Human review required — open dashboard to approve',
  '<span class="t-accent">[Approved]</span>  22 specs approved, 2 edited — resuming pipeline',
  '<span class="t-accent">[Auto]</span>      Running 22 Playwright tests across 4 workers\u2026',
  '<span class="t-pass">[Results]</span>   <span class="t-pass">22 passed</span>, <span class="t-heal">1 healed</span>, <span class="t-fail">1 escalated</span> — 0 flaky',
  '<span class="t-heal">[Heal]</span>      submit-btn selector updated \u2192 re-run passed',
  '<span class="t-dim">Run completed in 4m 12s. Memory updated with 3 new patterns.</span>',
];

const FEATURES = [
  { icon: <Search size={24} strokeWidth={1.5} />, title: "Autonomous Exploration", desc: "Crawls your app with a real browser, captures accessibility trees, intercepts API calls, and detects voice inputs, file uploads, and infinite scroll.", parallax: 20 },
  { icon: <FileText size={24} strokeWidth={1.5} />, title: "Spec Generation", desc: "Generates human-readable Markdown test specs with edge cases, preconditions, and expected outcomes. Your QA team reviews before any code runs.", parallax: -15 },
  { icon: <Code2 size={24} strokeWidth={1.5} />, title: "Playwright Code Gen", desc: "Writes real Playwright TypeScript tests from approved specs. Three templates — UI, voice, and API — run immediately and stream results live.", parallax: 25 },
  { icon: <ShieldCheck size={24} strokeWidth={1.5} />, title: "Self-Healing Tests", desc: "When selectors break after a deploy, the Maintenance agent reads your source from GitHub, finds the new selector, patches the test, and re-runs it.", parallax: -20 },
  { icon: <Mic size={24} strokeWidth={1.5} />, title: "Voice & Mic Testing", desc: "Mocks Web Speech API and getUserMedia. Tests happy paths and all error states — permission denied, no speech, network errors, silence, background noise.", parallax: 15 },
  { icon: <RefreshCw size={24} strokeWidth={1.5} />, title: "Persistent Memory", desc: "Learns from every run via Mem0. Remembers app structure, heal patterns, known bugs, and QA preferences. Gets measurably smarter over time.", parallax: -10 },
];

const PIPELINE_STEPS = [
  { num: "0", title: "Scoper", desc: "Parses feature description, reads git diff via GitHub MCP, maps direct scope + blast radius.", tag: "Feature mode only", tagClass: "" },
  { num: "1", title: "Explorer", desc: "Crawls scoped routes with Playwright, captures accessibility trees, intercepts network calls, reads React Router config from source." },
  { num: "2", title: "Test Case", desc: "Generates Markdown specs with edge cases derived from your real Zod schemas. Pipeline pauses for human review.", tag: "Human checkpoint", tagClass: "l-pipeline__tag--warn" },
  { num: "3", title: "Automation", desc: "Writes Playwright .spec.ts files from approved specs. Runs them across parallel workers. Streams results live via SSE." },
  { num: "4", title: "Maintenance", desc: "Triages failures, self-heals broken selectors using component source, quarantines flaky tests, escalates real bugs." },
];

const WORKFLOW_STEPS = [
  { num: "01", title: "Trigger a run", desc: "Choose full regression, smoke, or feature mode. Describe the feature in plain English. Hit start." },
  { num: "02", title: "Review AI specs", desc: "The system generates test specs and pauses. Your QA team reviews, edits edge cases, and approves." },
  { num: "03", title: "Watch tests run", desc: "Live SSE streaming shows each test as it passes or fails. Voice, UI, and API tests run together." },
  { num: "04", title: "Triage what matters", desc: "Broken selectors heal automatically. Real bugs surface with AI diagnosis, screenshots, and reproduction commands." },
];

const METRICS = [
  { label: "Feature spec writing", before: "2-4 hours", after: "~10 min review" },
  { label: "Test code authoring", before: "2-4 hours", after: "0 min" },
  { label: "Selector maintenance", before: "~40% of QA time", after: "Auto-healed" },
  { label: "Full regression run", before: "2-3 hours", after: "~5 min automated" },
];
