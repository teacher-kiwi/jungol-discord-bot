(() => {
  const COOLDOWN_MS = 5000;
  let lastSentTime = 0;

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

  const observer = new MutationObserver((mutations) => {
    if (isContestPage()) return;

    const now = Date.now();
    if (now - lastSentTime < COOLDOWN_MS) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (!node.innerText || !node.innerText.includes("정답이에요!")) continue;

        lastSentTime = now;

        const problemNumElem = document.querySelector('h3.S-xp96hh > span');
        const problemNum = problemNumElem ? problemNumElem.childNodes[0]?.nodeValue.trim() : "";
        const titleElem = document.querySelector('h1.S-xp96hh > span:not(.limit)');
        const problemTitle = titleElem ? titleElem.innerText.trim() : "";
        const tierImgElem = document.querySelector('h1.S-xp96hh img');
        const tierImgUrl = tierImgElem ? tierImgElem.src : "";
        const tierColorDiv = document.querySelector('h1.S-xp96hh main div');
        const tierHexColor = tierColorDiv ? tierColorDiv.style.getPropertyValue('--t').trim() : "";
        const langBtn = Array.from(document.querySelectorAll('button')).find(btn => {
          const icon = btn.querySelector('span.notranslate');
          return icon && icon.innerText === 'language';
        });
        const language = langBtn ? langBtn.innerText.replace('language', '').trim() : "";

        const cleanUrl = window.location.origin + window.location.pathname;
        const submissionUrl = cleanUrl + "/submission";

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

            chrome.runtime.sendMessage({
              type: "CORRECT_ANSWER",
              problemNum, problemTitle, problemUrl: cleanUrl,
              tierImgUrl, tierColor: tierHexColor, language,
              handle, userId, userRank, userTier,
              pid, sid, solvedUsr, solvedSub, totalSub,
            });
          })
          .catch(err => {
            console.error("[정올 알리미] __data.json 요청 실패:", err);
            chrome.runtime.sendMessage({
              type: "CORRECT_ANSWER",
              problemNum, problemTitle, problemUrl: cleanUrl,
              tierImgUrl, tierColor: tierHexColor, language,
              handle: "", userId: "", userRank: 0, userTier: 0,
              pid: "", sid: "", solvedUsr: 0, solvedSub: 0, totalSub: 0,
            });
          });

        return;
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
