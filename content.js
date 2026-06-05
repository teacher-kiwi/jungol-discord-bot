(() => {
  const COOLDOWN_MS = 5000;
  const TIER_IMAGE_BASE_URL = "https://s.jungol.co.kr/solved";
  let lastSentTime = 0;

  function isContestPage() {
    return window.location.pathname.includes("/contest/");
  }

  function getProblemIdFromPath() {
    const match = window.location.pathname.match(/\/problem\/([^/]+)/);
    return match ? match[1] : "";
  }

  function getProblemUrl(pid) {
    return pid
      ? `${window.location.origin}/problem/${pid}`
      : window.location.origin + window.location.pathname;
  }

  function buildTierImageUrl(tier) {
    return tier ? `${TIER_IMAGE_BASE_URL}/${tier}.svg?dm=jungol.co.kr` : "";
  }

  function decodeDevalue(data) {
    if (!Array.isArray(data)) return data;

    const seen = new Map();

    function resolve(idx) {
      if (typeof idx !== 'number') return idx;
      const val = data[idx];
      if (val === null || val === undefined) return val;
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
      if (seen.has(idx)) return seen.get(idx);
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

  function getDomProblemTitle() {
    const h1 = document.querySelector("h1");
    if (!h1) return "";

    const titleSpan = Array.from(h1.children).find((child) => {
      return child.tagName === "SPAN" && !child.classList.contains("limit");
    });

    return titleSpan ? titleSpan.innerText.trim() : "";
  }

  function tierImageSelector(tier) {
    return tier
      ? `h1 img[src*="/solved/${tier}.svg"]`
      : 'h1 img[src*="/solved/"]';
  }

  function getDomTierImageUrl(tier) {
    const tierImgElem = document.querySelector(tierImageSelector(tier));
    return tierImgElem ? tierImgElem.src : "";
  }

  function getDomTierColor(tier) {
    const tierImgElem = document.querySelector(tierImageSelector(tier));
    const tierElem = tierImgElem?.closest('[style*="--t"]') || document.querySelector('h1 [style*="--t"]');

    return tierElem ? tierElem.style.getPropertyValue("--t").trim() : "";
  }

  function getTierFromImageUrl(url) {
    const match = url.match(/\/solved\/(\d+)\.svg/);
    return match ? Number(match[1]) : 0;
  }

  function getDomLanguage() {
    const langBtn = Array.from(document.querySelectorAll('button')).find(btn => {
      const icon = btn.querySelector('span.notranslate');
      return icon && icon.innerText === 'language';
    });

    return langBtn ? langBtn.innerText.replace('language', '').trim() : "";
  }

  function readJungolData(json) {
    const result = {};

    function hasOwn(value, key) {
      return Object.prototype.hasOwnProperty.call(value, key);
    }

    function isPresent(value) {
      return value !== undefined && value !== null && value !== "";
    }

    function unwrapData(value) {
      return value && typeof value === "object" && value.data && typeof value.data === "object"
        ? value.data
        : value;
    }

    function walkObjects(value, visit, seen = new WeakSet()) {
      if (!value || typeof value !== "object" || seen.has(value)) return;

      seen.add(value);
      visit(value);

      for (const child of Object.values(value)) {
        walkObjects(child, visit, seen);
      }
    }

    function firstPresent(value, keys) {
      for (const key of keys) {
        if (hasOwn(value, key) && isPresent(value[key])) return value[key];
      }

      return undefined;
    }

    function metricValue(value) {
      if (Array.isArray(value)) {
        const numbers = value.map(item => Number(item)).filter(Number.isFinite);
        return numbers.length ? Math.max(...numbers) : undefined;
      }

      if (value && typeof value === "object") return undefined;
      if (!isPresent(value)) return undefined;

      const num = Number(value);
      return Number.isFinite(num) ? num : value;
    }

    function readMetric(value, keys) {
      for (const key of keys) {
        if (!hasOwn(value, key)) continue;

        const metric = metricValue(value[key]);
        if (isPresent(metric)) return { key, value: metric };
      }

      return null;
    }

    function sourceText(source) {
      if (typeof source === "string") return source;
      if (Array.isArray(source)) {
        for (const item of source) {
          const text = sourceText(item);
          if (text) return text;
        }
      }
      if (source && typeof source === "object") {
        return sourceText(source.source || source.code || source.text);
      }

      return "";
    }

    function sourceByteLength(value) {
      const text = sourceText(value.source || value.code || value.text);
      return text ? new TextEncoder().encode(text).length : 0;
    }

    function hasSubmissionSignal(value) {
      return [
        "sid", "submissionId", "r", "result", "m_reason", "score",
        "m_time", "m_memory", "source",
      ].some(key => hasOwn(value, key));
    }

    function readSubmissionData(value) {
      const candidate = unwrapData(value);
      if (!candidate || typeof candidate !== "object" || !hasSubmissionSignal(candidate)) return;

      const executionTime = readMetric(candidate, [
        "m_time", "dur", "duration", "runtime", "runtimeMs", "timeMs", "time",
      ]);
      const memoryUsage = readMetric(candidate, [
        "m_memory", "mem", "memory", "memoryKb", "memoryKB", "memoryMb", "memoryMB", "memoryUsage",
      ]);
      const codeLength = readMetric(candidate, [
        "size", "byt", "byte", "bytes", "sourceLength", "codeLength", "codeLengthBytes",
      ]);
      const sourceLength = codeLength ? 0 : sourceByteLength(candidate);

      const sid = firstPresent(candidate, ["sid", "submissionId"])
        || (
          (executionTime || memoryUsage || codeLength || candidate.source)
            ? firstPresent(candidate, ["id"])
            : undefined
        );
      const language = firstPresent(candidate, ["language", "lang"]);

      if (sid) result.sid = String(sid);
      if (language) result.language = language;
      if (executionTime) result.executionTime = executionTime.value;
      if (memoryUsage) {
        result.memoryUsage = memoryUsage.value;
        result.memoryUnit = memoryUsage.key === "memory" || memoryUsage.key.toLowerCase().includes("mb")
          ? "MB"
          : "KB";
      }
      if (codeLength || sourceLength) {
        result.codeLength = codeLength?.value || sourceLength;
      }
    }

    for (const node of json?.nodes || []) {
      if (!node?.data) continue;

      const root = decodeDevalue(node.data);
      if (!root || typeof root !== "object") continue;

      const account = root["$/account/my"]?.data;
      if (account) {
        if (account.handle) result.handle = account.handle;
        if (account.id) result.userId = account.id;
        if (account.rank) result.userRank = account.rank;
        if (account.tier) result.userTier = account.tier;
      }

      if (root.pid) result.pid = String(root.pid);

      walkObjects(root, readSubmissionData);

      const problemKey = Object.keys(root).find(k => k.startsWith("$/problem/"));
      const problemData = problemKey ? root[problemKey]?.data : null;
      if (!problemData) continue;

      result.pid = String(problemData.id || root.pid || result.pid || "");
      if (problemData.title) result.problemTitle = problemData.title;

      const problemTier = problemData.fTier || problemData.tier?.tier;
      if (problemTier) result.problemTier = problemTier;

      if (problemData.sid) result.sid = String(problemData.sid);
      if (problemData.rank?.solvedUsr) result.solvedUsr = problemData.rank.solvedUsr;
      if (problemData.rank?.solvedSub) result.solvedSub = problemData.rank.solvedSub;
      if (problemData.rank?.totalSub) result.totalSub = problemData.rank.totalSub;
    }

    return result;
  }

  function mergeData(...sources) {
    return sources.reduce((result, source) => {
      for (const [key, value] of Object.entries(source || {})) {
        if (value !== undefined && value !== null && value !== "") {
          result[key] = value;
        }
      }
      return result;
    }, {});
  }

  function fetchJson(url) {
    return fetch(url).then(res => {
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url, { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.text();
    });
  }

  function readSubmissionHtml(html, sid) {
    const result = {};
    const escapedSid = sid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const submissionBlockMatch = html.match(new RegExp(`"\\$/submission/${escapedSid}"[\\s\\S]*?url:"/submission/${escapedSid}"`));
    const source = submissionBlockMatch ? submissionBlockMatch[0] : html;

    function readNumber(key) {
      const match = source.match(new RegExp(`${key}:([0-9]+(?:\\.[0-9]+)?)`));
      return match ? Number(match[1]) : "";
    }

    function readString(key) {
      const match = source.match(new RegExp(`${key}:"([^"]*)"`));
      return match ? match[1] : "";
    }

    result.sid = sid;
    result.executionTime = readNumber("m_time");
    result.memoryUsage = readNumber("m_memory");
    result.memoryUnit = "KB";
    result.codeLength = readNumber("size");
    result.language = readString("language");
    result.pid = String(readNumber("problemId") || "");

    return result;
  }

  function isExtensionContextError(err) {
    const message = String(err?.message || err);

    return message.includes("Extension context invalidated")
      || message.includes("Could not establish connection")
      || message.includes("Receiving end does not exist");
  }

  function safeSendMessage(message) {
    try {
      if (!chrome?.runtime?.id) return false;

      chrome.runtime.sendMessage(message);

      return true;
    } catch (err) {
      if (!isExtensionContextError(err)) {
        console.error("[정올 알리미] background 메시지 전송 실패:", err);
      }

      return false;
    }
  }

  function readDomData() {
    const pathPid = getProblemIdFromPath();
    const tierImgUrl = getDomTierImageUrl();

    return {
      pid: pathPid,
      problemUrl: getProblemUrl(pathPid),
      problemTitle: getDomProblemTitle(),
      tierImgUrl,
      problemTier: getTierFromImageUrl(tierImgUrl),
      language: getDomLanguage(),
    };
  }

  function fetchSubmissionDetail(rawSid, problemUrl) {
    const sid = encodeURIComponent(rawSid);
    const { origin } = window.location;

    return Promise.allSettled([
      fetchJson(`${problemUrl}/submission/__data.json?sid=${sid}`).then(readJungolData),
      fetchJson(`${origin}/submission/${sid}/__data.json`).then(readJungolData),
      fetchText(`${origin}/submission/${sid}`).then(html => readSubmissionHtml(html, rawSid)),
    ]).then(results => results.map(result => (
      result.status === "fulfilled" ? result.value : {}
    )));
  }

  async function fetchSubmissionData(problemUrl) {
    const results = await Promise.allSettled([
      fetchJson(`${problemUrl}/__data.json`),
      fetchJson(`${problemUrl}/submission/__data.json`),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("[정올 알리미] __data.json 요청 실패:", result.reason);
      }
    }

    let data = mergeData(...results.map(result => (
      result.status === "fulfilled" ? readJungolData(result.value) : {}
    )));

    if (data.sid) {
      data = mergeData(data, ...await fetchSubmissionDetail(data.sid, problemUrl));
    }

    return data;
  }

  function buildPayload(data, dom) {
    const pid = data.pid || dom.pid;
    const problemTier = data.problemTier || dom.problemTier;

    return {
      type: "CORRECT_ANSWER",
      problemNum: pid ? `#${pid}` : "",
      problemTitle: data.problemTitle || dom.problemTitle,
      problemUrl: dom.problemUrl,
      tierImgUrl: dom.tierImgUrl || buildTierImageUrl(problemTier),
      tierColor: getDomTierColor(problemTier),
      language: dom.language || data.language || "",
      executionTime: data.executionTime || "",
      memoryUsage: data.memoryUsage || "",
      memoryUnit: data.memoryUnit || "KB",
      codeLength: data.codeLength || "",
      handle: data.handle || "",
      userId: data.userId || "",
      userRank: data.userRank || 0,
      userTier: data.userTier || 0,
      pid,
      sid: data.sid || "",
      solvedUsr: data.solvedUsr || 0,
      solvedSub: data.solvedSub || 0,
      totalSub: data.totalSub || 0,
    };
  }

  async function handleCorrectAnswer() {
    const dom = readDomData();

    try {
      const data = await fetchSubmissionData(dom.problemUrl);
      safeSendMessage(buildPayload(data, dom));
    } catch (err) {
      console.error("[정올 알리미] __data.json 처리 실패:", err);
      safeSendMessage(buildPayload({}, dom));
    }
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
        handleCorrectAnswer();

        return;
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
