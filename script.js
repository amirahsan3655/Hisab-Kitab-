const STORAGE_KEY = "hisabKitabTransactionsV1";
const THEME_KEY = "hisabKitabThemeV1";
const BUDGET_KEY = "hisabKitabBudgetV1";
const SIDEBAR_KEY = "hisabKitabSidebarV1";
const LOCK_KEY = "hisabKitabLockPinV1";
const LOCK_SESSION_KEY = "hisabKitabUnlockedV1";
const THEMES = ["dark", "light", "blue", "emerald"];
const THEME_NAMES = { dark: "Dark", light: "Light", blue: "Blue", emerald: "Emerald" };
const DEFAULT_CATEGORIES = ["Salary", "Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other"];
const BASE_CURRENCY_KEY = "hisabKitabBaseCurrencyV1";
const CURRENCY_META = {
  SAR: { name: "Saudi Riyal", locale: "en-SA", flag: "🇸🇦" },
  AED: { name: "UAE Dirham", locale: "en-AE", flag: "🇦🇪" },
  PKR: { name: "Pakistani Rupee", locale: "en-PK", flag: "🇵🇰" },
  INR: { name: "Indian Rupee", locale: "en-IN", flag: "🇮🇳" },
  GBP: { name: "British Pound", locale: "en-GB", flag: "🇬🇧" }
};
const CURRENCY_CODES = Object.keys(CURRENCY_META);
// 1 unit → SAR (approx). Used only to convert totals into base currency.
const RATES_TO_SAR = { SAR: 1, AED: 1.02, PKR: 0.0135, INR: 0.043, GBP: 4.85 };
const $ = (id) => document.getElementById(id);
let transactions = loadTransactions();
let cashflowChart, categoryChart, reportChart;
let editingId = null;

function getBaseCurrency() {
  const c = localStorage.getItem(BASE_CURRENCY_KEY);
  return CURRENCY_CODES.includes(c) ? c : "SAR";
}
function setBaseCurrency(code) {
  if (!CURRENCY_CODES.includes(code)) code = "SAR";
  localStorage.setItem(BASE_CURRENCY_KEY, code);
}
function txCurrency(t) {
  const c = t && t.currency;
  return CURRENCY_CODES.includes(c) ? c : "SAR";
}
function convertAmount(amount, from, to) {
  const a = Number(amount) || 0;
  const f = CURRENCY_CODES.includes(from) ? from : "SAR";
  const tcur = CURRENCY_CODES.includes(to) ? to : "SAR";
  if (f === tcur) return a;
  const inSar = a * (RATES_TO_SAR[f] || 1);
  return inSar / (RATES_TO_SAR[tcur] || 1);
}
function money(value, code = null) {
  const c = CURRENCY_CODES.includes(code) ? code : getBaseCurrency();
  const meta = CURRENCY_META[c] || CURRENCY_META.SAR;
  try {
    return new Intl.NumberFormat(meta.locale, {
      style: "currency", currency: c, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(Number(value) || 0);
  } catch {
    return c + " " + (Number(value) || 0).toFixed(2);
  }
}
function moneyTx(t) { return money(t.amount, txCurrency(t)); }
function amountInBase(t) { return convertAmount(t.amount, txCurrency(t), getBaseCurrency()); }

function getTheme() {
  const t = localStorage.getItem(THEME_KEY);
  return THEMES.includes(t) ? t : "dark";
}
function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const label = $("themeLabel");
  if (label) label.textContent = THEME_NAMES[theme] || theme;
  document.querySelectorAll(".theme-option").forEach(opt => {
    opt.classList.toggle("active", opt.dataset.themeSet === theme);
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const colors = { dark: "#0c0d10", light: "#f4f2ec", blue: "#0b1220", emerald: "#0a1410" };
    meta.setAttribute("content", colors[theme] || "#0c0d10");
  }
  refreshIcons();
}
function openThemePanel() {
  const picker = $("themePicker");
  const panel = $("themePanel");
  const btn = $("themeToggle");
  if (!picker || !panel) return;
  panel.hidden = false;
  void panel.offsetHeight;
  picker.classList.add("open");
  if (btn) btn.setAttribute("aria-expanded", "true");
}
function closeThemePanel() {
  const picker = $("themePicker");
  const panel = $("themePanel");
  const btn = $("themeToggle");
  if (!picker || !panel) return;
  picker.classList.remove("open");
  if (btn) btn.setAttribute("aria-expanded", "false");
  const onEnd = (e) => {
    if (e.propertyName !== "grid-template-rows" && e.propertyName !== "opacity") return;
    panel.removeEventListener("transitionend", onEnd);
    if (!picker.classList.contains("open")) panel.hidden = true;
  };
  panel.addEventListener("transitionend", onEnd);
  setTimeout(() => {
    if (!picker.classList.contains("open")) panel.hidden = true;
  }, 360);
}
function toggleThemePanel() {
  const picker = $("themePicker");
  if (picker && picker.classList.contains("open")) closeThemePanel();
  else openThemePanel();
}
function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  if (typeof renderCharts === "function") renderCharts();
  showToast((THEME_NAMES[theme] || theme) + " theme on");
}
function cycleTheme() {
  const cur = getTheme();
  const idx = THEMES.indexOf(cur);
  setTheme(THEMES[(idx + 1) % THEMES.length]);
}

function loadTransactions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveTransactions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }

