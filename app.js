/* =========================================
   Expense & Budget Visualizer — app.js
   Vanilla JS | LocalStorage | Chart.js
   ========================================= */

// ── Constants ──────────────────────────────
const STORAGE_KEY = 'expense_transactions';
const LIMIT_KEY   = 'expense_limit';
const THEME_KEY   = 'expense_theme';

const CATEGORY_COLORS = {
  Food:      '#4caf50',
  Transport: '#2196f3',
  Fun:       '#ff9800',
};

// ── State ──────────────────────────────────
let transactions = [];   // Array of { id, name, amount, category, createdAt }
let spendingLimit = null; // number | null
let chartInstance = null; // Chart.js instance

// ── DOM References ──────────────────────────
const form            = document.getElementById('transaction-form');
const nameInput       = document.getElementById('item-name');
const amountInput     = document.getElementById('item-amount');
const categoryInput   = document.getElementById('item-category');
const nameError       = document.getElementById('name-error');
const amountError     = document.getElementById('amount-error');
const categoryError   = document.getElementById('category-error');
const totalBalanceEl  = document.getElementById('total-balance');
const transactionList = document.getElementById('transaction-list');
const emptyState      = document.getElementById('empty-state');
const sortSelect      = document.getElementById('sort-select');
const limitInput      = document.getElementById('spending-limit');
const setLimitBtn     = document.getElementById('set-limit-btn');
const clearLimitBtn   = document.getElementById('clear-limit-btn');
const limitStatus     = document.getElementById('limit-status');
const themeToggle     = document.getElementById('theme-toggle');
const chartCanvas     = document.getElementById('spending-chart');
const chartEmpty      = document.getElementById('chart-empty');

// ── LocalStorage Helpers ────────────────────
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadTransactions() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveLimit(value) {
  if (value === null) {
    localStorage.removeItem(LIMIT_KEY);
  } else {
    localStorage.setItem(LIMIT_KEY, String(value));
  }
}

function loadLimit() {
  const stored = localStorage.getItem(LIMIT_KEY);
  return stored !== null ? parseFloat(stored) : null;
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

// ── Theme ───────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  // Rebuild chart so Chart.js picks up new colors
  if (chartInstance) {
    renderChart();
  }
}

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
});

// ── Validation ──────────────────────────────
function clearErrors() {
  nameError.textContent     = '';
  amountError.textContent   = '';
  categoryError.textContent = '';
  nameInput.classList.remove('input-error');
  amountInput.classList.remove('input-error');
  categoryInput.classList.remove('input-error');
}

function validateForm() {
  clearErrors();
  let valid = true;
  const name     = nameInput.value.trim();
  const amount   = amountInput.value.trim();
  const category = categoryInput.value;

  if (!name) {
    nameError.textContent = 'Item name is required.';
    nameInput.classList.add('input-error');
    valid = false;
  }

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    amountError.textContent = 'Enter a valid amount greater than 0.';
    amountInput.classList.add('input-error');
    valid = false;
  }

  if (!category) {
    categoryError.textContent = 'Please select a category.';
    categoryInput.classList.add('input-error');
    valid = false;
  }

  return valid;
}

// ── Transactions ────────────────────────────
function addTransaction(name, amount, category) {
  const transaction = {
    id:        crypto.randomUUID(),
    name:      name,
    amount:    parseFloat(parseFloat(amount).toFixed(2)),
    category:  category,
    createdAt: Date.now(),
  };
  transactions.push(transaction);
  saveTransactions();
  refreshUI();
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  refreshUI();
}

