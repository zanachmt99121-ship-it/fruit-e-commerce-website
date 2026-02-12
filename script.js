/* =========================================================
   Kurdistan — Tourism, History & Culture (Luxury UI)
   File: js/script.js

   Features:
   - Smooth scrolling + active section highlighting
   - Mobile navigation (panel) with focus trapping + ESC close
   - Overlays/Modals: Search, Weather, Planner, Gallery lightbox, Article reader
   - IntersectionObserver reveal-on-scroll animation system
   - Dynamic Weather widget for Kurdish cities (Open-Meteo, no API key)
   - Interactive sliders (scroll-snap + buttons + keyboard + drag assist)
   - Gallery filtering + compact view toggle
   - News filtering/search + pagination simulation + modal reader
   - Form UX: Contact + Newsletter (validation + status)
   - Accessibility: ARIA, focus management, reduced motion support

   Notes:
   - This script is defensive: it only wires features if matching DOM nodes exist.
   - Weather uses Open-Meteo endpoints; requires internet access.
   ========================================================= */

(() => {
  "use strict";

  /* -----------------------------
     0) Helpers / Utilities
  ------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const isReducedMotion = () => {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const rafThrottle = (fn) => {
    let rafId = 0;
    let lastArgs = null;
    return (...args) => {
      lastArgs = args;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        fn(...lastArgs);
      });
    };
  };

  const debounce = (fn, wait = 250) => {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const nowMs = () => Date.now();

  const safeJsonParse = (str, fallback = null) => {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  };

  const setText = (el, txt) => {
    if (!el) return;
    el.textContent = String(txt ?? "");
  };

  const setHTML = (el, html) => {
    if (!el) return;
    el.innerHTML = String(html ?? "");
  };

  const addClass = (el, cls) => el && el.classList.add(cls);
  const removeClass = (el, cls) => el && el.classList.remove(cls);
  const toggleClass = (el, cls, force) => el && el.classList.toggle(cls, force);

  const isHidden = (el) => !el || el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true";

  const setHidden = (el, hidden) => {
    if (!el) return;
    if (hidden) {
      el.setAttribute("hidden", "");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.removeAttribute("hidden");
      el.setAttribute("aria-hidden", "false");
    }
  };

  const qsIn = (root, ...sels) => {
    for (const s of sels) {
      const n = root ? root.querySelector(s) : null;
      if (n) return n;
    }
    return null;
  };

  const qsaIn = (root, ...sels) => {
    for (const s of sels) {
      const nodes = root ? root.querySelectorAll(s) : [];
      if (nodes && nodes.length) return Array.from(nodes);
    }
    return [];
  };

  const disableBodyScroll = (() => {
    let lockCount = 0;
    let prevOverflow = "";
    let prevPaddingRight = "";
    let prevTouchAction = "";

    const scrollbarWidth = () => {
      const w = window.innerWidth - document.documentElement.clientWidth;
      return w > 0 ? w : 0;
    };

    return {
      lock() {
        lockCount += 1;
        if (lockCount !== 1) return;

        prevOverflow = document.body.style.overflow;
        prevPaddingRight = document.body.style.paddingRight;
        prevTouchAction = document.body.style.touchAction;

        const sw = scrollbarWidth();
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        if (sw) document.body.style.paddingRight = `${sw}px`;
      },
      unlock() {
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount !== 0) return;

        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPaddingRight;
        document.body.style.touchAction = prevTouchAction;
      },
      get locked() {
        return lockCount > 0;
      },
    };
  })();

  const focusableSelector =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), details summary, [tabindex]:not([tabindex="-1"])';

  const trapFocus = (container) => {
    if (!container) return () => {};
    const getFocusable = () => $$(focusableSelector, container).filter((el) => el.offsetParent !== null);
    const keyHandler = (e) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };
    container.addEventListener("keydown", keyHandler);
    return () => container.removeEventListener("keydown", keyHandler);
  };

  const smoothScrollTo = (targetEl, offset = 0) => {
    if (!targetEl) return;
    const y = targetEl.getBoundingClientRect().top + window.pageYOffset - offset;
    const behavior = isReducedMotion() ? "auto" : "smooth";
    window.scrollTo({ top: y, behavior });
  };

  const formatNumber = (n, digits = 0) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "—";
    return num.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  const formatDateShort = (d) => {
    try {
      const dt = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(dt.getTime())) return "—";
      return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return "—";
    }
  };

  const formatTimeShort = (d) => {
    try {
      const dt = d instanceof Date ? d : new Date(d);
      if (Number.isNaN(dt.getTime())) return "—";
      return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  const escapeHtml = (str) => {
    const s = String(str ?? "");
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  };

  const dispatch = (name, detail = {}) => {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  };

  /* -----------------------------
     1) App State / Config
  ------------------------------ */
  const APP = {
    version: "1.0.0",
    selectors: {
      // Header / nav
      header: ".header",
      topbar: ".topbar",
      navLinks: ".nav__link, [data-nav-link], a[data-scroll]",
      navToggle: ".nav-toggle, [data-nav-toggle]",
      mobileNav: ".mobile-nav",
      mobileNavInner: ".mobile-nav__inner",
      mobileNavClose: "[data-mobile-close], .mobile-nav [data-close]",
      mobileNavLink: ".mobile-nav__link, .mobile-nav a[href^='#']",

      // Overlays
      overlay: ".overlay",
      overlayBackdrop: ".overlay__backdrop",
      overlayPanel: ".overlay__panel",
      overlayClose: "[data-close-overlay], [data-close], .overlay [aria-label='Close']",

      // Specific overlays (IDs are preferred; fallbacks are class/data)
      searchOverlay: "#searchOverlay, [data-overlay='search']",
      weatherOverlay: "#weatherOverlay, [data-overlay='weather']",
      plannerOverlay: "#plannerOverlay, [data-overlay='planner']",
      galleryModal: "#galleryModal, .modal--gallery, [data-modal='gallery']",
      articleModal: "#articleModal, .modal--article, [data-modal='article']",

      // Hero
      hero: ".hero",
      toTop: ".to-top, [data-to-top]",
      scrollIndicator: ".hero__scroll-indicator",

      // Reveal
      reveal: ".reveal, [data-reveal]",

      // Slider
      slider: ".slider, [data-slider]",
      sliderViewport: ".slider__viewport, [data-slider-viewport]",
      sliderTrack: ".slider__track, [data-slider-track]",
      sliderPrev: "[data-slider-prev]",
      sliderNext: "[data-slider-next]",
      sliderBar: ".slider__bar, [data-slider-bar]",

      // Gallery
      gallery: ".gallery, [data-gallery]",
      galleryGrid: ".gallery__grid, [data-gallery-grid]",
      galleryItem: ".gallery-card, [data-gallery-item]",
      galleryBtn: ".gallery-card__btn, [data-gallery-open]",
      galleryFilters: ".gallery__filters, [data-gallery-filters]",
      galleryFilterBtn: "[data-gallery-filter]",
      galleryCompactToggle: "[data-gallery-compact]",

      // News
      news: ".news, [data-news]",
      newsGrid: ".news__grid, [data-news-grid]",
      newsCard: ".news-card, [data-news-card]",
      newsFilterBtn: "[data-news-filter]",
      newsSearchInput: ".news__search-input, [data-news-search]",
      newsSearchBtn: ".news__search-btn, [data-news-search-btn]",
      newsPrev: "[data-news-prev]",
      newsNext: "[data-news-next]",
      newsPage: ".news__page, [data-news-page]",
      readMoreBtn: "[data-read-article]",

      // Forms
      contactForm: "form[data-contact], form#contactForm, .contact form",
      newsletterForm: "form[data-newsletter], form#newsletterForm, .newsletter",
      formStatus: "[data-status]",

      // Theme toggle
      themeToggle: "[data-theme-toggle], #themeToggle",
    },

    storageKeys: {
      theme: "kurdistan_theme",
      weatherCache: "kurdistan_weather_cache",
      weatherUnits: "kurdistan_weather_units",
      lastCity: "kurdistan_weather_city",
      galleryCompact: "kurdistan_gallery_compact",
      newsPage: "kurdistan_news_page",
    },

    // Kurdish region/cities: approximate coordinates for weather
    cities: [
      { id: "erbil", name: "Erbil (Hewlêr)", country: "Iraq", lat: 36.1911, lon: 44.0092 },
      { id: "sulaymaniyah", name: "Sulaymaniyah (Silêmanî)", country: "Iraq", lat: 35.5653, lon: 45.4329 },
      { id: "duhok", name: "Duhok (Dihok)", country: "Iraq", lat: 36.8667, lon: 42.95 },
      { id: "halabja", name: "Halabja", country: "Iraq", lat: 35.1815, lon: 45.9866 },
      { id: "zakho", name: "Zakho", country: "Iraq", lat: 37.1431, lon: 42.6861 },
      { id: "kirkuk", name: "Kirkuk", country: "Iraq", lat: 35.4681, lon: 44.3922 },
    ],

    // Open-Meteo endpoints
    weather: {
      base: "https://api.open-meteo.com/v1/forecast",
      // We'll request current + hourly for a compact mini forecast
      params: {
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
        hourly: "temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m",
        timezone: "auto",
        forecast_hours: 24,
      },
      cacheTtlMs: 10 * 60 * 1000, // 10 minutes
    },

    // News simulation parameters
    news: {
      perPage: 6,
      maxPage: 4,
    },
  };

  const STATE = {
    headerOffset: 0,
    currentOverlay: null,
    overlayStack: [],
    untrap: null,
    lastFocus: null,
    sliderInstances: [],
    revealObserver: null,
    sectionObserver: null,
    activeSectionId: null,

    weather: {
      units: "c", // 'c' or 'f'
      cityId: null,
      cache: {}, // keyed by `${cityId}_${units}`
      isLoading: false,
      lastError: null,
    },

    gallery: {
      filter: "all",
      compact: false,
      items: [],
      currentIndex: 0,
    },

    news: {
      filter: "all",
      query: "",
      page: 1,
      items: [],
    },
  };

  /* -----------------------------
     2) DOM Ready + Boot
  ------------------------------ */
  const ready = (fn) => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  };

  ready(() => {
    loadPersistedState();
    computeHeaderOffset();
    bindGlobalListeners();
    initTheme();
    initSmoothScrolling();
    initRevealOnScroll();
    initSectionActiveHighlight();
    initMobileNav();
    initOverlays();
    initSliders();
    initGallery();
    initNews();
    initForms();
    initToTop();
    initOptionalGsapEnhancements();
    dispatch("kurdistan:ready", { version: APP.version });
  });

  /* -----------------------------
     3) Persisted State
  ------------------------------ */
  function loadPersistedState() {
    // Theme
    const theme = localStorage.getItem(APP.storageKeys.theme);
    if (theme === "light" || theme === "dark") {
      toggleClass(document.body, "is-light", theme === "light");
    }

    // Weather units + last city
    const units = localStorage.getItem(APP.storageKeys.weatherUnits);
    if (units === "c" || units === "f") STATE.weather.units = units;

    const lastCity = localStorage.getItem(APP.storageKeys.lastCity);
    if (lastCity) STATE.weather.cityId = lastCity;

    // Weather cache
    const cacheRaw = localStorage.getItem(APP.storageKeys.weatherCache);
    const cache = safeJsonParse(cacheRaw, {});
    if (cache && typeof cache === "object") STATE.weather.cache = cache;

    // Gallery compact
    const compactRaw = localStorage.getItem(APP.storageKeys.galleryCompact);
    STATE.gallery.compact = compactRaw === "1";

    // News page
    const pageRaw = localStorage.getItem(APP.storageKeys.newsPage);
    const pageNum = Number(pageRaw);
    if (Number.isFinite(pageNum) && pageNum >= 1) STATE.news.page = Math.floor(pageNum);
  }

  function persistTheme() {
    localStorage.setItem(APP.storageKeys.theme, document.body.classList.contains("is-light") ? "light" : "dark");
  }

  function persistWeatherSettings() {
    localStorage.setItem(APP.storageKeys.weatherUnits, STATE.weather.units);
    if (STATE.weather.cityId) localStorage.setItem(APP.storageKeys.lastCity, STATE.weather.cityId);
  }

  function persistWeatherCache() {
    try {
      localStorage.setItem(APP.storageKeys.weatherCache, JSON.stringify(STATE.weather.cache));
    } catch {
      // Ignore quota errors
    }
  }

  function persistGalleryCompact() {
    localStorage.setItem(APP.storageKeys.galleryCompact, STATE.gallery.compact ? "1" : "0");
  }

  function persistNewsPage() {
    localStorage.setItem(APP.storageKeys.newsPage, String(STATE.news.page));
  }

  /* -----------------------------
     4) Header Offset (for scroll)
  ------------------------------ */
  function computeHeaderOffset() {
    const header = $(APP.selectors.header);
    const topbar = $(APP.selectors.topbar);
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
    // Some layouts have both topbar + sticky header, so offset is their combined heights.
    STATE.headerOffset = Math.round(headerH + topbarH + 12);
  }

  function bindGlobalListeners() {
    window.addEventListener("resize", rafThrottle(computeHeaderOffset), { passive: true });

    // ESC closes overlay/modals
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (STATE.overlayStack.length) {
        closeTopOverlay();
      } else {
        const mobileNav = $(APP.selectors.mobileNav);
        if (mobileNav && !isHidden(mobileNav)) closeMobileNav();
      }
    });

    // Close overlays by clicking backdrop
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;

      // Overlay backdrop click
      const overlay = target.closest(APP.selectors.overlay);
      if (overlay && (target.matches(APP.selectors.overlayBackdrop) || target === overlay)) {
        // Only close if click is on backdrop area, not inside panel
        const panel = $(APP.selectors.overlayPanel, overlay);
        if (panel && panel.contains(target)) return;
        closeOverlay(overlay);
      }

      // Modal backdrop click
      const modal = target.closest(".modal");
      if (modal && (target.matches(".modal__backdrop") || target === modal)) {
        const panel = $(".modal__panel", modal);
        if (panel && panel.contains(target)) return;
        closeModal(modal);
      }

      // Close buttons
      if (target.matches(APP.selectors.overlayClose) || target.closest(APP.selectors.overlayClose)) {
        const ov = target.closest(APP.selectors.overlay);
        if (ov) closeOverlay(ov);
      }
      if (target.matches("[data-close-modal], .modal [data-close], .modal [aria-label='Close']") || target.closest("[data-close-modal], .modal [data-close], .modal [aria-label='Close']")) {
        const md = target.closest(".modal");
        if (md) closeModal(md);
      }
    });
  }

  /* -----------------------------
     5) Theme Toggle
  ------------------------------ */
  function initTheme() {
    const btn = $(APP.selectors.themeToggle);
    if (!btn) return;

    btn.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("is-light");
      btn.setAttribute("aria-pressed", isLight ? "true" : "false");
      persistTheme();
      dispatch("kurdistan:theme", { theme: isLight ? "light" : "dark" });
    });

    btn.setAttribute("aria-pressed", document.body.classList.contains("is-light") ? "true" : "false");
  }

  /* -----------------------------
     6) Smooth Scrolling (enhanced)
  ------------------------------ */
  function initSmoothScrolling() {
    const header = $(APP.selectors.header);
    const offset = () => (header ? STATE.headerOffset : 0);

    // Handle anchor clicks
    document.addEventListener("click", (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[href^='#']") : null;
      if (!a) return;

      const href = a.getAttribute("href") || "";
      if (!href.startsWith("#") || href === "#") return;
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      // Close mobile nav if open
      closeMobileNav();
      // Close overlays if any (optional behavior)
      if (STATE.overlayStack.length) closeTopOverlay();

      smoothScrollTo(target, offset());
      history.pushState(null, "", `#${encodeURIComponent(id)}`);
    });

    // Improve scroll behavior when opening page with hash
    if (location.hash && location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id);
      if (target) {
        // Delay to allow layout settle
        setTimeout(() => smoothScrollTo(target, offset()), 50);
      }
    }
  }

  /* -----------------------------
     7) Reveal on Scroll (IntersectionObserver)
  ------------------------------ */
  function initRevealOnScroll() {
    const nodes = $$(APP.selectors.reveal);
    if (!nodes.length) return;

    // Ensure reveal baseline class
    nodes.forEach((el) => {
      if (!el.classList.contains("reveal")) el.classList.add("reveal");
    });

    if (!("IntersectionObserver" in window) || isReducedMotion()) {
      nodes.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((ent) => {
          if (!ent.isIntersecting) return;
          const el = ent.target;
          // Optional delay from data-delay (ms)
          const delay = el.getAttribute("data-delay");
          if (delay) el.style.transitionDelay = `${clamp(Number(delay) || 0, 0, 1200)}ms`;
          el.classList.add("is-in");
          observer.unobserve(el);
        });
      },
      { root: null, threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((el) => observer.observe(el));
    STATE.revealObserver = observer;
  }

  /* -----------------------------
     8) Active Section Highlight
  ------------------------------ */
  function initSectionActiveHighlight() {
    const navLinks = $$(APP.selectors.navLinks).filter((a) => a instanceof HTMLAnchorElement);
    if (!navLinks.length) return;

    const sectionIds = navLinks
      .map((a) => (a.getAttribute("href") || "").trim())
      .filter((h) => h.startsWith("#") && h.length > 1)
      .map((h) => decodeURIComponent(h.slice(1)));

    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el) => el && el instanceof HTMLElement);

    if (!sections.length || !("IntersectionObserver" in window)) return;

    const mapLinks = new Map();
    navLinks.forEach((a) => {
      const href = (a.getAttribute("href") || "").trim();
      if (href.startsWith("#") && href.length > 1) mapLinks.set(decodeURIComponent(href.slice(1)), a);
    });

    const setActive = (id) => {
      if (!id || STATE.activeSectionId === id) return;
      STATE.activeSectionId = id;

      // Clear
      mapLinks.forEach((link) => link.classList.remove("is-active"));
      // Set
      const activeLink = mapLinks.get(id);
      if (activeLink) activeLink.classList.add("is-active");

      dispatch("kurdistan:section", { id });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // Choose the most visible intersecting section
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;

        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0].target;
        if (top && top.id) setActive(top.id);
      },
      {
        root: null,
        threshold: [0.12, 0.22, 0.35, 0.5, 0.66],
        rootMargin: `-${Math.round(STATE.headerOffset)}px 0px -55% 0px`,
      }
    );

    sections.forEach((sec) => observer.observe(sec));
    STATE.sectionObserver = observer;

    // Set initial
    if (location.hash && location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1));
      if (document.getElementById(id)) setActive(id);
    } else {
      setActive(sections[0].id);
    }
  }

  /* -----------------------------
     9) Mobile Navigation
  ------------------------------ */
  function initMobileNav() {
    const toggleBtn = $(APP.selectors.navToggle);
    const mobileNav = $(APP.selectors.mobileNav);
    if (!toggleBtn || !mobileNav) return;

    setHidden(mobileNav, true);

    toggleBtn.addEventListener("click", () => {
      if (isHidden(mobileNav)) openMobileNav();
      else closeMobileNav();
    });

    // Close when clicking nav links
    mobileNav.addEventListener("click", (e) => {
      const link = e.target instanceof Element ? e.target.closest(APP.selectors.mobileNavLink) : null;
      if (!link) return;
      closeMobileNav();
    });

    // Close button (if any)
    const closeBtn = $(APP.selectors.mobileNavClose, mobileNav);
    if (closeBtn) closeBtn.addEventListener("click", closeMobileNav);

    // Backdrop click handled globally, but ensure direct click on container closes
    mobileNav.addEventListener("click", (e) => {
      if (!(e.target instanceof Element)) return;
      const panel = $(APP.selectors.mobileNavInner, mobileNav);
      if (panel && panel.contains(e.target)) return;
      closeMobileNav();
    });

    function openMobileNav() {
      STATE.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setHidden(mobileNav, false);
      mobileNav.setAttribute("role", "dialog");
      mobileNav.setAttribute("aria-modal", "true");
      toggleBtn.setAttribute("aria-expanded", "true");
      disableBodyScroll.lock();

      const panel = $(APP.selectors.mobileNavInner, mobileNav) || mobileNav;
      STATE.untrap = trapFocus(panel);

      // Focus first focusable
      const first = $(focusableSelector, panel);
      if (first) first.focus({ preventScroll: true });
    }

    function closeMobileNav() {
      if (!mobileNav || isHidden(mobileNav)) return;
      setHidden(mobileNav, true);
      toggleBtn.setAttribute("aria-expanded", "false");
      if (STATE.untrap) {
        STATE.untrap();
        STATE.untrap = null;
      }
      disableBodyScroll.unlock();
      if (STATE.lastFocus) {
        try {
          STATE.lastFocus.focus({ preventScroll: true });
        } catch {}
      }
      STATE.lastFocus = null;
    }

    // Expose to outer scope
    window.__kurdistanCloseMobileNav = closeMobileNav;
    window.__kurdistanOpenMobileNav = openMobileNav;
  }

  function closeMobileNav() {
    if (typeof window.__kurdistanCloseMobileNav === "function") window.__kurdistanCloseMobileNav();
  }

  /* -----------------------------
     10) Overlays / Modals System
  ------------------------------ */
  function initOverlays() {
    // Wire "open overlay" triggers via data attributes:
    // data-open="search|weather|planner"
    // data-overlay-target="#searchOverlay"
    document.addEventListener("click", (e) => {
      const t = e.target instanceof Element ? e.target.closest("[data-open], [data-overlay-target], [data-open-modal], [data-modal-target]") : null;
      if (!t) return;

      // Overlay open
      const openName = t.getAttribute("data-open");
      const overlayTarget = t.getAttribute("data-overlay-target");
      if (openName || overlayTarget) {
        e.preventDefault();
        const overlay = overlayTarget ? $(overlayTarget) : openName === "search" ? $(APP.selectors.searchOverlay) : openName === "weather" ? $(APP.selectors.weatherOverlay) : openName === "planner" ? $(APP.selectors.plannerOverlay) : null;
        if (overlay) openOverlay(overlay, { focusSelector: t.getAttribute("data-focus") || null });
        return;
      }

      // Modal open
      const modalTarget = t.getAttribute("data-modal-target");
      const openModal = t.getAttribute("data-open-modal");
      if (openModal || modalTarget) {
        e.preventDefault();
        const modal = modalTarget ? $(modalTarget) : openModal === "gallery" ? $(APP.selectors.galleryModal) : openModal === "article" ? $(APP.selectors.articleModal) : null;
        if (modal) openModalDialog(modal, { focusSelector: t.getAttribute("data-focus") || null });
      }
    });

    // Pre-initialize overlays hidden
    const overlays = $$(APP.selectors.overlay);
    overlays.forEach((ov) => {
      if (!ov.hasAttribute("hidden")) setHidden(ov, true);
      ov.setAttribute("aria-hidden", "true");
    });

    // Pre-initialize modals hidden
    const modals = $$(".modal");
    modals.forEach((md) => {
      if (!md.hasAttribute("hidden")) setHidden(md, true);
      md.setAttribute("aria-hidden", "true");
    });

    // Specific overlay inits
    initSearchOverlay();
    initWeatherOverlay();
    initPlannerOverlay();
    initGalleryModal();
    initArticleModal();
  }

  function openOverlay(overlay, opts = {}) {
    if (!overlay) return;
    // Close mobile nav first
    closeMobileNav();

    // If another overlay open, stack
    STATE.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    setHidden(overlay, false);
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");

    const panel = $(APP.selectors.overlayPanel, overlay) || overlay;
    disableBodyScroll.lock();

    const untrap = trapFocus(panel);
    STATE.overlayStack.push({ el: overlay, untrap, type: "overlay" });
    STATE.currentOverlay = overlay;

    // Focus
    const focusSel = opts.focusSelector;
    const focusEl = focusSel ? $(focusSel, overlay) : $(focusableSelector, panel);
    if (focusEl) focusEl.focus({ preventScroll: true });

    dispatch("kurdistan:overlay:open", { id: overlay.id || null });
  }

  function closeOverlay(overlay) {
    if (!overlay || isHidden(overlay)) return;

    // Find in stack
    const idx = STATE.overlayStack.findIndex((x) => x.el === overlay);
    if (idx !== -1) {
      const item = STATE.overlayStack[idx];
      if (item.untrap) item.untrap();
      STATE.overlayStack.splice(idx, 1);
    }

    setHidden(overlay, true);
    overlay.setAttribute("aria-hidden", "true");

    disableBodyScroll.unlock();

    // restore focus to previous if no more overlays/modals
    if (!STATE.overlayStack.length && STATE.lastFocus) {
      try {
        STATE.lastFocus.focus({ preventScroll: true });
      } catch {}
      STATE.lastFocus = null;
    }

    STATE.currentOverlay = STATE.overlayStack.length ? STATE.overlayStack[STATE.overlayStack.length - 1].el : null;
    dispatch("kurdistan:overlay:close", { id: overlay.id || null });
  }

  function closeTopOverlay() {
    if (!STATE.overlayStack.length) return;
    const top = STATE.overlayStack[STATE.overlayStack.length - 1];
    if (!top) return;
    if (top.type === "modal") closeModal(top.el);
    else closeOverlay(top.el);
  }

  function openModalDialog(modal, opts = {}) {
    if (!modal) return;
    closeMobileNav();

    STATE.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    setHidden(modal, false);
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "false");

    const panel = $(".modal__panel", modal) || modal;
    disableBodyScroll.lock();

    const untrap = trapFocus(panel);
    STATE.overlayStack.push({ el: modal, untrap, type: "modal" });

    const focusSel = opts.focusSelector;
    const focusEl = focusSel ? $(focusSel, modal) : $(focusableSelector, panel);
    if (focusEl) focusEl.focus({ preventScroll: true });

    dispatch("kurdistan:modal:open", { id: modal.id || null });
  }

  function closeModal(modal) {
    if (!modal || isHidden(modal)) return;

    const idx = STATE.overlayStack.findIndex((x) => x.el === modal);
    if (idx !== -1) {
      const item = STATE.overlayStack[idx];
      if (item.untrap) item.untrap();
      STATE.overlayStack.splice(idx, 1);
    }

    setHidden(modal, true);
    modal.setAttribute("aria-hidden", "true");

    disableBodyScroll.unlock();

    if (!STATE.overlayStack.length && STATE.lastFocus) {
      try {
        STATE.lastFocus.focus({ preventScroll: true });
      } catch {}
      STATE.lastFocus = null;
    }

    dispatch("kurdistan:modal:close", { id: modal.id || null });
  }

  /* -----------------------------
     10a) Search Overlay
  ------------------------------ */
  function initSearchOverlay() {
    const overlay = $(APP.selectors.searchOverlay);
    if (!overlay) return;

    const input = qsIn(overlay, ".search__input", "input[type='search']", "input[data-search]");
    const btn = qsIn(overlay, ".search__btn", "[data-search-btn]");
    const results = qsIn(overlay, ".search__results", "[data-search-results]");
    const empty = qsIn(overlay, ".search__empty", "[data-search-empty]");

    const chips = qsaIn(overlay, ".chip", "[data-chip]");
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const q = chip.getAttribute("data-q") || chip.textContent || "";
        if (input) input.value = q.trim();
        doSearch();
      });
    });

    const doSearch = () => {
      const query = (input ? input.value : "").trim().toLowerCase();
      const index = buildSearchIndex();
      const matched = query ? index.filter((item) => item.text.includes(query) || item.title.includes(query) || item.tags.some((t) => t.includes(query))) : [];

      if (results) setHidden(results, false);
      if (empty) setHidden(empty, false);

      if (!query) {
        if (results) setHTML(results, "");
        if (empty) {
          setHidden(empty, false);
          setHTML(
            empty,
            `<div><i class="ri-search-line" aria-hidden="true"></i></div>
             <div style="font-weight:700; letter-spacing:.02em;">Search the site</div>
             <div class="muted">Try “Erbil”, “mountains”, “history”, “festival”, or “waterfall”.</div>`
          );
        }
        return;
      }

      if (!matched.length) {
        if (results) setHTML(results, "");
        if (empty) {
          setHidden(empty, false);
          setHTML(
            empty,
            `<div><i class="ri-emotion-sad-line" aria-hidden="true"></i></div>
             <div style="font-weight:700; letter-spacing:.02em;">No results</div>
             <div class="muted">Try a broader keyword or select a suggestion chip above.</div>`
          );
        }
        return;
      }

      if (empty) setHidden(empty, true);

      const html = matched
        .slice(0, 14)
        .map((m) => {
          const href = m.href || "#";
          const title = escapeHtml(m.title);
          const desc = escapeHtml(m.desc || "");
          const badge = m.badge ? `<span class="meta-pill"><i class="ri-bookmark-3-line" aria-hidden="true"></i>${escapeHtml(m.badge)}</span>` : "";
          return `
            <article class="glass-card" style="padding:14px; margin-top:12px;">
              <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center;">
                <div style="font-family:var(--display); font-weight:700; letter-spacing:.02em; font-size:15px;">${title}</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; color:var(--muted); font-size:12px;">
                  ${badge}
                  <span class="meta-pill"><i class="ri-compass-3-line" aria-hidden="true"></i>${escapeHtml(m.section || "Section")}</span>
                </div>
              </div>
              <p style="margin:10px 0 0; color:var(--muted); font-size:13px;">${desc}</p>
              <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
                <a class="mini-cta" href="${href}"><i class="ri-arrow-right-line" aria-hidden="true"></i>Open</a>
                <button class="mini-cta mini-cta--ghost" type="button" data-close-overlay><i class="ri-close-line" aria-hidden="true"></i>Close</button>
              </div>
            </article>
          `;
        })
        .join("");

      if (results) setHTML(results, html);
    };

    const buildSearchIndex = () => {
      // A lightweight, DOM-based index that adapts to your current HTML.
      // We scan sections and cards for titles/text.
      const items = [];

      const pushItem = (o) => {
        const title = String(o.title || "").trim();
        const desc = String(o.desc || "").trim();
        if (!title && !desc) return;
        items.push({
          title,
          desc,
          text: `${title} ${desc}`.toLowerCase(),
          href: o.href || "",
          section: o.section || "",
          badge: o.badge || "",
          tags: (o.tags || []).map((t) => String(t).toLowerCase()),
        });
      };

      // Sections by ID
      const scanSection = (id, name) => {
        const sec = document.getElementById(id);
        if (!sec) return;

        const titleEl = qsIn(sec, ".section__title", "h2", "h3");
        const subtitleEl = qsIn(sec, ".section__subtitle", "p");

        pushItem({
          title: titleEl ? titleEl.textContent : name,
          desc: subtitleEl ? subtitleEl.textContent : "",
          href: `#${id}`,
          section: name,
          badge: "Section",
          tags: [id, name],
        });

        // Cards inside
        $$(".glass-card, .feature-card, .about-card, .news-card, .destination, .gallery-card", sec).forEach((card) => {
          const t = qsIn(card, ".destination__title", ".news-card__title", ".about-card__title", ".feature-card__title", ".gallery-card__title", "h3", "h4");
          const d = qsIn(card, ".destination__desc", ".news-card__excerpt", ".about-card__text", ".feature-card__text", ".gallery-card__meta", "p");
          const href = id ? `#${id}` : "#";
          pushItem({
            title: t ? t.textContent : "",
            desc: d ? d.textContent : "",
            href,
            section: name,
            badge: "Card",
            tags: [id, name],
          });
        });
      };

      scanSection("about", "About");
      scanSection("explore", "Explore");
      scanSection("gallery", "Gallery");
      scanSection("news", "News");
      scanSection("contact", "Contact");

      // Add city direct links
      APP.cities.forEach((c) => {
        pushItem({
          title: c.name,
          desc: `Weather and travel cues for ${c.name}.`,
          href: "#explore",
          section: "Explore",
          badge: "City",
          tags: [c.id, c.name, "weather", "city"],
        });
      });

      return items;
    };

    if (btn) btn.addEventListener("click", doSearch);
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doSearch();
        }
      });
      input.addEventListener("input", debounce(doSearch, 220));
    }

    // On open: focus search input
    document.addEventListener("kurdistan:overlay:open", (e) => {
      if (!e.detail) return;
      const id = overlay.id || null;
      if (id && e.detail.id !== id) return;
      if (input) {
        setTimeout(() => input.focus({ preventScroll: true }), 20);
      }
    });
  }

  /* -----------------------------
     10b) Weather Overlay (Open-Meteo)
  ------------------------------ */
  function initWeatherOverlay() {
    const overlay = $(APP.selectors.weatherOverlay);
    if (!overlay) return;

    // Controls
    const citySelect = qsIn(overlay, "select[data-weather-city]", "select#weatherCity", "select");
    const unitsWrap = qsIn(overlay, ".segmented", "[data-units]");
    const unitInputs = unitsWrap ? $$("input[type='radio']", unitsWrap) : [];

    const refreshBtn = qsIn(overlay, "[data-weather-refresh]", "#weatherRefresh", "button[data-refresh]");
    const statusEl = qsIn(overlay, ".weather__note", "[data-weather-note]", "[data-status]");
    const grid = qsIn(overlay, ".weather__grid", "[data-weather-grid]");
    const cardNow = qsIn(overlay, "[data-weather-now]", ".weather-card--now", ".weather-card");
    const cardForecast = qsIn(overlay, "[data-weather-forecast]", ".weather-card--forecast");

    // If select exists, populate options (id/name)
    if (citySelect) {
      const existing = $$("option", citySelect);
      const hasRealOptions = existing.some((o) => (o.value || "").trim().length > 0);
      if (!hasRealOptions) {
        const frag = document.createDocumentFragment();
        APP.cities.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.id;
          opt.textContent = c.name;
          frag.appendChild(opt);
        });
        citySelect.appendChild(frag);
      }
    }

    // Set initial selection
    if (!STATE.weather.cityId) STATE.weather.cityId = (APP.cities[0] && APP.cities[0].id) || "erbil";
    if (citySelect) citySelect.value = STATE.weather.cityId;

    // Set unit UI
    unitInputs.forEach((inp) => {
      const v = inp.value === "f" ? "f" : "c";
      inp.checked = STATE.weather.units === v;
      inp.addEventListener("change", () => {
        if (!inp.checked) return;
        STATE.weather.units = v;
        persistWeatherSettings();
        renderWeatherFromCacheOrFetch();
      });
    });

    if (citySelect) {
      citySelect.addEventListener("change", () => {
        STATE.weather.cityId = citySelect.value;
        persistWeatherSettings();
        renderWeatherFromCacheOrFetch();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        renderWeatherFromCacheOrFetch({ force: true });
      });
    }

    // Build / find inner placeholders
    const ensureWeatherCardStructure = (card, kind) => {
      if (!card) return null;
      // Try to locate the intended sub-elements by class/data, else create them.
      const header = qsIn(card, ".weather-card__header") || (() => {
        const h = document.createElement("div");
        h.className = "weather-card__header";
        card.prepend(h);
        return h;
      })();

      const title = qsIn(header, ".weather-card__title") || (() => {
        const t = document.createElement("h3");
        t.className = "weather-card__title";
        t.textContent = kind === "now" ? "Current Conditions" : "Mini Forecast";
        header.prepend(t);
        return t;
      })();

      const status = qsIn(header, ".weather-card__status") || (() => {
        const s = document.createElement("div");
        s.className = "weather-card__status";
        s.innerHTML = `<i class="ri-time-line" aria-hidden="true"></i><span>—</span>`;
        header.appendChild(s);
        return s;
      })();

      const body = qsIn(card, "[data-body]", ".weather-card__body") || (() => {
        const b = document.createElement("div");
        b.className = "weather-card__body";
        b.setAttribute("data-body", "1");
        card.appendChild(b);
        return b;
      })();

      const footer = qsIn(card, ".weather-card__footer") || (() => {
        const f = document.createElement("div");
        f.className = "weather-card__footer";
        f.textContent = "Powered by Open-Meteo • No API key required";
        card.appendChild(f);
        return f;
      })();

      return { card, header, title, status, body, footer };
    };

    const nowParts = ensureWeatherCardStructure(cardNow, "now");
    const fcParts = ensureWeatherCardStructure(cardForecast, "forecast");

    const renderSkeleton = () => {
      if (statusEl) statusEl.textContent = "Fetching live weather for Kurdish cities…";
      if (nowParts) {
        nowParts.body.innerHTML = `
          <div class="weather-now">
            <div class="weather-now__icon"><i class="ri-loader-4-line" aria-hidden="true"></i></div>
            <div>
              <p class="weather-now__temp">—</p>
              <p class="weather-now__city muted">Loading…</p>
              <p class="weather-now__desc muted">Please wait</p>
            </div>
          </div>
          <div class="weather-stats">
            <div class="weather-stats__item"><div class="skeleton line"></div></div>
            <div class="weather-stats__item"><div class="skeleton line"></div></div>
            <div class="weather-stats__item"><div class="skeleton line"></div></div>
            <div class="weather-stats__item"><div class="skeleton line"></div></div>
          </div>
        `;
      }
      if (fcParts) {
        fcParts.body.innerHTML = `
          <div class="forecast__placeholder">
            <div class="skeleton line"></div>
            <div class="skeleton line"></div>
            <div class="skeleton line short"></div>
          </div>
        `;
      }
    };

    const codeToIcon = (code) => {
      // Open-Meteo weather code mapping (simplified)
      const c = Number(code);
      if (!Number.isFinite(c)) return { icon: "ri-question-line", label: "Unknown" };

      // Clear
      if (c === 0) return { icon: "ri-sun-line", label: "Clear sky" };
      // Mainly clear, partly cloudy, overcast
      if (c === 1) return { icon: "ri-sun-cloudy-line", label: "Mainly clear" };
      if (c === 2) return { icon: "ri-cloudy-2-line", label: "Partly cloudy" };
      if (c === 3) return { icon: "ri-cloudy-line", label: "Overcast" };
      // Fog
      if (c === 45 || c === 48) return { icon: "ri-mist-line", label: "Fog" };
      // Drizzle
      if (c === 51 || c === 53 || c === 55) return { icon: "ri-drizzle-line", label: "Drizzle" };
      // Freezing drizzle
      if (c === 56 || c === 57) return { icon: "ri-snowy-line", label: "Freezing drizzle" };
      // Rain
      if (c === 61 || c === 63 || c === 65) return { icon: "ri-rainy-line", label: "Rain" };
      // Freezing rain
      if (c === 66 || c === 67) return { icon: "ri-snowy-line", label: "Freezing rain" };
      // Snow fall
      if (c === 71 || c === 73 || c === 75) return { icon: "ri-snowy-line", label: "Snow" };
      if (c === 77) return { icon: "ri-snowy-line", label: "Snow grains" };
      // Showers
      if (c === 80 || c === 81 || c === 82) return { icon: "ri-showers-line", label: "Showers" };
      // Thunderstorm
      if (c === 95) return { icon: "ri-thunderstorms-line", label: "Thunderstorm" };
      if (c === 96 || c === 99) return { icon: "ri-thunderstorms-line", label: "Thunderstorm + hail" };

      return { icon: "ri-cloud-windy-line", label: "Variable" };
    };

    const toF = (c) => (c * 9) / 5 + 32;

    const buildKey = () => `${STATE.weather.cityId}_${STATE.weather.units}`;

    const getCity = (id) => APP.cities.find((c) => c.id === id) || APP.cities[0];

    const fromCache = () => {
      const key = buildKey();
      const entry = STATE.weather.cache[key];
      if (!entry) return null;
      if (!entry.ts || nowMs() - entry.ts > APP.weather.cacheTtlMs) return null;
      return entry.data || null;
    };

    const cacheSet = (data) => {
      const key = buildKey();
      STATE.weather.cache[key] = { ts: nowMs(), data };
      persistWeatherCache();
    };

    const renderWeather = (data, meta = {}) => {
      const city = getCity(STATE.weather.cityId);
      const units = STATE.weather.units;
      const unitSymbol = units === "f" ? "°F" : "°C";
      const windUnit = units === "f" ? "mph" : "km/h";

      const current = data && data.current ? data.current : null;
      const currentUnits = data && data.current_units ? data.current_units : null;

      const tempC = current && typeof current.temperature_2m === "number" ? current.temperature_2m : null;
      const temp = units === "f" && tempC !== null ? toF(tempC) : tempC;
      const humidity = current && typeof current.relative_humidity_2m === "number" ? current.relative_humidity_2m : null;
      const feelsC = current && typeof current.apparent_temperature === "number" ? current.apparent_temperature : null;
      const feels = units === "f" && feelsC !== null ? toF(feelsC) : feelsC;

      const wcode = current && typeof current.weather_code === "number" ? current.weather_code : null;
      const windKmh = current && typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null;
      const wind = units === "f" && windKmh !== null ? windKmh * 0.621371 : windKmh;

      const timeStr = current && current.time ? current.time : null;
      const timeLabel = timeStr ? `${formatDateShort(timeStr)} • ${formatTimeShort(timeStr)}` : "—";

      const { icon, label } = codeToIcon(wcode);

      if (statusEl) {
        const source = meta.source === "cache" ? "Cached" : "Live";
        statusEl.textContent = `${source} weather updated: ${timeLabel}`;
      }

      if (nowParts) {
        const statusSpan = qsIn(nowParts.status, "span");
        if (statusSpan) statusSpan.textContent = timeLabel;

        nowParts.body.innerHTML = `
          <div class="weather-now">
            <div class="weather-now__icon"><i class="${icon}" aria-hidden="true"></i></div>
            <div>
              <p class="weather-now__temp">${temp !== null ? `${formatNumber(temp, 0)}${unitSymbol}` : "—"}</p>
              <p class="weather-now__city muted">${escapeHtml(city.name)}</p>
              <p class="weather-now__desc muted">${escapeHtml(label)}</p>
            </div>
          </div>
          <dl class="weather-stats">
            <div class="weather-stats__item">
              <dt><i class="ri-thermometer-line" aria-hidden="true"></i>Feels like</dt>
              <dd>${feels !== null ? `${formatNumber(feels, 0)}${unitSymbol}` : "—"}</dd>
            </div>
            <div class="weather-stats__item">
              <dt><i class="ri-drop-line" aria-hidden="true"></i>Humidity</dt>
              <dd>${humidity !== null ? `${formatNumber(humidity, 0)}%` : "—"}</dd>
            </div>
            <div class="weather-stats__item">
              <dt><i class="ri-windy-line" aria-hidden="true"></i>Wind</dt>
              <dd>${wind !== null ? `${formatNumber(wind, 0)} ${windUnit}` : "—"}</dd>
            </div>
            <div class="weather-stats__item">
              <dt><i class="ri-map-pin-2-line" aria-hidden="true"></i>Coordinates</dt>
              <dd>${formatNumber(city.lat, 3)}, ${formatNumber(city.lon, 3)}</dd>
            </div>
          </dl>
        `;
      }

      // Forecast: Use hourly first 8 points (next 24h)
      if (fcParts) {
        const h = data && data.hourly ? data.hourly : null;
        const times = h && Array.isArray(h.time) ? h.time : [];
        const tempsC = h && Array.isArray(h.temperature_2m) ? h.temperature_2m : [];
        const codes = h && Array.isArray(h.weather_code) ? h.weather_code : [];
        const winds = h && Array.isArray(h.wind_speed_10m) ? h.wind_speed_10m : [];
        const hums = h && Array.isArray(h.relative_humidity_2m) ? h.relative_humidity_2m : [];

        const rows = [];
        const count = Math.min(8, times.length, tempsC.length, codes.length);
        for (let i = 0; i < count; i++) {
          const t = times[i];
          const tempVal = units === "f" ? toF(tempsC[i]) : tempsC[i];
          const w = units === "f" ? winds[i] * 0.621371 : winds[i];
          const { icon: ic, label: lb } = codeToIcon(codes[i]);
          rows.push(`
            <div class="glass-card" style="padding:12px; border-radius:18px; margin-top:10px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="width:40px; height:40px; border-radius:16px; display:grid; place-items:center; border:1px solid var(--border); background:rgba(255,255,255,.06);">
                    <i class="${ic}" aria-hidden="true"></i>
                  </span>
                  <div>
                    <div style="font-weight:700; letter-spacing:.02em;">${escapeHtml(formatTimeShort(t))}</div>
                    <div style="color:var(--muted); font-size:12px;">${escapeHtml(lb)}</div>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div style="font-family:var(--display); font-weight:700; letter-spacing:.02em;">${formatNumber(tempVal, 0)}${unitSymbol}</div>
                  <div style="color:var(--muted); font-size:12px; display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
                    <span><i class="ri-windy-line" aria-hidden="true"></i> ${formatNumber(w, 0)} ${windUnit}</span>
                    <span><i class="ri-drop-line" aria-hidden="true"></i> ${formatNumber(hums[i], 0)}%</span>
                  </div>
                </div>
              </div>
            </div>
          `);
        }

        const statusSpan = qsIn(fcParts.status, "span");
        if (statusSpan) statusSpan.textContent = count ? `Next hours • ${units === "f" ? "Fahrenheit" : "Celsius"}` : "—";

        fcParts.body.innerHTML = rows.length
          ? `<div class="forecast">${rows.join("")}</div>`
          : `<div class="reader__placeholder">No forecast data available.</div>`;
      }
    };

    const fetchWeather = async ({ force = false } = {}) => {
      const city = getCity(STATE.weather.cityId);
      if (!city) throw new Error("City not found");

      // cache check
      if (!force) {
        const cached = fromCache();
        if (cached) return { data: cached, source: "cache" };
      }

      const params = new URLSearchParams({
        latitude: String(city.lat),
        longitude: String(city.lon),
        current: APP.weather.params.current,
        hourly: APP.weather.params.hourly,
        timezone: APP.weather.params.timezone,
        forecast_hours: String(APP.weather.params.forecast_hours),
        // Open-Meteo can output units: but easiest is request in metric and convert to F if needed.
        // We'll keep default (metric).
      });

      const url = `${APP.weather.base}?${params.toString()}`;

      const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
      const json = await res.json();
      cacheSet(json);
      return { data: json, source: "live" };
    };

    const renderWeatherFromCacheOrFetch = async ({ force = false } = {}) => {
      if (STATE.weather.isLoading) return;
      STATE.weather.isLoading = true;
      STATE.weather.lastError = null;

      renderSkeleton();

      try {
        const { data, source } = await fetchWeather({ force });
        renderWeather(data, { source });
        dispatch("kurdistan:weather", { cityId: STATE.weather.cityId, units: STATE.weather.units, source });
      } catch (err) {
        STATE.weather.lastError = err instanceof Error ? err.message : String(err);
        if (statusEl) statusEl.textContent = `Could not load weather. ${STATE.weather.lastError}`;
        if (nowParts) {
          nowParts.body.innerHTML = `
            <div class="weather-now">
              <div class="weather-now__icon"><i class="ri-error-warning-line" aria-hidden="true"></i></div>
              <div>
                <p class="weather-now__temp">—</p>
                <p class="weather-now__city muted">${escapeHtml(getCity(STATE.weather.cityId).name)}</p>
                <p class="weather-now__desc muted">Network error or API unavailable.</p>
              </div>
            </div>
            <div class="reader__placeholder" style="margin-top:12px;">
              <div style="font-weight:700; letter-spacing:.02em;">Troubleshooting</div>
              <ul style="margin:10px 0 0; padding-left:18px; color:var(--muted);">
                <li>Check your internet connection.</li>
                <li>Try a different city.</li>
                <li>Tap “Refresh” to retry.</li>
              </ul>
            </div>
          `;
        }
        if (fcParts) {
          fcParts.body.innerHTML = `<div class="reader__placeholder">Forecast unavailable right now.</div>`;
        }
      } finally {
        STATE.weather.isLoading = false;
      }
    };

    // Open overlay triggers should load weather
    document.addEventListener("kurdistan:overlay:open", (e) => {
      if (!e.detail) return;
      const id = overlay.id || null;
      if (id && e.detail.id !== id) return;
      renderWeatherFromCacheOrFetch();
    });

    // Also expose for other UI
    window.__kurdistanWeatherRefresh = () => renderWeatherFromCacheOrFetch({ force: true });
    window.__kurdistanWeatherOpen = () => openOverlay(overlay);

    // If overlay is already visible at load (edge case), render
    if (!isHidden(overlay)) renderWeatherFromCacheOrFetch();
  }

  /* -----------------------------
     10c) Planner Overlay (simple itinerary builder)
  ------------------------------ */
  function initPlannerOverlay() {
    const overlay = $(APP.selectors.plannerOverlay);
    if (!overlay) return;

    const form = qsIn(overlay, "form[data-planner]", "form", ".planner__form form");
    const output = qsIn(overlay, ".itinerary", "[data-itinerary]");
    const empty = qsIn(overlay, ".itinerary__empty", "[data-itinerary-empty]");
    const copyBtn = qsIn(overlay, "[data-itinerary-copy]");
    const clearBtn = qsIn(overlay, "[data-itinerary-clear]");
    const printBtn = qsIn(overlay, "[data-itinerary-print]");
    const status = qsIn(overlay, "[data-itinerary-status]", ".planner__note", "[data-status]");

    const getVal = (name, fallback = "") => {
      if (!form) return fallback;
      const el = form.elements && form.elements[name] ? form.elements[name] : null;
      if (!el) return fallback;
      if (el instanceof RadioNodeList) return (el.value || fallback).trim();
      if ("value" in el) return String(el.value || fallback).trim();
      return fallback;
    };

    const getChecks = (name) => {
      if (!form) return [];
      const els = form.elements && form.elements[name] ? form.elements[name] : null;
      if (!els) return [];
      const list = els instanceof NodeList || Array.isArray(els) ? Array.from(els) : [els];
      return list
        .filter((x) => x && x.checked)
        .map((x) => String(x.value || x.getAttribute("data-label") || x.name || "").trim())
        .filter(Boolean);
    };

    const buildItinerary = () => {
      const city = getVal("city", "Erbil (Hewlêr)");
      const days = clamp(Number(getVal("days", "3")) || 3, 1, 10);
      const pace = getVal("pace", "balanced");
      const interests = getChecks("interests");
      const notes = getVal("notes", "");

      const paceLabel = pace === "relaxed" ? "Relaxed" : pace === "fast" ? "Fast-paced" : "Balanced";

      const interestLabel = interests.length ? interests.join(", ") : "Culture, nature, and local cuisine";

      const cityShort = city.split("(")[0].trim() || city;

      const suggestions = makeSuggestions(cityShort, interests, pace);

      const lines = [];
      lines.push(`# Kurdistan Trip Plan — ${city}`);
      lines.push(`- Duration: ${days} day${days > 1 ? "s" : ""}`);
      lines.push(`- Pace: ${paceLabel}`);
      lines.push(`- Focus: ${interestLabel}`);
      if (notes) lines.push(`- Notes: ${notes}`);
      lines.push("");

      for (let d = 1; d <= days; d++) {
        lines.push(`## Day ${d}`);
        const dayPlan = suggestions[(d - 1) % suggestions.length];
        lines.push(`- Morning: ${dayPlan.morning}`);
        lines.push(`- Afternoon: ${dayPlan.afternoon}`);
        lines.push(`- Evening: ${dayPlan.evening}`);
        lines.push(`- Food: ${dayPlan.food}`);
        lines.push(`- Pro tip: ${dayPlan.tip}`);
        lines.push("");
      }

      lines.push(`---`);
      lines.push(`Generated locally • Customize freely • Safe travel and respect local guidelines.`);

      return lines.join("\n");
    };

    const makeSuggestions = (city, interests, pace) => {
      const like = (k) => interests.map((x) => x.toLowerCase()).some((x) => x.includes(k));
      const wantsNature = like("nature") || like("mountain") || like("waterfall") || like("hiking");
      const wantsHistory = like("history") || like("heritage") || like("museum") || like("archaeology");
      const wantsFood = like("food") || like("cuisine") || like("market") || like("tea");
      const wantsCulture = like("culture") || like("music") || like("festival") || like("art");
      const wantsPhotography = like("photo") || like("photography") || like("sunset");

      const paceFast = pace === "fast";
      const paceRelaxed = pace === "relaxed";

      const base = {
        morning: `Start with a sunrise walk and a local breakfast in ${city}.`,
        afternoon: `Visit a signature viewpoint and explore a nearby neighborhood.`,
        evening: `Enjoy a calm café stop and a golden-hour stroll.`,
        food: `Try traditional dishes and regional sweets; ask locals for the best spot.`,
        tip: `Carry cash for small vendors and keep a light jacket for evening breeze.`,
      };

      const variants = [];

      variants.push({
        morning: wantsHistory
          ? `Museum + old quarter: begin with a heritage museum or historic citadel area in ${city}.`
          : `Local life: breakfast + traditional market walk to see daily rhythms in ${city}.`,
        afternoon: wantsNature
          ? `Nature escape: drive to a scenic area (valley, waterfall, or mountain viewpoint) near ${city}.`
          : `City textures: architecture tour + artisan shops and craft streets in ${city}.`,
        evening: wantsCulture
          ? `Culture hour: attend a music venue, cultural center, or community gathering (if available).`
          : `Sunset views: choose a rooftop or hilltop viewpoint for sunset in/near ${city}.`,
        food: wantsFood
          ? `Food route: sample kebab + dolma + local bread; finish with tea and seasonal fruit.`
          : `Classic dinner: choose a well-reviewed family restaurant; try local appetizers + tea.`,
        tip: paceFast
          ? `Fast pace: pre-book drivers/taxis; group nearby spots to save time.`
          : paceRelaxed
          ? `Relaxed pace: keep one big highlight and leave space for spontaneous stops.`
          : `Balanced pace: schedule a highlight, then leave 2–3 hours flexible.`,
      });

      variants.push({
        morning: wantsNature
          ? `Early nature: hike a short trail or visit a viewpoint before crowds (sunrise is best).`
          : `City morning: coffee + a calm walk in a central park or promenade area.`,
        afternoon: wantsHistory
          ? `Heritage focus: guided walking tour or historic landmarks with local storytelling.`
          : `Explore focus: neighborhood hopping + local markets for gifts and crafts.`,
        evening: wantsPhotography
          ? `Photo session: golden-hour shots, then night lights in the most iconic streets.`
          : `Slow evening: tea house + live ambiance; keep it simple and restorative.`,
        food: `Ask for the most famous dish in the city and order it “as locals eat it.”`,
        tip: `Always confirm closing hours—some sites close early; keep ID and essentials secure.`,
      });

      variants.push({
        morning: wantsCulture
          ? `Culture morning: galleries, craft studios, or language/calligraphy showcases.`
          : `Classic morning: relaxed breakfast, then a curated shortlist of must-see spots.`,
        afternoon: wantsNature
          ? `Scenic loop: valley drive + picnic viewpoint; keep water and snacks handy.`
          : `Urban loop: iconic squares + cafés + shopping for handicrafts.`,
        evening: `Dinner + stroll: choose a safe, lively area and enjoy the atmosphere.`,
        food: `Dessert stop: look for local pastries and seasonal specialties.`,
        tip: `Respect local customs and dress norms; people appreciate polite greetings.`,
      });

      // Strengthen with city-specific flavor (generic, safe suggestions)
      const cityLower = city.toLowerCase();
      const addCity = (s, c) => {
        if (cityLower.includes("erbil") || cityLower.includes("hewl")) return s.replaceAll("nearby", "around Erbil").replaceAll("historic", "historic");
        if (cityLower.includes("sulay") || cityLower.includes("sil")) return s.replaceAll("nearby", "around Sulaymaniyah");
        if (cityLower.includes("duhok") || cityLower.includes("dih")) return s.replaceAll("nearby", "around Duhok");
        if (cityLower.includes("halab")) return s.replaceAll("nearby", "around Halabja");
        if (cityLower.includes("zakh")) return s.replaceAll("nearby", "around Zakho");
        return s;
      };

      return variants.map((v) => ({
        morning: addCity(v.morning, city),
        afternoon: addCity(v.afternoon, city),
        evening: addCity(v.evening, city),
        food: addCity(v.food, city),
        tip: addCity(v.tip, city),
      }));
    };

    const render = (text) => {
      if (!output) return;
      // Render as preformatted
      output.innerHTML = `
        <pre style="margin:0; white-space:pre-wrap; word-break:break-word; color:var(--ink); font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:12.5px; line-height:1.55;">${escapeHtml(text)}</pre>
      `;
      if (empty) setHidden(empty, true);
    };

    const clear = () => {
      if (!output) return;
      output.innerHTML = "";
      if (empty) setHidden(empty, false);
      if (status) status.textContent = "Fill the form and generate a tailored itinerary.";
    };

    const copy = async () => {
      if (!output) return;
      const pre = $("pre", output);
      const txt = pre ? pre.textContent : "";
      if (!txt.trim()) return;

      try {
        await navigator.clipboard.writeText(txt);
        if (status) status.textContent = "Copied itinerary to clipboard.";
      } catch {
        // fallback: select via textarea
        const ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          if (status) status.textContent = "Copied itinerary to clipboard.";
        } catch {
          if (status) status.textContent = "Could not copy. Select the text manually.";
        } finally {
          document.body.removeChild(ta);
        }
      }
    };

    const print = () => {
      if (!output) return;
      const pre = $("pre", output);
      const txt = pre ? pre.innerHTML : "";
      const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
      if (!w) {
        if (status) status.textContent = "Popup blocked. Please allow popups to print.";
        return;
      }
      w.document.open();
      w.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Itinerary Print</title>
            <style>
              body{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; margin: 24px; }
              pre{ white-space: pre-wrap; word-break: break-word; line-height: 1.55; font-size: 12.5px; }
              h1{ font-size: 16px; margin:0 0 12px; }
            </style>
          </head>
          <body>
            <h1>Kurdistan Trip Itinerary</h1>
            <pre>${txt}</pre>
            <script>window.onload=()=>setTimeout(()=>{window.print();}, 120);</script>
          </body>
        </html>
      `);
      w.document.close();
    };

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const txt = buildItinerary();
        render(txt);
        if (status) status.textContent = "Itinerary generated. You can copy or print it.";
      });
    }

    if (copyBtn) copyBtn.addEventListener("click", copy);
    if (clearBtn) clearBtn.addEventListener("click", clear);
    if (printBtn) printBtn.addEventListener("click", print);

    // On overlay open: show guidance
    document.addEventListener("kurdistan:overlay:open", (e) => {
      if (!e.detail) return;
      const id = overlay.id || null;
      if (id && e.detail.id !== id) return;
      if (status && (!output || !output.textContent.trim())) {
        status.textContent = "Build a tailored itinerary for Kurdistan—city, pace, and interests.";
      }
    });
  }

  /* -----------------------------
     10d) Gallery Modal (Lightbox)
  ------------------------------ */
  function initGalleryModal() {
    const modal = $(APP.selectors.galleryModal);
    if (!modal) return;

    // We will populate modal fields if we find them; else create fallback blocks.
    const panel = $(".modal__panel", modal) || modal;

    const img = qsIn(modal, "#galleryModalImg", "[data-gallery-modal-img]", ".modal__image-wrap img") || (() => {
      const wrap = qsIn(modal, ".modal__image-wrap") || (() => {
        const body = qsIn(modal, ".modal__body") || (() => {
          const b = document.createElement("div");
          b.className = "modal__body";
          panel.appendChild(b);
          return b;
        })();
        const w = document.createElement("div");
        w.className = "modal__image-wrap";
        body.prepend(w);
        return w;
      })();
      const im = document.createElement("img");
      im.alt = "Gallery preview";
      wrap.appendChild(im);
      return im;
    })();

    const titleEl =
      qsIn(modal, "#galleryModalTitle", "[data-gallery-modal-title]", ".modal__title") ||
      (() => {
        // ensure header
        const header = qsIn(modal, ".modal__header") || (() => {
          const h = document.createElement("div");
          h.className = "modal__header";
          panel.prepend(h);
          return h;
        })();
        const h3 = document.createElement("h3");
        h3.className = "modal__title";
        h3.innerHTML = `<i class="ri-image-line" aria-hidden="true"></i><span>Gallery</span>`;
        header.prepend(h3);
        return h3;
      })();

    const descEl = qsIn(modal, "#galleryModalDesc", "[data-gallery-modal-desc]", ".modal__desc");
    const chipsWrap = qsIn(modal, ".modal__chips", "[data-gallery-modal-chips]");
    const progressBar = qsIn(modal, ".modal__progress-bar", "[data-gallery-progress]");

    const prevBtn = qsIn(modal, "[data-gallery-prev]");
    const nextBtn = qsIn(modal, "[data-gallery-next]");
    const downloadBtn = qsIn(modal, "[data-gallery-download]");
    const openBtn = qsIn(modal, "[data-gallery-open]");

    const setModal = (item, index, total) => {
      if (!item) return;
      const src = item.getAttribute("data-src") || (qsIn(item, "img") ? qsIn(item, "img").src : "");
      const alt = item.getAttribute("data-alt") || (qsIn(item, "img") ? qsIn(item, "img").alt : "Gallery image");
      const title = item.getAttribute("data-title") || (qsIn(item, ".gallery-card__title") ? qsIn(item, ".gallery-card__title").textContent : alt);
      const meta = item.getAttribute("data-meta") || (qsIn(item, ".gallery-card__meta") ? qsIn(item, ".gallery-card__meta").textContent : "");
      const tag = item.getAttribute("data-tag") || (qsIn(item, ".gallery-card__tag") ? qsIn(item, ".gallery-card__tag").textContent : "");

      img.src = src;
      img.alt = alt;

      // Title area
      if (titleEl) {
        const span = titleEl.querySelector("span");
        if (span) span.textContent = title;
        else titleEl.textContent = title;
      }

      if (descEl) descEl.textContent = meta || "A curated moment from Kurdistan.";

      if (chipsWrap) {
        const chips = [];
        if (tag) chips.push(tag);
        chips.push(`${index + 1} / ${total}`);
        chipsWrap.innerHTML = chips
          .map((c) => `<span class="chip chip--active"><i class="ri-price-tag-3-line" aria-hidden="true"></i>${escapeHtml(c)}</span>`)
          .join("");
      }

      if (progressBar) {
        const p = total > 0 ? ((index + 1) / total) * 100 : 0;
        progressBar.style.width = `${clamp(p, 0, 100)}%`;
      }

      // download/open behavior (optional)
      if (downloadBtn) {
        downloadBtn.onclick = () => {
          const a = document.createElement("a");
          a.href = src;
          a.download = "";
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
      }

      if (openBtn) {
        openBtn.onclick = () => {
          window.open(src, "_blank", "noopener,noreferrer");
        };
      }
    };

    const move = (dir) => {
      const items = STATE.gallery.items;
      if (!items.length) return;
      const total = items.length;
      STATE.gallery.currentIndex = (STATE.gallery.currentIndex + dir + total) % total;
      setModal(items[STATE.gallery.currentIndex], STATE.gallery.currentIndex, total);
    };

    if (prevBtn) prevBtn.addEventListener("click", () => move(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => move(+1));

    // Keyboard navigation inside modal
    modal.addEventListener("keydown", (e) => {
      if (isHidden(modal)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        move(+1);
      }
    });

    // Expose API
    window.__kurdistanOpenGalleryModal = (index = 0) => {
      const items = STATE.gallery.items;
      if (!items.length) return;
      const total = items.length;
      const idx = clamp(Number(index) || 0, 0, total - 1);
      STATE.gallery.currentIndex = idx;
      setModal(items[idx], idx, total);
      openModalDialog(modal);
    };
  }

  /* -----------------------------
     10e) Article Modal (Reader)
  ------------------------------ */
  function initArticleModal() {
    const modal = $(APP.selectors.articleModal);
    if (!modal) return;

    const title = qsIn(modal, "[data-article-title]", ".modal__title span", ".modal__title");
    const reader = qsIn(modal, ".reader", "[data-reader]") || (() => {
      const panel = $(".modal__panel", modal) || modal;
      const body = qsIn(modal, ".modal__body", ".modal__body--article") || (() => {
        const b = document.createElement("div");
        b.className = "modal__body modal__body--article";
        panel.appendChild(b);
        return b;
      })();
      const r = document.createElement("div");
      r.className = "reader";
      body.appendChild(r);
      return r;
    })();

    const renderArticle = (data) => {
      const safeTitle = escapeHtml(data.title || "Article");
      if (title) {
        // If title is a span inside modal__title
        if (title instanceof HTMLElement && title.tagName.toLowerCase() === "span") title.textContent = data.title || "Article";
        else title.textContent = data.title || "Article";
      }

      const meta = `
        <div style="display:flex; gap:10px; flex-wrap:wrap; color:var(--muted); font-size:12px; margin-bottom:12px;">
          <span class="meta-pill"><i class="ri-time-line" aria-hidden="true"></i>${escapeHtml(data.date || formatDateShort(new Date()))}</span>
          <span class="meta-pill"><i class="ri-map-pin-2-line" aria-hidden="true"></i>${escapeHtml(data.location || "Kurdistan")}</span>
          <span class="meta-pill"><i class="ri-price-tag-3-line" aria-hidden="true"></i>${escapeHtml(data.category || "News")}</span>
        </div>
      `;

      const body = `
        <article>
          <h2 style="margin:0 0 10px; font-family:var(--display); letter-spacing:.02em; font-size:20px; line-height:1.2;">${safeTitle}</h2>
          ${meta}
          ${data.contentHtml || `<p style="color:var(--muted); margin:0;">No content.</p>`}
          <div style="margin-top:16px; border-top:1px solid rgba(255,255,255,.10); padding-top:14px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="color:var(--muted); font-size:12px;">Tip: Use the Share button to send this story.</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="mini-cta" type="button" data-article-share><i class="ri-share-forward-line" aria-hidden="true"></i>Share</button>
              <button class="mini-cta mini-cta--ghost" type="button" data-close-modal><i class="ri-close-line" aria-hidden="true"></i>Close</button>
            </div>
          </div>
        </article>
      `;

      reader.innerHTML = body;

      const shareBtn = qsIn(reader, "[data-article-share]");
      if (shareBtn) {
        shareBtn.addEventListener("click", async () => {
          const shareData = {
            title: data.title || "Kurdistan Article",
            text: data.excerpt || "A story from Kurdistan.",
            url: location.href,
          };
          try {
            if (navigator.share) {
              await navigator.share(shareData);
            } else {
              await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
              shareBtn.textContent = "Copied link ✓";
              setTimeout(() => (shareBtn.innerHTML = `<i class="ri-share-forward-line" aria-hidden="true"></i>Share`), 1200);
            }
          } catch {
            // ignore
          }
        });
      }
    };

    // Expose to news system
    window.__kurdistanOpenArticle = (data) => {
      renderArticle(data);
      openModalDialog(modal);
    };

    // If opened with no data, show placeholder
    if (!isHidden(modal) && reader && !reader.textContent.trim()) {
      reader.innerHTML = `
        <div class="reader__placeholder">
          <div style="font-weight:700; letter-spacing:.02em;">Article Reader</div>
          <p style="margin:10px 0 0; color:var(--muted);">Select a news card to read a full story.</p>
        </div>
      `;
    }
  }

  /* -----------------------------
     11) Sliders (Explore, etc.)
  ------------------------------ */
  function initSliders() {
    const sliders = $$(APP.selectors.slider);
    if (!sliders.length) return;

    sliders.forEach((slider, index) => {
      const viewport = qsIn(slider, APP.selectors.sliderViewport);
      const track = qsIn(slider, APP.selectors.sliderTrack);
      if (!viewport || !track) return;

      // Create controls if missing
      let prev = qsIn(slider, APP.selectors.sliderPrev);
      let next = qsIn(slider, APP.selectors.sliderNext);

      if (!prev || !next) {
        const controls = document.createElement("div");
        controls.style.position = "absolute";
        controls.style.left = "14px";
        controls.style.bottom = "18px";
        controls.style.display = "flex";
        controls.style.gap = "10px";
        controls.style.zIndex = "2";

        prev = document.createElement("button");
        prev.type = "button";
        prev.className = "icon-btn icon-btn--ring";
        prev.setAttribute("aria-label", "Previous");
        prev.setAttribute("data-slider-prev", "1");
        prev.innerHTML = `<i class="ri-arrow-left-line" aria-hidden="true"></i>`;

        next = document.createElement("button");
        next.type = "button";
        next.className = "icon-btn icon-btn--ring";
        next.setAttribute("aria-label", "Next");
        next.setAttribute("data-slider-next", "1");
        next.innerHTML = `<i class="ri-arrow-right-line" aria-hidden="true"></i>`;

        controls.appendChild(prev);
        controls.appendChild(next);
        slider.appendChild(controls);
      }

      const bar = qsIn(slider, APP.selectors.sliderBar);
      const slides = Array.from(track.children).filter((n) => n instanceof HTMLElement);

      // Setup viewport accessibility
      viewport.setAttribute("tabindex", "0");
      viewport.setAttribute("role", "region");
      viewport.setAttribute("aria-label", slider.getAttribute("aria-label") || "Slider");

      // Slide width measure
      const getStep = () => {
        const first = slides[0];
        if (!first) return 320;
        const rect = first.getBoundingClientRect();
        // include gap by checking next
        const second = slides[1];
        if (second) {
          const r2 = second.getBoundingClientRect();
          const gap = Math.max(0, r2.left - rect.right);
          return rect.width + gap;
        }
        return rect.width + 14;
      };

      const scrollByStep = (dir) => {
        const step = getStep();
        viewport.scrollBy({ left: dir * step, behavior: isReducedMotion() ? "auto" : "smooth" });
      };

      // Buttons
      prev.addEventListener("click", () => scrollByStep(-1));
      next.addEventListener("click", () => scrollByStep(+1));

      // Keyboard control
      viewport.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          scrollByStep(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          scrollByStep(+1);
        } else if (e.key === "Home") {
          e.preventDefault();
          viewport.scrollTo({ left: 0, behavior: isReducedMotion() ? "auto" : "smooth" });
        } else if (e.key === "End") {
          e.preventDefault();
          viewport.scrollTo({ left: viewport.scrollWidth, behavior: isReducedMotion() ? "auto" : "smooth" });
        }
      });

      // Drag assist: click and drag to scroll (mouse)
      let isDown = false;
      let startX = 0;
      let startScroll = 0;

      const onDown = (e) => {
        if (e.button !== 0) return;
        isDown = true;
        startX = e.clientX;
        startScroll = viewport.scrollLeft;
        viewport.style.scrollSnapType = "none";
        viewport.style.cursor = "grabbing";
        viewport.setPointerCapture?.(e.pointerId);
      };

      const onMove = (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        viewport.scrollLeft = startScroll - dx;
      };

      const onUp = (e) => {
        if (!isDown) return;
        isDown = false;
        viewport.style.cursor = "";
        // restore snap after small delay
        setTimeout(() => {
          viewport.style.scrollSnapType = "";
        }, 0);
        viewport.releasePointerCapture?.(e.pointerId);
      };

      // Pointer events for both mouse/touch
      viewport.addEventListener("pointerdown", onDown);
      viewport.addEventListener("pointermove", onMove);
      viewport.addEventListener("pointerup", onUp);
      viewport.addEventListener("pointercancel", onUp);
      viewport.addEventListener("pointerleave", onUp);

      // Progress bar
      const updateProgress = rafThrottle(() => {
        if (!bar) return;
        const max = Math.max(1, viewport.scrollWidth - viewport.clientWidth);
        const pct = clamp((viewport.scrollLeft / max) * 100, 0, 100);
        bar.style.width = `${pct}%`;
      });

      viewport.addEventListener("scroll", updateProgress, { passive: true });
      updateProgress();

      // Instance tracking
      STATE.sliderInstances.push({ slider, viewport, track, prev, next, bar, index });
    });
  }

  /* -----------------------------
     12) Gallery
  ------------------------------ */
  function initGallery() {
    const gallery = $(APP.selectors.gallery);
    if (!gallery) return;

    const grid = qsIn(gallery, APP.selectors.galleryGrid);
    const items = $$(APP.selectors.galleryItem, gallery);
    if (!grid || !items.length) return;

    STATE.gallery.items = items;

    // Restore compact
    STATE.gallery.compact = STATE.gallery.compact || false;
    toggleClass(gallery, "is-compact", STATE.gallery.compact);

    // Filters
    const filtersWrap = qsIn(gallery, APP.selectors.galleryFilters);
    const filterBtns = filtersWrap ? $$(APP.selectors.galleryFilterBtn, filtersWrap) : [];
    const compactBtn = qsIn(gallery, APP.selectors.galleryCompactToggle);

    const getItemTag = (item) => {
      const t = item.getAttribute("data-tag") || (qsIn(item, ".gallery-card__tag") ? qsIn(item, ".gallery-card__tag").textContent : "");
      return String(t || "").trim().toLowerCase();
    };

    const applyFilter = (name) => {
      const f = String(name || "all").toLowerCase();
      STATE.gallery.filter = f;

      items.forEach((item) => {
        const tag = getItemTag(item);
        const show = f === "all" ? true : tag.includes(f);
        item.style.display = show ? "" : "none";
      });

      filterBtns.forEach((b) => b.classList.toggle("is-active", String(b.getAttribute("data-gallery-filter") || "").toLowerCase() === f));

      dispatch("kurdistan:gallery:filter", { filter: f });
    };

    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = btn.getAttribute("data-gallery-filter") || "all";
        applyFilter(f);
      });
    });

    if (compactBtn) {
      compactBtn.addEventListener("click", () => {
        STATE.gallery.compact = !STATE.gallery.compact;
        toggleClass(gallery, "is-compact", STATE.gallery.compact);
        persistGalleryCompact();
        dispatch("kurdistan:gallery:compact", { compact: STATE.gallery.compact });
      });
    }

    // Open modal
    const openButtons = $$(APP.selectors.galleryBtn, gallery);
    openButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const card = btn.closest(APP.selectors.galleryItem);
        if (!card) return;
        const idx = STATE.gallery.items.indexOf(card);
        if (idx < 0) return;
        if (typeof window.__kurdistanOpenGalleryModal === "function") window.__kurdistanOpenGalleryModal(idx);
      });
    });

    // Default filter from markup if any btn is active
    const activeBtn = filterBtns.find((b) => b.classList.contains("is-active"));
    if (activeBtn) applyFilter(activeBtn.getAttribute("data-gallery-filter") || "all");
    else applyFilter("all");
  }

  /* -----------------------------
     13) News (Filter + Search + Pagination + Reader)
  ------------------------------ */
  function initNews() {
    const news = $(APP.selectors.news);
    if (!news) return;

    const grid = qsIn(news, APP.selectors.newsGrid);
    if (!grid) return;

    const cards = $$(APP.selectors.newsCard, news);
    if (!cards.length) return;

    // Build a data model from DOM; if missing, we synthesize.
    const readCardData = (card, index) => {
      const title = (qsIn(card, ".news-card__title") ? qsIn(card, ".news-card__title").textContent : card.getAttribute("data-title")) || `Story ${index + 1}`;
      const excerpt = (qsIn(card, ".news-card__excerpt") ? qsIn(card, ".news-card__excerpt").textContent : card.getAttribute("data-excerpt")) || "A curated story from Kurdistan.";
      const category = (qsIn(card, ".news-card__badge") ? qsIn(card, ".news-card__badge").textContent : card.getAttribute("data-category")) || "News";
      const time = (qsIn(card, ".news-card__time") ? qsIn(card, ".news-card__time").textContent : card.getAttribute("data-date")) || formatDateShort(new Date());
      const location = card.getAttribute("data-location") || "Kurdistan";

      // Content: prefer hidden template in card
      const template = qsIn(card, "template[data-article]") || null;
      let contentHtml = null;
      if (template && template.content) {
        const tmpWrap = document.createElement("div");
        tmpWrap.appendChild(template.content.cloneNode(true));
        contentHtml = tmpWrap.innerHTML;
      } else {
        // Synthesize a long-form article for luxury feel
        const t = escapeHtml(title);
        const ex = escapeHtml(excerpt);
        const cat = escapeHtml(category);
        const dt = escapeHtml(time);
        const loc = escapeHtml(location);

        contentHtml = `
          <p style="margin:0; color:var(--muted);">${ex}</p>
          <div style="margin-top:14px; display:grid; gap:12px;">
            <section class="glass-card" style="padding:14px; border-radius:18px;">
              <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                <div style="font-weight:800; letter-spacing:.02em;">Context</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; color:var(--muted); font-size:12px;">
                  <span class="meta-pill"><i class="ri-price-tag-3-line" aria-hidden="true"></i>${cat}</span>
                  <span class="meta-pill"><i class="ri-time-line" aria-hidden="true"></i>${dt}</span>
                  <span class="meta-pill"><i class="ri-map-pin-2-line" aria-hidden="true"></i>${loc}</span>
                </div>
              </div>
              <p style="margin:10px 0 0; color:var(--muted);">
                Kurdistan blends ancient layers of history with mountain landscapes, living traditions, and vibrant cities.
                This story highlights practical insights and cultural notes to help you explore with respect and curiosity.
              </p>
            </section>

            <section class="glass-card" style="padding:14px; border-radius:18px;">
              <div style="font-weight:800; letter-spacing:.02em;">Highlights</div>
              <ul style="margin:10px 0 0; padding-left:18px; color:var(--muted); display:grid; gap:8px;">
                <li>Architectural textures, bazaars, and community spaces that shape everyday life.</li>
                <li>Seasonal cues—weather, light, and crowds—ideal for photography and walking routes.</li>
                <li>Food culture: tea rituals, local bread, family restaurants, and friendly hospitality.</li>
                <li>Nature access: viewpoints, valleys, and scenic drives around major Kurdish cities.</li>
              </ul>
            </section>

            <section class="glass-card" style="padding:14px; border-radius:18px;">
              <div style="font-weight:800; letter-spacing:.02em;">Travel Notes</div>
              <p style="margin:10px 0 0; color:var(--muted);">
                Plan with flexibility. Confirm opening times, keep essentials secure, and follow local guidance.
                If you’re visiting nature spots, bring water, comfortable shoes, and a light layer for the evening.
              </p>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <span class="chip chip--active"><i class="ri-compass-3-line" aria-hidden="true"></i>Explore</span>
                <span class="chip chip--active"><i class="ri-camera-3-line" aria-hidden="true"></i>Photo</span>
                <span class="chip chip--active"><i class="ri-leaf-line" aria-hidden="true"></i>Nature</span>
                <span class="chip chip--active"><i class="ri-ancient-gate-line" aria-hidden="true"></i>Heritage</span>
              </div>
            </section>

            <section class="glass-card" style="padding:14px; border-radius:18px;">
              <div style="font-weight:800; letter-spacing:.02em;">Closing</div>
              <p style="margin:10px 0 0; color:var(--muted);">
                ${t} is one more reminder that Kurdistan is best experienced slowly—through people, places, and stories.
                Save your favorites, share respectfully, and keep exploring.
              </p>
            </section>
          </div>
        `;
      }

      return {
        id: card.getAttribute("data-id") || `news_${index + 1}`,
        title: String(title).trim(),
        excerpt: String(excerpt).trim(),
        category: String(category).trim(),
        date: String(time).trim(),
        location: String(location).trim(),
        contentHtml,
        el: card,
      };
    };

    STATE.news.items = cards.map(readCardData);

    const filterBtns = $$(APP.selectors.newsFilterBtn, news);
    const searchInput = qsIn(news, APP.selectors.newsSearchInput);
    const searchBtn = qsIn(news, APP.selectors.newsSearchBtn);
    const prevBtn = qsIn(news, APP.selectors.newsPrev);
    const nextBtn = qsIn(news, APP.selectors.newsNext);
    const pageEl = qsIn(news, APP.selectors.newsPage);

    // Ensure read more buttons
    STATE.news.items.forEach((it) => {
      let btn = qsIn(it.el, APP.selectors.readMoreBtn, "button.news-card__read", "a.news-card__read");
      if (!btn) {
        const footer = qsIn(it.el, ".news-card__footer") || (() => {
          const f = document.createElement("div");
          f.className = "news-card__footer";
          it.el.appendChild(f);
          return f;
        })();

        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mini-cta";
        btn.setAttribute("data-read-article", "1");
        btn.innerHTML = `<i class="ri-book-open-line" aria-hidden="true"></i>Read`;
        footer.appendChild(btn);
      }

      btn.addEventListener("click", () => {
        if (typeof window.__kurdistanOpenArticle === "function") {
          window.__kurdistanOpenArticle({
            title: it.title,
            excerpt: it.excerpt,
            category: it.category,
            date: it.date,
            location: it.location,
            contentHtml: it.contentHtml,
          });
        } else {
          alert(it.title);
        }
      });
    });

    const apply = () => {
      const filter = STATE.news.filter;
      const query = STATE.news.query.trim().toLowerCase();

      const filtered = STATE.news.items.filter((it) => {
        const cat = it.category.toLowerCase();
        const okFilter = filter === "all" ? true : cat.includes(filter);
        const okQuery = !query ? true : (it.title + " " + it.excerpt + " " + it.category + " " + it.location).toLowerCase().includes(query);
        return okFilter && okQuery;
      });

      // Pagination
      const totalPages = Math.max(1, Math.ceil(filtered.length / APP.news.perPage));
      STATE.news.page = clamp(STATE.news.page, 1, Math.min(totalPages, APP.news.maxPage));
      persistNewsPage();

      const start = (STATE.news.page - 1) * APP.news.perPage;
      const pageItems = filtered.slice(start, start + APP.news.perPage);

      // Hide all, then show page
      STATE.news.items.forEach((it) => {
        it.el.style.display = "none";
      });
      pageItems.forEach((it) => {
        it.el.style.display = "";
      });

      if (pageEl) pageEl.textContent = `Page ${STATE.news.page} / ${totalPages}`;
      if (prevBtn) prevBtn.disabled = STATE.news.page <= 1;
      if (nextBtn) nextBtn.disabled = STATE.news.page >= totalPages;

      filterBtns.forEach((b) => {
        const f = String(b.getAttribute("data-news-filter") || "all").toLowerCase();
        b.classList.toggle("is-active", f === filter);
      });

      dispatch("kurdistan:news:update", { filter, query, page: STATE.news.page, totalPages });
    };

    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        STATE.news.filter = String(btn.getAttribute("data-news-filter") || "all").toLowerCase();
        STATE.news.page = 1;
        apply();
      });
    });

    const doSearch = () => {
      STATE.news.query = searchInput ? String(searchInput.value || "") : "";
      STATE.news.page = 1;
      apply();
    };

    if (searchBtn) searchBtn.addEventListener("click", doSearch);
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doSearch();
        }
      });
      searchInput.addEventListener("input", debounce(doSearch, 240));
    }

    if (prevBtn) prevBtn.addEventListener("click", () => { STATE.news.page -= 1; apply(); });
    if (nextBtn) nextBtn.addEventListener("click", () => { STATE.news.page += 1; apply(); });

    // Initial filter active (if any)
    const activeBtn = filterBtns.find((b) => b.classList.contains("is-active"));
    if (activeBtn) STATE.news.filter = String(activeBtn.getAttribute("data-news-filter") || "all").toLowerCase();
    apply();
  }

  /* -----------------------------
     14) Forms: Contact + Newsletter
  ------------------------------ */
  function initForms() {
    initContactForm();
    initNewsletterForm();
  }

  function initContactForm() {
    const form = $(APP.selectors.contactForm);
    if (!form) return;

    const status = qsIn(form, APP.selectors.formStatus) || (() => {
      const s = document.createElement("div");
      s.setAttribute("data-status", "1");
      s.className = "form__status";
      form.appendChild(s);
      return s;
    })();

    const getField = (name) => (form.elements && form.elements[name]) ? form.elements[name] : null;

    const setStatus = (msg, kind = "info") => {
      status.textContent = msg;
      status.style.color =
        kind === "ok" ? "rgba(228,199,125,.95)" :
        kind === "err" ? "rgba(195,71,71,.95)" :
        "rgba(245,247,255,.72)";
    };

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const nameEl = getField("name") || getField("fullName") || getField("fullname");
      const emailEl = getField("email");
      const subjectEl = getField("subject");
      const messageEl = getField("message") || getField("details");

      const name = nameEl && "value" in nameEl ? String(nameEl.value || "").trim() : "";
      const email = emailEl && "value" in emailEl ? String(emailEl.value || "").trim() : "";
      const subject = subjectEl && "value" in subjectEl ? String(subjectEl.value || "").trim() : "";
      const message = messageEl && "value" in messageEl ? String(messageEl.value || "").trim() : "";

      if (!name || name.length < 2) return setStatus("Please enter your name.", "err");
      if (!validateEmail(email)) return setStatus("Please enter a valid email address.", "err");
      if (!subject || subject.length < 3) return setStatus("Please enter a subject.", "err");
      if (!message || message.length < 10) return setStatus("Please write a message (at least 10 characters).", "err");

      // Simulate sending
      setStatus("Sending…", "info");
      const btn = qsIn(form, "button[type='submit'], [data-submit]");
      if (btn) btn.disabled = true;

      setTimeout(() => {
        if (btn) btn.disabled = false;
        setStatus("Message sent ✓ We’ll respond as soon as possible.", "ok");
        form.reset();
      }, 850);
    });
  }

  function initNewsletterForm() {
    const form = $(APP.selectors.newsletterForm);
    if (!form) return;

    const input = qsIn(form, "input[type='email'], input[name='email'], .newsletter__input");
    const status = qsIn(form, ".newsletter__status", "[data-status]") || (() => {
      const s = document.createElement("div");
      s.className = "newsletter__status";
      s.setAttribute("data-status", "1");
      form.appendChild(s);
      return s;
    })();

    const setStatus = (msg, kind = "info") => {
      status.textContent = msg;
      status.style.color =
        kind === "ok" ? "rgba(228,199,125,.95)" :
        kind === "err" ? "rgba(195,71,71,.95)" :
        "rgba(245,247,255,.68)";
    };

    const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

    const onSubmit = (e) => {
      e.preventDefault();
      const email = input ? String(input.value || "").trim() : "";
      if (!validateEmail(email)) return setStatus("Enter a valid email to subscribe.", "err");

      setStatus("Subscribing…", "info");
      const btn = qsIn(form, "button[type='submit'], .newsletter__btn");
      if (btn) btn.disabled = true;

      setTimeout(() => {
        if (btn) btn.disabled = false;
        setStatus("Subscribed ✓ Welcome to Kurdistan updates.", "ok");
        if (input) input.value = "";
      }, 650);
    };

    if (form.tagName.toLowerCase() === "form") form.addEventListener("submit", onSubmit);
    else {
      // If the wrapper isn't a form, attach to button
      const btn = qsIn(form, "button[type='submit'], .newsletter__btn");
      if (btn) btn.addEventListener("click", onSubmit);
    }
  }

  /* -----------------------------
     15) To Top Button
  ------------------------------ */
  function initToTop() {
    const btn = $(APP.selectors.toTop);
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const behavior = isReducedMotion() ? "auto" : "smooth";
      window.scrollTo({ top: 0, behavior });
    });

    // Show/hide based on scroll depth
    const update = rafThrottle(() => {
      const y = window.scrollY || window.pageYOffset || 0;
      btn.style.opacity = y > 420 ? "1" : "0";
      btn.style.pointerEvents = y > 420 ? "auto" : "none";
      btn.style.transform = y > 420 ? "translateY(0)" : "translateY(6px)";
    });

    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* -----------------------------
     16) Optional: GSAP Enhancements
  ------------------------------ */
  function initOptionalGsapEnhancements() {
    // If GSAP is loaded, we can add subtle entrance animations to hero elements.
    const gsap = window.gsap;
    if (!gsap || isReducedMotion()) return;

    const hero = $(APP.selectors.hero);
    if (!hero) return;

    const title = qsIn(hero, ".hero__title");
    const subtitle = qsIn(hero, ".hero__subtitle");
    const ctas = qsaIn(hero, ".hero__cta .cta-btn");
    const stats = qsaIn(hero, ".hero__stats .stat-card");
    const panel = qsIn(hero, ".hero-panel");

    gsap.set([title, subtitle, ...ctas, ...stats, panel].filter(Boolean), { opacity: 0, y: 12 });

    const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.9 } });
    if (title) tl.to(title, { opacity: 1, y: 0 }, 0);
    if (subtitle) tl.to(subtitle, { opacity: 1, y: 0 }, 0.12);

    if (ctas.length) tl.to(ctas, { opacity: 1, y: 0, stagger: 0.08 }, 0.2);
    if (stats.length) tl.to(stats, { opacity: 1, y: 0, stagger: 0.06 }, 0.34);
    if (panel) tl.to(panel, { opacity: 1, y: 0 }, 0.28);
  }

  /* -----------------------------
     17) Public convenience actions (optional)
  ------------------------------ */
  // Allow opening overlays by calling window helpers from HTML buttons
  window.KurdistanUI = {
    openSearch() {
      const ov = $(APP.selectors.searchOverlay);
      if (ov) openOverlay(ov);
    },
    openWeather() {
      const ov = $(APP.selectors.weatherOverlay);
      if (ov) openOverlay(ov);
    },
    openPlanner() {
      const ov = $(APP.selectors.plannerOverlay);
      if (ov) openOverlay(ov);
    },
    closeTop() {
      closeTopOverlay();
    },
    scrollTo(id) {
      const el = document.getElementById(String(id || "").replace("#", ""));
      if (el) smoothScrollTo(el, STATE.headerOffset);
    },
  };
})();
