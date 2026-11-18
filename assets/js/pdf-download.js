/* =========================================================================
   PROSHIKA HRMS — PDF ডাউনলোড (মডিউল ও সাব-মডিউল অনুযায়ী)
   -------------------------------------------------------------------------
   PDF বাটনে ট্যাপ করলে একটি ড্রপডাউন মেনু খুলবে:
     • ১. ভূমিকা / Introduction  ← মডিউলের নাম (⬇ চাপলে পুরো মডিউলের PDF)
          i.  নির্দেশিকার উদ্দেশ্য  ← সাব-মডিউল (চাপলে শুধু সেই অংশের PDF)
          ii. মূল ব্যবহারকারী
     • সবার শেষে "Download Full User Manual" (পুরো ম্যানুয়াল)

   ★ মেনু নিজে থেকেই sidebar.html থেকে তৈরি হয় ★
   ভবিষ্যতে নতুন মডিউল/সাব-মডিউল যোগ করতে এই JS ফাইলে হাত দিতে হবে না:
     ১. sidebar.html-এ নতুন .accordion-item / <li><a href="#id"> যোগ করুন
     ২. main.html-এ ওই id-ওয়ালা section যোগ করুন
   ব্যস! ড্রপডাউনে নিজে থেকেই চলে আসবে এবং PDF ডাউনলোডও কাজ করবে।

   html2canvas ও jsPDF লাইব্রেরি প্রথমবার ডাউনলোডের সময় নিজে থেকেই লোড হয়।
   বাংলা লেখা ঠিক রাখতে প্রতিটি অংশ ছবির মতো (canvas) করে PDF-এ বসানো হয়,
   তাই PDF-এর লেখা সিলেক্ট/কপি করা যাবে না।
   ========================================================================= */
