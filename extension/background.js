// background.js — minimal service worker
// Seed API URL default vào storage khi install; migrate localhost → public RPC
const DEFAULT_API = 'https://blacklist-checker.tipxinhshop.vn';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['apiUrl'], (result) => {
    if (!result.apiUrl || result.apiUrl.startsWith('http://localhost')) {
      chrome.storage.sync.set({ apiUrl: DEFAULT_API });
    }
  });
});