function loadBudget() {
  try {
    const v = localStorage.getItem(BUDGET_KEY);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}
function saveBudget(amount) {
  localStorage.setItem(BUDGET_KEY, String(amount));
}

function animateValue(el, end, duration = 650) {
  if (!el) return;
  const start = 0;
  const isMoney = el.id !== "countValue" && el.id !== "budgetPageDays";
  const startTime = performance.now();
  el.classList.add("tick");
  function frame(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = start + (end - start) * eased;
    el.textContent = isMoney ? money(current) : Math.round(current).toString();
    if (t < 1) requestAnimationFrame(frame);
    else {
      el.textContent = isMoney ? money(end) : Math.round(end).toString();
      setTimeout(() => el.classList.remove("tick"), 300);
    }
  }
  requestAnimationFrame(frame);
}
function dateLabel(value) {
  if (!value) return "";
  return new Date(value + "T00:00:00").toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" });
}
function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonthKey() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return monthKey(d);
}
function monthTotals(key) {
  const list = transactions.filter(t => t.date && t.date.startsWith(key));
  const income = list.filter(t => t.type === "income").reduce((s, t) => s + amountInBase(t), 0);
  const expense = list.filter(t => t.type === "expense").reduce((s, t) => s + amountInBase(t), 0);
  return { income, expense };
}
function totals(list = transactions) {
  const income = list.filter(t => t.type === "income").reduce((s, t) => s + amountInBase(t), 0);
  const expense = list.filter(t => t.type === "expense").reduce((s, t) => s + amountInBase(t), 0);
  return { income, expense, balance: income - expense };
}
function safe(text) {
  return String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function pctChange(current, previous) {
  if (!previous && !current) return { text: "—", cls: "" };
  if (!previous) return { text: "New", cls: "positive" };
  const diff = ((current - previous) / previous) * 100;
  const sign = diff > 0 ? "+" : "";
  const cls = diff > 0 ? "positive" : diff < 0 ? "negative" : "";
  return { text: `${sign}${diff.toFixed(0)}% vs last month`, cls };
}

function renderStats(animate = true) {
  const t = totals();
  if (animate) {
    animateValue($("balanceValue"), t.balance);
    animateValue($("incomeValue"), t.income);
    animateValue($("expenseValue"), t.expense);
    animateValue($("countValue"), transactions.length, 500);
  } else {
    if ($("balanceValue")) $("balanceValue").textContent = money(t.balance);
    if ($("incomeValue")) $("incomeValue").textContent = money(t.income);
    if ($("expenseValue")) $("expenseValue").textContent = money(t.expense);
    if ($("countValue")) $("countValue").textContent = transactions.length;
  }
  if ($("donutTotal")) $("donutTotal").textContent = money(t.expense);
  if ($("reportIncome")) $("reportIncome").textContent = money(t.income);
  if ($("reportExpense")) $("reportExpense").textContent = money(t.expense);

  const cur = monthTotals(monthKey());
  const prev = monthTotals(prevMonthKey());
  const incCh = pctChange(cur.income, prev.income);
  const expCh = pctChange(cur.expense, prev.expense);
  const incEl = $("incomeChange");
  const expEl = $("expenseChange");
  if (incEl) incEl.innerHTML = `<span class="${incCh.cls}">${incCh.text}</span>`;
  if (expEl) expEl.innerHTML = `<span class="${expCh.cls}">${expCh.text}</span>`;
}

function rowHTML(t, includeActions = false) {
  const icon = t.type === "income" ? "arrow-down-left" : "shopping-bag";
  const amountClass = t.type === "income" ? "amount-income" : "amount-expense";
  const sign = t.type === "income" ? "+" : "−";
  return `<tr>
    <td><div class="detail-cell"><div class="transaction-icon"><i data-lucide="${icon}"></i></div><div><strong>${safe(t.description)}</strong><span>${safe(t.category)}</span></div></div></td>
    ${includeActions ? `<td><span class="type-chip">${t.type}</span></td><td>${safe(t.category)}</td>` : `<td>${safe(t.category)}</td>`}
    <td>${dateLabel(t.date)}</td><td class="${amountClass}">${sign} ${moneyTx(t)}</td>
    ${includeActions ? `<td class="row-actions">
      <button class="icon-action edit-btn" data-edit="${t.id}" title="Edit"><i data-lucide="pencil"></i></button>
      <button class="icon-action delete-btn" data-delete="${t.id}" title="Delete"><i data-lucide="trash-2"></i></button>
    </td>` : ""}
  </tr>`;
}
function renderRecent() {
  const list = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5);
  const rows = $("recentRows");
  if (rows) rows.innerHTML = list.map(t => rowHTML(t)).join("");
  const empty = $("recentEmpty");
  if (empty) {
    empty.classList.toggle("show", list.length === 0);
    if (list.length) empty.classList.remove("show");
  }
  refreshIcons();
}
function populateCategoryFilter() {
  const sel = $("categoryFilter");
  if (!sel) return;
  const used = [...new Set(transactions.map(t => t.category).filter(Boolean))];
  const all = [...new Set([...DEFAULT_CATEGORIES, ...used])].sort((a, b) => a.localeCompare(b));
  const current = sel.value || "all";
  sel.innerHTML = `<option value="all">All categories</option>` + all.map(c => `<option value="${safe(c)}">${safe(c)}</option>`).join("");
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}
function renderAll() {
  const searchEl = $("searchInput");
  const typeEl = $("typeFilter");
  const catEl = $("categoryFilter");
  const search = (searchEl ? searchEl.value : "").trim().toLowerCase();
  const type = typeEl ? typeEl.value : "all";
  const category = catEl ? catEl.value : "all";
  const list = [...transactions].filter(t => {
    const matchesText = (t.description + " " + t.category).toLowerCase().includes(search);
    return matchesText && (type === "all" || t.type === type) && (category === "all" || t.category === category);
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const rows = $("allRows");
  if (rows) rows.innerHTML = list.map(t => rowHTML(t, true)).join("");
  const empty = $("allEmpty");
  if (empty) empty.classList.toggle("show", list.length === 0);
  refreshIcons();
}
function lastSixMonths() {
  const labels = [], keys = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString("en", { month: "short" }));
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return { labels, keys };
}
function monthlyValues() {
  const { labels, keys } = lastSixMonths();
  const income = keys.map(k => transactions.filter(t => t.type === "income" && t.date.startsWith(k)).reduce((s, t) => s + amountInBase(t), 0));
  const expense = keys.map(k => transactions.filter(t => t.type === "expense" && t.date.startsWith(k)).reduce((s, t) => s + amountInBase(t), 0));
  return { labels, income, expense };
}
const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  animation: { duration: 750, easing: "easeOutQuart" },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: "#25272d", titleColor: "#fff", bodyColor: "#ddd", padding: 11, displayColors: true } },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#858690", font: { family: "DM Sans", size: 10 } }, border: { display: false } },
    y: { grid: { color: "#ffffff0b" }, ticks: { color: "#858690", font: { family: "DM Sans", size: 9 }, callback: v => v >= 1000 ? (v / 1000) + "k" : v }, border: { display: false } }
  }
};
function getAccentColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    income: s.getPropertyValue("--chart-income").trim() || "#d8b46a",
    expense: s.getPropertyValue("--chart-expense").trim() || "#5a5d67",
    accent: s.getPropertyValue("--accent").trim() || "#d8b46a",
    green: s.getPropertyValue("--green").trim() || "#5ac69a",
    red: s.getPropertyValue("--red").trim() || "#f17e82"
  };
}
function renderCharts() {
  if (typeof Chart === "undefined") return;
  const m = monthlyValues();
  const c = getAccentColors();
  const cashData = {
    labels: m.labels,
    datasets: [
      { label: "Income", data: m.income, backgroundColor: c.income, borderRadius: 5, maxBarThickness: 19 },
      { label: "Expenses", data: m.expense, backgroundColor: c.expense, borderRadius: 5, maxBarThickness: 19 }
    ]
  };
  if (cashflowChart) cashflowChart.destroy();
  const cashCanvas = $("cashflowChart");
  if (cashCanvas) {
    cashflowChart = new Chart(cashCanvas, { type: "bar", data: cashData, options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, beginAtZero: true } } } });
  }
  if (reportChart) reportChart.destroy();
  const reportCanvas = $("reportChart");
  if (reportCanvas) {
    reportChart = new Chart(reportCanvas, {
      type: "line",
      data: {
        labels: m.labels,
        datasets: [
          { label: "Income", data: m.income, borderColor: c.income, backgroundColor: c.income + "33", fill: true, tension: 0.38, pointRadius: 3 },
          { label: "Expenses", data: m.expense, borderColor: c.red, backgroundColor: c.red + "26", fill: true, tension: 0.38, pointRadius: 3 }
        ]
      },
      options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, beginAtZero: true } } }
    });
  }
  const colors = [c.accent, c.green, "#8199d8", "#c18bd0", "#d88976", "#8ba9b6", "#a4a5ad"];
  const cats = {};
  transactions.filter(t => t.type === "expense").forEach(t => { cats[t.category] = (cats[t.category] || 0) + amountInBase(t); });
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  if (categoryChart) categoryChart.destroy();
  const catCanvas = $("categoryChart");
  if (catCanvas) {
    categoryChart = new Chart(catCanvas, {
      type: "doughnut",
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map((_, i) => colors[i % colors.length]), borderColor: "#191b20", borderWidth: 4, hoverOffset: 5 }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: "76%", plugins: { legend: { display: false }, tooltip: chartOptions.plugins.tooltip } }
    });
  }
  const legend = $("categoryLegend");
  if (legend) {
    legend.innerHTML = entries.length
      ? entries.map(([name, value], i) => `<div class="legend-row"><span class="legend-left"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${safe(name)}</span><strong>${money(value)}</strong></div>`).join("")
      : `<div class="empty-mini">Add expenses to see categories.</div>`;
  }
  const reportCats = $("reportCategories");
  if (reportCats) {
    reportCats.innerHTML = entries.length
      ? entries.map(([name, value], i) => {
          const max = Math.max(...entries.map(e => e[1]), 1);
          return `<div class="report-category"><div class="report-category-top"><span>${safe(name)}</span><strong>${money(value)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.max(3, (value / max) * 100)}%;background:${colors[i % colors.length]}"></div></div></div>`;
        }).join("")
      : `<div class="empty-mini">No expense data yet. Add an expense to create your report.</div>`;
  }
}

