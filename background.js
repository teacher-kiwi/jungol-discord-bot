// 설정 기본값
const DEFAULTS = {
  webhookUrl: "",
  displayName: "",
  active: true,
  sendFirstAcOnly: false,
  acSentPids: [], // 이미 전송된 pid 기록
};

// 같은 pid를 중복 기록하지 않도록 최대 보관 개수
// storage.sync는 약 100KB 할당량 → 여유있게 1000개까지만
const MAX_SENT_PIDS = 1000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "CORRECT_ANSWER") return;

  // 비동기 응답을 위해 true 반환
  handleCorrectAnswer(message)
    .then((response) => sendResponse(response))
    .catch((err) => {
      console.error("[정올 알리미] 처리 중 예외:", err);
      sendResponse({ status: "error", reason: "exception" });
    });

  return true;
});

async function handleCorrectAnswer(message) {
  const settings = await chrome.storage.sync.get(DEFAULTS);

  if (!settings.webhookUrl) {
    console.error("웹훅 URL이 설정되지 않았습니다.");
    return { status: "error", reason: "no-webhook" };
  }

  // (이중 체크) 비활성화 상태면 전송 안 함
  if (!settings.active) {
    return { status: "inactive" };
  }

  // 첫 정답만 전송 옵션: 이미 전송된 pid면 건너뜀
  const pid = message.pid || "";
  if (settings.sendFirstAcOnly && pid && settings.acSentPids.includes(pid)) {
    return { status: "duplicate" };
  }

  const { payload, files } = await buildPayload(message, settings.displayName);

  try {
    let options;
    if (files.length) {
      // 티어 이미지를 첨부파일로 함께 전송 (embed에서 attachment://파일명 으로 참조)
      const form = new FormData();
      form.append("payload_json", JSON.stringify(payload));
      files.forEach((f, i) => form.append(`files[${i}]`, f.blob, f.name));
      options = { method: "POST", body: form };
    } else {
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };
    }
    const res = await fetch(settings.webhookUrl, options);

    if (!res.ok) {
      console.error("Discord webhook failed:", res.status);
      return { status: "error", reason: `http-${res.status}` };
    }

    // 성공 시 pid 기록 (FIFO로 1000개 유지)
    if (pid && !settings.acSentPids.includes(pid)) {
      const updated = [...settings.acSentPids, pid].slice(-MAX_SENT_PIDS);
      await chrome.storage.sync.set({ acSentPids: updated });
    }

    return { status: "sent" };
  } catch (err) {
    console.error("Discord webhook error:", err);
    return { status: "error", reason: "network" };
  }
}

// data URL → Blob (실패 시 null)
async function dataUrlToBlob(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith("data:image/png;base64,")) return null;
  try {
    return await (await fetch(dataUrl)).blob();
  } catch {
    return null;
  }
}

async function buildPayload(message, displayName) {
  const {
    problemNum, problemTitle, problemUrl,
    tierImgUrl, tierColor, language,
    handle, userId, userRank, userTier,
    pid, sid, solvedUsr, solvedSub, totalSub,
    tierPng, userTierPng,
  } = message;

  const files = [];
  const tierBlob = await dataUrlToBlob(tierPng);
  const userTierBlob = await dataUrlToBlob(userTierPng);
  if (tierBlob) files.push({ name: "tier.png", blob: tierBlob });
  if (userTierBlob) files.push({ name: "user-tier.png", blob: userTierBlob });

  const colorValue = tierColor && tierColor.startsWith("#")
    ? parseInt(tierColor.replace("#", ""), 16)
    : 0x4a66c3;

  const userTierIconUrl = userTier
    ? `https://wsrv.nl/?url=${encodeURIComponent(`https://s.jungol.co.kr/solved/${userTier}.svg?dm=jungol.co.kr`)}&output=png`
    : "";

  // displayName이 설정되어 있으면 사용, 없으면 핸들, 그것도 없으면 "누군가"
  const baseName = (displayName && displayName.trim())
    || handle
    || "누군가";

  const embed = {
    author: {
      name: userRank
        ? `${baseName} (🏅${userRank.toLocaleString()}등)`
        : baseName,
      url: userId ? `https://jungol.co.kr/account/${userId}` : undefined,
      icon_url: userTierBlob
        ? "attachment://user-tier.png"
        : (userTierIconUrl || undefined),
    },
    title: `${problemNum} ${problemTitle}`,
    url: problemUrl,
    color: colorValue,
    fields: [],
    timestamp: new Date().toISOString(),
    footer: {
      text: "제출 일시",
    },
  };

  if (tierBlob) {
    embed.thumbnail = { url: "attachment://tier.png" };
  } else if (tierImgUrl) {
    // 변환 실패 시 기존 방식(외부 변환 서비스) 사용
    const pngConvertedUrl = `https://wsrv.nl/?url=${encodeURIComponent(tierImgUrl)}&output=png`;
    embed.thumbnail = { url: pngConvertedUrl };
  }
  if (sid && pid) {
    embed.description = `[코드 보기](https://jungol.co.kr/problem/${pid}/submission?sid=${sid})`;
  }
  if (language) {
    embed.fields.push({ name: "언어", value: language, inline: true });
  }
  if (solvedUsr) {
    embed.fields.push({ name: "맞춘 사람", value: `${solvedUsr.toLocaleString()}명`, inline: true });
  }
  if (totalSub) {
    const rate = ((solvedSub / totalSub) * 100).toFixed(1);
    embed.fields.push({ name: "정답 비율", value: `${rate}%`, inline: true });
  }

  return {
    payload: {
      username: "정올 알리미",
      avatar_url: "https://s.jungol.co.kr/logo.png",
      embeds: [embed],
    },
    files,
  };
}
