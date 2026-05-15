let memories = [];
let editingId = null;
let deletingId = null;
let pendingPhotos = [];   // {url, isNew, file?}
let viewerPhotos = [];
let viewerIndex = 0;

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  loadMemories();
  setupDragDrop();
});

async function loadMemories() {
  try {
    const res = await fetch('/api/memories');
    memories = await res.json();
    renderCards();
  } catch {
    document.getElementById('cards-container').innerHTML =
      '<div class="loading">⚠️ 読み込みに失敗しました</div>';
  }
}

// ===================== RENDER CARDS =====================
function renderCards() {
  const container = document.getElementById('cards-container');
  const empty = document.getElementById('empty-state');

  if (memories.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = memories.map((m, i) => {
    const thumb = m.photos[0] || null;
    const dateStr = m.date ? m.date.replace(/-/g, '.') : '';
    const isNew = i === 0;
    return `
      <div class="card" onclick="openDetail('${m.id}')">
        ${isNew ? '<div class="card-ribbon">NEW ✨</div>' : ''}
        <div class="card-img-wrap">
          ${thumb
            ? `<img src="${thumb}" alt="${m.title}" loading="lazy" />`
            : `<div class="card-no-img">📷</div>`}
        </div>
        <div class="card-body">
          <div class="card-date">📅 ${dateStr}</div>
          <div class="card-title">${escHtml(m.title)}</div>
          ${m.location ? `<div class="card-location">📍 ${escHtml(m.location)}</div>` : ''}
          ${m.description ? `<div class="card-desc">${escHtml(m.description)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ===================== ADD MODAL =====================
function openAddModal() {
  editingId = null;
  pendingPhotos = [];
  document.getElementById('modal-title').textContent = '✨ おもいでを追加';
  document.getElementById('f-title').value = '';
  document.getElementById('f-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('f-location').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('photo-preview').innerHTML = '';
  openModal('add-modal');
}

function openEditModal(m) {
  editingId = m.id;
  pendingPhotos = m.photos.map(url => ({ url, isNew: false }));
  document.getElementById('modal-title').textContent = '✏️ 思い出を編集';
  document.getElementById('f-title').value = m.title;
  document.getElementById('f-date').value = m.date;
  document.getElementById('f-location').value = m.location || '';
  document.getElementById('f-desc').value = m.description || '';
  renderPhotoPreview();
  openModal('add-modal');
}

// ===================== SAVE =====================
async function saveMemory() {
  const title = document.getElementById('f-title').value.trim();
  const date  = document.getElementById('f-date').value;
  if (!title || !date) {
    alert('タイトルと日付は必須だよ！');
    return;
  }

  // upload new files first
  const newFiles = pendingPhotos.filter(p => p.isNew);
  if (newFiles.length > 0) {
    const form = new FormData();
    newFiles.forEach(p => form.append('photos', p.file));
    const r = await fetch('/api/upload', { method: 'POST', body: form });
    const { urls } = await r.json();
    let ui = 0;
    pendingPhotos = pendingPhotos.map(p => p.isNew ? { url: urls[ui++], isNew: false } : p);
  }

  const body = {
    title,
    date,
    location:    document.getElementById('f-location').value.trim(),
    description: document.getElementById('f-desc').value.trim(),
    photos:      pendingPhotos.map(p => p.url),
  };

  let saved;
  if (editingId) {
    const r = await fetch(`/api/memories/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    saved = await r.json();
    memories = memories.map(m => m.id === editingId ? saved : m);
  } else {
    const r = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    saved = await r.json();
    memories.unshift(saved);
  }

  closeModal('add-modal');
  renderCards();
}

// ===================== DETAIL =====================
function openDetail(id) {
  const m = memories.find(x => x.id === id);
  if (!m) return;
  deletingId = id;

  const photosHtml = m.photos.length
    ? `<div class="detail-photos">${m.photos.map((url, i) =>
        `<img src="${url}" alt="" onclick="openViewer('${id}', ${i})" />`
      ).join('')}</div>`
    : '';

  document.getElementById('detail-content').innerHTML = `
    ${photosHtml}
    <div class="detail-title">${escHtml(m.title)}</div>
    <div class="detail-meta">
      <span>📅 ${m.date.replace(/-/g, '.')}</span>
      ${m.location ? `<span>📍 ${escHtml(m.location)}</span>` : ''}
      <span>🖼 写真 ${m.photos.length}枚</span>
    </div>
    ${m.description ? `<div class="detail-desc">${escHtml(m.description)}</div>` : ''}
  `;
  openModal('detail-modal');
}

function editMemory() {
  const m = memories.find(x => x.id === deletingId);
  if (!m) return;
  closeModal('detail-modal');
  openEditModal(m);
}

// ===================== DELETE =====================
function deleteMemory() {
  closeModal('detail-modal');
  openModal('confirm-modal');
}

async function confirmDelete() {
  await fetch(`/api/memories/${deletingId}`, { method: 'DELETE' });
  memories = memories.filter(m => m.id !== deletingId);
  closeModal('confirm-modal');
  renderCards();
}

// ===================== PHOTO HANDLING =====================
function handleFiles(fileList) {
  Array.from(fileList).forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    pendingPhotos.push({ url, isNew: true, file });
  });
  renderPhotoPreview();
  document.getElementById('f-photos').value = '';
}

function renderPhotoPreview() {
  const el = document.getElementById('photo-preview');
  el.innerHTML = pendingPhotos.map((p, i) => `
    <div class="preview-thumb">
      <img src="${p.url}" alt="" />
      <button class="remove-thumb" onclick="removeThumb(${i})">✕</button>
    </div>
  `).join('');
}

function removeThumb(i) {
  pendingPhotos.splice(i, 1);
  renderPhotoPreview();
}

function setupDragDrop() {
  const area = document.getElementById('drop-area');
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

// ===================== PHOTO VIEWER =====================
function openViewer(id, startIndex) {
  const m = memories.find(x => x.id === id);
  if (!m) return;
  viewerPhotos = m.photos;
  viewerIndex  = startIndex;
  showViewerImage();
  document.getElementById('photo-viewer').classList.add('open');
}

function showViewerImage() {
  document.getElementById('viewer-img').src = viewerPhotos[viewerIndex];
  document.getElementById('viewer-counter').textContent =
    viewerPhotos.length > 1 ? `${viewerIndex + 1} / ${viewerPhotos.length}` : '';
  document.getElementById('viewer-prev').style.display = viewerPhotos.length > 1 ? '' : 'none';
  document.getElementById('viewer-next').style.display = viewerPhotos.length > 1 ? '' : 'none';
}

function viewerPrev(e) {
  e.stopPropagation();
  viewerIndex = (viewerIndex - 1 + viewerPhotos.length) % viewerPhotos.length;
  showViewerImage();
}

function viewerNext(e) {
  e.stopPropagation();
  viewerIndex = (viewerIndex + 1) % viewerPhotos.length;
  showViewerImage();
}

function closePhotoViewer() {
  document.getElementById('photo-viewer').classList.remove('open');
}

// ===================== MODAL HELPERS =====================
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

// ===================== UTILS =====================
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
