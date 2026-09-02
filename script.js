// Scroll-reveal animation (progressive enhancement — content is visible by default;
// this class opts elements into the fade-in-on-scroll treatment)
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.classList.add("js-animate-ready");

  var obs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  document.querySelectorAll(".animate").forEach(function (el, i) {
    el.style.transitionDelay = (i % 4) * 0.06 + "s";
    obs.observe(el);
  });

  // Safety net: if anything is still hidden after load (print, fast scroll,
  // observer edge cases), force it visible so content is never lost.
  window.addEventListener("load", function () {
    setTimeout(function () {
      document.querySelectorAll(".animate:not(.visible)").forEach(function (el) {
        el.classList.add("visible");
      });
    }, 1500);
  });
}

window.addEventListener("beforeprint", function () {
  document.querySelectorAll(".animate").forEach(function (el) {
    el.classList.add("visible");
  });
});

// Mobile nav toggle
var navToggle = document.getElementById("navToggle");
var navLinks = document.getElementById("navLinks");
if (navToggle && navLinks) {
  navToggle.addEventListener("click", function () {
    var isOpen = navLinks.classList.toggle("open");
    navToggle.classList.toggle("open", isOpen);
    navToggle.setAttribute("aria-expanded", isOpen);
  });
  navLinks.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      navLinks.classList.remove("open");
      navToggle.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}
