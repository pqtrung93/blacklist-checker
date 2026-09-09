/**
 * popup.js — Blacklist Checker popup logic
 */

let API_URL = 'https://blacklist-checker.tipxinhshop.vn';

// ─── Init ─────────────────────────────────────────────────────────────────

chrome.storage.sync.get(['apiUrl'], (result) => {
  if (result.apiUrl) API_URL = result.apiUrl;
  document.getElementById('api-url').value = API_URL;
  checkApiHealth();
});

// ─── Tabs ─────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panelId = tab.dataset.tab + '-panel';
    document.getElementById(panelId).classList.add('active');
    if (tab.dataset.tab === 'settings') checkApiHealth();
    if (tab.dataset.tab === 'history') loadHistory();
  });
});

// ─── History ──────────────────────────────────────────────────────────────

async function loadHistory() {
  const histEl = document.getElementById('history-list');
  const feedEl = document.getElementById('feed-list');
  try {
    const [hRes, fRes] = await Promise.all([
      fetch(`${API_URL}/api/v1/reports/history`),
      fetch(`${API_URL}/api/v1/reports?reports=1`),
    ]);
    const h = await hRes.json();
    const f = await fRes.json();

    histEl.innerHTML = (h.data ?? []).map(r => {
      const parts = Object.entries(r.query ?? {})
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`).join(', ');
      return `<div class="history-item">
        <span>${escHtml(parts || '(trống)')}</span>
        <span class="${r.matched ? 'badge-scam' : 'badge-clean'}">${r.matched ? '⚠ khớp' : 'sạch'}</span>
        <span class="muted">${escHtml((r.created_at ?? '').slice(5, 16))}</span>
      </div>`;
    }).join('') || 'Chưa có lượt tra cứu nào.';

    feedEl.innerHTML = (f.data ?? []).map(r => {
      const who = r.b_phone ?? r.b_name ?? '(không rõ)';
      return `<div class="history-item">
        <span class="${r.verdict === 'scam' ? 'badge-scam' : 'badge-clean'}">${r.verdict === 'scam' ? '🔴' : '🟢'}</span>
        <span style="flex:1">${escHtml(who)} — ${escHtml(r.comment)}</span>
        <span class="muted">${escHtml((r.created_at ?? '').slice(5, 10))}</span>
      </div>`;
    }).join('') || 'Chưa có báo cáo nào.';
  } catch (err) {
    histEl.textContent = `Lỗi tải lịch sử: ${err.message}`;
    feedEl.textContent = '';
  }
}

// ─── Check ────────────────────────────────────────────────────────────────

document.getElementById('btn-check').addEventListener('click', async () => {
  const phone   = document.getElementById('q-phone').value.trim();
  const name    = document.getElementById('q-name').value.trim();
  const address = document.getElementById('q-address').value.trim();
  const email   = document.getElementById('q-email').value.trim();

  if (!phone && !name && !address && !email) {
    showResult('error', 'Nhập ít nhất một thông tin để tra cứu.');
    return;
  }

  const btn = document.getElementById('btn-check');
  btn.textContent = '⏳ Đang tra cứu...';
  btn.disabled = true;

  try {
    const body = {};
    if (phone)   body.phone   = phone;
    if (name)    body.name    = name;
    if (address) body.address = address;
    if (email)   body.email   = email;

    const res = await fetch(`${API_URL}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderCheckResult(data);
    loadThread(data);
  } catch (err) {
    showResult('error', `Không kết nối được API: ${err.message}`);
  } finally {
    btn.textContent = '🔍 Tra cứu';
    btn.disabled = false;
  }
});

function renderCheckResult(data) {
  const el = document.getElementById('result');

  if (!data.matched) {
    el.innerHTML = `<div class="result-clean">✅ Không có trong blacklist</div>`;
    return;
  }

  const items = data.matches.map(m => `
    <div class="match-item">
      <div class="match-reason severity-${m.entry.severity}">
        ${severityIcon(m.entry.severity)} ${escHtml(m.entry.reason)}
      </div>
      <div class="match-meta">
        Khớp: <strong>${m.matched_fields.join(', ')}</strong> ·
        ${m.entry.phone ? 'SĐT: ' + escHtml(m.entry.phone) + ' · ' : ''}
        ${m.entry.name  ? 'Tên: ' + escHtml(m.entry.name)  + ' · ' : ''}
        Thêm bởi: ${escHtml(m.entry.added_by)}
      </div>
      <div class="score-bar"><div style="width:${data.score ?? 0}%"></div></div>
      <div class="score-line">Điểm rủi ro: <strong>${data.score ?? 0}/100</strong> · xem chi tiết ở tab Lịch sử</div>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="result-match">
      <div class="result-match-header">⚠ ${data.matches.length} cảnh báo blacklist</div>
      ${items}
    </div>
  `;
}

async function loadThread(data) {
  const phone = document.getElementById('q-phone').value.trim();
  if (!phone || !data.matched) return;
  try {
    const res = await fetch(`${API_URL}/api/v1/reports?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return;
    const t = await res.json();
    const comments = (t.data ?? []).map(c => `
      <div class="history-item">
        <span class="${c.verdict === 'scam' ? 'badge-scam' : 'badge-clean'}">${c.verdict === 'scam' ? '🔴' : '🟢'}</span>
        <span style="flex:1">${escHtml(c.comment)}</span>
        <span class="muted">${escHtml((c.created_at ?? '').slice(0, 10))}</span>
      </div>`).join('');
    const s = t.score;
    const scoreLine = s && s.total > 0
      ? `<div class="score-line">${s.scam_reports} scam / ${s.clean_reports} clean · điểm ${s.points}/100</div>`
      : '';
    if (comments || scoreLine) {
      document.getElementById('result').insertAdjacentHTML('beforeend',
        `<div style="margin-top:8px"><label>Bình luận cộng đồng</label>${scoreLine}${comments}</div>`);
    }
  } catch { /* fail-soft */ }
}

function showResult(type, msg) {
  const el = document.getElementById('result');
  if (type === 'error') {
    el.innerHTML = `<div class="error-msg">${escHtml(msg)}</div>`;
  }
}

// ─── Add ──────────────────────────────────────────────────────────────────

document.getElementById('btn-add').addEventListener('click', async () => {
  const phone    = document.getElementById('a-phone').value.trim();
  const email    = document.getElementById('a-email').value.trim();
  const name     = document.getElementById('a-name').value.trim();
  const address  = document.getElementById('a-address').value.trim();
  const comment  = document.getElementById('a-reason').value.trim();
  const verdict  = document.getElementById('a-verdict').value;
  const platform = await getPlatformName();

  if (!phone && !name && !address && !email) {
    showAddResult('error', 'Nhập ít nhất một thông tin định danh.');
    return;
  }
  if (!comment) {
    showAddResult('error', 'Nhập bình luận.');
    return;
  }

  const btn = document.getElementById('btn-add');
  btn.textContent = '⏳ Đang gửi...';
  btn.disabled = true;

  try {
    const body = { comment, verdict, platform, added_by: 'extension' };
    if (phone)   body.phone   = phone;
    if (email)   body.email   = email;
    if (name)    body.name    = name;
    if (address) body.address = address;

    const res = await fetch(`${API_URL}/api/v1/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const r = await res.json();
    const s = r.score ?? {};
    showAddResult('ok', `✅ Đã gửi báo cáo · điểm rủi ro hiện tại: ${s.points ?? 0}/100`);

    // Clear form
    ['a-phone','a-email','a-name','a-address','a-reason'].forEach(id => {
      document.getElementById(id).value = '';
    });
  } catch (err) {
    showAddResult('error', `Lỗi: ${err.message}`);
  } finally {
    btn.textContent = '➕ Gửi báo cáo';
    btn.disabled = false;
  }
});

async function getPlatformName() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const host = tab?.url ? new URL(tab.url).hostname : '';
    if (host.includes('tiktok')) return 'tiktok';
    if (host.includes('shopee')) return 'shopee';
    if (host.includes('sapo'))   return 'sapo';
    return null;
  } catch { return null; }
}

