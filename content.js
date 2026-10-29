(() => {
  const COOLDOWN_MS = 5000;
  let lastSentTime = 0;

  // popup에서 설정한 값을 캐시 (fetch 전 빠른 체크용)
  // storage.onChanged로 실시간 갱신됨
  const settings = {
    active: true,
    showEmoji: true,
  };

  chrome.storage.sync.get(
    { active: true, showEmoji: true },
    (data) => {
      settings.active = Boolean(data.active);
      settings.showEmoji = Boolean(data.showEmoji);
    }
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.active !== undefined) settings.active = Boolean(changes.active.newValue);
    if (changes.showEmoji !== undefined) settings.showEmoji = Boolean(changes.showEmoji.newValue);
  });

  function isContestPage() {
    return window.location.pathname.includes("/contest/");
  }

  function decodeDevalue(data) {
    function resolve(idx) {
      if (typeof idx !== 'number') return idx;
      const val = data[idx];
      if (val === null || val === undefined) return val;
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
      if (Array.isArray(val)) return val.map(item => resolve(item));
      if (typeof val === 'object') {
        const result = {};
        for (const [key, ref] of Object.entries(val)) {
          result[key] = resolve(ref);
        }
        return result;
      }
      return val;
    }
    return resolve(0);
  }

  /**
   * 루트 노드 하위에서 "정답이에요!"를 포함하는
   * 가장 구체적인 요소(=텍스트 노드의 부모)를 찾습니다.
   * 이모지를 깔끔하게 append할 타겟을 정하기 위함.
   */
  function findAcTextElement(rootNode) {
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.includes("정답이에요!")) {
        return node.parentElement;
      }
    }
    return null;
  }

  /**
   * background.js에서 반환한 status에 따라 이모지를 표시합니다.
   * showEmoji가 false면 아무것도 하지 않음.
   */
  function showResultEmoji(response, targetEl) {
    if (!settings.showEmoji) return;
    if (!response || !targetEl) return;

    // 같은 상태가 이미 표시되어 있으면 중복 방지
    if (targetEl.querySelector(".jungol-notify-emoji")) return;

    let emoji = "";
    let title = "";
    switch (response.status) {
      case "sent":
        emoji = " ✔️";
        title = "[정올 알리미] 디스코드에 전송했습니다.";
        break;
      case "error":
        emoji = " ❌";
        title = `[정올 알리미] 전송 실패 (${response.reason || "unknown"})`;
        break;
      case "duplicate":
        emoji = " ⏭️";
        title = "[정올 알리미] 이미 전송한 문제입니다. (첫 정답만 전송 옵션 활성)";
        break;
      case "inactive":
        emoji = " 💤";
        title = "[정올 알리미] 비활성화 상태입니다.";
        break;
      default:
        return;
    }

    const span = document.createElement("span");
    span.className = "jungol-notify-emoji";
    span.title = title;
    span.textContent = emoji;
    span.style.marginLeft = "4px";
    targetEl.appendChild(span);
  }

  /**
   * 메시지를 background로 전송하고, 응답 받으면 이모지를 표시.
   */
  function sendAndShow(payload, targetEl) {
    chrome.runtime.sendMessage(payload, (response) => {
      // 확장 프로그램 재로딩 등으로 chrome.runtime.lastError가 발생할 수 있음
      if (chrome.runtime.lastError) {
        console.error("[정올 알리미] sendMessage error:", chrome.runtime.lastError.message);
        return;
      }
      showResultEmoji(response, targetEl);
    });
  }

  // 채점 결과 판정 라벨 (2026-10 정올 개편 이후: "정답이에요!" 문구 → 결과 오버레이의 .verdict-label "정답")
  const AC_LABELS = ["정답", "Accepted"];
  const text = (sel) => document.querySelector(sel)?.textContent.trim() || "";

  function findNewAcLabel() {
    for (const el of document.querySelectorAll(".verdict-label")) {
      if (el.dataset.jungolNotify) continue;
      if (AC_LABELS.includes(el.textContent.trim())) return el;
    }
    return null;
  }

  const observer = new MutationObserver(() => {
    if (isContestPage()) return;
    if (!settings.active) return; // 비활성 상태면 fetch도 생략

    const targetEl = findNewAcLabel();
    if (!targetEl) return;
    targetEl.dataset.jungolNotify = "1"; // 같은 결과 창을 두 번 처리하지 않도록 표시

    const now = Date.now();
    if (now - lastSentTime < COOLDOWN_MS) return;
    lastSentTime = now;

    const problemNum = text(".title-main .eyebrow > span").replace(/^#/, "");
    const problemTitle = text("h1 .name");
    const tierImgElem = document.querySelector("h1 .tier img");
    const tierImgUrl = tierImgElem ? tierImgElem.src : "";
    const tierColorDiv = document.querySelector("h1 .tier main");
    const tierHexColor = tierColorDiv ? tierColorDiv.style.getPropertyValue("--t").trim() : "";
    const language = text("button.lang-chip .lang-label");

    const cleanUrl = window.location.origin + window.location.pathname;
    const submissionUrl = cleanUrl + "/submission";

    const basePayload = {
      type: "CORRECT_ANSWER",
      problemNum, problemTitle, problemUrl: cleanUrl,
      tierImgUrl, tierColor: tierHexColor, language,
    };

    fetch(submissionUrl + "/__data.json")
      .then(res => res.json())
      .then(json => {
        let handle = "", userId = "", userRank = 0, userTier = 0;
        let pid = "", sid = "", solvedUsr = 0, solvedSub = 0, totalSub = 0;

        try {
          const nodes = json.nodes || [];

          if (nodes[0] && nodes[0].data) {
            const root = decodeDevalue(nodes[0].data);
            const account = root["$/account/my"]?.data;
            if (account) {
              handle = account.handle || "";
              userId = account.id || "";
              userRank = account.rank || 0;
              userTier = account.tier || 0;
            }
          }

          if (nodes[2] && nodes[2].data) {
            const prob = decodeDevalue(nodes[2].data);
            pid = prob.pid || "";
            const probKey = Object.keys(prob).find(k => k.startsWith("$/problem/"));
            if (probKey && prob[probKey]?.data) {
              const probData = prob[probKey].data;
              sid = probData.sid || "";
              solvedUsr = probData.rank?.solvedUsr || 0;
              solvedSub = probData.rank?.solvedSub || 0;
              totalSub = probData.rank?.totalSub || 0;
            }
          }
        } catch (e) {
          console.error("[정올 알리미] __data.json 파싱 에러:", e);
        }

        sendAndShow({
          ...basePayload,
          handle, userId, userRank, userTier,
          pid, sid, solvedUsr, solvedSub, totalSub,
        }, targetEl);
      })
      .catch(err => {
        console.error("[정올 알리미] __data.json 요청 실패:", err);
        sendAndShow({
          ...basePayload,
          handle: "", userId: "", userRank: 0, userTier: 0,
          pid: "", sid: "", solvedUsr: 0, solvedSub: 0, totalSub: 0,
        }, targetEl);
      });

  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
