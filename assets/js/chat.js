// =======================
// GLOBAL STATE
// =======================
let manualData = [];
let lastQuestion = "";
let waitingForClarification = false;

// Set ব্যবহার করা হয়েছে দ্রুত খোঁজার জন্য (Performance Optimization)
const stopWords = new Set([
  "এই",
  "একটি",
  "কিভাবে",
  "কি",
  "the",
  "is",
  "a",
  "an",
  "of",
  "to",
  "and",
  "in",
  "for",
  "on",
]);

const casualMap = {
  greeting: [
    "hi",
    "hello",
    "hey",
    "assalamu alaikum",
    "salam",
    "হ্যালো",
    "হাই",
    "সালাম",
  ],
  howareyou: [
    "how are you",
    "kmn aso",
    "kemon aso",
    "valo aso naki",
    "tmi kemon",
    "আপনি কেমন",
    "kemon acho",
    "ki obostha",
    "কি অবস্থা",
    "কেমন আছো",
    "kmn aco",
  ],
};
const explicitSectionMap = {
  attendance: "attendance-register",
  হাজিরা: "attendance-register",
  present: "attendance-register",
  leave: "leave-information",
  ছুটি: "leave-information",
  salary: "salary-processing",
  বেতন: "salary-processing",
  loan: "loan-application",
  ঋণ: "loan-application",
};
// =======================
// LOAD & INDEX MANUAL
// =======================
async function loadManual() {
  try {
    const res = await fetch("partials/main.html");
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // ডেটা একবারেই ইনডেক্স করে রাখা হচ্ছে
    manualData = Array.from(doc.querySelectorAll("section")).map((sec) => ({
      id: sec.id,
      title: (sec.querySelector("h2")?.innerText || "").toLowerCase(),
      content: sec.innerText.toLowerCase(),
    }));

    console.log("✅ Manual Loaded & Indexed");
  } catch (e) {
    console.error("❌ Manual load failed", e);
  }
}
loadManual();

// =======================
// CORE UTILITIES
// =======================
function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0980-\u09FF ]/g, "")
    .replace(/\b(kmn|aco|valo)\b/g, (m) => {
      const map = { kmn: "kemon", aco: "acho", valo: "bhalo" };
      return map[m];
    })
    .replace(/\s+/g, " ")
    .trim();
}

function cleanWords(text) {
  return text.split(" ").filter((w) => w.length > 1 && !stopWords.has(w));
}

function detectCasualIntent(text) {
  const q = normalizeText(text);
  for (let [intent, phrases] of Object.entries(casualMap)) {
    if (phrases.some((p) => q.includes(p))) return intent;
  }
  return null;
}

