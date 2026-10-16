const MODELS = window.MODELS || [];

const els = {
  text: document.getElementById("inputText"),
  model: document.getElementById("modelSelect"),
  out: document.getElementById("outputTokens"),
  presets: document.getElementById("outputPresets"),
  mode: document.getElementById("countMode"),
  statChars: document.getElementById("statChars"),
  statWords: document.getElementById("statWords"),
  statLines: document.getElementById("statLines"),
  statTokens: document.getElementById("statTokens"),
  priceIn: document.getElementById("priceIn"),
  priceOut: document.getElementById("priceOut"),
  priceCtx: document.getElementById("priceCtx"),
  priceTok: document.getElementById("priceTok"),
  priceTokNote: document.getElementById("priceTokNote"),
  costIn: document.getElementById("costIn"),
  costOut: document.getElementById("costOut"),
  costTotal: document.getElementById("costTotal"),
  costInSub: document.getElementById("costInSub"),
  costOutSub: document.getElementById("costOutSub"),
  costTotalSub: document.getElementById("costTotalSub"),
  perNote: document.getElementById("perNote"),
  tbody: document.querySelector("#compareTable tbody"),
  estimateNotice: document.getElementById("estimateNotice"),
};

let encoder = null;
let encodeFailed = false;
let inputTokens = 0;

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function countTokens(text) {
  if (!text) return 0;
  if (encoder) return encoder.encode(text).length;
  return estimateTokens(text);
}

function fmtNum(n) {
  return n.toLocaleString("en-US");
}

function fmtUsd(n) {
  if (!isFinite(n) || n === 0) return "$0.00";
  if (n < 0.000001) return "$" + n.toExponential(2);
  if (n < 0.01) return "$" + n.toFixed(6);
  if (n < 1) return "$" + n.toFixed(4);
  return (
    "$" +
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
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
  for (const p of providers) {
    const group = document.createElement("optgroup");
    group.label = p;
    for (const m of MODELS.filter((x) => x.provider === p)) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} — $${m.inPrice}/$${m.outPrice} per 1M`;
      group.appendChild(opt);
    }
    els.model.appendChild(group);
  }
  els.model.value = MODELS[0]?.id || "";
}

function renderPricingCard(m) {
  els.priceIn.textContent = `$${m.inPrice.toFixed(2)}`;
  els.priceOut.textContent = `$${m.outPrice.toFixed(2)}`;
  els.priceCtx.textContent = m.context;
  els.priceTok.textContent = m.exact ? m.tokenizer : "≈ 4 chars/token";
  els.priceTokNote.textContent = m.exact ? "exact count" : "estimated count";
}

function renderResults(m) {
  const outTokens = outputTokenCount();
  const inCost = costOf(inputTokens, m.inPrice);
  const outCost = costOf(outTokens, m.outPrice);

  els.statTokens.textContent = fmtNum(inputTokens);
  els.costIn.textContent = fmtUsd(inCost);
  els.costOut.textContent = fmtUsd(outCost);
  els.costTotal.textContent = fmtUsd(inCost + outCost);
  els.costInSub.textContent = `${fmtNum(inputTokens)} tokens × $${m.inPrice}/1M`;
  els.costOutSub.textContent = `${fmtNum(outTokens)} tokens × $${m.outPrice}/1M`;
  els.costTotalSub.textContent = `${m.name} · input + output`;

  if (inCost + outCost > 0) {
    els.perNote.textContent = `For 1,000 identical requests: ${fmtUsd(
      (inCost + outCost) * 1000
    )} · for 1,000,000 requests: ${fmtUsd((inCost + outCost) * 1_000_000)}`;
  } else {
    els.perNote.textContent = "";
  }
}

function renderCompare() {
  const text = els.text.value;
  const outTokens = outputTokenCount();
  const exactTokens = inputTokens;

  const rows = MODELS.map((m) => {
    const inTok = m.exact ? exactTokens : estimateTokens(text);
    const inCost = costOf(inTok, m.inPrice);
    const outCost = costOf(outTokens, m.outPrice);
    return { m, inTok, inCost, outCost, total: inCost + outCost };
  }).sort((a, b) => a.total - b.total);

  els.tbody.innerHTML = rows
    .map(
      ({ m, inTok, inCost, outCost, total }) => `
      <tr data-id="${m.id}" class="${m.id === els.model.value ? "selected" : ""}">
        <td>${m.name}${m.exact ? "" : ' <span class="provider-tag">est.</span>'}</td>
        <td><span class="provider-tag">${m.provider}</span></td>
        <td class="num">${fmtNum(inTok)}</td>
        <td class="num">$${m.inPrice.toFixed(2)}</td>
        <td class="num">$${m.outPrice.toFixed(2)}</td>
        <td class="num">${fmtUsd(inCost)}</td>
        <td class="num">${fmtUsd(outCost)}</td>
        <td class="num total-cell">${fmtUsd(total)}</td>
      </tr>`
    )
    .join("");
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
  renderPricingCard(selectedModel());
  refreshInputStats();
}

let debounceTimer = null;
els.text.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshInputStats, 120);
});

els.model.addEventListener("change", refreshAll);
els.out.addEventListener("input", () => {
  renderResults(selectedModel());
  renderCompare();
});

els.presets.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  els.out.value = btn.dataset.v === "match" ? Math.max(inputTokens, 0) : btn.dataset.v;
  renderResults(selectedModel());
  renderCompare();
});

els.tbody.addEventListener("click", (e) => {
  const tr = e.target.closest("tr");
  if (!tr || !tr.dataset.id) return;
  els.model.value = tr.dataset.id;
  refreshAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function setModeBadge(state) {
  els.mode.className = "badge";
  if (state === "loading") {
    els.mode.classList.add("badge-loading");
    els.mode.textContent = "loading tokenizer…";
  } else if (state === "exact") {
    els.mode.classList.add("badge-exact");
    els.mode.textContent = "exact count · o200k_base";
  } else {
    els.mode.classList.add("badge-estimate");
    els.mode.textContent = "estimated count";
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
    console.warn("Tokenizer failed to load, using estimates.", err);
    encodeFailed = true;
    setModeBadge("estimate");
    els.estimateNotice.hidden = false;
  }
  refreshInputStats();
}

populateModels();
setModeBadge("loading");
refreshAll();
loadTokenizer();
