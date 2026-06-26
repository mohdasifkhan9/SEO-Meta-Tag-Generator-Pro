const fields = [
  "title", "description", "url", "keywords", "author", "language", "robots", "canonical",
  "themeColor", "ogTitle", "ogDescription", "ogImage", "twitterCard", "twitterTitle",
  "twitterDescription", "twitterImage", "favicon", "appName", "publisher", "copyright",
  "appleIcon", "tileColor"
];

const $ = (selector) => document.querySelector(selector);
const form = $("#metaForm");
const els = Object.fromEntries(fields.map((id) => [id, document.getElementById(id)]));
const storageKey = "seo-meta-generator-pro-state";
let generatedPlain = "";
let uploadedImage = "";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const absoluteUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  return `https://${trimmed}`;
};

const isValidUrl = (value) => {
  if (!value.trim()) return false;
  try {
    const url = new URL(absoluteUrl(value), window.location.href);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const getHost = (value) => {
  try {
    return new URL(absoluteUrl(value), window.location.href).host || "example.com";
  } catch {
    return "example.com";
  }
};

const getState = () => Object.fromEntries(fields.map((id) => [id, els[id].value.trim()]));

function derived(state = getState()) {
  const title = state.title || "Your title appears here";
  const description = state.description || "Your meta description will update instantly as you type.";
  const url = absoluteUrl(state.url || "https://example.com");
  const ogTitle = state.ogTitle || title;
  const ogDescription = state.ogDescription || description;
  const ogImage = uploadedImage || state.ogImage;
  const twitterTitle = state.twitterTitle || ogTitle;
  const twitterDescription = state.twitterDescription || ogDescription;
  const twitterImage = uploadedImage || state.twitterImage || ogImage;
  const canonical = absoluteUrl(state.canonical || state.url || "");
  const appName = state.appName || state.publisher || state.title || "Website";
  const language = state.language || "en";
  return { ...state, title, description, url, ogTitle, ogDescription, ogImage, twitterTitle, twitterDescription, twitterImage, canonical, appName, language };
}

function buildTags(data) {
  const schemaOrg = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": data.publisher || data.author || data.appName,
        "url": data.url,
        "logo": data.ogImage || data.favicon || undefined
      },
      {
        "@type": "WebSite",
        "name": data.appName,
        "url": data.url,
        "description": data.description,
        "publisher": { "@type": "Organization", "name": data.publisher || data.author || data.appName }
      }
    ]
  };

  const cleanSchema = JSON.stringify(schemaOrg, (key, value) => value === undefined || value === "" ? undefined : value, 2);
  const tags = [
    `<meta charset="UTF-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">`,
    `<html lang="${escapeHtml(data.language)}">`,
    `<title>${escapeHtml(data.title)}</title>`,
    `<meta name="description" content="${escapeHtml(data.description)}">`,
    data.keywords && `<meta name="keywords" content="${escapeHtml(data.keywords)}">`,
    data.author && `<meta name="author" content="${escapeHtml(data.author)}">`,
    `<meta name="robots" content="${escapeHtml(data.robots)}">`,
    data.canonical && `<link rel="canonical" href="${escapeHtml(data.canonical)}">`,
    `<meta name="theme-color" content="${escapeHtml(data.themeColor)}">`,
    data.appName && `<meta name="application-name" content="${escapeHtml(data.appName)}">`,
    data.publisher && `<meta name="publisher" content="${escapeHtml(data.publisher)}">`,
    data.copyright && `<meta name="copyright" content="${escapeHtml(data.copyright)}">`,
    data.favicon && `<link rel="icon" href="${escapeHtml(data.favicon)}">`,
    data.appleIcon && `<link rel="apple-touch-icon" href="${escapeHtml(data.appleIcon)}">`,
    data.tileColor && `<meta name="msapplication-TileColor" content="${escapeHtml(data.tileColor)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(data.ogTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(data.ogDescription)}">`,
    `<meta property="og:url" content="${escapeHtml(data.url)}">`,
    `<meta property="og:site_name" content="${escapeHtml(data.appName)}">`,
    data.ogImage && `<meta property="og:image" content="${escapeHtml(data.ogImage)}">`,
    `<meta name="twitter:card" content="${escapeHtml(data.twitterCard)}">`,
    `<meta name="twitter:title" content="${escapeHtml(data.twitterTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(data.twitterDescription)}">`,
    data.twitterImage && `<meta name="twitter:image" content="${escapeHtml(data.twitterImage)}">`,
    `<script type="application/ld+json">\n${cleanSchema}\n<\/script>`
  ].filter(Boolean);
  return tags;
}

