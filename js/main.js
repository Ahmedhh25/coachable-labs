// Coachable Labs - site behaviour + motion layer.
// Every block guards on the elements it needs, so this one file serves every page.
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

  /* ---------- Coaching dropdown ----------
     The parent is a real link to /coaching/; the caret is a separate control, so
     the hub page stays reachable by keyboard and by tap. Below 960px the caret is
     hidden and the submenu is simply stacked open. */
  var navItem = document.getElementById("nav-coaching");
  var caret = document.getElementById("nav-caret");
  if (navItem && caret) {
    var setMenu = function (open) {
      navItem.classList.toggle("is-open", open);
      caret.setAttribute("aria-expanded", open ? "true" : "false");
    };

    caret.addEventListener("click", function (e) {
      e.preventDefault();
      setMenu(caret.getAttribute("aria-expanded") !== "true");
    });

    if (finePointer) {
      navItem.addEventListener("mouseenter", function () { setMenu(true); });
      navItem.addEventListener("mouseleave", function () { setMenu(false); });
    }

    navItem.addEventListener("focusout", function (e) {
      if (!navItem.contains(e.relatedTarget)) setMenu(false);
    });
    document.addEventListener("click", function (e) {
      if (!navItem.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
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

  /* ---------- Split the hero heading into masked words ----------
     Walks nested elements, not just bare text children: the home headline is
     split across two spans, and both halves need to animate. */
  document.querySelectorAll(".hero-title").forEach(function (el) {
    var wordIndex = 0;

    (function split(parent) {
      [].slice.call(parent.childNodes).forEach(function (child) {
        if (child.nodeType === 1) { split(child); return; }
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
          // Capped, or the last words of a 25-word headline arrive far too late.
          inner.style.transitionDelay = (0.08 + Math.min(wordIndex, 22) * 0.035).toFixed(3) + "s";
          mask.appendChild(inner);
          frag.appendChild(mask);
          wordIndex++;
        });
        parent.replaceChild(frag, child);
      });
    })(el);

    el.classList.add("words");
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
  }

  var hasObserver = "IntersectionObserver" in window;
  var observer = hasObserver
    ? new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              makeVisible(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
      )
    : null;

  if (observer) {
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(makeVisible);
  }

  /* ---------- Scroll-in motion for the text-heavy pages ----------
     Pages like /how-it-works/, /approach/, /questions/ and
     /coaching-vs-therapy/ are long runs of prose with nothing to hold the eye.
     Rather than tagging every paragraph in the markup, the classes are applied
     here: with JavaScript off nothing is hidden, and under reduced motion this
     whole block is skipped.

     Only elements starting below the fold are animated. Anything already on
     screen at load would otherwise flash in. */
  if (observer && !reduceMotion) {
    var viewportH = window.innerHeight;

    // [selector, variant, stagger siblings within the same parent]
    var animGroups = [
      [".section-heading", "up", false],
      [".sub-heading", "up", false],
      [".page-lede", "up", false],
      ["main .section > .container > p", "up", false],
      [".dot-list li, .related-list li, .reassurance-list li", "up", true],
      [".faq-item", "up", true],
      [".track-card, .coach-card, .contact-card, .testimonial", "up", true],
      [".credential", "up", true],
      [".price-figure", "pop", false],
      [".booking-fallback, .form-confirm", "up", false],
      // The panel arrives first, then its contents stagger in on top of it.
      [".cta-panel", "pop", false],
      [".cta-heading, .cta-body, .cta-primary, .cta-secondary", "up", true]
    ];

    var animate = function (el, variant) {
      // Never double up on an element the markup already reveals, and leave the
      // hero alone so the page opens on its own animation.
      if (el.classList.contains("reveal")) return false;
      if (el.closest(".hero, .site-header, .site-footer")) return false;
      if (el.getBoundingClientRect().top < viewportH) return false;
      el.classList.add("anim-" + variant);
      observer.observe(el);
      return true;
    };

    animGroups.forEach(function (group) {
      var selector = group[0], variant = group[1], stagger = group[2];
      var seen = [];

      [].slice.call(document.querySelectorAll(selector)).forEach(function (el) {
        if (!animate(el, variant)) return;
        if (!stagger || !el.parentElement) return;
        // Siblings arrive one after another rather than all at once.
        var i = seen.filter(function (s) { return s === el.parentElement; }).length;
        seen.push(el.parentElement);
        if (i > 0) el.style.transitionDelay = (Math.min(i, 7) * 0.07).toFixed(2) + "s";
      });
    });

    // The section headings carry the one repeated motif: a short rule that
    // draws itself in underneath.
    document.querySelectorAll(".section-heading.anim-up").forEach(function (el) {
      el.classList.add("anim-keyline");
    });

    // The two comparison columns come in from opposite sides.
    var compareCols = document.querySelectorAll(".compare-col");
    if (compareCols.length === 2) {
      ["left", "right"].forEach(function (side, i) {
        var col = compareCols[i];
        if (col.getBoundingClientRect().top < viewportH) return;
        col.classList.add("anim-" + side);
        observer.observe(col);
      });
    }

    /* ---------- The two approach diagrams ----------
       The argument of that page is in these two pictures, so the tracks draw
       themselves: four lines running out to nothing, then four curves arriving
       at a single point. Lengths are measured off the real geometry, so this
       keeps working if the paths are ever redrawn. */
    document.querySelectorAll(".diagram svg").forEach(function (svg) {
      var figure = svg.closest(".diagram");
      var paths = [].slice.call(svg.querySelectorAll(".dg-split path, .dg-join path"));
      if (!paths.length) return;

      figure.classList.add("diagram-anim");

      paths.forEach(function (path, i) {
        var length = path.getTotalLength();
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = length;
        path.style.transition = "stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1) " + (0.25 + i * 0.16).toFixed(2) + "s";
      });

      // Labels first, then each track, then the dot it lands on.
      svg.querySelectorAll(".dg-labels text").forEach(function (label, i) {
        label.style.transitionDelay = (i * 0.09).toFixed(2) + "s";
      });
      svg.querySelectorAll(".dg-ends circle").forEach(function (dot, i) {
        dot.style.transitionDelay = (1.0 + i * 0.16).toFixed(2) + "s";
      });
      svg.querySelectorAll(".dg-hub, .dg-hub-ring").forEach(function (hub, i) {
        hub.style.transitionDelay = (1.55 + i * 0.1).toFixed(2) + "s";
      });

      drawWhenSeen(figure, function () {
        figure.classList.add("is-drawn");
        paths.forEach(function (path) { path.style.strokeDashoffset = "0"; });
      });
    });
  }

  // Fires a one-shot callback the first time an element is well into view.
  function drawWhenSeen(el, run) {
    if (!("IntersectionObserver" in window)) return run();
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          run();
          io.disconnect();
        });
      },
      { threshold: 0.25 }
    );
    io.observe(el);
  }

  /* ---------- Recognition rows: driven by scroll position ----------
     Not a one-shot entrance. Each row reports how far it has travelled up the
     viewport as --lit, from 0 to 1, and the CSS hangs the dot, the rule, the
     marker sweep and a small lift off that single number. So the list keeps
     moving the whole way past, and unwinds if you scroll back up.

     --lit falls back to 1 everywhere it is used, so with JavaScript off or
     under reduced motion every row simply renders finished. */
  var recognitionRows = [].slice.call(document.querySelectorAll(".recognition-list li"));

  function updateRecognition(vh) {
    // Starts as the row clears the bottom of the screen, complete a little
    // above the middle, so it finishes while the row is still being read.
    var from = vh * 0.92;
    var span = vh * 0.45;
    // The row you are level with is picked the same way the process steps pick
    // theirs: whichever sits nearest a line just below the viewport centre.
    var line = vh * 0.5;
    var nearest = -1;
    var nearestGap = Infinity;

    for (var i = 0; i < recognitionRows.length; i++) {
      var rect = recognitionRows[i].getBoundingClientRect();
      var p = (from - rect.top) / span;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      recognitionRows[i].style.setProperty("--lit", p.toFixed(3));

      // Only rows actually on screen can be the active one.
      if (rect.bottom > 0 && rect.top < vh) {
        var gap = Math.abs(rect.top + rect.height / 2 - line);
        if (gap < nearestGap) {
          nearestGap = gap;
          nearest = i;
        }
      }
    }

    for (var j = 0; j < recognitionRows.length; j++) {
      recognitionRows[j].classList.toggle("is-active", j === nearest);
    }
  }

  /* ---------- Process steps: spine geometry + scroll-driven fill ----------
     Used by the four steps on the home page and the four on /how-it-works/, so
     it handles any number of instances on a page rather than one fixed set. */
  // Distance from the top of a step row to the centre of its marker:
  // 22px of padding + half of the 34px marker.
  var MARKER_CENTER = 39;

  var stepGroups = [].slice.call(document.querySelectorAll(".step-wrap"))
    .map(function (wrap) {
      var list = wrap.querySelector(".step-list");
      return {
        spine: wrap.querySelector(".step-spine"),
        fill: wrap.querySelector(".step-spine-fill"),
        items: list ? [].slice.call(list.children) : [],
        height: 0
      };
    })
    .filter(function (g) { return g.spine && g.fill && g.items.length; });

  function layoutSpine() {
    stepGroups.forEach(function (g) {
      var first = g.items[0];
      var last = g.items[g.items.length - 1];
      var top = first.offsetTop + MARKER_CENTER;
      g.height = last.offsetTop + MARKER_CENTER - top;
      g.spine.style.top = top + "px";
      g.spine.style.height = g.height + "px";
    });
  }

  function updateSteps(vh) {
    // Progress is measured against a line slightly below the viewport centre,
    // so a step lights up as you reach it rather than after it has gone past.
    var line = vh * 0.55;

    stepGroups.forEach(function (g) {
      if (!g.height) return;
      var p = (line - g.spine.getBoundingClientRect().top) / g.height;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      g.fill.style.height = (p * 100).toFixed(2) + "%";

      var reached = -1;
      g.items.forEach(function (li, i) {
        var center = li.getBoundingClientRect().top + MARKER_CENTER;
        var done = center <= line;
        li.classList.toggle("is-done", done);
        if (done) reached = i;
      });
      g.items.forEach(function (li, i) {
        li.classList.toggle("is-active", i === reached);
      });
    });
  }

  if (reduceMotion) {
    stepGroups.forEach(function (g) {
      g.items.forEach(function (li) { li.classList.add("is-done"); });
    });
  }

  /* ---------- Unified scroll loop: header, progress, CTA, parallax ---------- */
  var header = document.querySelector(".site-header");
  var progressBar = document.querySelector(".scroll-progress");
  var floatingCta = document.querySelector(".floating-cta");
  var swirl = document.querySelector(".hero-swirl");

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
      updateSteps(vh);
      updateRecognition(vh);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () {
    layoutSpine();
    onScroll();
  });
  layoutSpine();
  updateScroll();
  // Rows are laid out before the webfont swaps, so remeasure once it lands.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      layoutSpine();
      updateScroll();
    });
  }

  /* ---------- 3D tilt + cursor spotlight on cards ---------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".contact-card").forEach(function (card) {
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
    document.querySelectorAll(".hero-ctas .btn, .floating-cta, .cta-primary").forEach(function (btn) {
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

  /* ---------- Intake form (/start/) ----------
     Posts to the same Formspree endpoint the previous single-page site used.
     Validation is inline and per-field, on blur and on submit; success replaces
     the form in place rather than redirecting. */
  var form = document.getElementById("intake-form");
  var status = document.getElementById("form-status");
  var confirmBox = document.getElementById("form-confirm");

  if (form) {
    var rules = {
      email: function (value) {
        if (!value.trim()) return "We need an email address to come back to you.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "That does not look like an email address.";
        return "";
      },
      message: function (value) {
        if (!value.trim()) return "Tell us what is going on, in as much or as little detail as you want.";
        return "";
      }
    };

    var showFieldError = function (field, message) {
      var wrap = field.closest(".form-field");
      var error = document.getElementById(field.id + "-error");
      wrap.classList.toggle("has-error", !!message);
      field.setAttribute("aria-invalid", message ? "true" : "false");
      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }
    };

    var validateField = function (id) {
      var field = document.getElementById(id);
      if (!field) return true;
      var message = rules[id](field.value);
      showFieldError(field, message);
      return !message;
    };

    Object.keys(rules).forEach(function (id) {
      var field = document.getElementById(id);
      if (!field) return;
      field.addEventListener("blur", function () { validateField(id); });
      field.addEventListener("input", function () {
        if (field.closest(".form-field").classList.contains("has-error")) validateField(id);
      });
    });

    var showStatus = function (text) {
      if (!status) return;
      status.textContent = text;
      status.classList.remove("pop");
      void status.offsetWidth;
      status.classList.add("pop");
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var firstInvalid = null;
      Object.keys(rules).forEach(function (id) {
        if (!validateField(id) && !firstInvalid) firstInvalid = document.getElementById(id);
      });
      if (firstInvalid) {
        showStatus("");
        firstInvalid.focus();
        return;
      }

      var submitBtn = form.querySelector("button[type=submit]");
      if (submitBtn) submitBtn.disabled = true;
      showStatus("Sending...");

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      }).then(function (response) {
        if (response.ok) {
          form.hidden = true;
          if (confirmBox) {
            confirmBox.hidden = false;
            confirmBox.focus();
            confirmBox.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
          }
        } else {
          response.json().then(function (data) {
            var msg = data && data.errors && data.errors.length
              ? data.errors.map(function (err) { return err.message; }).join(", ")
              : "Something went wrong. Please try again, or email us directly.";
            showStatus(msg);
          }).catch(function () {
            showStatus("Something went wrong. Please try again, or email us directly.");
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