function daysLeftInMonth() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, last - now.getDate() + 1);
}
function renderBudget() {
  const limit = loadBudget();
  const spent = monthTotals(monthKey()).expense;
  const remaining = limit > 0 ? limit - spent : 0;
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const over = limit > 0 && spent > limit;
  const daysLeft = daysLeftInMonth();
  const daily = daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;

  const setText = (id, val) => { const el = $(id); if (el) el.textContent = val; };

  setText("budgetSpent", money(spent));
  setText("budgetLimit", limit > 0 ? money(limit) : "Not set");
  setText("budgetPercent", limit > 0 ? `${pct.toFixed(0)}% used` : "No budget");
  setText("budgetRemaining", limit > 0 ? (over ? money(spent - limit) + " over" : money(remaining) + " remaining") : "—");
  setText("budgetSubtitle", limit > 0 ? "Tracking this month’s spending" : "Set a budget to track your spending");

  const bar = $("budgetProgressBar");
  if (bar) {
    bar.style.width = limit > 0 ? `${pct}%` : "0%";
    bar.classList.toggle("over-budget", over);
  }

  setText("budgetPageLimit", limit > 0 ? money(limit) : "Not set");
  setText("budgetPageSpent", money(spent));
  setText("budgetPageRemaining", limit > 0 ? money(Math.max(0, remaining)) : "—");
  setText("budgetPageDaily", limit > 0 ? money(daily) : "—");
  setText("budgetPageDays", String(daysLeft));
  setText("budgetRingPercent", limit > 0 ? `${Math.round(pct)}%` : "—");

  const ring = $("budgetRing");
  if (ring) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    ring.style.strokeDasharray = String(circ);
    ring.style.strokeDashoffset = String(circ * (1 - (limit > 0 ? pct / 100 : 0)));
    ring.classList.toggle("over-budget", over);
  }
}

