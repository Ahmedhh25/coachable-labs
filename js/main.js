// Coachable Labs — site behavior + motion layer
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Mobile nav ---------- */
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Logo intro: auto-play the shutter animation once on load ---------- */
  var logoEl = document.querySelector(".logo");
  if (logoEl && !reduceMotion) {
    setTimeout(function () {
      logoEl.classList.add("intro-play");
      setTimeout(function () {
        logoEl.classList.remove("intro-play");
      }, 1900); // 1.5s animation + up to 0.28s stagger + buffer
    }, 500);
  }

  /* ---------- Hero badge: measure text so it can slide out to its exact width ---------- */
  var badgeText = document.querySelector(".hero-badge-text");
  var badgeInner = document.querySelector(".hero-badge-text-inner");
  if (badgeText && badgeInner) {
    var measureBadge = function () {
      // +2px of slack so sub-pixel rounding never clips the last glyph.
      badgeText.style.setProperty("--badge-text-w", badgeInner.offsetWidth + 2 + "px");
    };
    measureBadge();
    // The webfont almost never lands before this script runs, so the first
    // measurement is taken in the fallback font and comes out too narrow.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureBadge);
    window.addEventListener("resize", measureBadge);
  }

  /* ---------- Split display headings into masked words ---------- */
  document.querySelectorAll(".hero-title, .serif-heading, .sans-display").forEach(function (el) {
    var wordIndex = 0;
    [].slice.call(el.childNodes).forEach(function (child) {
      if (child.nodeType !== 3 || !child.textContent.trim()) return;
      var frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(" "));
          return;
        }
        var mask = document.createElement("span");
        mask.className = "word";
        var inner = document.createElement("span");
        inner.className = "word-inner";
        inner.textContent = part;
        inner.style.transitionDelay = (0.08 + wordIndex * 0.05).toFixed(2) + "s";
        mask.appendChild(inner);
        frag.appendChild(mask);
        wordIndex++;
      });
      el.replaceChild(frag, child);
    });
    el.classList.add("words");
  });

  /* ---------- Widget progress bars start empty, fill on reveal ---------- */
  document.querySelectorAll(".widget-progress-bar > div").forEach(function (bar) {
    bar.dataset.width = bar.style.width || "90%";
    bar.style.width = "0%";
  });

  /* ---------- Scroll reveal with sibling stagger ---------- */
  var revealEls = [].slice.call(document.querySelectorAll(".reveal"));
  revealEls.forEach(function (el) {
    if (!el.parentElement || el.classList.contains("words")) return;
    var sibs = [].filter.call(el.parentElement.children, function (c) {
      return c.classList.contains("reveal");
    });
    var i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = (Math.min(i, 6) * 0.09).toFixed(2) + "s";
  });

  function makeVisible(el) {
    el.classList.add("is-visible");
    el.querySelectorAll(".widget-progress-bar > div").forEach(function (bar) {
      setTimeout(function () { bar.style.width = bar.dataset.width; }, 400);
    });
  }

  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            makeVisible(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(makeVisible);
  }

  /* ---------- Unified scroll loop: header, progress, CTA, parallax ---------- */
  var header = document.querySelector(".site-header");
  var progressBar = document.querySelector(".scroll-progress");
  var floatingCta = document.querySelector(".floating-cta");
  var swirl = document.querySelector(".hero-swirl");
  var parallaxPhotos = [].slice.call(document.querySelectorAll(".dark-card-photo"));

  var ticking = false;
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScroll);
    }
  }
  function updateScroll() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    var vh = window.innerHeight;

    if (header) header.classList.toggle("is-scrolled", y > 12);
    if (progressBar) {
      var max = document.documentElement.scrollHeight - vh;
      progressBar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }
    if (floatingCta) floatingCta.classList.toggle("is-shown", y > vh * 0.7);

    if (!reduceMotion) {
      if (swirl) swirl.style.setProperty("--py", (y * 0.28).toFixed(1) + "px");
      parallaxPhotos.forEach(function (img) {
        var r = img.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var p = (r.top + r.height / 2 - vh / 2) / vh;
        img.style.transform = "translateY(" + (p * -24).toFixed(1) + "px) scale(1.06)";
      });
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  updateScroll();

  /* ---------- Carousel: arrows, drag-to-scroll, gentle autoplay ---------- */
  var track = document.getElementById("carousel-track");
  var prev = document.getElementById("carousel-prev");
  var next = document.getElementById("carousel-next");
  if (track && prev && next) {
    var autoTimer = null;
    var stopAuto = function () {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    };
    var step = function () {
      var card = track.querySelector(".photo-card");
      var gap = parseFloat(getComputedStyle(track).columnGap) || 36;
      return card ? card.offsetWidth + gap : 350;
    };

    prev.addEventListener("click", function () { stopAuto(); track.scrollBy({ left: -step(), behavior: "smooth" }); });
    next.addEventListener("click", function () { stopAuto(); track.scrollBy({ left: step(), behavior: "smooth" }); });

    var down = false, startX = 0, startLeft = 0, dragged = false;
    track.addEventListener("pointerdown", function (e) {
      down = true;
      dragged = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      track.classList.add("dragging");
    });
    window.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) dragged = true;
      track.scrollLeft = startLeft - dx;
    });
    window.addEventListener("pointerup", function () {
      if (!down) return;
      down = false;
      track.classList.remove("dragging");
      if (dragged) stopAuto();
    });
    track.addEventListener("dragstart", function (e) { e.preventDefault(); });

    if (!reduceMotion) {
      autoTimer = setInterval(function () {
        if (track.matches(":hover")) return;
        var atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 20;
        if (atEnd) track.scrollTo({ left: 0, behavior: "smooth" });
        else track.scrollBy({ left: step(), behavior: "smooth" });
      }, 4500);
    }
  }

  /* ---------- 3D tilt + cursor spotlight on cards ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".package-card, .benefit-card, .dark-card, .contact-card").forEach(function (card) {
      card.classList.add("tilt");
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--rx", (y * -5).toFixed(2) + "deg");
        card.style.setProperty("--ry", (x * 7).toFixed(2) + "deg");
        card.style.setProperty("--sx", ((x + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--sy", ((y + 0.5) * 100).toFixed(1) + "%");
      });
      card.addEventListener("mouseleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".hero-ctas .btn, .floating-cta, .carousel-btn").forEach(function (btn) {
      btn.classList.add("magnetic");
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.22;
        btn.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.transform = "";
      });
    });
  }

  /* ---------- Click ripple on real buttons/links ---------- */
  document.querySelectorAll("a.btn, button.btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      if (reduceMotion) return;
      var r = btn.getBoundingClientRect();
      var d = Math.max(r.width, r.height) * 2;
      var s = document.createElement("span");
      s.className = "ripple";
      s.style.width = s.style.height = d + "px";
      s.style.left = (e.clientX - r.left - d / 2) + "px";
      s.style.top = (e.clientY - r.top - d / 2) + "px";
      btn.appendChild(s);
      setTimeout(function () { s.remove(); }, 700);
    });
  });

  /* ---------- Objections accordion ---------- */
  var accItems = [].slice.call(document.querySelectorAll(".acc-item"));
  if (accItems.length) {
    var panels = accItems.map(function (item) {
      return {
        btn: item.querySelector(".acc-q"),
        panel: item.querySelector(".acc-a")
      };
    });

    var setOpen = function (entry, open) {
      entry.btn.setAttribute("aria-expanded", open ? "true" : "false");
      // Animate to the measured height, then release to auto so reflow (resize,
      // font swap) doesn't leave the panel clipped at a stale pixel value.
      if (open) {
        entry.panel.style.height = entry.panel.scrollHeight + "px";
        if (!reduceMotion) {
          window.setTimeout(function () {
            if (entry.btn.getAttribute("aria-expanded") === "true") entry.panel.style.height = "auto";
          }, 420);
        } else {
          entry.panel.style.height = "auto";
        }
      } else {
        entry.panel.style.height = entry.panel.scrollHeight + "px";
        void entry.panel.offsetHeight;
        entry.panel.style.height = "0px";
      }
    };

    panels.forEach(function (entry) {
      setOpen(entry, entry.btn.getAttribute("aria-expanded") === "true");
      entry.btn.addEventListener("click", function () {
        var willOpen = entry.btn.getAttribute("aria-expanded") !== "true";
        panels.forEach(function (other) {
          if (other !== entry && other.btn.getAttribute("aria-expanded") === "true") setOpen(other, false);
        });
        setOpen(entry, willOpen);
      });
    });

    window.addEventListener("resize", function () {
      panels.forEach(function (entry) {
        if (entry.btn.getAttribute("aria-expanded") === "true") entry.panel.style.height = "auto";
      });
    });
  }

  /* ---------- Contact form (Formspree) ---------- */
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var submitBtn = form.querySelector("button[type=submit]");
      var showStatus = function (text) {
        status.textContent = text;
        status.classList.remove("pop");
        void status.offsetWidth;
        status.classList.add("pop");
      };

      if (submitBtn) submitBtn.disabled = true;
      showStatus("Sending...");

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      }).then(function (response) {
        if (response.ok) {
          showStatus("Thanks — we'll be in touch shortly!");
          form.reset();
        } else {
          response.json().then(function (data) {
            var msg = data && data.errors && data.errors.length
              ? data.errors.map(function (err) { return err.message; }).join(", ")
              : "Something went wrong. Please try again or email us directly.";
            showStatus(msg);
          }).catch(function () {
            showStatus("Something went wrong. Please try again or email us directly.");
          });
        }
      }).catch(function () {
        showStatus("Something went wrong. Please check your connection and try again.");
      }).finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }
})();
