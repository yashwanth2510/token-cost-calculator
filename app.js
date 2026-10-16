const MODELS = window.MODELS || [];
const $ = (id) => document.getElementById(id);

const els = {
  text: $("inputText"),
  model: $("modelSelect"),
  out: $("outputTokens"),
  presets: $("outputPresets"),
  mode: $("countMode"),
  statChars: $("statChars"),
  statWords: $("statWords"),
  statLines: $("statLines"),
  statTokens: $("statTokens"),
  modelName: $("modelName"),
  modelProvider: $("modelProvider"),
  priceIn: $("priceIn"),
  priceOut: $("priceOut"),
  priceCtx: $("priceCtx"),
  priceTok: $("priceTok"),
  priceTokNote: $("priceTokNote"),
  modelNote: $("modelNote"),
  costTotal: $("costTotal"),
  costTotalSub: $("costTotalSub"),
  costIn: $("costIn"),
  costOut: $("costOut"),
  costInSub: $("costInSub"),
  costOutSub: $("costOutSub"),
  barIn: $("barIn"),
  barOut: $("barOut"),
  perNote: $("perNote"),
  compareList: $("compareList"),
  estimateNotice: $("estimateNotice"),
  themeToggle: $("themeToggle"),
};

let encoder = null;
let inputTokens = 0;

function estimateTokens(text) {
  return text ? Math.ceil(text.length / 4) : 0;
}

function countTokens(text) {
  if (!text) return 0;
  return encoder ? encoder.encode(text).length : estimateTokens(text);
}

function fmtNum(n) {
  return n.toLocaleString("en-US");
}

function fmtPrice(p) {
  return "$" + (p < 1 ? p.toFixed(2) : p.toFixed(2));
}

function fmtUsd(n) {
  if (!isFinite(n) || n <= 0) return "$0.00";
  if (n >= 1) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (n >= 0.01) return "$" + n.toFixed(4);
  if (n < 0.0000001) return "<$0.0000001";
  return "$" + n.toFixed(8).replace(/0+$/, "");
}

function costOf(tokens, pricePer1M) {
  return (tokens / 1_000_000) * pricePer1M;
}

function selectedModel() {
  return MODELS.find((m) => m.id === els.model.value) || MODELS[0];
}

function outputTokenCount() {
  const n = parseInt(els.out.value, 10);
  return isFinite(n) && n > 0 ? n : 0;
}