function updateInsight() {
  const el = $("insightText");
  if (!el) return;
  if (!transactions.length) {
    el.textContent = "Add a few transactions to unlock personalized spending insights.";
    return;
  }
  const t = totals();
  const cur = monthTotals(monthKey());
  const cats = {};
  transactions.filter(x => x.type === "expense").forEach(x => { cats[x.category] = (cats[x.category] || 0) + amountInBase(x); });
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const budget = loadBudget();

  if (budget > 0 && cur.expense > budget) {
    el.textContent = `You’ve exceeded this month’s budget by ${money(cur.expense - budget)}. Consider cutting back.`;
  } else if (budget > 0 && cur.expense > budget * 0.85) {
    el.textContent = `You’ve used ${Math.round((cur.expense / budget) * 100)}% of your monthly budget. Stay mindful.`;
  } else if (t.expense > t.income && t.income > 0) {
    el.textContent = `Expenses exceed income by ${money(t.expense - t.income)}. Review your top categories.`;
  } else if (top) {
    el.textContent = `Top spending is ${top[0]} at ${money(top[1])}. Balance sits at ${money(t.balance)}.`;
  } else if (t.income > 0) {
    el.textContent = `Looking good — income recorded is ${money(t.income)}. Add expenses to see a full picture.`;
  } else {
    el.textContent = `You have ${transactions.length} entries. Keep tracking to unlock better insights.`;
  }
}

function refresh() {
  populateCategoryFilter();
  renderStats();
  renderRecent();
  renderAll();
  renderCharts();
  renderBudget();
  updateInsight();
}
function refreshIcons() { if (window.lucide) lucide.createIcons(); }

function openModal(editTx = null) {
  editingId = editTx ? editTx.id : null;
  const eyebrow = $("modalEyebrow");
  const title = $("modalTitle");
  const submitLabel = $("submitLabel");
  const editInput = $("editId");
  if (editInput) editInput.value = editingId || "";

  if (editTx) {
    if (eyebrow) eyebrow.textContent = "EDIT ENTRY";
    if (title) title.textContent = "Edit transaction";
    if (submitLabel) submitLabel.textContent = "Update transaction";
    $("description").value = editTx.description || "";
    $("amount").value = editTx.amount;
    $("date").value = editTx.date;
    setEntryType(editTx.type);
    $("category").value = editTx.category || (editTx.type === "income" ? "Salary" : "Food");
    if ($("txCurrency")) $("txCurrency").value = txCurrency(editTx);
  } else {
    if (eyebrow) eyebrow.textContent = "NEW ENTRY";
    if (title) title.textContent = "Add transaction";
    if (submitLabel) submitLabel.textContent = "Save transaction";
    $("transactionForm").reset();
    const today = new Date();
    $("date").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setEntryType("expense");
    if ($("txCurrency")) $("txCurrency").value = getBaseCurrency();
  }
  $("modalBackdrop").classList.add("open");
  setTimeout(() => $("description") && $("description").focus(), 50);
}
function closeModal() {
  $("modalBackdrop").classList.remove("open");
  $("transactionForm").reset();
  editingId = null;
  const editInput = $("editId");
  if (editInput) editInput.value = "";
  setEntryType("expense");
}
function setEntryType(type) {
  $("entryType").value = type;
  document.querySelectorAll(".type-choice").forEach(b => b.classList.toggle("selected", b.dataset.type === type));
  if (!editingId) {
    $("category").value = type === "income" ? "Salary" : "Food";
  }
}
function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  const span = toast.querySelector("span");
  if (span) span.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2300);
}

