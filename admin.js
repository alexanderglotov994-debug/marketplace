let casesData = [];
let editingId = null;

const elements = {
  tableBody: document.getElementById('cases-table-body'),
  btnAddCase: document.getElementById('btn-add-case'),
  btnDownloadCsv: document.getElementById('btn-download-csv'),
  formOverlay: document.getElementById('form-overlay'),
  caseForm: document.getElementById('case-form'),
  btnCancel: document.getElementById('btn-cancel'),
  modalTitle: document.getElementById('modal-title'),
  
  inputs: {
    id: document.getElementById('case-id'),
    title: document.getElementById('case-title'),
    desc: document.getElementById('case-desc'),
    industries: document.getElementById('case-industries'),
    products: document.getElementById('case-products'),
    divisions: document.getElementById('case-divisions'),
    url: document.getElementById('case-url'),
  }
};

boot();

async function boot() {
  bindEvents();
  await loadCases();
}

function bindEvents() {
  elements.btnAddCase.addEventListener('click', openAddModal);
  elements.btnCancel.addEventListener('click', closeModal);
  elements.caseForm.addEventListener('submit', handleFormSubmit);
  elements.btnDownloadCsv.addEventListener('click', downloadCsv);
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
    // Внутренний ID для редактирования/удаления
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
  // Конвертируем разделитель | в запятые для удобства ввода
  elements.inputs.industries.value = item.industries.split('|').filter(Boolean).join(', ');
  elements.inputs.products.value = item.products.split('|').filter(Boolean).join(', ');
  elements.inputs.divisions.value = item.divisions.split('|').filter(Boolean).join(', ');
  elements.inputs.url.value = item.url;
  
  elements.formOverlay.classList.add('active');
}

window.deleteCase = function(id) {
  if (confirm('Вы уверены, что хотите удалить этот кейс?')) {
    casesData = casesData.filter(c => c._id !== id);
    renderTable();
  }
}

function closeModal() {
  elements.formOverlay.classList.remove('active');
}

function handleFormSubmit(e) {
  e.preventDefault();
  
  // Конвертируем запятые обратно в |
  const formatList = (str) => {
    return str.split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s[0].toUpperCase() + s.slice(1)) // Капитализируем первую букву
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
}

function downloadCsv() {
  // UTF-8 BOM нужен для Excel
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
  
  const csvString = BOM + csvRows.join('\r\n');
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

function formatCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Экранирование для CSV
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Функции парсинга CSV (скопированы из app.js)
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