function populateModels() {
  const providers = [...new Set(MODELS.map((m) => m.provider))];
  els.model.innerHTML = "";
  for (const provider of providers) {
    const group = document.createElement("optgroup");
    group.label = provider;
    for (const m of MODELS.filter((x) => x.provider === provider)) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} · ${fmtPrice(m.inPrice)} / ${fmtPrice(m.outPrice)} per 1M`;
      group.appendChild(opt);
    }
    els.model.appendChild(group);
  }
  els.model.value = MODELS[0]?.id || "";
}

function renderModelCard(m) {
  els.modelName.textContent = m.name;
  els.modelProvider.textContent = m.provider;
  els.priceIn.textContent = fmtPrice(m.inPrice);
  els.priceOut.textContent = fmtPrice(m.outPrice);
  els.priceCtx.textContent = m.context;
  els.priceTok.textContent = m.exact ? m.tokenizer : "≈ 4 chars/token";
  els.priceTokNote.textContent = m.exact ? "exact count" : "estimated count";
  els.modelNote.textContent = m.note || "";
}

function renderResults(m) {
  const outTokens = outputTokenCount();
  const inCost = costOf(inputTokens, m.inPrice);
  const outCost = costOf(outTokens, m.outPrice);
  const total = inCost + outCost;

  els.statTokens.textContent = fmtNum(inputTokens);
  els.costTotal.textContent = fmtUsd(total);
  els.costTotalSub.textContent = `${m.name} · ${fmtNum(inputTokens)} in + ${fmtNum(outTokens)} out`;
  els.costIn.textContent = fmtUsd(inCost);
  els.costOut.textContent = fmtUsd(outCost);
  els.costInSub.textContent = `${fmtNum(inputTokens)} × ${fmtPrice(m.inPrice)}/1M`;
  els.costOutSub.textContent = `${fmtNum(outTokens)} × ${fmtPrice(m.outPrice)}/1M`;

  const inPct = total > 0 ? (inCost / total) * 100 : 0;
  els.barIn.style.width = inPct + "%";
  els.barOut.style.width = (total > 0 ? 100 - inPct : 0) + "%";

  els.perNote.textContent =
    total > 0
      ? `1,000 requests ≈ ${fmtUsd(total * 1000)} · 1 million requests ≈ ${fmtUsd(total * 1_000_000)}`
      : "";
}

function renderCompare() {
  const text = els.text.value;
  const outTokens = outputTokenCount();

  const rows = MODELS.map((m) => {
    const inTok = m.exact ? inputTokens : estimateTokens(text);
    const inCost = costOf(inTok, m.inPrice);
    const outCost = costOf(outTokens, m.outPrice);
    return { m, inTok, inCost, outCost, total: inCost + outCost };
  }).sort((a, b) => a.total - b.total);

  const max = rows.length ? rows[rows.length - 1].total : 0;
  const currentId = els.model.value;

  els.compareList.innerHTML = rows
    .map(({ m, inTok, inCost, outCost, total }, i) => {
      const pct = max > 0 ? Math.max((total / max) * 100, 2) : 0;
      const best = i === 0 && total > 0;
      return `
      <div class="crow ${best ? "best" : ""} ${m.id === currentId ? "selected" : ""}" data-id="${m.id}" role="button" tabindex="0">
        <div class="crow-info">
          <div class="crow-name">
            ${m.name}
            <span class="chip">${m.provider}</span>
            ${best ? '<span class="badge-best">Best value</span>' : ""}
            ${m.exact ? "" : '<span class="tag-est">Est.</span>'}
          </div>
          <div class="crow-sub">${fmtNum(inTok)} tokens · input ${fmtUsd(inCost)} · output ${fmtUsd(outCost)}</div>
        </div>
        <div class="crow-cost">${fmtUsd(total)}</div>
        <div class="crow-bar"><span style="width:${pct}%"></span></div>
      </div>`;
    })
    .join("");
}

function syncPresetActive() {
  const v = String(outputTokenCount());
  els.presets.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b.dataset.v === v);
  });
}

function refreshInputStats() {
  const text = els.text.value;
  els.statChars.textContent = fmtNum(text.length);
  els.statWords.textContent = fmtNum(text.trim() ? text.trim().split(/\s+/).length : 0);
  els.statLines.textContent = fmtNum(text ? text.split(/\r\n|\r|\n/).length : 0);
  inputTokens = countTokens(text);
  renderResults(selectedModel());
  renderCompare();
}

function refreshAll() {
  renderModelCard(selectedModel());
  refreshInputStats();
  syncPresetActive();
}

let debounceTimer = null;
els.text.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshInputStats, 110);
});

els.model.addEventListener("change", refreshAll);

els.out.addEventListener("input", () => {
  renderResults(selectedModel());
  renderCompare();
  syncPresetActive();
});

els.presets.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  els.out.value = btn.dataset.v === "match" ? Math.max(inputTokens, 0) : btn.dataset.v;
  renderResults(selectedModel());
  renderCompare();
  syncPresetActive();
});

function selectModel(id) {
  els.model.value = id;
  refreshAll();
}

els.compareList.addEventListener("click", (e) => {
  const row = e.target.closest(".crow");
  if (row) selectModel(row.dataset.id);
});

els.compareList.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const row = e.target.closest(".crow");
  if (row) {
    e.preventDefault();
    selectModel(row.dataset.id);
  }
});

function setModeBadge(state) {
  els.mode.className = "pill";
  if (state === "loading") {
    els.mode.classList.add("pill-loading");
    els.mode.textContent = "Loading tokenizer…";
  } else if (state === "exact") {
    els.mode.classList.add("pill-exact");
    els.mode.textContent = "Exact · o200k_base";
  } else {
    els.mode.classList.add("pill-estimate");
    els.mode.textContent = "Estimated count";
  }
}

async function loadTokenizer() {
  try {
    const [{ Tiktoken }, o200k] = await Promise.all([
      import("https://esm.sh/js-tiktoken/lite"),
      import("https://esm.sh/js-tiktoken/ranks/o200k_base"),
    ]);
    encoder = new Tiktoken(o200k.default);
    setModeBadge("exact");
  } catch (err) {
    console.warn("Tokenizer failed to load; using estimates.", err);
    setModeBadge("estimate");
    els.estimateNotice.hidden = false;
  }
  refreshInputStats();
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
}

els.themeToggle.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
});

initTheme();
populateModels();
setModeBadge("loading");
refreshAll();
loadTokenizer();
