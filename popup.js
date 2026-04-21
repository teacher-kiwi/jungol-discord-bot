const webhookUrlInput = document.getElementById("webhookUrl");
const saveBtn = document.getElementById("saveBtn");

chrome.storage.sync.get(["webhookUrl"], (data) => {
  if (data.webhookUrl) webhookUrlInput.value = data.webhookUrl;
});

saveBtn.addEventListener("click", () => {
  const webhookUrl = webhookUrlInput.value.trim();

  if (!webhookUrl) {
    saveBtn.textContent = "URL을 입력해주세요!";
    saveBtn.style.backgroundColor = "#e74c3c";
    setTimeout(() => {
      saveBtn.textContent = "저장하기";
      saveBtn.style.backgroundColor = "";
    }, 1500);
    return;
  }

  chrome.storage.sync.set({ webhookUrl }, () => {
    saveBtn.textContent = "저장 완료!";
    saveBtn.style.backgroundColor = "#43b581";
    setTimeout(() => {
      saveBtn.textContent = "저장하기";
      saveBtn.style.backgroundColor = "";
    }, 1500);
  });
});