function openBudgetModal() {
  const limit = loadBudget();
  const input = $("budgetAmount");
  if (input) input.value = limit > 0 ? limit : "";
  $("budgetModalBackdrop").classList.add("open");
  setTimeout(() => input && input.focus(), 50);
}
function closeBudgetModal() {
  $("budgetModalBackdrop").classList.remove("open");
  const form = $("budgetForm");
  if (form) form.reset();
}

const PAGE_ORDER = ["overview", "transactions", "reports", "budget"];
let currentPage = "overview";
let isPageSliding = false;

function switchPage(name) {
  const titles = {
    overview: "Overview",
    transactions: "Transactions",
    reports: "Reports",
    budget: "Budget"
  };
  if (!titles[name] || name === currentPage || isPageSliding) {
    closeSidebar();
    return;
  }

  const fromIdx = PAGE_ORDER.indexOf(currentPage);
  const toIdx = PAGE_ORDER.indexOf(name);
  const goingForward = toIdx >= fromIdx;

  const outPage = $(currentPage + "Page");
  const inPage = $(name + "Page");
  if (!outPage || !inPage) return;

  isPageSliding = true;

  document.querySelectorAll(".page-section").forEach(p => {
    p.classList.remove("page-visible", "slide-in-left", "slide-in-right", "slide-out-left", "slide-out-right");
  });

  const outClass = goingForward ? "slide-out-left" : "slide-out-right";
  const inClass = goingForward ? "slide-in-right" : "slide-in-left";

  outPage.classList.add(outClass);
  inPage.classList.add(inClass, "page-visible");

  document.querySelectorAll(".nav-link").forEach(b =>
    b.classList.toggle("active", b.dataset.page === name)
  );
  if ($("pageTitle")) $("pageTitle").textContent = titles[name];
  currentPage = name;

  if (name === "reports" || name === "overview" || name === "budget") {
    try { renderCharts(); renderBudget(); } catch (_) {}
  }

  const done = () => {
    outPage.classList.remove(outClass);
    inPage.classList.remove(inClass);
    inPage.classList.add("page-visible");
    isPageSliding = false;
  };

  const timer = setTimeout(done, 420);
  inPage.addEventListener("animationend", function handler() {
    inPage.removeEventListener("animationend", handler);
    clearTimeout(timer);
    done();
  });

  closeSidebar();
}

function isMobileNav() {
  return window.matchMedia("(max-width: 760px)").matches;
}
function openSidebar() {
  const sb = $("sidebar");
  const shell = document.querySelector(".app-shell");
  if (!sb) return;
  if (isMobileNav()) {
    sb.classList.add("open");
    sb.classList.remove("collapsed");
    const ov = $("mobileOverlay");
    if (ov) ov.classList.add("show");
  } else {
    sb.classList.remove("collapsed");
    if (shell) shell.classList.remove("sidebar-collapsed");
    localStorage.setItem(SIDEBAR_KEY, "open");
  }
}
function closeSidebar() {
  const sb = $("sidebar");
  const shell = document.querySelector(".app-shell");
  if (!sb) return;
  if (isMobileNav()) {
    sb.classList.remove("open");
    const ov = $("mobileOverlay");
    if (ov) ov.classList.remove("show");
  } else {
    sb.classList.add("collapsed");
    if (shell) shell.classList.add("sidebar-collapsed");
    localStorage.setItem(SIDEBAR_KEY, "collapsed");
  }
}
function toggleSidebar() {
  if (isMobileNav()) {
    if ($("sidebar").classList.contains("open")) closeSidebar();
    else openSidebar();
  } else {
    if ($("sidebar").classList.contains("collapsed")) openSidebar();
    else closeSidebar();
  }
}
function initSidebarState() {
  const shell = document.querySelector(".app-shell");
  const sb = $("sidebar");
  if (!sb) return;
  if (isMobileNav()) {
    sb.classList.remove("open", "collapsed");
    if (shell) shell.classList.remove("sidebar-collapsed");
    const ov = $("mobileOverlay");
    if (ov) ov.classList.remove("show");
    return;
  }
  const saved = localStorage.getItem(SIDEBAR_KEY);
  if (saved === "collapsed") {
    sb.classList.add("collapsed");
    if (shell) shell.classList.add("sidebar-collapsed");
  } else {
    sb.classList.remove("collapsed");
    if (shell) shell.classList.remove("sidebar-collapsed");
  }
}

/* ===== App Lock ===== */
function getStoredPin() {
  try { return localStorage.getItem(LOCK_KEY) || ""; }
  catch { return ""; }
}
function isLockEnabled() {
  return !!getStoredPin();
}
// In-memory only: refresh / new tab always requires PIN again
let appUnlocked = false;
const AUTO_LOCK_MS = 2 * 60 * 1000; // 2 minutes idle
let autoLockTimer = null;