function highlight(code) {
  return escapeHtml(code)
    .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="token-tag">$2</span>')
    .replace(/([\w:-]+)=(&quot;.*?&quot;)/g, '<span class="token-name">$1</span>=<span class="token-value">$2</span>');
}

function score(data) {
  const rawTitle = els.title.value.trim();
  const rawDescription = els.description.value.trim();
  const checks = [
    { label: "Title is between 30 and 60 characters", pass: rawTitle.length >= 30 && rawTitle.length <= 60, warn: rawTitle.length > 0 },
    { label: "Description is between 120 and 160 characters", pass: rawDescription.length >= 120 && rawDescription.length <= 160, warn: rawDescription.length > 0 },
    { label: "Keywords include at least three terms", pass: keywordList(data.keywords).length >= 3, warn: keywordList(data.keywords).length > 0 },
    { label: "Canonical URL is present and valid", pass: Boolean(data.canonical && isValidUrl(data.canonical)), warn: Boolean(data.canonical) },
    { label: "Open Graph title, description, and image are ready", pass: Boolean(data.ogTitle && data.ogDescription && data.ogImage), warn: Boolean(data.ogTitle || data.ogDescription) },
    { label: "Twitter card metadata is complete", pass: Boolean(data.twitterCard && data.twitterTitle && data.twitterDescription && data.twitterImage), warn: Boolean(data.twitterTitle || data.twitterDescription) },
    { label: "Robots directive is selected", pass: Boolean(data.robots), warn: false },
    { label: "Organization and WebSite schema will be generated", pass: Boolean(data.publisher || data.author || data.appName), warn: false },
    { label: "Viewport meta tag is included", pass: true, warn: false },
    { label: "Responsive theme color is included", pass: Boolean(data.themeColor), warn: false }
  ];
  const total = Math.round(checks.reduce((sum, item) => sum + (item.pass ? 10 : item.warn ? 4 : 0), 0));
  return { total, checks };
}

