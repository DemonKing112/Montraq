/* ──────────────────────────────────────────────────────────────
   EXPENSES PAGE JAVASCRIPT
   Full CRUD: add, edit, delete, search, and filter expenses.
   ────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

  /* ── Auth guard — redirect to login if not signed in ──────── */
  if (!getAccessToken()) {
    window.location.href = 'login.html';
    return;
  }

  const user = getUser();
  const nameEl = document.getElementById('user-name');
  const initialEl = document.getElementById('avatar-initial');
  if (user) {
    if (nameEl) nameEl.textContent = user.name;
    if (initialEl) initialEl.textContent = (user.name || 'U').trim().charAt(0).toUpperCase();
  }

  async function doLogout() {
    await logout();
    window.location.href = 'index.html';
  }
  document.getElementById('logout-btn')?.addEventListener('click', doLogout);
  document.getElementById('menu-logout-btn')?.addEventListener('click', doLogout);

  /* ── Sidebar toggle (mobile) ────────────────────────────────── */
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    sidebar.classList.add('open');
    scrim.classList.add('open');
  });
  scrim?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    scrim.classList.remove('open');
  });

  /* ── Avatar dropdown ─────────────────────────────────────────── */
  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  }
  document.getElementById('avatar-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('avatar-menu');
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) menu.classList.add('open');
  });
  document.getElementById('avatar-chevron')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('avatar-btn')?.click();
  });
  document.addEventListener('click', closeAllDropdowns);

  document.querySelectorAll('[data-stub]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showToast(`${el.dataset.stub} is coming soon`, 'success');
    });
  });

  /* ── State ─────────────────────────────────────────────────── */
  let expenses = [];
  let categories = [];
  let projects = [];
  let editingId = null;

  /* ── Load initial data from the API ────────────────────────── */
  try {
    [expenses, categories, projects] = await Promise.all([
      getExpenses(),
      getCategories(),
      getProjects(),
    ]);
    populateFilters();
    renderExpenseTable(expenses);

    /* Deep link: /expenses.html?edit=123 opens that row in edit mode */
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (editId) startEdit(Number(editId));
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Authentication')) {
      clearTokens();
      window.location.href = 'login.html';
      return;
    }
    showToast('Failed to load data — check your connection', 'error');
  }

  window.addEventListener('pageshow', async (e) => {
    if (!e.persisted) return;
    try {
      expenses = await getExpenses();
      renderExpenseTable(applyFilter());
    } catch { /* non-critical on a bfcache restore */ }
  });

  /* ── Populate category & project dropdowns ─────────────────── */
  function populateFilters() {
    const catSelect = document.getElementById('expense-category');
    const projSelect = document.getElementById('expense-project');
    const filterCat = document.getElementById('filter-category');

    if (catSelect) {
      catSelect.innerHTML = '<option value="">No category</option>';
      categories.forEach(c => {
        catSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
      });
    }

    if (projSelect) {
      projSelect.innerHTML = '<option value="">No project</option>';
      projects.forEach(p => {
        projSelect.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
      });
    }

    if (filterCat) {
      filterCat.innerHTML = '<option value="">All categories</option>';
      categories.forEach(c => {
        filterCat.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
      });
    }
  }

  /* ── Render the expense table ──────────────────────────────── */
  function renderExpenseTable(data) {
    const tbody = document.getElementById('expense-tbody');
    if (!tbody) return;

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="6" class="empty-state">
          No expenses yet — add your first one above!
        </td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(exp => `
      <tr data-id="${exp.id}">
        <td>${formatDate(exp.date)}</td>
        <td>${escapeHtml(exp.description)}</td>
        <td>
          <span class="cat-pill" style="background:${exp.category_color || '#8A8577'}20; color:${exp.category_color || '#8A8577'}">
            ${escapeHtml(exp.category_name || 'Uncategorized')}
          </span>
        </td>
        <td>${escapeHtml(exp.project_name || '—')}</td>
        <td class="amount-cell">$${Number(exp.amount).toFixed(2)}</td>
        <td>
          <div class="row-actions">
            <button class="btn-icon edit-btn" title="Edit" data-id="${exp.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon delete-btn" title="Delete" data-id="${exp.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => startEdit(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDelete(Number(btn.dataset.id)));
    });
  }

  /* ── Add / Edit expense form ───────────────────────────────── */
  const form = document.getElementById('expense-form');
  const formTitle = document.getElementById('form-title');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');

      const payload = {
        amount: parseFloat(document.getElementById('expense-amount').value),
        description: document.getElementById('expense-desc').value,
        date: document.getElementById('expense-date').value,
        category_id: document.getElementById('expense-category').value || null,
        project_id: document.getElementById('expense-project').value || null,
      };

      submitBtn.disabled = true;

      try {
        if (editingId) {
          const updated = await updateExpense(editingId, payload);
          expenses = expenses.map(e => e.id === editingId ? updated : e);
          showToast('Expense updated');
          stopEdit();
        } else {
          const created = await createExpense(payload);
          expenses.unshift(created);
          showToast('Expense added');
        }

        form.reset();
        setDefaultDate();
        renderExpenseTable(applyFilter());
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function setDefaultDate() {
    const dateInput = document.getElementById('expense-date');
    if (dateInput && !dateInput.value) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}`;
    }
  }
  setDefaultDate();

  /* ── Edit mode ─────────────────────────────────────────────── */
  function startEdit(id) {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;

    editingId = id;
    formTitle.textContent = 'Edit Expense';
    cancelBtn.style.display = 'inline-flex';

    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-desc').value = exp.description;
    document.getElementById('expense-date').value = exp.date;
    document.getElementById('expense-category').value = exp.category_id || '';
    document.getElementById('expense-project').value = exp.project_id || '';

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function stopEdit() {
    editingId = null;
    formTitle.textContent = 'Add Expense';
    cancelBtn.style.display = 'none';
    form.reset();
    setDefaultDate();
  }

  cancelBtn?.addEventListener('click', stopEdit);

  /* ── Delete ────────────────────────────────────────────────── */
  async function handleDelete(id) {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    try {
      await deleteExpense(id);
      expenses = expenses.filter(e => e.id !== id);
      renderExpenseTable(applyFilter());
      showToast('Expense deleted');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  /* ── Filtering ─────────────────────────────────────────────── */
  const filterCat = document.getElementById('filter-category');
  const searchInput = document.getElementById('search-input');

  filterCat?.addEventListener('change', () => renderExpenseTable(applyFilter()));
  searchInput?.addEventListener('input', () => renderExpenseTable(applyFilter()));

  function applyFilter() {
    let filtered = [...expenses];
    const catId = filterCat?.value;
    const query = searchInput?.value?.toLowerCase() || '';

    if (catId) {
      filtered = filtered.filter(e => String(e.category_id) === catId);
    }
    if (query) {
      filtered = filtered.filter(e =>
        e.description.toLowerCase().includes(query) ||
        (e.project_name || '').toLowerCase().includes(query)
      );
    }
    return filtered;
  }

  /* ── Toast notifications ───────────────────────────────────── */
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function formatDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
