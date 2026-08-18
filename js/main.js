// Coachable Labs — site behaviour + motion layer.
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

  /* ---------- Split the hero heading into masked words ---------- */
  document.querySelectorAll(".hero-title").forEach(function (el) {
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

  /* ---------- Process steps: spine geometry + scroll-driven fill ---------- */
  var stepList = document.getElementById("step-list");
  var stepSpine = document.getElementById("step-spine");
  var stepFill = document.getElementById("step-spine-fill");
  var stepItems = stepList ? [].slice.call(stepList.children) : [];
  // Distance from the top of a step row to the centre of its marker:
  // 22px of padding + half of the 34px marker.
  var MARKER_CENTER = 39;
  var spineTop = 0, spineHeight = 0;

  function layoutSpine() {
    if (!stepItems.length || !stepSpine) return;
    var first = stepItems[0];
    var last = stepItems[stepItems.length - 1];
    spineTop = first.offsetTop + MARKER_CENTER;
    spineHeight = last.offsetTop + MARKER_CENTER - spineTop;
    stepSpine.style.top = spineTop + "px";
    stepSpine.style.height = spineHeight + "px";
  }

  function updateSteps(vh) {
    if (!stepItems.length || !spineHeight) return;
    // Progress is measured against a line slightly below the viewport centre,
    // so a step lights up as you reach it rather than after it has gone past.
    var line = vh * 0.55;
    var spineRect = stepSpine.getBoundingClientRect();
    var p = (line - spineRect.top) / spineHeight;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    stepFill.style.height = (p * 100).toFixed(2) + "%";

    var reached = -1;
    stepItems.forEach(function (li, i) {
      var center = li.getBoundingClientRect().top + MARKER_CENTER;
      var done = center <= line;
      li.classList.toggle("is-done", done);
      if (done) reached = i;
    });
    stepItems.forEach(function (li, i) {
      li.classList.toggle("is-active", i === reached);
    });
  }

  if (stepItems.length && reduceMotion) {
    stepItems.forEach(function (li) { li.classList.add("is-done"); });
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
    document.querySelectorAll(".hero-ctas .btn, .floating-cta").forEach(function (btn) {
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
