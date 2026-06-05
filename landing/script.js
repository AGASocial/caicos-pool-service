/* =========================================================
   Neura Pool — Landing interactions
   - Mobile menu
   - Smooth scroll for anchor links
   - Reveal-on-scroll (IntersectionObserver)
   - FAQ accordion is native <details>, no JS needed
   - ROI calculator
   - Animated stat counters
   - Form submission feedback
   ========================================================= */

(function () {
  'use strict';

  /* --------- Mobile menu --------- */
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
      // swap icon
      const icon = menuBtn.querySelector('svg');
      if (icon) {
        icon.innerHTML = isOpen
          ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>'
          : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>';
      }
    });
    // close on link click
    mobileMenu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        const icon = menuBtn.querySelector('svg');
        if (icon) {
          icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>';
        }
      });
    });
  }

  /* --------- Smooth scroll for in-page anchors --------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#' || href.length < 2) return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const y = target.getBoundingClientRect().top + window.scrollY - 72;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  /* --------- Reveal on scroll --------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* --------- Animated stat counters --------- */
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    const counterIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterIO.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((c) => counterIO.observe(c));
  } else {
    counters.forEach(animateCounter);
  }
  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 1400;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = target * eased;
      el.textContent = prefix + value.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }
    requestAnimationFrame(step);
  }

  /* --------- ROI Calculator --------- */
  const calc = {
    techs: document.getElementById('calcTechs'),
    pools: document.getElementById('calcPools'),
    hours: document.getElementById('calcHours'),
    hoursSaved: document.getElementById('calcHoursSaved'),
    money: document.getElementById('calcMoney'),
    reports: document.getElementById('calcReports'),
  };
  if (calc.techs && calc.pools) {
    const handler = () => {
      const techs = Math.max(1, parseInt(calc.techs.value || '0', 10) || 0);
      const pools = Math.max(1, parseInt(calc.pools.value || '0', 10) || 0);
      // Estimations: 12 min saved per pool (paper → digital), tech salary $22/h, photos reduced sync
      const minPerPoolSaved = 12;
      const hoursPerMonth = (techs * pools * minPerPoolSaved * 4) / 60; // 4 weeks
      const laborValue = hoursPerMonth * 22;
      const reportsGenerated = techs * pools * 4; // monthly reports

      calc.hoursSaved.textContent = Math.round(hoursPerMonth).toLocaleString();
      calc.money.textContent = '$' + Math.round(laborValue).toLocaleString();
      calc.reports.textContent = reportsGenerated.toLocaleString();
    };
    [calc.techs, calc.pools].forEach((el) => el.addEventListener('input', handler));
    handler();
  }

  /* --------- Email capture form --------- */
  const form = document.getElementById('ctaForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const btn = form.querySelector('button[type="submit"]');
      if (!input || !btn) return;
      const email = input.value.trim();
      if (!email || !email.includes('@')) {
        input.focus();
        input.style.borderColor = 'rgba(239, 68, 68, 0.6)';
        setTimeout(() => { input.style.borderColor = ''; }, 2000);
        return;
      }
      const originalText = btn.textContent;
      btn.textContent = 'Sending…';
      btn.disabled = true;
      // Simulated request — replace with real endpoint
      setTimeout(() => {
        btn.textContent = '✓ Check your inbox';
        input.value = '';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.disabled = false;
        }, 3500);
      }, 900);
    });
  }

  /* --------- Header shadow on scroll --------- */
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => {
      if (window.scrollY > 8) {
        header.classList.add('shadow-2xl', 'shadow-black/30');
      } else {
        header.classList.remove('shadow-2xl', 'shadow-black/30');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --------- Year in footer --------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