function keywordList(value = "") {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function updateValidation(data) {
  const alerts = [];
  if (!els.title.value.trim()) alerts.push(["error", "Website title is required."]);
  if (!els.description.value.trim()) alerts.push(["error", "Meta description is required."]);
  if (!els.url.value.trim()) alerts.push(["error", "Website URL is required."]);
  if (els.title.value.trim().length > 60) alerts.push(["warn", "Title exceeds 60 characters. Consider tightening it."]);
  if (els.description.value.trim().length > 160) alerts.push(["warn", "Description exceeds 160 characters. Search snippets may truncate."]);
  if (els.url.value.trim() && !isValidUrl(els.url.value)) alerts.push(["error", "Website URL is invalid."]);
  if (els.canonical.value.trim() && !isValidUrl(els.canonical.value)) alerts.push(["error", "Canonical URL is invalid."]);

  $("#alerts").innerHTML = alerts.map(([type, text]) => `<div class="alert ${type}">${escapeHtml(text)}</div>`).join("");
  const scored = score(data);
  $("#validationList").innerHTML = scored.checks.map((item) => `<li class="${item.pass ? "pass" : item.warn ? "warn" : ""}">${escapeHtml(item.label)}</li>`).join("");
}

function updateCounters(data) {
  const descWords = data.description.trim() ? data.description.trim().split(/\s+/).length : 0;
  $("#titleCount").textContent = els.title.value.trim().length;
  $("#descriptionCount").textContent = els.description.value.trim().length;
  $("#keywordCount").textContent = keywordList(data.keywords).length;
  $("#wordCount").textContent = descWords;
}

function updatePreviews(data) {
  $("#googleTitle").textContent = data.title;
  $("#googleUrl").textContent = data.url;
  $("#googleDescription").textContent = data.description;
  $("#facebookSite").textContent = getHost(data.url);
  $("#facebookTitle").textContent = data.ogTitle;
  $("#facebookDescription").textContent = data.ogDescription;
  $("#twitterSite").textContent = `@${getHost(data.url).replace(/^www\./, "").split(".")[0]}`;
  $("#twitterTitlePreview").textContent = data.twitterTitle;
  $("#twitterDescriptionPreview").textContent = data.twitterDescription;
  setPreviewImage($("#facebookImage"), data.ogImage, "OG");
  setPreviewImage($("#twitterImagePreview"), data.twitterImage, "X");
  $("#pixelBar").style.width = `${Math.min(100, Math.round(data.title.length / 60 * 100))}%`;
}

function setPreviewImage(el, src, fallback) {
  el.textContent = src ? "" : fallback;
  el.style.backgroundImage = src ? `linear-gradient(rgba(8,9,13,.08), rgba(8,9,13,.22)), url("${src}")` : "";
}

function updateTools(data) {
  const titleLength = els.title.value.trim().length;
  const descLength = els.description.value.trim().length;
  $("#titleAdvice").textContent = titleLength < 30
    ? "Add specificity and a primary keyword. Aim for 30-60 characters."
    : titleLength <= 60 ? "Strong title length. Keep the strongest keyword near the front." : "Trim the title below 60 characters to reduce truncation.";
  $("#descriptionAdvice").textContent = descLength < 120
    ? "Expand the description with a benefit, audience, and action. Aim for 120-160 characters."
    : descLength <= 160 ? "Excellent snippet length. It should fit most search results." : "Shorten the description below 160 characters for cleaner SERP display.";
  $("#slugOutput").textContent = (data.title || "your page slug").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-") || "your-page-slug";
  const words = data.description.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const total = words.length || 1;
  const densities = keywordList(data.keywords).slice(0, 5).map((keyword) => {
    const key = keyword.toLowerCase();
    const hits = words.filter((word) => word === key).length;
    return `<div>${escapeHtml(keyword)}: <strong>${((hits / total) * 100).toFixed(1)}%</strong></div>`;
  }).join("");
  $("#densityOutput").innerHTML = densities || "Add keywords and description text.";
}

function updateScore(data) {
  const scored = score(data);
  const scoreRing = $(".score-ring");
  scoreRing.style.setProperty("--score", scored.total);
  $("#scoreValue").textContent = scored.total;
  $("#heroScore").textContent = scored.total;
  $("#heroMeter").style.width = `${scored.total}%`;
  $("#scoreLabel").textContent = scored.total >= 90 ? "Excellent" : scored.total >= 70 ? "Strong" : scored.total >= 45 ? "Improving" : "Needs inputs";
}

function updateOutput(data) {
  const tags = buildTags(data);
  generatedPlain = tags.join("\n");
  $("#codeOutput").innerHTML = `<code>${highlight(generatedPlain)}</code>`;
  $("#individualTags").innerHTML = tags.slice(0, -1).map((tag, index) => `
    <div class="tag-pill">
      <span>${escapeHtml(tag)}</span>
      <button class="mini-copy" type="button" data-tag-index="${index}">Copy</button>
    </div>
  `).join("");
}

function render() {
  const data = derived();
  updateCounters(data);
  updateValidation(data);
  updatePreviews(data);
  updateTools(data);
  updateScore(data);
  updateOutput(data);
  saveState();
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(getState()));
}

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    fields.forEach((id) => {
      if (state[id] !== undefined) els[id].value = state[id];
    });
  } catch {
    localStorage.removeItem(storageKey);
  }
}

async function copyText(text, message = "Copied to clipboard") {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  toast(message);
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast(`${name} downloaded`);
}

function toast(message) {
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  $("#toastRegion").appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function clearForm() {
  fields.forEach((id) => {
    if (els[id].type === "color") return;
    els[id].value = id === "language" ? "en" : "";
  });
  els.robots.value = "index, follow";
  els.twitterCard.value = "summary_large_image";
  uploadedImage = "";
  render();
  toast("Form cleared");
}

function resetForm() {
  localStorage.removeItem(storageKey);
  clearForm();
  els.themeColor.value = "#6366F1";
  els.tileColor.value = "#08090D";
  render();
  toast("Reset complete");
}

function parseImport(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = doc.querySelector("title")?.textContent || "";
  const meta = (selector) => doc.querySelector(selector)?.getAttribute("content") || "";
  const link = (selector) => doc.querySelector(selector)?.getAttribute("href") || "";
  els.title.value = title || meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]');
  els.description.value = meta('meta[name="description"]') || meta('meta[property="og:description"]');
  els.keywords.value = meta('meta[name="keywords"]');
  els.author.value = meta('meta[name="author"]');
  els.robots.value = meta('meta[name="robots"]') || els.robots.value;
  els.canonical.value = link('link[rel="canonical"]');
  els.themeColor.value = meta('meta[name="theme-color"]') || els.themeColor.value;
  els.ogTitle.value = meta('meta[property="og:title"]');
  els.ogDescription.value = meta('meta[property="og:description"]');
  els.ogImage.value = meta('meta[property="og:image"]');
  els.twitterCard.value = meta('meta[name="twitter:card"]') || els.twitterCard.value;
  els.twitterTitle.value = meta('meta[name="twitter:title"]');
  els.twitterDescription.value = meta('meta[name="twitter:description"]');
  els.twitterImage.value = meta('meta[name="twitter:image"]');
  els.favicon.value = link('link[rel="icon"]');
  els.appleIcon.value = link('link[rel="apple-touch-icon"]');
  render();
  toast("HTML metadata imported");
}

