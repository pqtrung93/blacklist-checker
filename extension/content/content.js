/**
 * content.js — Blacklist Checker content script
 * Inject vào TikTok Shop, Shopee, Sapo seller pages
 * Tự động extract thông tin khách hàng và highlight nếu có trong blacklist
 */

(function () {
  'use strict';

  let API_URL = 'https://blacklist-checker.tipxinhshop.vn';
  let lastCheckedKey = '';
  let checkTimer = null;

  // Load API URL từ storage
  chrome.storage.sync.get(['apiUrl'], (result) => {
    if (result.apiUrl) API_URL = result.apiUrl;
  });

  // ─── Platform detection ───────────────────────────────────────────────────

  function getPlatform() {
    const host = location.hostname;
    if (host.includes('tiktok.com')) return 'tiktok';
    if (host.includes('shopee.vn')) return 'shopee';
    if (host.includes('mysapo.net') || host.includes('sapo.vn')) return 'sapo';
    return null;
  }

  // ─── Selectors per platform ───────────────────────────────────────────────

  const SELECTORS = {
    tiktok: {
      // TikTok Shop Seller Center order detail
      containers: [
        '.order-detail-buyer',
        '.buyer-info',
        '[class*="buyerInfo"]',
        '[class*="buyer-info"]',
        '[class*="recipientInfo"]',
      ],
      phone: [
        '[class*="phone"]',
        '[class*="mobile"]',
        '[class*="tel"]',
      ],
      name: [
        '[class*="buyerName"]',
        '[class*="buyer-name"]',
        '[class*="recipientName"]',
        '[class*="recipient-name"]',
      ],
      address: [
        '[class*="address"]',
        '[class*="shipping"]',
      ],
    },
    shopee: {
      containers: [
        '.order-detail__buyer',
        '[class*="buyerInfo"]',
        '[class*="buyer"]',
        '.order-info',
      ],
      phone: [
        '[class*="phone"]',
        '[class*="mobile"]',
      ],
      name: [
        '[class*="buyerName"]',
        '[class*="name"]',
      ],
      address: [
        '[class*="address"]',
        '[class*="shipping"]',
      ],
    },
    sapo: {
      containers: [
        '.customer-info',
        '.order-customer',
        '[class*="customer"]',
        '.shipping-address',
      ],
      phone: [
        '[class*="phone"]',
        '[class*="mobile"]',
        'input[name*="phone"]',
      ],
      name: [
        '[class*="customer-name"]',
        '[class*="fullname"]',
        'input[name*="name"]',
      ],
      address: [
        '[class*="address"]',
        'input[name*="address"]',
      ],
    },
  };

  // ─── Extract text from element ────────────────────────────────────────────

  function extractText(el) {
    if (!el) return '';
    const val = el.value || el.textContent || el.innerText || '';
    return val.trim();
  }

  function findFirst(selectors, root = document) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && extractText(el)) return el;
    }
    return null;
  }

  // ─── Extract order info ───────────────────────────────────────────────────

  function extractOrderInfo() {
    const platform = getPlatform();
    if (!platform) return null;

    const sels = SELECTORS[platform];
    if (!sels) return null;

    // Find container first, then search within; fallback to document
    let root = document;
    for (const cSel of sels.containers) {
      const c = document.querySelector(cSel);
      if (c) { root = c; break; }
    }

    const phoneEl = findFirst(sels.phone, root) || findFirst(sels.phone);
    const nameEl  = findFirst(sels.name,  root) || findFirst(sels.name);
    const addrEl  = findFirst(sels.address, root) || findFirst(sels.address);

    const phone   = extractText(phoneEl);
    const name    = extractText(nameEl);
    const address = extractText(addrEl);

    if (!phone && !name && !address) return null;

    return { phone, name, address, phoneEl, nameEl, addrEl };
  }

  // ─── API call ─────────────────────────────────────────────────────────────

  async function checkBlacklist(data) {
    const body = {};
    if (data.phone)   body.phone   = data.phone;
    if (data.name)    body.name    = data.name;
    if (data.address) body.address = data.address;

    try {
      const res = await fetch(`${API_URL}/api/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ─── Highlight ────────────────────────────────────────────────────────────

  function severityClass(severity) {
    if (severity === 'low')    return 'blc-low';
    if (severity === 'medium') return 'blc-medium';
    return ''; // high = default red
  }

  function addBadge(el, match, score) {
    if (!el) return;
    // Remove existing badge
    const existing = el.parentElement?.querySelector('.blc-badge');
    if (existing) existing.remove();

    el.classList.add('blc-warning-field');

    const badge = document.createElement('span');
    badge.className = `blc-badge ${severityClass(match.entry.severity)}`;
    badge.textContent = score >= 40 ? `⚠ BLACKLIST ${score}/100` : '⚠ BLACKLIST';
    badge.title = `${match.entry.reason} | ${match.matched_fields.join(', ')}`;

    // Tooltip on hover
    badge.addEventListener('mouseenter', (e) => showTooltip(e, match, score));
    badge.addEventListener('mouseleave', hideTooltip);

    el.insertAdjacentElement('afterend', badge);
  }

  function showTooltip(e, match, score) {
    hideTooltip();
    const tip = document.createElement('div');
    tip.className = 'blc-tooltip';
    tip.id = 'blc-tooltip';
    tip.innerHTML = `
      <strong>⚠ Blacklist · điểm rủi ro ${score}/100</strong><br>
      Lý do: ${match.entry.reason}<br>
      Mức độ: ${match.entry.severity}<br>
      Khớp: ${match.matched_fields.join(', ')}<br>
      Thêm bởi: ${match.entry.added_by}
    `;
    document.body.appendChild(tip);
    tip.style.top  = `${e.clientY + 12}px`;
    tip.style.left = `${e.clientX + 12}px`;
  }

  function hideTooltip() {
    document.getElementById('blc-tooltip')?.remove();
  }

  function showBanner(count, score) {
    document.querySelector('.blc-banner')?.remove();
    const banner = document.createElement('div');
    banner.className = 'blc-banner';
    banner.innerHTML = `⚠ ${count} cảnh báo blacklist · điểm rủi ro ${score}/100`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 5000);
  }

  // ─── Main check ───────────────────────────────────────────────────────────

  async function runCheck() {
    const info = extractOrderInfo();
    if (!info) return;

    // Deduplicate — don't re-check same data
    const key = `${info.phone}|${info.name}|${info.address}`;
    if (key === lastCheckedKey) return;
    lastCheckedKey = key;

    const result = await checkBlacklist(info);
    if (!result || !result.matched) return;
    const score = result.score ?? 0;

    let badgeCount = 0;

    for (const match of result.matches) {
      for (const field of match.matched_fields) {
        if (field === 'phone'   && info.phoneEl) { addBadge(info.phoneEl, match, score); badgeCount++; }
        if (field === 'name'    && info.nameEl)  { addBadge(info.nameEl,  match, score); badgeCount++; }
        if (field === 'address' && info.addrEl)  { addBadge(info.addrEl,  match, score); badgeCount++; }
      }
    }

    if (badgeCount > 0) showBanner(result.matches.length, score);
  }

  // ─── MutationObserver — SPA navigation ───────────────────────────────────

  function scheduleCheck() {
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = setTimeout(runCheck, 600);
  }

  const observer = new MutationObserver(scheduleCheck);
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial check
  scheduleCheck();
})();