function isSessionUnlocked() {
  return appUnlocked === true;
}
function setSessionUnlocked(on) {
  appUnlocked = !!on;
  if (on) resetAutoLockTimer();
  else clearAutoLockTimer();
}
function clearAutoLockTimer() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}
function resetAutoLockTimer() {
  clearAutoLockTimer();
  if (!isLockEnabled() || !appUnlocked) return;
  autoLockTimer = setTimeout(() => {
    if (!isLockEnabled()) return;
    appUnlocked = false;
    showLockScreen();
    showToast("Locked due to inactivity");
  }, AUTO_LOCK_MS);
}
function armAutoLockListeners() {
  const bump = () => {
    if (isLockEnabled() && appUnlocked) resetAutoLockTimer();
  };
  ["pointerdown", "keydown", "touchstart", "mousemove", "scroll"].forEach(evt => {
    document.addEventListener(evt, bump, { passive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    // Returning to tab: if lock on and was unlocked, still respect idle timer;
    // if user left for long, timer may already have locked.
    if (isLockEnabled() && !appUnlocked) showLockScreen();
  });
}
function simpleHash(str) {
  // lightweight obfuscation (not crypto-grade; device-local only)
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "hk:" + (h >>> 0).toString(16);
}
function setPin(pin) {
  localStorage.setItem(LOCK_KEY, simpleHash(String(pin)));
}
function clearPin() {
  localStorage.removeItem(LOCK_KEY);
  setSessionUnlocked(false);
  clearAutoLockTimer();
}
function verifyPin(pin) {
  const stored = getStoredPin();
  if (!stored) return true;
  return stored === simpleHash(String(pin));
}
function showLockScreen() {
  const screen = $("lockScreen");
  if (!screen) return;
  screen.hidden = false;
  document.body.style.overflow = "hidden";
  const input = $("unlockPin");
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 80);
  }
  const hint = $("lockHint");
  if (hint) hint.textContent = "";
  refreshIcons();
}
function hideLockScreen() {
  const screen = $("lockScreen");
  if (!screen) return;
  screen.hidden = true;
  document.body.style.overflow = "";
}
function enforceLock() {
  if (isLockEnabled() && !isSessionUnlocked()) showLockScreen();
  else hideLockScreen();
}
function updateLockModalUI() {
  const on = isLockEnabled();
  const status = $("lockStatusBox");
  const statusText = $("lockStatusText");
  const currentWrap = $("lockCurrentWrap");
  const removeBtn = $("removeLockBtn");
  const extra = $("lockExtra");
  const submitLabel = $("lockSubmitLabel");
  const title = $("lockModalTitle");
  if (status) status.className = "lock-status-box " + (on ? "on" : "off");
  if (statusText) statusText.textContent = on ? "Lock is ON — PIN on every open + auto-lock after 2 min idle" : "Lock is OFF";
  if (currentWrap) currentWrap.hidden = !on;
  if (removeBtn) removeBtn.hidden = !on;
  if (extra) extra.hidden = !on;
  if (submitLabel) submitLabel.textContent = on ? "Change PIN" : "Set PIN";
  if (title) title.textContent = on ? "Manage App Lock" : "Set App Lock";
}
function openLockModal() {
  updateLockModalUI();
  const form = $("lockForm");
  if (form) form.reset();
  $("lockModalBackdrop").classList.add("open");
  refreshIcons();
}
function closeLockModal() {
  $("lockModalBackdrop").classList.remove("open");
  const form = $("lockForm");
  if (form) form.reset();
}

/* ===== Backup / Restore / Gmail ===== */
function buildBackupPayload() {
  return {
    app: "Hisab Kitab Premium",
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions,
    budget: loadBudget(),
    theme: getTheme(),
    baseCurrency: getBaseCurrency(),
    lockEnabled: isLockEnabled()
  };
}
function downloadBackupFile() {
  const data = buildBackupPayload();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `hisab-kitab-backup-${day}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}
function exportFullBackup() {
  const name = downloadBackupFile();
  showToast("Backup downloaded: " + name);
}
function emailBackupViaGmail() {
  const name = downloadBackupFile();
  const subject = encodeURIComponent("Hisab Kitab Backup " + new Date().toLocaleDateString("en"));
  const body = encodeURIComponent(
    "Assalam o Alaikum / Hello,\n\n" +
    "Please find my Hisab Kitab backup attached (file: " + name + ").\n\n" +
    "How to restore:\n" +
    "1. Open Hisab Kitab\n" +
    "2. Sidebar → Backup → Restore from file\n" +
    "3. Select this JSON file\n\n" +
    "Exported: " + new Date().toLocaleString() + "\n" +
    "Transactions: " + transactions.length + "\n"
  );
  // Open Gmail compose; user attaches the just-downloaded file
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`;
  window.open(gmail, "_blank", "noopener,noreferrer");
  showToast("Backup downloaded — attach it in Gmail");
}
function restoreFromBackupObject(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid backup");
  if (!Array.isArray(data.transactions)) throw new Error("Backup missing transactions");
  // basic sanitize
  transactions = data.transactions.filter(t => t && t.id && t.type && t.amount != null).map(t => ({
    id: String(t.id),
    description: String(t.description || "").slice(0, 60),
    amount: Number(t.amount) || 0,
    type: t.type === "income" ? "income" : "expense",
    category: String(t.category || "Other"),
    date: String(t.date || "").slice(0, 10),
    currency: CURRENCY_CODES.includes(t.currency) ? t.currency : "SAR",
    createdAt: Number(t.createdAt) || Date.now()
  }));
  saveTransactions();
  if (data.budget != null && Number(data.budget) > 0) saveBudget(Number(data.budget));
  if (data.theme && THEMES.includes(data.theme)) {
    localStorage.setItem(THEME_KEY, data.theme);
    applyTheme(data.theme);
  }
  if (data.baseCurrency && CURRENCY_CODES.includes(data.baseCurrency)) {
    setBaseCurrency(data.baseCurrency);
    const sel = $("baseCurrencySelect");
    if (sel) sel.value = data.baseCurrency;
  }
  refresh();
}
function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!confirm("Restore will replace current transactions and budget. Continue?")) return;
      restoreFromBackupObject(data);
      showToast("Backup restored successfully");
      closeBackupModal();
    } catch (err) {
      console.error(err);
      showToast("Invalid backup file");
    }
  };
  reader.onerror = () => showToast("Could not read file");
  reader.readAsText(file);
}
function openBackupModal() {
  $("backupModalBackdrop").classList.add("open");
  refreshIcons();
}
function closeBackupModal() {
  $("backupModalBackdrop").classList.remove("open");
  const input = $("importBackupInput");
  if (input) input.value = "";
}