function confetti() {
  const canvas = $("#confettiCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#6366F1", "#22D3EE", "#A855F7", "#34D399", "#FBBF24"];
  const pieces = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * .35,
    size: 4 + Math.random() * 7,
    speed: 2 + Math.random() * 5,
    rotate: Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.y += p.speed;
      p.x += Math.sin(frame / 14 + p.rotate) * 1.8;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotate + frame / 20);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
      ctx.restore();
    });
    frame += 1;
    if (frame < 150) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

fields.forEach((id) => els[id].addEventListener("input", render));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  render();
  if (!els.title.value.trim() || !els.description.value.trim() || !isValidUrl(els.url.value)) {
    toast("Fix required fields before publishing tags");
    return;
  }
  confetti();
  toast("SEO meta tags generated");
  $("#output").scrollIntoView({ behavior: "smooth" });
});

document.addEventListener("click", (event) => {
  const rippleTarget = event.target.closest("[data-ripple]");
  if (rippleTarget) {
    const rect = rippleTarget.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${Math.max(rect.width, rect.height)}px`;
    ripple.style.left = `${event.clientX - rect.left - rect.width / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - rect.height / 2}px`;
    rippleTarget.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
  const tagButton = event.target.closest("[data-tag-index]");
  if (tagButton) copyText(buildTags(derived())[Number(tagButton.dataset.tagIndex)], "Tag copied");
  const targetButton = event.target.closest("[data-copy-target]");
  if (targetButton) copyText(document.getElementById(targetButton.dataset.copyTarget).textContent, "Copied");
});

$("#copyAllBtn").addEventListener("click", () => copyText(generatedPlain, "All tags copied"));
$("#copyVisibleBtn").addEventListener("click", () => copyText(generatedPlain, "Generated output copied"));
$("#downloadHtmlBtn").addEventListener("click", () => download("seo-meta-tags.html", generatedPlain, "text/html"));
$("#downloadTxtBtn").addEventListener("click", () => download("seo-meta-tags.txt", generatedPlain, "text/plain"));
$("#exportJsonBtn").addEventListener("click", () => download("seo-meta-tags.json", JSON.stringify(derived(), null, 2), "application/json"));
$("#clearBtn").addEventListener("click", clearForm);
$("#resetBtn").addEventListener("click", resetForm);
$("#importBtn").addEventListener("click", () => $("#importDialog").showModal());
$("#parseImportBtn").addEventListener("click", () => {
  parseImport($("#importHtml").value);
  $("#importDialog").close();
});

$("#themeToggle").addEventListener("click", () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "light" ? "" : "light";
  toast(document.documentElement.dataset.theme === "light" ? "Light mode enabled" : "Dark mode enabled");
});

$("#browseUpload").addEventListener("click", () => $("#logoUpload").click());
$("#dropZone").addEventListener("click", (event) => {
  if (event.target.id !== "browseUpload") $("#logoUpload").click();
});
$("#dropZone").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") $("#logoUpload").click();
});
["dragenter", "dragover"].forEach((type) => $("#dropZone").addEventListener(type, (event) => {
  event.preventDefault();
  $("#dropZone").classList.add("dragging");
}));
["dragleave", "drop"].forEach((type) => $("#dropZone").addEventListener(type, (event) => {
  event.preventDefault();
  $("#dropZone").classList.remove("dragging");
}));
$("#dropZone").addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));
$("#logoUpload").addEventListener("change", (event) => handleFile(event.target.files[0]));

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Please choose an image file");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    uploadedImage = reader.result;
    render();
    toast("Image added to previews");
  };
  reader.readAsDataURL(file);
}

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && document.activeElement === $("#codeOutput")) {
    event.preventDefault();
    copyText(generatedPlain, "Generated output copied");
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    form.requestSubmit();
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: .12 });
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

loadState();
render();
