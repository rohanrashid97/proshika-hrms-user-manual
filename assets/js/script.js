/**
 * Proshika HRMS - Main Application Script
 * Features: Dynamic Loading, ScrollSpy, Search with Navigation, Video Autoplay
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- গ্লোবাল এলিমেন্ট রেফারেন্স এবং কনস্ট্যান্ট ---
  const mainContainer = document.getElementById("main-container");
  const sidebarContainer = document.getElementById("sidebar-container");
  const backToTopButton = document.getElementById("backToTop");
  const HEADER_OFFSET = 80; // ফিক্সড হেডারের জন্য অফসেট

  let observer; // ScrollSpy Observer
  let isClickScrolling = true; // ক্লিক করে স্ক্রল করার সময় ScrollSpy বন্ধ রাখার ফ্ল্যাগ

  // সার্চ নেভিগেশনের জন্য ভ্যারিয়েবল
  let currentMatchIndex = -1;
  let matches = [];

  // ==========================================
  // ১. ডাইনামিক কন্টেন্ট লোডিং (Sidebar & Main)
  // ==========================================
  const loadLayout = async () => {
    try {
      // Sidebar লোড করা
      const sidebarRes = await fetch("partials/sidebar.html");
      const sidebarHtml = await sidebarRes.text();
      sidebarContainer.innerHTML = sidebarHtml;

      // সাইডবার লোড হওয়ার পর এর লজিক ইনিশিয়ালাইজ করা
      initializeAccordion();
      initializeSidebarLinks();

      // Main Content লোড করা
      const mainRes = await fetch("partials/main.html");
      const mainHtml = await mainRes.text();
      mainContainer.innerHTML = mainHtml;

      // মেইন কন্টেন্ট লোড হওয়ার পর স্ক্রল এবং ভিডিও লজিক ইনিশিয়ালাইজ করা
      initializeScrollSpy();
      initializeVideoObserver();
      console.log("✅ Layout Loaded Successfully");
    } catch (e) {
      console.error("❌ Layout Load Failed:", e);
    }
  };

  loadLayout();

  // ==========================================
  // ২. অ্যাকর্ডিয়ন লজিক (Sidebar Menu)
  // ==========================================
  const initializeAccordion = () => {
    sidebarContainer.addEventListener("click", (e) => {
      const header = e.target.closest(".accordion-header");
      if (!header) return;

      const content = header.nextElementSibling;
      const isOpen = header.getAttribute("aria-expanded") === "true";

      // =========================
      // 🔹 ACTIVE CLASS HANDLE
      // =========================
      sidebarContainer
        .querySelectorAll(".accordion-header")
        .forEach((h) => h.classList.remove("active"));

      header.classList.add("active");

      // =========================
      // 🔹 CHAPTER CLICK → SCROLL
      // =========================
      const targetId = header.getAttribute("data-target");
      const targetElement = document.querySelector(targetId);

      if (targetElement && mainContainer) {
        isClickScrolling = true;
        const targetPosition = targetElement.offsetTop - HEADER_OFFSET;

        mainContainer.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });

        // স্ক্রল শেষ হওয়া পর্যন্ত ScrollSpy বন্ধ রাখা
        setTimeout(() => {
          isClickScrolling = false;
        }, 800);

        // optional highlight effect 🔥
        targetElement.style.transition = "background 0.3s";
        targetElement.style.background = "#fff3cd";

        setTimeout(() => {
          targetElement.style.background = "";
        }, 1200);
      }

      // =========================
      // 🔹 CLOSE ALL ACCORDION
      // =========================
      sidebarContainer.querySelectorAll(".accordion-header").forEach((h) => {
        h.setAttribute("aria-expanded", "false");

        const c = h.nextElementSibling;
        if (c) c.style.maxHeight = null;

        const icon = h.querySelector(".icon");
        if (icon) icon.textContent = "▶";
      });

      // =========================
      // 🔹 OPEN CURRENT ONE
      // =========================
      if (!isOpen) {
        header.setAttribute("aria-expanded", "true");

        if (content) {
          content.style.maxHeight = content.scrollHeight + "px";
        }

        const icon = header.querySelector(".icon");
        if (icon) icon.textContent = "▼";
      }
    });
  };

  // ==========================================
  // ৩. সাইডবার লিঙ্ক ক্লিক ও স্মুথ স্ক্রল
  // ==========================================
  const initializeSidebarLinks = () => {
    sidebarContainer.addEventListener("click", function (e) {
      const link = e.target.closest("a");
      if (link && link.getAttribute("href")?.startsWith("#")) {
        e.preventDefault();
        isClickScrolling = true;

        // একটিভ ক্লাস ম্যানেজমেন্ট
        sidebarContainer
          .querySelectorAll(".sidebar-nav a")
          .forEach((a) => a.classList.remove("active"));
        link.classList.add("active");

        const targetId = link.getAttribute("href");
        const targetElement = document.querySelector(targetId);

        if (targetElement && mainContainer) {
          const targetPosition = targetElement.offsetTop - HEADER_OFFSET;
          mainContainer.scrollTo({ top: targetPosition, behavior: "smooth" });

          // স্ক্রল শেষ হওয়া পর্যন্ত ScrollSpy বন্ধ রাখা
          setTimeout(() => {
            isClickScrolling = false;
          }, 800);
        }
      }
    });
  };

  // ==========================================
  // ৪. ScrollSpy (স্ক্রল অনুযায়ী মেনু একটিভ করা)
  // ==========================================
  const initializeScrollSpy = () => {
    const sections = mainContainer.querySelectorAll("section[id]");
    observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling) return;

        entries.forEach((entry) => {
          const id = entry.target.getAttribute("id");
          const link = sidebarContainer.querySelector(
            `.sidebar-nav a[href="#${id}"]`,
          );

          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            sidebarContainer
              .querySelectorAll(".sidebar-nav a")
              .forEach((l) => l.classList.remove("active"));
            if (link) {
              link.classList.add("active");
              // অটোমেটিক অ্যাকর্ডিয়ন ওপেন করা
              const parentContent = link.closest(".accordion-content");
              if (parentContent) {
                const parentHeader = parentContent.previousElementSibling;
                if (parentHeader && parentHeader.getAttribute("aria-expanded") !== "true") {
                  // click() না করে শুধু visually খোলা — কোনো scroll হবে না
                  sidebarContainer.querySelectorAll(".accordion-header").forEach((h) => {
                    h.setAttribute("aria-expanded", "false");
                    if (h.nextElementSibling) h.nextElementSibling.style.maxHeight = null;
                    const ic = h.querySelector(".icon");
                    if (ic) ic.textContent = "▶";
                  });
                  parentHeader.setAttribute("aria-expanded", "true");
                  parentContent.style.maxHeight = parentContent.scrollHeight + "px";
                  const icon = parentHeader.querySelector(".icon");
                  if (icon) icon.textContent = "▼";
                }
              }
            }
          }
        });
      },
      { root: mainContainer, rootMargin: `-${HEADER_OFFSET}px 0px -40% 0px` },
    );

    sections.forEach((section) => observer.observe(section));
  };

  // ==========================================
  // ৫. উন্নত সার্চ এবং নেভিগেশন লজিক (Ctrl+F এর মতো)
  // ==========================================
  window.liveSearchAndHighlight = function () {
    const searchTerm = document
      .getElementById("pageSearch")
      .value.trim()
      .toLowerCase();
    const controls = document.getElementById("search-controls");
    const countDisplay = document.getElementById("search-count");

    // কন্টেন্ট রিসেট করা
    const oldHighlights = mainContainer.querySelectorAll(".search-highlight");
    oldHighlights.forEach((el) => {
      el.outerHTML = el.innerText;
    });
    mainContainer.normalize();

    if (!searchTerm || searchTerm.length < 2) {
      if (controls) controls.style.display = "none";
      matches = [];
      return;
    }

    // টেক্সট নোড খুঁজে হাইলাইট বসানো
    const walker = document.createTreeWalker(
      mainContainer,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let node;
    const nodesToReplace = [];

    while ((node = walker.nextNode())) {
      if (
        !["SCRIPT", "STYLE", "VIDEO"].includes(node.parentElement.tagName) &&
        node.textContent.toLowerCase().includes(searchTerm)
      ) {
        nodesToReplace.push(node);
      }
    }

    nodesToReplace.forEach((node) => {
      const regex = new RegExp(`(${searchTerm})`, "gi");
      const span = document.createElement("span");
      span.innerHTML = node.textContent.replace(
        regex,
        `<mark class="search-highlight">$1</mark>`,
      );
      node.parentNode.replaceChild(span, node);
    });

    // সব ম্যাচ সংগ্রহ এবং প্রথমটিতে স্ক্রল
    matches = mainContainer.querySelectorAll(".search-highlight");
    if (matches.length > 0) {
      if (controls) controls.style.display = "flex";
      currentMatchIndex = 0;
      updateSearchUI();
    } else {
      if (controls) controls.style.display = "none";
      if (countDisplay) countDisplay.innerText = "0/0";
    }
  };

  function updateSearchUI() {
    if (matches.length === 0) return;
    matches.forEach((m) => m.classList.remove("active-match"));

    const current = matches[currentMatchIndex];
    current.classList.add("active-match");
    current.scrollIntoView({ behavior: "smooth", block: "center" });

    const countDisplay = document.getElementById("search-count");
    if (countDisplay)
      countDisplay.innerText = `${currentMatchIndex + 1}/${matches.length}`;
  }

  window.navigateSearch = function (direction) {
    if (matches.length === 0) return;
    currentMatchIndex += direction;
    if (currentMatchIndex >= matches.length) currentMatchIndex = 0;
    if (currentMatchIndex < 0) currentMatchIndex = matches.length - 1;
    updateSearchUI();
  };

  // ==========================================
  // সার্চ টগল এবং নেভিগেশন ফিক্স
  // ==========================================
  window.toggleSearch = function (event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const wrapper = document.getElementById("searchWrapper");
    const input = document.getElementById("pageSearch");
    const isActive = wrapper.classList.contains("active");

    if (!isActive) {
      wrapper.classList.add("active");
      setTimeout(() => input.focus(), 100); // স্মুথ ফোকাস
    } else {
      wrapper.classList.remove("active");
      input.value = "";
      liveSearchAndHighlight();
    }
  };

  // এই অংশটি গুরুত্বপূর্ণ: লিখতে লিখতে ক্লোজ হওয়া বন্ধ করবে
  document.addEventListener("mousedown", function (event) {
    const wrapper = document.getElementById("searchWrapper");

    // যদি ক্লিকটি সার্চ র‍্যাপারের বাইরে হয়, তবেই ক্লোজ হবে
    if (wrapper && !wrapper.contains(event.target)) {
      if (wrapper.classList.contains("active")) {
        wrapper.classList.remove("active");
        document.getElementById("pageSearch").value = "";
        // হাইলাইট ক্লিয়ার করার ফাংশন কল করুন
        if (typeof liveSearchAndHighlight === "function")
          liveSearchAndHighlight();
      }
    }
  });

  // ==========================================
  // ৬. ভিডিও অটো-প্লে লজিক
  // ==========================================
  const initializeVideoObserver = () => {
    const videos = mainContainer.querySelectorAll(".ss-video");
    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            video.muted = true;
            video.play().catch(() => console.warn("Autoplay blocked"));
          } else {
            video.pause();
            video.currentTime = 0;
          }
        });
      },
      { threshold: 0.5 },
    );

    videos.forEach((video) => videoObserver.observe(video));
  };

  // ==========================================
  // ৭. Back to Top বাটন লজিক
  // ==========================================
  let lastScrollTop = 0;
  mainContainer.addEventListener("scroll", () => {
    let st = mainContainer.scrollTop;
    if (st < lastScrollTop && st > 200) {
      backToTopButton.style.display = "block";
    } else {
      backToTopButton.style.display = "none";
    }
    lastScrollTop = st;
  });

  backToTopButton.addEventListener("click", () => {
    mainContainer.scrollTo({ top: 0, behavior: "smooth" });
  });

});

// সরাসরি সেকশনে যাওয়ার গ্লোবাল ফাংশন
window.scrollToSection = function (id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.style.background = "#fff3cd";
    setTimeout(() => {
      el.style.background = "";
    }, 2000);
  }
};