function exportCSV() {
  const header = ["Description", "Type", "Category", "Date", "Amount", "Currency"];
  const rows = transactions.map(t => [t.description, t.type, t.category, t.date, Number(t.amount).toFixed(2), txCurrency(t)]);
  const csv = [header, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hisab-kitab-transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("CSV file exported");
}

/* ===== Event bindings ===== */
document.querySelectorAll(".nav-link").forEach(b => b.addEventListener("click", () => switchPage(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => switchPage(b.dataset.go)));
["addTopBtn", "addTransactionsBtn", "emptyAddBtn"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("click", () => openModal(null));
});
if ($("closeModal")) $("closeModal").addEventListener("click", closeModal);
if ($("cancelModal")) $("cancelModal").addEventListener("click", closeModal);
if ($("modalBackdrop")) {
  $("modalBackdrop").addEventListener("click", e => {
    if (e.target === $("modalBackdrop")) closeModal();
  });
}
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    closeBudgetModal();
    closeLockModal();
    closeBackupModal();
    closeSidebar();
    closeThemePanel();
  }
});
document.querySelectorAll(".type-choice").forEach(b => b.addEventListener("click", () => setEntryType(b.dataset.type)));

if ($("transactionForm")) {
  $("transactionForm").addEventListener("submit", e => {
    e.preventDefault();
    const amount = Number($("amount").value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Please enter a valid amount");
      return;
    }
    const cur = ($("txCurrency") && $("txCurrency").value) || getBaseCurrency();
    const payload = {
      description: $("description").value.trim(),
      amount,
      type: $("entryType").value,
      category: $("category").value,
      date: $("date").value,
      currency: CURRENCY_CODES.includes(cur) ? cur : "SAR",
      createdAt: Date.now()
    };
    if (!payload.description) {
      showToast("Please enter a description");
      return;
    }
    if (editingId) {
      const idx = transactions.findIndex(t => t.id === editingId);
      if (idx >= 0) {
        transactions[idx] = { ...transactions[idx], ...payload };
        showToast("Transaction updated");
      }
    } else {
      transactions.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        ...payload
      });
      showToast("Transaction saved successfully");
    }
    saveTransactions();
    refresh();
    closeModal();
  });
}

if ($("allRows")) {
  $("allRows").addEventListener("click", e => {
    const delBtn = e.target.closest("[data-delete]");
    if (delBtn) {
      const id = delBtn.dataset.delete;
      if (confirm("Delete this transaction?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions();
        refresh();
        showToast("Transaction deleted");
      }
      return;
    }
    const editBtn = e.target.closest("[data-edit]");
    if (editBtn) {
      const id = editBtn.dataset.edit;
      const tx = transactions.find(t => t.id === id);
      if (tx) openModal(tx);
    }
  });
}

["searchInput", "typeFilter", "categoryFilter"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("input", renderAll);
});
if ($("exportBtn")) $("exportBtn").addEventListener("click", exportCSV);
if ($("menuBtn")) $("menuBtn").addEventListener("click", toggleSidebar);
if ($("closeSidebar")) $("closeSidebar").addEventListener("click", closeSidebar);
if ($("mobileOverlay")) $("mobileOverlay").addEventListener("click", closeSidebar);

/* Budget modal */
if ($("setBudgetBtn")) $("setBudgetBtn").addEventListener("click", openBudgetModal);
if ($("closeBudgetModal")) $("closeBudgetModal").addEventListener("click", closeBudgetModal);
if ($("cancelBudgetModal")) $("cancelBudgetModal").addEventListener("click", closeBudgetModal);
if ($("budgetModalBackdrop")) {
  $("budgetModalBackdrop").addEventListener("click", e => {
    if (e.target === $("budgetModalBackdrop")) closeBudgetModal();
  });
}
if ($("budgetForm")) {
  $("budgetForm").addEventListener("submit", e => {
    e.preventDefault();
    const amount = Number($("budgetAmount").value);
    if (!Number.isFinite(amount) || amount < 1) {
      showToast("Please enter a valid budget amount");
      return;
    }
    saveBudget(amount);
    renderBudget();
    updateInsight();
    closeBudgetModal();
    showToast("Budget saved");
  });
}

const today = new Date();
if ($("todayLabel")) {
  $("todayLabel").textContent = today.toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
}
if ($("date")) {
  $("date").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}
