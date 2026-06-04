(() => {
  const COOLDOWN_MS = 5000;
  const DATA_JSON_FILES = ["_data.json", "__data.json"];
  let lastSentTime = 0;

  function isContestPage() {
    return window.location.pathname.includes("/contest/");
  }

  function decodeDevalue(data) {
    if (!Array.isArray(data)) return data;

    const seen = new Map();

    function resolve(idx) {
      if (typeof idx !== 'number') return idx;
      if (idx < 0 || idx >= data.length) return idx;
      if (seen.has(idx)) return seen.get(idx);

      const val = data[idx];
      if (val === null || val === undefined) return val;
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
      if (Array.isArray(val)) {
        const result = [];
        seen.set(idx, result);
        for (const item of val) result.push(resolve(item));
        return result;
      }
      if (typeof val === 'object') {
        const result = {};
        seen.set(idx, result);
        for (const [key, ref] of Object.entries(val)) {
          result[key] = resolve(ref);
        }
        return result;
      }
      return val;
    }
    return resolve(0);
  }

  function getProblemIdFromPath() {
    const match = window.location.pathname.match(/\/problem\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function getProblemUrl() {
    const match = window.location.pathname.match(/^(.*?\/problem\/[^/]+)/);
    return match
      ? window.location.origin + match[1]
      : window.location.origin + window.location.pathname;
  }

  function getTitleFromDocument() {
    return document.title.replace(/\s*-\s*JUNGOL\s*$/i, "").trim();
  }

  function getDomFallbackInfo() {
    const problemNumElem = document.querySelector('h3.S-xp96hh > span');
    const titleElem = document.querySelector('h1.S-xp96hh > span:not(.limit)');
    const tierImgElem = document.querySelector('h1.S-xp96hh img');
    const tierColorDiv = document.querySelector('h1.S-xp96hh main div');

    return {
      problemNum: problemNumElem?.childNodes?.[0]?.nodeValue?.trim() || "",
      problemTitle: titleElem?.innerText?.trim() || "",
      tierImgUrl: tierImgElem?.src || "",
      tierColor: tierColorDiv?.style?.getPropertyValue('--t')?.trim() || "",
    };
  }

  function getLanguageFromDom() {
    const langBtn = Array.from(document.querySelectorAll('button')).find(btn => {
      const icon = btn.querySelector('span.notranslate');
      return icon && icon.innerText === 'language';
    });

    return langBtn ? langBtn.innerText.replace('language', '').trim() : "";
  }

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function unwrapData(value) {
    if (value && typeof value === "object" && value.data && typeof value.data === "object") {
      return value.data;
    }

    return value;
  }

  function findInObject(value, predicate, seen = new WeakSet()) {
    if (!value || typeof value !== "object") return null;
    if (seen.has(value)) return null;

    seen.add(value);

    const matched = predicate(value);
    if (matched) return matched;

    for (const child of Object.values(value)) {
      const found = findInObject(child, predicate, seen);
      if (found) return found;
    }

    return null;
  }

  function decodeNodes(json) {
    const nodes = Array.isArray(json?.nodes) ? json.nodes : [];

    return nodes
      .map(node => node?.data ? decodeDevalue(node.data) : null)
      .filter(node => node && typeof node === "object");
  }

  function findByKey(decodedNodes, key) {
    for (const decodedNode of decodedNodes) {
      const found = findInObject(decodedNode, value => {
        if (!hasOwn(value, key)) return null;
        return unwrapData(value[key]);
      });

      if (found) return found;
    }

    return null;
  }

  function isSameId(left, right) {
    return left !== null
      && left !== undefined
      && right !== null
      && right !== undefined
      && String(left) === String(right);
  }

  function findProblemData(decodedNodes, problemId) {
    if (!problemId) return null;

    const keyedProblem = findByKey(decodedNodes, `$/problem/${problemId}`);
    if (keyedProblem) return keyedProblem;

    for (const decodedNode of decodedNodes) {
      const found = findInObject(decodedNode, value => {
        const candidate = unwrapData(value);
        if (!candidate || typeof candidate !== "object") return null;
        return isSameId(candidate.pid, problemId) ? candidate : null;
      });

      if (found) return found;
    }

    return null;
  }

  function findAccountData(decodedNodes) {
    const account = findByKey(decodedNodes, "$/account/my");
    if (account) return account;

    for (const decodedNode of decodedNodes) {
      const found = findInObject(decodedNode, value => {
        const candidate = unwrapData(value);
        if (!candidate || typeof candidate !== "object") return null;
        return candidate.handle && hasOwn(candidate, "rank") && hasOwn(candidate, "tier")
          ? candidate
          : null;
      });

      if (found) return found;
    }

    return null;
  }

  function findSubmissionId(decodedNodes, problemId) {
    for (const decodedNode of decodedNodes) {
      const found = findInObject(decodedNode, value => {
        const candidate = unwrapData(value);
        if (!candidate || typeof candidate !== "object") return null;
        if (candidate.pid !== undefined && !isSameId(candidate.pid, problemId)) return null;

        return candidate.sid
          || candidate.submissionId
          || candidate.submission?.sid
          || candidate.latestSubmission?.sid
          || null;
      });

      if (found) return String(found);
    }

    return "";
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function getTierFromProblemData(problemData) {
    return toNumber(problemData?.tier ?? problemData?.level ?? problemData?.difficulty);
  }

  function getTierImageUrl(tier) {
    return tier > 0
      ? `https://s.jungol.co.kr/solved/${tier}.svg?dm=jungol.co.kr`
      : "";
  }

  function getTierColor(problemData) {
    const color = problemData?.tierColor
      || problemData?.color
      || problemData?.hexColor
      || "";

    return typeof color === "string" && color.startsWith("#") ? color : "";
  }

  async function fetchSubmissionData(problemUrl) {
    let lastError = null;

    for (const fileName of DATA_JSON_FILES) {
      const dataUrl = `${problemUrl}/submission/${fileName}`;

      try {
        const res = await fetch(dataUrl, { credentials: "include" });
        if (!res.ok) throw new Error(`${dataUrl} returned ${res.status}`);
        return await res.json();
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("data.json request failed");
  }

  function buildMessage(problemId, problemUrl, documentTitle, language, dataJson) {
    let handle = "", userId = "", userRank = 0, userTier = 0;
    let pid = problemId, sid = "", solvedUsr = 0, solvedSub = 0, totalSub = 0;
    let dataTitle = "", tierImgUrl = "", tierColor = "";

    try {
      const decodedNodes = dataJson ? decodeNodes(dataJson) : [];
      const account = findAccountData(decodedNodes);
      const problemData = findProblemData(decodedNodes, problemId);

      if (account) {
        handle = account.handle || "";
        userId = account.id || "";
        userRank = toNumber(account.rank);
        userTier = toNumber(account.tier);
      }

      if (problemData) {
        const rank = problemData.rank || {};
        const tier = getTierFromProblemData(problemData);

        pid = problemData.pid || problemId;
        sid = problemData.sid || findSubmissionId(decodedNodes, problemId);
        dataTitle = problemData.title || problemData.name || "";
        solvedUsr = toNumber(rank.solvedUsr ?? problemData.solvedUsr);
        solvedSub = toNumber(rank.solvedSub ?? problemData.solvedSub);
        totalSub = toNumber(rank.totalSub ?? problemData.totalSub);
        tierImgUrl = problemData.tierImgUrl || problemData.tierImageUrl || getTierImageUrl(tier);
        tierColor = getTierColor(problemData);
      }
    } catch (e) {
      console.error("[정올 알리미] data.json 파싱 에러:", e);
    }

    const fallback = (!pid || !documentTitle || !tierImgUrl || !tierColor)
      ? getDomFallbackInfo()
      : {};

    return {
      type: "CORRECT_ANSWER",
      problemNum: pid || fallback.problemNum,
      problemTitle: documentTitle || dataTitle || fallback.problemTitle,
      problemUrl,
      tierImgUrl: tierImgUrl || fallback.tierImgUrl,
      tierColor: tierColor || fallback.tierColor,
      language,
      handle, userId, userRank, userTier,
      pid, sid, solvedUsr, solvedSub, totalSub,
    };
  }

  async function sendCorrectAnswerMessage() {
    const problemId = getProblemIdFromPath();
    const problemUrl = getProblemUrl();
    const documentTitle = getTitleFromDocument();
    const language = getLanguageFromDom();
    let dataJson = null;

    try {
      dataJson = await fetchSubmissionData(problemUrl);
    } catch (err) {
      console.error("[정올 알리미] data.json 요청 실패:", err);
    }

    chrome.runtime.sendMessage(
      buildMessage(problemId, problemUrl, documentTitle, language, dataJson)
    );
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
        sendCorrectAnswerMessage().catch(err => {
          console.error("[정올 알리미] 알림 전송 준비 실패:", err);
        });

        return;
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