(function () {
    "use strict";

    /* ---------------------- সেটিংস (দরকারে বদলান) ---------------------- */
    var CONFIG = {
        contentSelector: "#main-container", // ম্যানুয়ালের কনটেন্ট
        sidebarSelector: "#sidebar-container", // মডিউল/সাব-মডিউলের তালিকা এখান থেকে নেওয়া হয়
        logoSelector: ".header-logo", // PDF-এর মাথায় বসানো লোগো
        buttonSelector: ".pdf-download-btn",
        fileName: "Proshika-HRMS-User-Manual.pdf", // পুরো ম্যানুয়ালের PDF-এর নাম
        filePrefix: "Proshika-HRMS", // মডিউলের PDF-এর নামের শুরু
        docTitle: "PROSHIKA HRMS",
        docSubtitle: "ব্যবহার নির্দেশিকা",
        menuTitle: "PDF ডাউনলোড করুন",
        menuHint: "মডিউল খুলে সাব-মডিউল দেখুন, ⬇ চাপলে ডাউনলোড হবে",
        allLabel: "📚 সম্পূর্ণ ম্যানুয়াল ডাউনলোড / Download Full User Manual",
        openOneAtATime: true, // একটি মডিউল খুললে বাকিগুলো বন্ধ হবে (false দিলে সব খোলা রাখা যাবে)
        emptyHint: "এই অংশের কনটেন্ট এখনও যোগ হয়নি",
        // PDF-এ যে এলিমেন্ট বাদ যাবে (কোনো অংশ বাদ দিতে তাতে class="no-pdf" দিন)
        excludeSelectors: ".no-pdf, script, style, noscript",
        renderWidthPx: 760, // PDF বানানোর সময় কনটেন্টের প্রস্থ
        marginMm: 10, // পেজের চারদিকের মার্জিন
        gapMm: 2.5, // দুই অংশের মাঝের ফাঁক
        html2canvasUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
        jspdfUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    };

    var PAGE_W = 210; // A4 প্রস্থ (mm)
    var PAGE_H = 297; // A4 উচ্চতা (mm)
    var FOOTER_MM = 4; // পেজ নম্বরের জন্য নিচে রাখা জায়গা
    var busy = false;

    // শুধু এই ট্যাগগুলোর ভেতরে ঢুকে ছোট ছোট অংশে ভাগ করা হবে
    var CONTAINER_TAGS = { DIV: 1, SECTION: 1, ARTICLE: 1, MAIN: 1, ASIDE: 1 };

    /* ----------------------------- ছোট সহায়ক ----------------------------- */
    function delay(ms) {
        return new Promise(function (r) {
            setTimeout(r, ms);
        });
    }

    function nextFrame() {
        return new Promise(function (r) {
            requestAnimationFrame(function () {
                requestAnimationFrame(r);
            });
        });
    }

    function cleanText(s) {
        return (s || "").replace(/\s+/g, " ").trim();
    }

    function pad2(n) {
        return n < 10 ? "0" + n : String(n);
    }

    // i, ii, iii, iv ... (সাব-মডিউলের নম্বর)
    function toRoman(num) {
        var map = [
            [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"],
            [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"],
            [5, "v"], [4, "iv"], [1, "i"],
        ];
        var out = "";
        for (var i = 0; i < map.length; i++) {
            while (num >= map[i][0]) {
                out += map[i][1];
                num -= map[i][0];
            }
        }
        return out;
    }

    // "ভূমিকা / Introduction" থেকে ফাইলের নামের জন্য "Introduction" অংশটি নেয়
    function englishPart(label) {
        var parts = String(label || "").split("/");
        var last = cleanText(parts[parts.length - 1]);
        return /[A-Za-z]/.test(last) ? last : cleanText(label);
    }

    function safeFileName(label) {
        var s = cleanText(label)
            .replace(/[\\\/:*?"<>|#%&{}$!'@+`=]/g, "")
            .replace(/\s/g, "_")
            .slice(0, 60);
        return s || "Module";
    }

    function loadScript(url) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = url;
            s.async = true;
            s.onload = resolve;
            s.onerror = function () {
                reject(new Error("SCRIPT_LOAD_FAILED: " + url));
            };
            document.head.appendChild(s);
        });
    }

    function ensureLibs() {
        var tasks = [];
        if (!window.html2canvas) tasks.push(loadScript(CONFIG.html2canvasUrl));
        if (!(window.jspdf && window.jspdf.jsPDF))
            tasks.push(loadScript(CONFIG.jspdfUrl));
        return Promise.all(tasks);
    }

    function waitForImages(container) {
        var imgs = Array.prototype.slice.call(container.querySelectorAll("img"));
        return Promise.all(
            imgs.map(function (img) {
                // complete কিন্তু naturalWidth 0 মানে ছবি ভাঙা
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise(function (resolve) {
                    var done = false;
                    function fin() {
                        if (!done) { done = true; resolve(); }
                    }
                    img.addEventListener("load", fin);
                    img.addEventListener("error", function () {
                        console.warn("[PDF] ছবি লোড হয়নি:", img.src);
                        fin();
                    });
                    setTimeout(fin, 15000);
                });
            }),
        );
    }

    function isHidden(el) {
        try {
            return window.getComputedStyle(el).display === "none";
        } catch (e) {
            return false;
        }
    }

    /* ============================================================
       ১) sidebar.html থেকে মডিউল ও সাব-মডিউলের তালিকা পড়া
          (এটাই মেনুর একমাত্র "ডেটা সোর্স" — তাই নতুন কিছু যোগ করলে
           নিজে থেকেই চলে আসে)
       ============================================================ */
    function idFromHref(h) {
        if (!h) return "";
        h = String(h).replace(/^#/, "");
        try {
            h = decodeURIComponent(h);
        } catch (e) { }
        return h;
    }

    function readStructure() {
        var side = document.querySelector(CONFIG.sidebarSelector);
        if (!side) return [];
        var mods = [];

        Array.prototype.forEach.call(
            side.querySelectorAll(".accordion-item"),
            function (item) {
                var header = item.querySelector(".accordion-header");
                if (!header) return;
                var labEl = header.querySelector("span:not(.icon)");
                var label = cleanText(labEl ? labEl.textContent : header.textContent);
                if (!label) return;

                var subs = [];
                var seen = Object.create(null); // একই id দুইবার এলে একবারই দেখাবে
                Array.prototype.forEach.call(
                    item.querySelectorAll(".accordion-content a[href^='#']"),
                    function (a) {
                        var sid = idFromHref(a.getAttribute("href"));
                        var t = cleanText(a.textContent);
                        if (!sid || !t || seen[sid]) return;
                        seen[sid] = 1;
                        subs.push({ id: sid, label: t });
                    },
                );

                mods.push({
                    id: idFromHref(header.getAttribute("data-target")),
                    label: label,
                    subs: subs,
                });
            },
        );
        return mods;
    }

    function buildIdSet(structure) {
        var set = Object.create(null);
        structure.forEach(function (m) {
            if (m.id) set[m.id] = 1;
            m.subs.forEach(function (s) {
                set[s.id] = 1;
            });
        });
        return set;
    }

    /* ============================================================
       ২) main.html থেকে নির্দিষ্ট id-র কনটেন্ট খুঁজে বের করা
       ============================================================ */
    function getEl(id) {
        if (!id) return null;
        var main = document.querySelector(CONFIG.contentSelector);
        var el = document.getElementById(id);
        return el && main && main.contains(el) ? el : null;
    }

    // id শুধু একটি হেডিং/ফাঁকা চিহ্নে থাকলে (কনটেন্ট পরের এলিমেন্টগুলোতে)
    function isMarker(el) {
        if (/^H[1-6]$/.test(el.tagName)) return true;
        if (el.querySelector("img,video,svg,canvas,table,p,ul,ol,li,figure"))
            return false;
        return cleanText(el.textContent).length < 120;
    }

    function hasBoundary(node, idSet) {
        if (node.id && idSet[node.id]) return true;
        var ids = node.querySelectorAll("[id]");
        for (var i = 0; i < ids.length; i++) {
            if (idSet[ids[i].id]) return true;
        }
        return false;
    }

    // হেডিং থেকে শুরু করে পরের কোনো মডিউল/সাব-মডিউল শুরু হওয়ার আগ পর্যন্ত সব এলিমেন্ট
    function rangeFrom(el, idSet) {
        var out = [el];
        var n = el.nextElementSibling;
        while (n) {
            if (hasBoundary(n, idSet)) break;
            out.push(n);
            n = n.nextElementSibling;
        }
        return out;
    }

    function uniqueOrdered(list) {
        var uniq = [];
        list.forEach(function (el) {
            if (uniq.indexOf(el) === -1) uniq.push(el);
        });
        // অন্য কোনো এলিমেন্টের ভেতরে থাকলে আলাদা করে নেওয়ার দরকার নেই
        uniq = uniq.filter(function (el) {
            return !uniq.some(function (o) {
                return o !== el && o.contains(el);
            });
        });
        uniq.sort(function (a, b) {
            return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
                ? -1
                : 1;
        });
        return uniq;
    }

    function elementsForIds(ids, idSet) {
        var list = [];
        ids.forEach(function (id) {
            var el = getEl(id);
            if (!el) return;
            if (isMarker(el)) {
                rangeFrom(el, idSet).forEach(function (x) {
                    list.push(x);
                });
            } else {
                list.push(el);
            }
        });
        return uniqueOrdered(list);
    }

    function moduleElements(mod, idSet) {
        var ids = [mod.id].concat(
            mod.subs.map(function (s) {
                return s.id;
            }),
        );
        return elementsForIds(ids, idSet);
    }

    function subElements(sub, idSet) {
        return elementsForIds([sub.id], idSet);
    }

    /* --------------------------- প্রগ্রেস পপআপ --------------------------- */
    function createOverlay(subtitle) {
        var o = document.createElement("div");
        o.id = "pdf-progress-overlay";
        o.style.cssText =
            "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);" +
            "z-index:2147483000;display:flex;align-items:center;justify-content:center;" +
            "font-family:'Noto Sans Bengali',sans-serif;";
        o.innerHTML =
            '<div style="background:#fff;border-radius:14px;padding:24px 28px;width:min(86vw,340px);' +
            'text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.35);">' +
            '<div style="font-size:16px;font-weight:700;color:#1f2937;margin-bottom:6px;">PDF তৈরি হচ্ছে...</div>' +
            '<div id="pdf-progress-sub" style="font-size:12px;color:#1a73e8;margin-bottom:8px;line-height:1.5;"></div>' +
            '<div id="pdf-progress-text" style="font-size:13px;color:#6b7280;margin-bottom:14px;">প্রস্তুত হচ্ছে</div>' +
            '<div style="height:8px;background:#e5e7eb;border-radius:99px;overflow:hidden;">' +
            '<div id="pdf-progress-bar" style="height:100%;width:0%;background:#1a73e8;transition:width .2s;"></div></div>' +
            '<div style="font-size:12px;color:#9ca3af;margin-top:12px;">অনুগ্রহ করে অপেক্ষা করুন, পেজ বন্ধ করবেন না</div>' +
            "</div>";
        document.body.appendChild(o);

        var bar = o.querySelector("#pdf-progress-bar");
        var txt = o.querySelector("#pdf-progress-text");
        var sub = o.querySelector("#pdf-progress-sub");
        if (sub) sub.textContent = subtitle || "";
        return {
            set: function (pct, text) {
                if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
                if (txt && text) txt.textContent = text;
            },
            close: function () {
                if (o.parentNode) o.parentNode.removeChild(o);
            },
        };
    }

    /* ------------- PDF বানানোর জন্য লুকানো কপি তৈরি (অফস্ক্রিন) ------------- */
    // পুরো ম্যানুয়ালের সময় প্রথম স্তরের অংশগুলো পাওয়ার জন্য
    function topLevelItems(main) {
        var parent = main;
        for (var d = 0; d < 3; d++) {
            if (
                parent.children.length === 1 &&
                parent.firstElementChild.children.length > 1
            ) {
                parent = parent.firstElementChild;
            } else {
                break;
            }
        }
        return Array.prototype.slice.call(parent.children);
    }

    function buildRenderRoot(source, opts) {
        var W = CONFIG.renderWidthPx;

        var root = document.createElement("div");
        root.id = "pdf-render-root";
        root.setAttribute("aria-hidden", "true");
        root.style.cssText =
            "position:absolute;top:0;left:-10000px;width:" +
            W +
            "px;background:#fff;color:#111;" +
            "font-family:'Noto Sans Bengali',sans-serif;overflow:visible;pointer-events:none;";

        // বাংলা যুক্তাক্ষর ঠিক রাখতে letter-spacing বন্ধ, অ্যানিমেশন বন্ধ, সার্চ হাইলাইট বন্ধ
        var st = document.createElement("style");
        st.textContent =
            "#pdf-render-root,#pdf-render-root *{letter-spacing:normal!important;animation:none!important;transition:none!important;}" +
            "#pdf-render-root mark{background:transparent!important;color:inherit!important;}";
        root.appendChild(st);

        // PDF-এর মাথার অংশ: লোগো + শিরোনাম (+ মডিউল/সাব-মডিউলের নাম)
        var head = document.createElement("div");
        head.style.cssText =
            "display:flex;align-items:center;gap:14px;padding:4px 0 14px;margin-bottom:12px;border-bottom:3px solid #1a73e8;";
        var logo = document.querySelector(CONFIG.logoSelector);
        if (logo && logo.src) {
            var img = document.createElement("img");
            img.src = logo.currentSrc || logo.src;
            img.alt = "";
            img.style.cssText = "height:54px;width:auto;display:block;";
            head.appendChild(img);
        }
        var box = document.createElement("div");
        var t1 = document.createElement("div");
        t1.textContent = CONFIG.docTitle;
        t1.style.cssText =
            "font-size:26px;font-weight:700;color:#1a73e8;line-height:1.25;";
        var t2 = document.createElement("div");
        t2.textContent = CONFIG.docSubtitle;
        t2.style.cssText = "font-size:18px;color:#444;margin-top:2px;line-height:1.4;";
        box.appendChild(t1);
        box.appendChild(t2);
        if (opts.label) {
            var t3 = document.createElement("div");
            t3.textContent = opts.label;
            t3.style.cssText =
                "font-size:15px;font-weight:700;color:#fd7113;margin-top:6px;line-height:1.4;";
            box.appendChild(t3);
        }
        head.appendChild(box);
        root.appendChild(head);

        // ম্যানুয়ালের কনটেন্টের কপি।
        // main-এর খোলস (id/class সহ) রাখা হয় যাতে CSS ঠিকঠাক লাগে।
        // কপিটি পেজের শেষে থাকে, তাই getElementById সবসময় আসলটাই পায়।
        var shell;
        if (opts.elements) {
            // নির্বাচিত মডিউল/সাব-মডিউল
            shell = source.cloneNode(false);
            opts.elements.forEach(function (el) {
                var c = el.cloneNode(true);
                if (isHidden(el)) {
                    c.style.setProperty("display", "block", "important");
                    c.removeAttribute("hidden");
                }
                shell.appendChild(c);
            });
        } else {
            // পুরো ম্যানুয়াল (লুকানো ট্যাব/অ্যাকর্ডিয়ন অংশও দেখানো হবে)
            var hidden = topLevelItems(source).filter(isHidden);
            hidden.forEach(function (el) {
                el.setAttribute("data-pdf-force", "1");
            });
            try {
                shell = source.cloneNode(true);
            } finally {
                hidden.forEach(function (el) {
                    el.removeAttribute("data-pdf-force");
                });
            }
            Array.prototype.forEach.call(
                shell.querySelectorAll("[data-pdf-force]"),
                function (n) {
                    n.style.setProperty("display", "block", "important");
                    n.removeAttribute("hidden");
                    n.removeAttribute("data-pdf-force");
                },
            );
        }

        shell.style.cssText +=
            ";position:static!important;width:100%!important;max-width:none!important;" +
            "height:auto!important;min-height:0!important;max-height:none!important;" +
            "overflow:visible!important;margin:0!important;padding:0!important;" +
            "transform:none!important;float:none!important;flex:none!important;";

        Array.prototype.forEach.call(
            shell.querySelectorAll(CONFIG.excludeSelectors),
            function (n) {
                if (n.parentNode) n.parentNode.removeChild(n);
            },
        );

        // ছবি যেন অবশ্যই লোড হয় (lazy-load বন্ধ + URL ঠিক করা)
        Array.prototype.forEach.call(shell.querySelectorAll("img"), function (im) {
            im.setAttribute("loading", "eager");
            var ds = im.getAttribute("data-src");
            if (ds) im.setAttribute("src", ds);

            // স্পেস/বিশেষ অক্ষরসহ ফাইলের নাম ঠিকভাবে encode করা
            var raw = (im.getAttribute("src") || "").trim();
            if (raw && !/^(data:|blob:|https?:\/\/)/i.test(raw)) {
                try {
                    var abs = new URL(raw, document.baseURI).href; // পূর্ণ URL
                    im.setAttribute("src", abs);
                } catch (e) { }
            } else if (raw) {
                im.setAttribute("src", raw);
            }

            // CORS সমস্যা এড়াতে (একই ডোমেইন হলে সমস্যা নেই)
            im.setAttribute("crossorigin", "anonymous");
        });

        root.appendChild(shell);
        document.body.appendChild(root);
        return root;
    }

    /* ------------- কনটেন্টকে পেজে বসানোর মতো ছোট ছোট অংশে ভাগ ------------- */
    function wrapLooseText(el) {
        if (!el.children.length) return;
        Array.prototype.slice.call(el.childNodes).forEach(function (n) {
            if (n.nodeType === 3 && n.nodeValue.trim()) {
                var d = document.createElement("div");
                el.insertBefore(d, n);
                d.appendChild(n);
            }
        });
    }

    function isHeadingBlock(el, hPx) {
        if (/^H[1-6]$/.test(el.tagName)) return true;
        var f = el.firstElementChild;
        return !!(
            f &&
            el.children.length === 1 &&
            /^H[1-6]$/.test(f.tagName) &&
            hPx < 90
        );
    }

    function collectBlocks(root, maxPx) {
        var blocks = [];
        var rootLeft = root.getBoundingClientRect().left;

        function walk(el) {
            wrapLooseText(el);
            Array.prototype.forEach.call(el.children, function (c) {
                if (c.tagName === "STYLE" || c.tagName === "SCRIPT") return;
                var r = c.getBoundingClientRect();
                if (r.height < 2 || r.width < 2) return; // লুকানো বা ফাঁকা
                if (r.height > maxPx && c.children.length > 0 && CONTAINER_TAGS[c.tagName]) {
                    walk(c); // এক পেজের চেয়ে বড় হলে ভেতরের অংশে ভাগ করা হয়
                } else {
                    blocks.push({
                        el: c,
                        h: r.height,
                        dx: r.left - rootLeft,
                        heading: isHeadingBlock(c, r.height),
                    });
                }
            });
        }

        walk(root);
        return blocks;
    }

    /* ---------------------------- মূল PDF তৈরি ---------------------------- */
    async function generatePDF(ui, opts) {
        var source = document.querySelector(CONFIG.contentSelector);
        if (!source || !source.children.length) throw new Error("EMPTY_CONTENT");
        if (opts.elements && !opts.elements.length) throw new Error("EMPTY_CONTENT");

        ui.set(3, "প্রয়োজনীয় লাইব্রেরি লোড হচ্ছে...");
        await ensureLibs();
        if (document.fonts && document.fonts.ready) {
            try {
                await document.fonts.ready;
            } catch (e) { }
        }

        var jsPDF = window.jspdf.jsPDF;
        var isMobile = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
        var scale = isMobile ? 1.5 : 2; // মোবাইলে মেমরি বাঁচাতে একটু কম

        var root = buildRenderRoot(source, opts);
        try {
            ui.set(8, "ছবি লোড হচ্ছে...");
            await waitForImages(root);
            await nextFrame();

            var W = CONFIG.renderWidthPx;
            var M = CONFIG.marginMm;
            var GAP = CONFIG.gapMm;
            var CW = PAGE_W - 2 * M; // কনটেন্টের প্রস্থ (mm)
            var CH = PAGE_H - 2 * M - FOOTER_MM; // কনটেন্টের উচ্চতা (mm)
            var mmPerCssPx = CW / W;
            var mmPerPx = mmPerCssPx / scale;
            var maxBlockPx = CH / mmPerCssPx;

            var blocks = collectBlocks(root, maxBlockPx);
            if (!blocks.length) throw new Error("EMPTY_CONTENT");

            var doc = new jsPDF({
                unit: "mm",
                format: "a4",
                orientation: "portrait",
                compress: true,
            });
            doc.setProperties({
                title:
                    "Proshika HRMS - User Manual" + (opts.label ? " - " + opts.label : ""),
            });

            var top = M;
            var bottom = M + CH;
            var y = top;

            function newPage() {
                doc.addPage();
                y = top;
            }

            function drawSlice(canvas, srcY, slicePx, x) {
                var data;
                if (srcY === 0 && slicePx === canvas.height) {
                    data = canvas.toDataURL("image/jpeg", 0.92);
                } else {
                    var t = document.createElement("canvas");
                    t.width = canvas.width;
                    t.height = slicePx;
                    var ctx = t.getContext("2d");
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, t.width, t.height);
                    ctx.drawImage(
                        canvas,
                        0,
                        srcY,
                        canvas.width,
                        slicePx,
                        0,
                        0,
                        canvas.width,
                        slicePx,
                    );
                    data = t.toDataURL("image/jpeg", 0.92);
                    t.width = 0;
                    t.height = 0;
                }
                doc.addImage(
                    data,
                    "JPEG",
                    x,
                    y,
                    canvas.width * mmPerPx,
                    slicePx * mmPerPx,
                    undefined,
                    "FAST",
                );
            }

            function place(canvas, block, nextBlock) {
                var h = canvas.height * mmPerPx;
                var x = M + Math.max(0, Math.min(block.dx, W)) * mmPerCssPx;
                var remaining = bottom - y;

                // হেডিং যেন পেজের একদম নিচে একা না পড়ে
                if (block.heading && y > top) {
                    var nextH = nextBlock ? Math.min(nextBlock.h * mmPerCssPx, 35) : 0;
                    if (h + nextH > remaining) {
                        newPage();
                        remaining = bottom - y;
                    }
                }

                // ১) বাকি জায়গায় পুরোটা ধরে যাবে
                if (h <= remaining) {
                    drawSlice(canvas, 0, canvas.height, x);
                    y += h + GAP;
                    return;
                }

                // ২) এক পেজে ধরে, কিন্তু এখানে ধরে না → নতুন পেজে
                if (h <= CH) {
                    newPage();
                    drawSlice(canvas, 0, canvas.height, x);
                    y += h + GAP;
                    return;
                }

                // ৩) এক পেজের চেয়েও বড় → টুকরো করে একাধিক পেজে
                if (remaining < 30 && y > top) newPage();
                var srcY = 0;
                while (srcY < canvas.height) {
                    var availPx = Math.floor((bottom - y) / mmPerPx);
                    var slicePx = Math.min(availPx, canvas.height - srcY);
                    if (slicePx < 1) {
                        newPage();
                        continue;
                    }
                    drawSlice(canvas, srcY, slicePx, x);
                    srcY += slicePx;
                    y += slicePx * mmPerPx;
                    if (srcY < canvas.height) newPage();
                }
                y += GAP;
            }

            for (var i = 0; i < blocks.length; i++) {
                ui.set(
                    12 + Math.round((80 * i) / blocks.length),
                    "পেজ প্রস্তুত হচ্ছে... (" + (i + 1) + "/" + blocks.length + ")",
                );

                var canvas = await window.html2canvas(blocks[i].el, {
                    scale: scale,
                    useCORS: true,
                    allowTaint: false,
                    imageTimeout: 20000,
                    backgroundColor: "#ffffff",
                    logging: false,
                });

                if (canvas.width > 0 && canvas.height > 0) {
                    place(canvas, blocks[i], blocks[i + 1]);
                }
                canvas.width = 0; // মেমরি ছেড়ে দেওয়া (মোবাইলের জন্য জরুরি)
                canvas.height = 0;
            }

            // পেজ নম্বর
            ui.set(95, "ফাইল তৈরি হচ্ছে...");
            var total = doc.getNumberOfPages();
            for (var p = 1; p <= total; p++) {
                doc.setPage(p);
                doc.setFontSize(9);
                doc.setTextColor(120, 120, 120);
                doc.text(p + " / " + total, PAGE_W / 2, PAGE_H - 6, { align: "center" });
            }

            doc.save(opts.fileName);
        } finally {
            if (root.parentNode) root.parentNode.removeChild(root);
        }
    }

    /* ------------------------- ডাউনলোড শুরু করা ------------------------- */
    // opts = { elements: [এলিমেন্ট...] অথবা null (পুরো ম্যানুয়াল), label, fileName }
    async function startDownload(opts) {
        if (busy) return;
        busy = true;

        var btn = document.querySelector(CONFIG.buttonSelector);
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = "0.7";
        }
        var ui = createOverlay(opts.label || "সম্পূর্ণ ম্যানুয়াল (সব মডিউল)");

        try {
            await generatePDF(ui, opts);
            ui.set(100, "ডাউনলোড শুরু হচ্ছে...");
            await delay(500);
        } catch (err) {
            console.error("[PDF]", err);
            var msg = "দুঃখিত, PDF তৈরি করা যায়নি। আবার চেষ্টা করুন।";
            if (err && /SCRIPT_LOAD_FAILED/.test(err.message || "")) {
                msg = "ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।";
            } else if (err && err.message === "EMPTY_CONTENT") {
                msg = "এই অংশের বিষয়বস্তু পাওয়া যায়নি। একটু পরে আবার চেষ্টা করুন।";
            }
            alert(msg);
        } finally {
            ui.close();
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = "";
            }
            busy = false;
        }
    }

    /* --------------------------- ড্রপডাউন মেনু --------------------------- */
    var menuEl = null;

    function injectMenuStyle() {
        if (document.getElementById("pdf-menu-style")) return;
        var st = document.createElement("style");
        st.id = "pdf-menu-style";
        st.textContent = [
            "#pdf-menu{position:fixed;z-index:2147482000;display:flex;flex-direction:column;background:#fff;color:#1f2937;",
            "border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);border:1px solid rgba(0,0,0,.08);",
            "font-family:'Noto Sans Bengali',sans-serif;overflow:hidden;text-align:left;}",
            "#pdf-menu button{font-family:inherit;color:inherit;}",
            "#pdf-menu .pdfm-head{flex:0 0 auto;padding:12px 16px;font-size:14px;font-weight:700;border-bottom:1px solid #eef0f3;background:#f8fafc;}",
            "#pdf-menu .pdfm-head small{display:block;font-weight:400;color:#6b7280;font-size:12px;margin-top:2px;line-height:1.5;}",
            "#pdf-menu .pdfm-list{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px;}",
            "#pdf-menu .pdfm-empty{padding:14px;color:#6b7280;font-size:13px;text-align:center;}",

            /* মডিউলের সারি */
            "#pdf-menu .pdfm-mod{margin-bottom:2px;border-radius:10px;}",
            "#pdf-menu .pdfm-modrow{display:flex;align-items:stretch;gap:4px;}",
            "#pdf-menu .pdfm-toggle{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:10px;padding:10px;border:0;background:transparent;",
            "border-radius:10px;cursor:pointer;text-align:left;font-size:14px;font-weight:600;}",
            "#pdf-menu .pdfm-toggle:hover,#pdf-menu .pdfm-toggle:focus-visible{background:#f1f5f9;outline:none;}",
            "#pdf-menu .pdfm-mod.open>.pdfm-modrow .pdfm-toggle{background:#eef4ff;color:#1a5fd0;}",
            "#pdf-menu .pdfm-num{flex:0 0 26px;color:#1a73e8;font-weight:700;font-size:13px;}",
            "#pdf-menu .pdfm-label{flex:1 1 auto;line-height:1.45;}",
            "#pdf-menu .pdfm-chev{flex:0 0 auto;font-size:11px;color:#94a3b8;transition:transform .2s;}",
            "#pdf-menu .pdfm-mod.open>.pdfm-modrow .pdfm-chev{transform:rotate(90deg);color:#1a73e8;}",

            /* ডাউনলোড আইকন বাটন */
            "#pdf-menu .pdfm-dl{flex:0 0 40px;border:0;border-radius:10px;background:#e8f0fe;color:#1a73e8;font-size:16px;cursor:pointer;}",
            "#pdf-menu .pdfm-dl:hover,#pdf-menu .pdfm-dl:focus-visible{background:#1a73e8;color:#fff;outline:none;}",

            /* সাব-মডিউলের সারি */
            "#pdf-menu .pdfm-subs{display:none;margin:2px 0 6px 18px;padding-left:8px;border-left:2px solid #dbe7fb;}",
            "#pdf-menu .pdfm-mod.open>.pdfm-subs{display:block;}",
            "#pdf-menu .pdfm-sub{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;background:transparent;",
            "border-radius:8px;cursor:pointer;text-align:left;font-size:13px;color:#475569;}",
            "#pdf-menu .pdfm-sub:hover,#pdf-menu .pdfm-sub:focus-visible{background:#eaf2ff;color:#0f172a;outline:none;}",
            "#pdf-menu .pdfm-roman{flex:0 0 28px;color:#64748b;font-style:italic;}",
            "#pdf-menu .pdfm-sub .pdfm-ico{flex:0 0 auto;color:#1a73e8;font-size:14px;}",

            /* কনটেন্ট না থাকলে ধূসর */
            "#pdf-menu .pdfm-off{opacity:.45;cursor:not-allowed!important;}",
            "#pdf-menu .pdfm-off:hover{background:transparent!important;color:inherit!important;}",
            "#pdf-menu .pdfm-dl.pdfm-off:hover{background:#e8f0fe!important;color:#1a73e8!important;}",

            /* সবার শেষে: পুরো ম্যানুয়াল */
            "#pdf-menu .pdfm-foot{flex:0 0 auto;padding:10px;border-top:1px solid #eef0f3;background:#fff;}",
            "#pdf-menu .pdfm-all{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:0;",
            "border-radius:10px;background:#1a73e8;color:#fff!important;font-size:14px;font-weight:700;cursor:pointer;line-height:1.4;}",
            "#pdf-menu .pdfm-all:hover,#pdf-menu .pdfm-all:focus-visible{background:#1558b8;outline:none;}",
        ].join("");
        document.head.appendChild(st);
    }

    function placeMenu() {
        var btn = document.querySelector(CONFIG.buttonSelector);
        if (!menuEl || !btn) return;
        var r = btn.getBoundingClientRect();
        var vw = document.documentElement.clientWidth || window.innerWidth;
        var width = Math.min(380, vw - 24);
        var left = Math.min(Math.max(12, r.right - width), vw - width - 12);
        var top = r.bottom + 8;
        menuEl.style.width = width + "px";
        menuEl.style.left = left + "px";
        menuEl.style.top = top + "px";
        menuEl.style.maxHeight = Math.max(240, window.innerHeight - top - 16) + "px";
    }

    function onDocClick(e) {
        if (!menuEl) return;
        var t = e.target;
        if (menuEl.contains(t)) return;
        if (t.closest && t.closest(CONFIG.buttonSelector)) return; // বাটন নিজেই টগল করে
        closeMenu();
    }

    function onKey(e) {
        if (e.key === "Escape") closeMenu();
    }

    function closeMenu() {
        if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
        menuEl = null;
        document.removeEventListener("click", onDocClick, true);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", placeMenu);
        window.removeEventListener("scroll", placeMenu);
        var btn = document.querySelector(CONFIG.buttonSelector);
        if (btn) btn.setAttribute("aria-expanded", "false");
    }

    function makeEl(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function downloadModule(structure, mi) {
        var idSet = buildIdSet(structure);
        var mod = structure[mi];
        var modName = mi + 1 + ". " + mod.label;
        closeMenu();
        startDownload({
            elements: moduleElements(mod, idSet),
            label: modName,
            fileName:
                CONFIG.filePrefix +
                "_" +
                pad2(mi + 1) +
                "_" +
                safeFileName(englishPart(mod.label)) +
                ".pdf",
        });
    }

    function downloadSub(structure, mi, si) {
        var idSet = buildIdSet(structure);
        var mod = structure[mi];
        var sub = mod.subs[si];
        var label = mi + 1 + ". " + mod.label + "  ›  " + toRoman(si + 1) + ". " + sub.label;
        closeMenu();
        startDownload({
            elements: subElements(sub, idSet),
            label: label,
            fileName:
                CONFIG.filePrefix +
                "_" +
                pad2(mi + 1) +
                "_" +
                safeFileName(englishPart(mod.label)) +
                "_" +
                safeFileName(englishPart(sub.label)) +
                ".pdf",
        });
    }

    function toggleModule(wrap) {
        var willOpen = !wrap.classList.contains("open");
        if (willOpen && CONFIG.openOneAtATime && menuEl) {
            Array.prototype.forEach.call(menuEl.querySelectorAll(".pdfm-mod.open"), function (m) {
                m.classList.remove("open");
                var tg = m.querySelector(".pdfm-toggle");
                if (tg) tg.setAttribute("aria-expanded", "false");
            });
        }
        wrap.classList.toggle("open", willOpen);
        var tg2 = wrap.querySelector(".pdfm-toggle");
        if (tg2) tg2.setAttribute("aria-expanded", willOpen ? "true" : "false");
        if (willOpen && wrap.scrollIntoView) {
            try {
                wrap.scrollIntoView({ block: "nearest" });
            } catch (e) { }
        }
    }

    function openMenu() {
        var btn = document.querySelector(CONFIG.buttonSelector);
        if (!btn) return;
        injectMenuStyle();

        var structure = readStructure();

        menuEl = makeEl("div");
        menuEl.id = "pdf-menu";
        menuEl.setAttribute("role", "menu");

        var head = makeEl("div", "pdfm-head", CONFIG.menuTitle);
        head.appendChild(makeEl("small", "", CONFIG.menuHint));
        menuEl.appendChild(head);

        var list = makeEl("div", "pdfm-list");
        if (!structure.length) {
            list.appendChild(
                makeEl(
                    "div",
                    "pdfm-empty",
                    "কোনো মডিউল পাওয়া যায়নি। পেজ লোড হওয়া পর্যন্ত অপেক্ষা করুন।",
                ),
            );
        }

        structure.forEach(function (mod, mi) {
            var hasSubs = mod.subs.length > 0;
            var modHas =
                !!getEl(mod.id) ||
                mod.subs.some(function (s) {
                    return !!getEl(s.id);
                });

            var wrap = makeEl("div", "pdfm-mod");

            // --- মডিউলের সারি: [নাম (খোলা/বন্ধ)] [⬇] ---
            var row = makeEl("div", "pdfm-row pdfm-modrow");

            var toggle = makeEl("button", "pdfm-toggle");
            toggle.type = "button";
            toggle.setAttribute("role", "menuitem");
            toggle.setAttribute("aria-expanded", "false");
            toggle.appendChild(makeEl("span", "pdfm-num", mi + 1 + "."));
            toggle.appendChild(makeEl("span", "pdfm-label", mod.label));
            if (hasSubs) toggle.appendChild(makeEl("span", "pdfm-chev", "▶"));
            toggle.addEventListener("click", function () {
                if (hasSubs) toggleModule(wrap);
                else if (modHas) downloadModule(structure, mi);
            });
            row.appendChild(toggle);

            var dl = makeEl("button", "pdfm-dl", "⬇");
            dl.type = "button";
            dl.setAttribute("role", "menuitem");
            dl.title = modHas ? "পুরো মডিউল ডাউনলোড করুন" : CONFIG.emptyHint;
            dl.setAttribute("aria-label", "ডাউনলোড: " + mod.label);
            if (!modHas) dl.classList.add("pdfm-off");
            dl.addEventListener("click", function (e) {
                e.stopPropagation();
                if (modHas) downloadModule(structure, mi);
            });
            row.appendChild(dl);
            wrap.appendChild(row);

            // --- সাব-মডিউলগুলো ---
            if (hasSubs) {
                var subsBox = makeEl("div", "pdfm-subs");
                mod.subs.forEach(function (sub, si) {
                    var subHas = !!getEl(sub.id);
                    var sb = makeEl("button", "pdfm-sub");
                    sb.type = "button";
                    sb.setAttribute("role", "menuitem");
                    sb.appendChild(makeEl("span", "pdfm-roman", toRoman(si + 1) + "."));
                    sb.appendChild(makeEl("span", "pdfm-label", sub.label));
                    sb.appendChild(makeEl("span", "pdfm-ico", "⬇"));
                    if (!subHas) {
                        sb.classList.add("pdfm-off");
                        sb.title = CONFIG.emptyHint;
                    } else {
                        sb.title = "ডাউনলোড করুন";
                    }
                    sb.addEventListener("click", function () {
                        if (subHas) downloadSub(structure, mi, si);
                    });
                    subsBox.appendChild(sb);
                });
                wrap.appendChild(subsBox);
            }

            list.appendChild(wrap);
        });
        menuEl.appendChild(list);

        // সবার শেষে: পুরো ম্যানুয়াল একসাথে
        var foot = makeEl("div", "pdfm-foot");
        var all = makeEl("button", "pdfm-all", CONFIG.allLabel);
        all.type = "button";
        all.setAttribute("role", "menuitem");
        all.addEventListener("click", function () {
            closeMenu();
            startDownload({ elements: null, label: "", fileName: CONFIG.fileName });
        });
        foot.appendChild(all);
        menuEl.appendChild(foot);

        document.body.appendChild(menuEl);
        placeMenu();
        btn.setAttribute("aria-expanded", "true");

        document.addEventListener("click", onDocClick, true);
        document.addEventListener("keydown", onKey);
        window.addEventListener("resize", placeMenu);
        window.addEventListener("scroll", placeMenu);
    }

    /* ----------------- বাটন থেকে যে ফাংশন ডাকা হয় (global) ----------------- */
    // বাটনে ট্যাপ করলে মেনু খোলে, আবার ট্যাপ করলে বন্ধ হয়
    window.downloadPDF = function () {
        if (busy) return;
        if (menuEl) closeMenu();
        else openMenu();
    };
})();