if ($("year")) $("year").textContent = today.getFullYear();

/* Theme */
if ($("themeToggle")) {
  $("themeToggle").addEventListener("click", e => {
    e.stopPropagation();
    toggleThemePanel();
  });
}
if ($("themePanel")) {
  $("themePanel").addEventListener("click", e => {
    const opt = e.target.closest(".theme-option");
    if (!opt) return;
    e.stopPropagation();
    setTheme(opt.dataset.themeSet);
    closeThemePanel();
  });
}
document.addEventListener("click", e => {
  const picker = $("themePicker");
  if (picker && picker.classList.contains("open") && !picker.contains(e.target)) {
    closeThemePanel();
  }
});

/* Smart Insight collapse */
if ($("insightToggle")) {
  $("insightToggle").addEventListener("click", e => {
    e.stopPropagation();
    const card = $("insightCard");
    const btn = $("insightToggle");
    if (!card) return;
    const collapsed = card.classList.toggle("collapsed");
    if (btn) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}

/* Lock + Backup events */
if ($("backupBtn")) $("backupBtn").addEventListener("click", openBackupModal);
if ($("lockSettingsBtn")) $("lockSettingsBtn").addEventListener("click", openLockModal);
if ($("closeBackupModal")) $("closeBackupModal").addEventListener("click", closeBackupModal);
if ($("backupModalBackdrop")) {
  $("backupModalBackdrop").addEventListener("click", e => {
    if (e.target === $("backupModalBackdrop")) closeBackupModal();
  });
}
if ($("exportBackupBtn")) $("exportBackupBtn").addEventListener("click", exportFullBackup);
if ($("emailBackupBtn")) $("emailBackupBtn").addEventListener("click", emailBackupViaGmail);
if ($("importBackupInput")) {
  $("importBackupInput").addEventListener("change", e => {
    const file = e.target.files && e.target.files[0];
    handleImportFile(file);
  });
}
if ($("closeLockModal")) $("closeLockModal").addEventListener("click", closeLockModal);
if ($("cancelLockModal")) $("cancelLockModal").addEventListener("click", closeLockModal);
if ($("lockModalBackdrop")) {
  $("lockModalBackdrop").addEventListener("click", e => {
    if (e.target === $("lockModalBackdrop")) closeLockModal();
  });
}
if ($("lockForm")) {
  $("lockForm").addEventListener("submit", e => {
    e.preventDefault();
    const current = ($("lockCurrentPin") && $("lockCurrentPin").value) || "";
    const pin = ($("lockNewPin") && $("lockNewPin").value) || "";
    const confirmPin = ($("lockConfirmPin") && $("lockConfirmPin").value) || "";
    if (isLockEnabled() && !verifyPin(current)) {
      showToast("Current PIN is incorrect");
      return;
    }
    if (!/^[0-9]{4,8}$/.test(pin)) {
      showToast("PIN must be 4–8 digits");
      return;
    }
    if (pin !== confirmPin) {
      showToast("PIN confirmation does not match");
      return;
    }
    setPin(pin);
    setSessionUnlocked(true);
    updateLockModalUI();
    closeLockModal();
    showToast("App lock enabled");
  });
}
if ($("removeLockBtn")) {
  $("removeLockBtn").addEventListener("click", () => {
    const current = ($("lockCurrentPin") && $("lockCurrentPin").value) || "";
    if (!verifyPin(current)) {
      showToast("Enter current PIN to remove lock");
      return;
    }
    if (!confirm("Remove app lock?")) return;
    clearPin();
    updateLockModalUI();
    hideLockScreen();
    closeLockModal();
    showToast("App lock removed");
  });
}
if ($("lockNowBtn")) {
  $("lockNowBtn").addEventListener("click", () => {
    setSessionUnlocked(false);
    closeLockModal();
    closeSidebar();
    showLockScreen();
    showToast("App locked");
  });
}
if ($("unlockForm")) {
  $("unlockForm").addEventListener("submit", e => {
    e.preventDefault();
    const pin = ($("unlockPin") && $("unlockPin").value) || "";
    const hint = $("lockHint");
    if (verifyPin(pin)) {
      setSessionUnlocked(true);
      hideLockScreen();
      if (hint) hint.textContent = "";
      showToast("Unlocked");
    } else {
      if (hint) hint.textContent = "Wrong PIN. Try again.";
      if ($("unlockPin")) {
        $("unlockPin").value = "";
        $("unlockPin").focus();
      }
    }
  });
}

applyTheme(getTheme());
initSidebarState();
const baseSel = $("baseCurrencySelect");
if (baseSel) {
  baseSel.value = getBaseCurrency();
  baseSel.addEventListener("change", () => {
    setBaseCurrency(baseSel.value);
    refresh();
    showToast("Base currency: " + baseSel.value);
  });
}
enforceLock();
window.addEventListener("resize", () => {
  initSidebarState();
});

/* Button ripple */
document.querySelectorAll(".primary-btn").forEach(btn => {
  btn.addEventListener("click", function (e) {
    this.classList.remove("ripple");
    void this.offsetWidth;
    const rect = this.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    this.style.setProperty("--rx", x + "%");
    this.style.setProperty("--ry", y + "%");
    this.classList.add("ripple");
  });
});

refresh();
refreshIcons();
