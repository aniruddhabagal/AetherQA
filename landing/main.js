/* ─── LENIS + GSAP SCROLL STACK ─── */
(function () {
  "use strict";

  gsap.registerPlugin(ScrollTrigger);

  // Initialize Lenis with buttery, weighty feel
  const lenis = new Lenis({
    lerp: 0.08,
    smoothWheel: true,
  });

  // Feed Lenis RAF into GSAP ticker so ScrollTrigger stays in sync
  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add(function (time) {
    lenis.raf(time * 1000);
  });

  // Disable GSAP lag smoothing
  gsap.ticker.lagSmoothing(0);

  // Smooth scroll for anchor links — using lenis.scrollTo, NOT native behavior
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var target = document.querySelector(this.getAttribute("href"));
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -64 }); // offset for fixed nav
      }
    });
  });

  /* ─── ENTRANCE ANIMATIONS ─── */

  // Hero elements — stagger on load
  var heroTimeline = gsap.timeline({ delay: 0.2 });

  heroTimeline
    .from(".hero__badge", {
      y: 20,
      opacity: 0,
      duration: 0.6,
      ease: "power2.out",
    })
    .from(
      ".hero__title",
      {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
      },
      "-=0.3",
    )
    .from(
      ".hero__sub",
      {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
      },
      "-=0.35",
    )
    .from(
      ".hero__actions",
      {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
      },
      "-=0.3",
    )
    .from(
      ".hero__terminal",
      {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
      },
      "-=0.3",
    );

  // Terminal lines — typewriter-style stagger
  gsap.from(".terminal__body code", {
    opacity: 0,
    x: -10,
    duration: 0.4,
    stagger: 0.12,
    ease: "power2.out",
    delay: 1.2,
  });

  // Section headers — fade up on scroll
  gsap.utils.toArray(".section__header").forEach(function (header) {
    gsap.from(header, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      scrollTrigger: {
        trigger: header,
        start: "top 85%",
        toggleActions: "play none none none",
      },
    });
  });

  // Feature cards — stagger
  gsap.from(".feature-card", {
    y: 40,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".features__grid",
      start: "top 80%",
      toggleActions: "play none none none",
    },
  });

  // Pipeline steps — stagger
  gsap.from(".pipeline__step, .pipeline__connector", {
    y: 30,
    opacity: 0,
    duration: 0.5,
    stagger: 0.08,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".pipeline__flow",
      start: "top 80%",
      toggleActions: "play none none none",
    },
  });

  // Parallel pipeline section
  gsap.from(".pipeline__parallel", {
    y: 30,
    opacity: 0,
    duration: 0.6,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".pipeline__parallel",
      start: "top 85%",
      toggleActions: "play none none none",
    },
  });

  // How it works steps
  gsap.from(".step", {
    y: 40,
    opacity: 0,
    duration: 0.6,
    stagger: 0.12,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".steps",
      start: "top 80%",
      toggleActions: "play none none none",
    },
  });

  // Metric cards
  gsap.from(".metric-card", {
    y: 30,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".metrics__grid",
      start: "top 80%",
      toggleActions: "play none none none",
    },
  });

  // CTA section
  gsap.from(".cta__content", {
    y: 40,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
    scrollTrigger: {
      trigger: ".cta",
      start: "top 80%",
      toggleActions: "play none none none",
    },
  });

  // Nav background solidify on scroll
  var nav = document.querySelector(".nav");
  ScrollTrigger.create({
    start: "top -80",
    onUpdate: function (self) {
      if (self.direction === 1 && self.progress > 0) {
        nav.style.backgroundColor = "rgba(248, 247, 244, 0.95)";
      } else if (self.scroll() < 80) {
        nav.style.backgroundColor = "rgba(248, 247, 244, 0.85)";
      }
    },
  });
})();
