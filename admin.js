let casesData = [];
let editingId = null;

const elements = {
  tableBody: document.getElementById('cases-table-body'),
  btnAddCase: document.getElementById('btn-add-case'),
  btnDownloadCsv: document.getElementById('btn-download-csv'),
  btnSettings: document.getElementById('btn-settings'),
  
  formOverlay: document.getElementById('form-overlay'),
  caseForm: document.getElementById('case-form'),
  btnCancel: document.getElementById('btn-cancel'),
  modalTitle: document.getElementById('modal-title'),

  githubOverlay: document.getElementById('github-overlay'),
  githubForm: document.getElementById('github-form'),
  btnGithubCancel: document.getElementById('btn-github-cancel'),
  
  inputs: {
    id: document.getElementById('case-id'),
    title: document.getElementById('case-title'),
    desc: document.getElementById('case-desc'),
    industries: document.getElementById('case-industries'),
    products: document.getElementById('case-products'),
    divisions: document.getElementById('case-divisions'),
    url: document.getElementById('case-url'),

    ghRepo: document.getElementById('gh-repo'),
    ghToken: document.getElementById('gh-token'),
  }
};

boot();

async function boot() {
  elements.inputs.ghRepo.value = localStorage.getItem('gh_repo') || '';
  elements.inputs.ghToken.value = localStorage.getItem('gh_token') || '';
  bindEvents();
  await loadCases();
}

function bindEvents() {
  elements.btnAddCase.addEventListener('click', openAddModal);
  elements.btnCancel.addEventListener('click', closeModal);
  elements.caseForm.addEventListener('submit', handleFormSubmit);
  elements.btnDownloadCsv.addEventListener('click', downloadCsv);

  elements.btnSettings.addEventListener('click', () => elements.githubOverlay.classList.add('active'));
  elements.btnGithubCancel.addEventListener('click', () => elements.githubOverlay.classList.remove('active'));
  elements.githubForm.addEventListener('submit', handleGithubFormSubmit);

  ['industries', 'products', 'divisions'].forEach(key => {
    const input = document.getElementById(`case-${key}`);
    if (input) {
      input.addEventListener('input', () => {
        const container = document.getElementById(`tags-${key}`);
        if (!container) return;
        const currentVals = input.value.split(',').map(s => s.trim()).filter(Boolean);
        container.querySelectorAll('.tag-chip').forEach(chip => {
          chip.classList.toggle('selected', currentVals.includes(chip.textContent));
        });
      });
    }
  });
}

function handleGithubFormSubmit(e) {
  e.preventDefault();
  localStorage.setItem('gh_repo', elements.inputs.ghRepo.value.trim());
  localStorage.setItem('gh_token', elements.inputs.ghToken.value.trim());
  elements.githubOverlay.classList.remove('active');
  alert('Настройки интеграции с GitHub сохранены!');
}

async function loadCases() {
  try {
    const response = await fetch("./data/cases.csv", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const csvText = await response.text();
    casesData = parseCasesCsv(csvText);
    renderTable();
  } catch (error) {
    console.error(error);
    elements.tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--danger);">Не удалось загрузить data/cases.csv. Если вы только начинаете, таблица пуста.</td></tr>`;
  }
}