// ── Sorting ─────────────────────────────────
function getSortedTransactions() {
  const sortBy = sortSelect.value;
  const copy   = [...transactions];

  switch (sortBy) {
    case 'oldest':
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'category':
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    case 'newest':
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

// ── Total Balance ────────────────────────────
function getTotalBalance() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

function renderBalance() {
  const total = getTotalBalance();
  totalBalanceEl.textContent = formatCurrency(total);

  if (spendingLimit !== null && total > spendingLimit) {
    totalBalanceEl.classList.add('over-limit');
  } else {
    totalBalanceEl.classList.remove('over-limit');
  }
}

// ── Spending Limit ───────────────────────────
function renderLimitStatus() {
  const total = getTotalBalance();

  if (spendingLimit === null) {
    limitStatus.textContent = '';
    limitStatus.className   = 'limit-status';
    return;
  }

  const remaining = spendingLimit - total;

  if (remaining < 0) {
    limitStatus.textContent = `⚠️ Over limit by ${formatCurrency(Math.abs(remaining))} (limit: ${formatCurrency(spendingLimit)})`;
    limitStatus.className   = 'limit-status over';
  } else {
    limitStatus.textContent = `✅ ${formatCurrency(remaining)} remaining (limit: ${formatCurrency(spendingLimit)})`;
    limitStatus.className   = 'limit-status safe';
  }
}

setLimitBtn.addEventListener('click', () => {
  const val = parseFloat(limitInput.value);
  if (isNaN(val) || val <= 0) {
    limitInput.classList.add('input-error');
    limitInput.focus();
    return;
  }
  limitInput.classList.remove('input-error');
  spendingLimit = val;
  saveLimit(spendingLimit);
  renderLimitStatus();
  renderBalance();
  renderTransactionList(); // re-render to update highlight badges
});

clearLimitBtn.addEventListener('click', () => {
  spendingLimit = null;
  saveLimit(null);
  limitInput.value = '';
  renderLimitStatus();
  renderBalance();
  renderTransactionList();
});

// ── Transaction List Rendering ───────────────
function renderTransactionList() {
  const sorted = getSortedTransactions();
  const total  = getTotalBalance();

  // Toggle empty state
  if (sorted.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
  }

  // Remove existing items (keep empty-state li)
  const existingItems = transactionList.querySelectorAll('.transaction-item');
  existingItems.forEach(el => el.remove());

  sorted.forEach(t => {
    const isOver = spendingLimit !== null && total > spendingLimit;

    const li = document.createElement('li');
    li.className = 'transaction-item' + (isOver ? ' over-limit' : '');
    li.setAttribute('data-id', t.id);

    const badgeClass = `badge-${t.category.toLowerCase()}`;

    li.innerHTML = `
      <div class="transaction-info">
        <p class="transaction-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</p>
        <p class="transaction-amount">${formatCurrency(t.amount)}</p>
        <div class="transaction-meta">
          <span class="category-badge ${badgeClass}">${escapeHtml(t.category)}</span>
          ${isOver ? '<span class="over-limit-badge">⚠ Over limit</span>' : ''}
        </div>
      </div>
      <button class="btn btn-danger delete-btn" aria-label="Delete ${escapeHtml(t.name)}">Delete</button>
    `;

    li.querySelector('.delete-btn').addEventListener('click', () => {
      deleteTransaction(t.id);
    });

    transactionList.appendChild(li);
  });
}

// ── Pie Chart ───────────────────────────────
function getCategoryTotals() {
  const totals = {};
  transactions.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  return totals;
}

function renderChart() {
  const totals     = getCategoryTotals();
  const labels     = Object.keys(totals);
  const data       = Object.values(totals);
  const colors     = labels.map(l => CATEGORY_COLORS[l] || '#9e9e9e');

  // Detect current theme for chart text color
  const isDark   = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#a0a8c0' : '#555770';

  if (labels.length === 0) {
    chartEmpty.classList.remove('hidden');
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  chartEmpty.classList.add('hidden');

  if (chartInstance) {
    chartInstance.data.labels        = labels;
    chartInstance.data.datasets[0].data   = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.options.plugins.legend.labels.color = textColor;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(chartCanvas, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data:            data,
        backgroundColor: colors,
        borderWidth:     2,
        borderColor:     isDark ? '#1c1f2e' : '#ffffff',
        hoverOffset:     8,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color:     textColor,
            font:      { size: 12, family: "'Segoe UI', system-ui, sans-serif" },
            padding:   14,
            boxWidth:  14,
            boxHeight: 14,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val   = ctx.parsed;
              const sum   = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = ((val / sum) * 100).toFixed(1);
              return ` ${formatCurrency(val)}  (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ── Form Submit ──────────────────────────────
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const name     = nameInput.value.trim();
  const amount   = amountInput.value.trim();
  const category = categoryInput.value;

  addTransaction(name, amount, category);

  // Reset form
  form.reset();
  clearErrors();
  nameInput.focus();
});

// ── Sort Change ──────────────────────────────
sortSelect.addEventListener('change', () => {
  renderTransactionList();
});

// ── Full UI Refresh ──────────────────────────
function refreshUI() {
  renderBalance();
  renderLimitStatus();
  renderTransactionList();
  renderChart();
}

// ── Utilities ────────────────────────────────
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Init ─────────────────────────────────────
function init() {
  // Load persisted data
  transactions  = loadTransactions();
  spendingLimit = loadLimit();

  // Restore limit input field value
  if (spendingLimit !== null) {
    limitInput.value = spendingLimit;
  }

  // Apply saved theme
  const savedTheme = loadTheme();
  applyTheme(savedTheme);

  // Render everything
  refreshUI();
}

init();
