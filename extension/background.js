// background.js — minimal service worker
// Lưu API URL default vào storage khi install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['apiUrl'], (result) => {
    if (!result.apiUrl) {
      chrome.storage.sync.set({ apiUrl: 'http://localhost:7070' });
    }
  });
});
