// 설정 기본값 (popup.html의 input id와 매칭)
const DEFAULTS = {
  webhookUrl: "",
  displayName: "",
  active: true,
  sendFirstAcOnly: false,
  showEmoji: true,
};

const els = {
  webhookUrl: document.getElementById("webhookUrl"),
  displayName: document.getElementById("displayName"),
  active: document.getElementById("active"),
  sendFirstAcOnly: document.getElementById("sendFirstAcOnly"),
  showEmoji: document.getElementById("showEmoji"),
  saveBtn: document.getElementById("saveBtn"),
};

// 현재 저장된 값을 로드 (없으면 DEFAULTS 사용)
chrome.storage.sync.get(DEFAULTS, (data) => {
  els.webhookUrl.value = data.webhookUrl || "";
  els.displayName.value = data.displayName || "";
  els.active.checked = Boolean(data.active);
  els.sendFirstAcOnly.checked = Boolean(data.sendFirstAcOnly);
  els.showEmoji.checked = Boolean(data.showEmoji);
});

// 저장
els.saveBtn.addEventListener("click", () => {
  const webhookUrl = els.webhookUrl.value.trim();

  if (!webhookUrl) {
    flashButton("URL을 입력해주세요!", "#e74c3c");
    return;
  }

  const settings = {
    webhookUrl,
    displayName: els.displayName.value.trim(),
    active: els.active.checked,
    sendFirstAcOnly: els.sendFirstAcOnly.checked,
    showEmoji: els.showEmoji.checked,
  };

  chrome.storage.sync.set(settings, () => {
    flashButton("저장 완료!", "#43b581");
  });
});

function flashButton(message, color) {
  els.saveBtn.textContent = message;
  els.saveBtn.style.backgroundColor = color;
  setTimeout(() => {
    els.saveBtn.textContent = "저장하기";
    els.saveBtn.style.backgroundColor = "";
  }, 1500);
}