function renderTable() {
  elements.tableBody.innerHTML = "";
  
  if (casesData.length === 0) {
    elements.tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">Кейсов пока нет</td></tr>`;
    return;
  }

  casesData.forEach((item, index) => {
    item._id = item._id || Date.now().toString() + index;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="text-truncate" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div></td>
      <td><div class="text-truncate" title="${escapeHtml(item.industries)}">${escapeHtml(item.industries || '-')}</div></td>
      <td><div class="text-truncate" title="${escapeHtml(item.products)}">${escapeHtml(item.products || '-')}</div></td>
      <td>
        <div class="admin-actions">
          <button class="btn" onclick="editCase('${item._id}')">Ред.</button>
          <button class="btn btn--danger" onclick="deleteCase('${item._id}')">Удал.</button>
        </div>
      </td>
    `;
    elements.tableBody.appendChild(tr);
  });
}

function openAddModal() {
  editingId = null;
  elements.modalTitle.textContent = "Добавить кейс";
  elements.caseForm.reset();
  elements.inputs.id.value = "";
  
  renderSuggestedTags('industries', 'tags-industries', 'case-industries');
  renderSuggestedTags('products', 'tags-products', 'case-products');
  renderSuggestedTags('divisions', 'tags-divisions', 'case-divisions');
  
  elements.formOverlay.classList.add('active');
}

window.editCase = function(id) {
  const item = casesData.find(c => c._id === id);
  if (!item) return;
  
  editingId = id;
  elements.modalTitle.textContent = "Редактировать кейс";
  elements.inputs.id.value = id;
  elements.inputs.title.value = item.title;
  elements.inputs.desc.value = item.description;
  
  elements.inputs.industries.value = item.industries.split('|').filter(Boolean).join(', ');
  elements.inputs.products.value = item.products.split('|').filter(Boolean).join(', ');
  elements.inputs.divisions.value = item.divisions.split('|').filter(Boolean).join(', ');
  elements.inputs.url.value = item.url;
  
  renderSuggestedTags('industries', 'tags-industries', 'case-industries');
  renderSuggestedTags('products', 'tags-products', 'case-products');
  renderSuggestedTags('divisions', 'tags-divisions', 'case-divisions');
  
  elements.formOverlay.classList.add('active');
}

window.deleteCase = function(id) {
  if (confirm('Вы уверены, что хотите удалить этот кейс?')) {
    casesData = casesData.filter(c => c._id !== id);
    renderTable();
    syncWithGitHub();
  }
}

function closeModal() {
  elements.formOverlay.classList.remove('active');
}

function handleFormSubmit(e) {
  e.preventDefault();
  
  const formatList = (str) => {
    return str.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s[0].toUpperCase() + s.slice(1))
      .join('|');
  };

  const newData = {
    _id: editingId || Date.now().toString(),
    title: elements.inputs.title.value.trim(),
    description: elements.inputs.desc.value.trim(),
    industries: formatList(elements.inputs.industries.value),
    products: formatList(elements.inputs.products.value),
    divisions: formatList(elements.inputs.divisions.value),
    url: elements.inputs.url.value.trim()
  };

  if (editingId) {
    const index = casesData.findIndex(c => c._id === editingId);
    if (index !== -1) {
      casesData[index] = newData;
    }
  } else {
    casesData.push(newData);
  }

  renderTable();
  closeModal();
  syncWithGitHub();
}

function generateCsvString() {
  const BOM = "\uFEFF";
  const headers = ['Название доработки', 'Описание', 'Отрасли', 'Продукты', 'Подразделения', 'Ссылка'];
  const csvRows = [];
  csvRows.push(headers.join(';'));
  
  casesData.forEach(item => {
    const row = [
      item.title,
      item.description,
      item.industries,
      item.products,
      item.divisions,
      item.url
    ].map(formatCsvCell);
    
    csvRows.push(row.join(';'));
  });
  
  return BOM + csvRows.join('\r\n');
}

function downloadCsv() {
  const csvString = generateCsvString();
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "cases.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

async function syncWithGitHub() {
  const repo = localStorage.getItem('gh_repo');
  const token = localStorage.getItem('gh_token');
  
  if (!repo || !token) {
    console.warn("GitHub credentials not configured. Skipping auto-sync.");
    return;
  }
  
  const originalText = elements.btnAddCase.textContent;
  elements.btnAddCase.textContent = "⏳ Синхронизация...";
  elements.btnAddCase.disabled = true;

  try {
    const path = 'data/cases.csv';
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    
    // 1. Get current SHA
    const getRes = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    let sha = undefined;
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }
    
    // 2. Encode Content to Base64 (UTF-8 safe)
    const csvStr = generateCsvString();
    const encodedContent = btoa(unescape(encodeURIComponent(csvStr)));
    
    // 3. Put new content
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "Update cases.csv via Admin Panel",
        content: encodedContent,
        sha: sha,
        branch: "main"
      })
    });
    
    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || putRes.statusText);
    }
    
    console.log("Successfully synced with GitHub");
  } catch (err) {
    console.error(err);
    alert('Ошибка при синхронизации с GitHub: ' + err.message);
  } finally {
    elements.btnAddCase.textContent = originalText;
    elements.btnAddCase.disabled = false;
  }
}

function formatCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Функции парсинга CSV
function parseCasesCsv(csvText) {
  const delimiter = detectDelimiter(csvText);
  const rows = parseDelimited(csvText, delimiter);
  if (rows.length < 2) return [];

  const header = rows[0].map((cell) => normalizeCsvCell(cell));
  const indexes = {
    title: header.indexOf("Название доработки"),
    description: header.indexOf("Описание"),
    industries: header.indexOf("Отрасли"),
    products: header.indexOf("Продукты"),
    divisions: header.indexOf("Подразделения"),
    url: header.indexOf("Ссылка")
  };

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => normalizeCsvCell(cell) !== ""))
    .map((row) => ({
      title: normalizeCsvCell(row[indexes.title]),
      description: normalizeCsvCell(row[indexes.description]),
      industries: normalizeCsvCell(row[indexes.industries]),
      products: normalizeCsvCell(row[indexes.products]),
      divisions: normalizeCsvCell(row[indexes.divisions]),
      url: normalizeCsvCell(row[indexes.url])
    }));
}

function normalizeCsvCell(value) {
  return `${value || ""}`.replace(/^\uFEFF/, "").trim();
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  return firstLine.includes(";") ? ";" : ",";
}

function escapeHtml(value) {
  return (value || "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getUniqueTags(field) {
  const allTags = casesData.flatMap(c => (c[field] || '').split('|').map(s => s.trim()).filter(Boolean));
  return [...new Set(allTags)].sort((a, b) => a.localeCompare(b, 'ru'));
}

function renderSuggestedTags(field, containerId, inputId) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;
  
  const tags = getUniqueTags(field);
  container.innerHTML = '';
  
  const updateAllChips = () => {
    const currentVals = input.value.split(',').map(s => s.trim()).filter(Boolean);
    const chips = container.querySelectorAll('.tag-chip');
    chips.forEach(chip => {
      chip.classList.toggle('selected', currentVals.includes(chip.textContent));
    });
  };

  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    
    chip.addEventListener('click', () => {
      let currentVals = input.value.split(',').map(s => s.trim()).filter(Boolean);
      if (currentVals.includes(tag)) {
        currentVals = currentVals.filter(v => v !== tag);
      } else {
        currentVals.push(tag);
      }
      input.value = currentVals.join(', ');
      updateAllChips();
    });
    
    container.appendChild(chip);
  });
  
  updateAllChips();
}
