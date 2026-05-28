const STORAGE_KEY = 'expense-budget-visualizer';
const CATEGORY_KEY = 'expense-budget-categories';
const THEME_KEY = 'expense-budget-theme';
const INITIAL_BALANCE = 1000;

const form = document.getElementById('transaction-form');
const nameInput = document.getElementById('item-name');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const customInput = document.getElementById('custom-category');
const limitInput = document.getElementById('monthly-limit');
const messageBox = document.getElementById('form-message');
const list = document.getElementById('transactions-list');
const balanceLabel = document.getElementById('total-balance');
const spentLabel = document.getElementById('spent-label');
const summaryBox = document.getElementById('monthly-summary');
const limitAlert = document.getElementById('limit-alert');
const sortSelect = document.getElementById('sort-select');
const themeToggle = document.getElementById('theme-toggle');

let transactions = loadTransactions();
let customCategories = loadCustomCategories();
let chart;


function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load transactions:', error);
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadCustomCategories() {
  try {
    return JSON.parse(localStorage.getItem(CATEGORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCustomCategories() {
  localStorage.setItem(CATEGORY_KEY, JSON.stringify(customCategories));
}

function applyCustomCategories() {
  const allCategories = ['Food', 'Transport', 'Fun', ...customCategories];
  const uniqueCategories = [...new Set(allCategories)];
  const currentValue = categoryInput.value;
  categoryInput.innerHTML = '<option value="">Choose a category</option>' +
    uniqueCategories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  if (currentValue) {
    categoryInput.value = currentValue;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function showMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.style.color = type === 'error' ? '#fb7185' : '#34d399';
}

function calculateTotals() {
  const totalSpent = transactions.reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = INITIAL_BALANCE - totalSpent;
  return { totalSpent, balance };
}

function getMonthlySummary() {
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();
  const monthlyItems = transactions.filter((item) => {
    const date = new Date(item.id);
    return date.getMonth() === new Date().getMonth() && date.getFullYear() === currentYear;
  });

  const monthlySpent = monthlyItems.reduce((sum, item) => sum + Number(item.amount), 0);
  const biggestCategory = monthlyItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
    return acc;
  }, {});
  const topCategory = Object.entries(biggestCategory).sort((a, b) => b[1] - a[1])[0];

  return { currentMonth, monthlySpent, topCategory: topCategory ? topCategory[0] : 'None', topValue: topCategory ? topCategory[1] : 0 };
}

function sortTransactions(items) {
  const sortBy = sortSelect.value;
  const sorted = [...items];

  if (sortBy === 'amount') {
    return sorted.sort((a, b) => Number(b.amount) - Number(a.amount));
  }

  if (sortBy === 'category') {
    return sorted.sort((a, b) => a.category.localeCompare(b.category));
  }

  return sorted.sort((a, b) => Number(b.id) - Number(a.id));
}

function renderTransactions() {
  const sortedTransactions = sortTransactions(transactions);

  if (!sortedTransactions.length) {
    list.innerHTML = '<li class="empty-state">No transactions yet. Add one to see your spending history.</li>';
    return;
  }

  const limitValue = Number(limitInput.value) || 0;

  list.innerHTML = sortedTransactions
    .map((item) => {
      const isOver = limitValue > 0 && Number(item.amount) > limitValue;
      return `
        <li class="transaction-item ${isOver ? 'over-limit' : ''}">
          <div class="transaction-meta">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.category)}</span>
          </div>
          <div class="transaction-meta" style="text-align:right;">
            <strong class="transaction-amount">${formatCurrency(item.amount)}</strong>
            <span><button class="delete-btn" data-id="${item.id}" type="button">Delete</button></span>
          </div>
        </li>
      `;
    })
    .join('');
}


function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function updateSummary() {
  const { totalSpent, balance } = calculateTotals();
  const { currentMonth, monthlySpent, topCategory, topValue } = getMonthlySummary();
  const limitValue = Number(limitInput.value) || 0;

  balanceLabel.textContent = formatCurrency(balance);
  spentLabel.textContent = `Spent so far: ${formatCurrency(totalSpent)}`;
  summaryBox.innerHTML = `
    <article class="summary-box"><strong>${currentMonth}</strong><span>${formatCurrency(monthlySpent)} spent</span></article>
    <article class="summary-box"><strong>${topCategory}</strong><span>Top category</span></article>
    <article class="summary-box"><strong>${formatCurrency(topValue)}</strong><span>Category total</span></article>
  `;

  if (limitValue > 0 && totalSpent > limitValue) {
    limitAlert.textContent = `You are over your monthly limit by ${formatCurrency(totalSpent - limitValue)}.`;
  } else if (limitValue > 0) {
    limitAlert.textContent = `You have ${formatCurrency(limitValue - totalSpent)} left before your limit.`;
  } else {
    limitAlert.textContent = 'Set a monthly limit to highlight spending above it.';
  }
}

function buildChartData() {
  const categories = [...new Set(['Food', 'Transport', 'Fun', ...customCategories, ...transactions.map((item) => item.category)])];
  const colors = ['#fb7185', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#4ade80', '#818cf8'];
  const totals = categories.map((category) =>
    transactions
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + Number(item.amount), 0)
  );

  return {
    labels: categories,
    datasets: [{
      data: totals,
      backgroundColor: categories.map((_, index) => colors[index % colors.length]),
      borderColor: '#0f172a',
      borderWidth: 2
    }]
  };
}

function renderChart() {
  const ctx = document.getElementById('category-chart');

  if (chart) {
    chart.data = buildChartData();
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: 'pie',
    data: buildChartData(),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#eff6ff' } }
      }
    }
  });
}

function refreshUI() {
  applyCustomCategories();
  renderTransactions();
  updateSummary();
  renderChart();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);
  const customCategory = customInput.value.trim();
  const category = customCategory || categoryInput.value;

  if (!name || !category || !amount || amount <= 0) {
    showMessage('Please fill in all fields with a valid amount.', 'error');
    return;
  }

  if (customCategory) {
    customCategories = [...new Set([customCategory, ...customCategories])];
    saveCustomCategories();
  }

  transactions.unshift({
    id: Date.now(),
    name,
    amount,
    category
  });

  saveTransactions();
  const currentLimit = limitInput.value;
  customInput.value = '';
  form.reset();
  limitInput.value = currentLimit;
  showMessage('Transaction added successfully.', 'success');
  refreshUI();
});

list.addEventListener('click', (event) => {
  if (!event.target.matches('button[data-id]')) return;

  const id = Number(event.target.dataset.id);
  transactions = transactions.filter((item) => item.id !== id);
  saveTransactions();
  refreshUI();
});

sortSelect.addEventListener('change', renderTransactions);

function loadTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  themeToggle.textContent = next === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

themeToggle.addEventListener('click', toggleTheme);

limitInput.addEventListener('input', () => {
  updateSummary();
  renderTransactions();
});

loadTheme();
applyCustomCategories();
refreshUI();