function showAddResult(type, msg) {
  const el = document.getElementById('add-result');
  const cls = type === 'ok' ? 'result-clean' : 'error-msg';
  el.innerHTML = `<div class="${cls}" style="margin-top:10px">${escHtml(msg)}</div>`;
}

// ─── Settings ─────────────────────────────────────────────────────────────

document.getElementById('btn-save-settings').addEventListener('click', () => {
  const url = document.getElementById('api-url').value.trim().replace(/\/$/, '');
  if (!url) return;
  API_URL = url;
  chrome.storage.sync.set({ apiUrl: url }, () => {
    checkApiHealth();
  });
});

document.getElementById('btn-export').addEventListener('click', () => {
  chrome.tabs.create({ url: `${API_URL}/api/blacklist/export` });
});

async function checkApiHealth() {
  const el = document.getElementById('api-status');
  el.innerHTML = `<span class="status-dot dot-checking"></span>Đang kiểm tra...`;
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      el.innerHTML = `<span class="status-dot dot-ok"></span>API online — ${API_URL}`;
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    el.innerHTML = `<span class="status-dot dot-err"></span>Không kết nối được: ${escHtml(err.message)}`;
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────

function severityIcon(s) {
  if (s === 'high')   return '🔴';
  if (s === 'medium') return '🟠';
  return '🟡';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