// =======================
// SEARCH ENGINE (OPTIMIZED)
// =======================
function findBestMatch(question) {
  let bestScore = 0;
  let bestMatch = null;

  const q = normalizeText(question);
  const qWords = cleanWords(q);

  for (let sec of manualData) {
    let score = 0;
    const title = sec.title;
    const content = sec.content;

    // টাইটেল যদি সরাসরি প্রশ্নের অংশ হয় (High Weight)
    if (q.includes(title) || title.includes(q)) score += 20;

    // শব্দভিত্তিক ম্যাচিং
    qWords.forEach((word) => {
      if (title.includes(word)) score += 8;
      if (content.includes(word)) score += 2;
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = sec;
    }
  }
  return { score: bestScore, match: bestMatch };
}

// =======================
// CUSTOM QA CONFIG (Quick Answers)
// =======================
const customQA = {
  ছুটি: "আপনি HRMS এর 'Leave Information' সেকশন থেকে ছুটির আবেদন করতে পারেন। বছরে নির্দিষ্ট সংখ্যক ক্যাজুয়াল এবং মেডিকেল লিভ বরাদ্দ থাকে।",
  বেতন: "প্রতি মাসের ১-৫ তারিখের মধ্যে স্যালারি প্রসেস করা হয়। আপনি 'Salary Processing' সেকশনে আপনার পে-স্লিপ দেখতে পাবেন।",
  হাজিরা:
    "অফিসে প্রবেশের সময় ফিঙ্গারপ্রিন্ট বা অ্যাপের মাধ্যমে হাজিরা নিশ্চিত করুন। সকাল ১০টার পর লেট কাউন্ট হবে।",
  লোন: "কোম্পানির পলিসি অনুযায়ী লোন এলিজিবিলিটি থাকলে আপনি 'Loan Application' থেকে আবেদন করতে পারেন।",
};

// =======================
// SMART RESPONSE GENERATOR (OPTIMIZED)
// =======================
function generateSmartAnswer(userInput) {
  const q = normalizeText(userInput);

  // ১. সরাসরি কাস্টম উত্তর (Quick Answers) চেক
  if (customQA[q]) {
    return `😊 ${customQA[q]}`;
  }

  // ২. ক্যাজুয়াল ইন্টেন্ট চেক
  const intent = detectCasualIntent(q);
  if (intent === "greeting") return "😊 হ্যালো! আমি HRMS Assistant। হাজিরা, লোন বা বেতন নিয়ে কিছু জানতে চান?";
  if (intent === "howareyou") return "😊 আলহামদুলিল্লাহ, আমি ভালো আছি! আপনাকে কীভাবে সাহায্য করতে পারি?";

  // ৩. হার্ড-ম্যাচিং চেক (Explicit Mapping)
  let forcedSectionId = null;
  for (let key in explicitSectionMap) {
    if (q.includes(key)) {
      forcedSectionId = explicitSectionMap[key];
      break;
    }
  }

  // ৪. সার্চ লজিক
  let currentSearch = waitingForClarification ? `${lastQuestion} ${q}` : q;
  const { score, match } = findBestMatch(currentSearch);

  // ৫. রেজাল্ট প্রসেসিং
  let finalMatch = forcedSectionId
    ? manualData.find((sec) => sec.id === forcedSectionId)
    : (score > 1 ? match : null); // লোন ছোট শব্দ বলে স্কোর কমিয়ে ২ করা হয়েছে

  if (finalMatch) {
    waitingForClarification = false;
    const displayContent = finalMatch.content.replace(/\s+/g, " ").substring(0, 300) + "...";

    return `
            <div style="border-left: 4px solid #1a73e8; padding-left: 10px;">
                <b style="color:#1a73e8;">📌 ${finalMatch.title.toUpperCase()}</b><br><br>
                ${displayContent}
                <br><br>
                <a href="#" onclick="scrollToSection('${finalMatch.id}')" style="color:#1a73e8; font-weight:bold; text-decoration:none; border: 1px solid #1a73e8; padding: 5px 10px; border-radius: 5px; font-size: 12px;">
                    👉 সরাসরি এখানে ক্লিক করে বিস্তারিত দেখুন
                </a>
            </div>
        `;
  }

  // ৬. কিছুই না পাওয়া গেলে
  lastQuestion = q;
  waitingForClarification = true;
  return "🤔 আমি ঠিক বুঝতে পারছি না। আপনি কি <b>হাজিরা</b>, <b>ছুটি</b>, <b>লোন (Loan)</b> অথবা <b>বেতন</b> নিয়ে জানতে চাচ্ছেন?";
}
// =======================
// UI CONTROLS
// =======================
window.askme = function () {
  const input = document.getElementById("user-input");
  const chat = document.getElementById("chat-history");
  const text = input.value.trim();

  if (!text) return;

  // ইউজার মেসেজ রেন্ডার
  chat.innerHTML += `<div class="user-msg"><span>${text}</span></div>`;
  input.value = "";

  // থিংকিং এনিমেশন
  const loadingId = "loading-" + Date.now();
  chat.innerHTML += `<div id="${loadingId}" class="ai-msg"><span>...</span></div>`;
  chat.scrollTop = chat.scrollHeight;

  setTimeout(() => {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    const reply = generateSmartAnswer(text);
    chat.innerHTML += `<div class="ai-msg"><span>${reply}</span></div>`;
    chat.scrollTop = chat.scrollHeight;
  }, 600);
};

window.toggleChat = function () {
  const chat = document.getElementById("ai-chat-container");
  chat.style.display = chat.style.display === "flex" ? "none" : "flex";
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && document.activeElement.id === "user-input") {
    askme();
  }
});

// সাজেশন বাটনে ক্লিক করলে অটোমেটিক চ্যাট হবে
window.quickAsk = function (text) {
  const input = document.getElementById("user-input");
  input.value = text;
  window.askme(); // আপনার মেইন ফাংশনটি কল হবে
};





let isFirstOpen = true;

// চ্যাট টগল ফাংশন
window.toggleChat = function () {
  const chat = document.getElementById("ai-chat-container");
  const chatHistory = document.getElementById("chat-history");

  if (chat.style.display === "none" || chat.style.display === "") {
    chat.style.display = "flex";

    // প্রথমবার ওপেন হলে ডিফল্ট মেসেজ দেখাবে
    if (isFirstOpen) {
      setTimeout(() => {
        const welcomeMsg = `
          <div class="ai-msg">
            <span>😊 আসসালামু আলাইকুম! আমি আপনার HRMS সহকারী। <br> হাজিরা, ছুটি বা বেতন নিয়ে যেকোনো প্রশ্ন থাকলে আমাকে করতে পারেন।</span>
          </div>`;
        chatHistory.innerHTML += welcomeMsg;
        chatHistory.scrollTop = chatHistory.scrollHeight;
        isFirstOpen = false;
      }, 300);
    }
  } else {
    chat.style.display = "none";
  }
};

// মেসেজ পাঠানোর ফাংশন
window.askme = function () {
  const input = document.getElementById("user-input");
  const chatHistory = document.getElementById("chat-history");
  const text = input.value.trim();

  if (!text) return;

  // ইউজারের মেসেজ যোগ করা
  chatHistory.innerHTML += `<div class="user-msg"><span>${text}</span></div>`;
  input.value = "";
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // AI থিংকিং এনিমেশন
  const loadingId = "loading-" + Date.now();
  chatHistory.innerHTML += `<div id="${loadingId}" class="ai-msg"><span>...</span></div>`;
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // রেসপন্স জেনারেট করা
  setTimeout(() => {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    const reply = generateSmartAnswer(text); // আপনার আগের লজিক ফাংশন
    chatHistory.innerHTML += `<div class="ai-msg"><span>${reply}</span></div>`;
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }, 600);
};

// কি-বোর্ড এন্টার বাটন সাপোর্ট
document.getElementById("user-input")?.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    askme();
  }
});