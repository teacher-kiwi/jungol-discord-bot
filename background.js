chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "CORRECT_ANSWER") return;

  chrome.storage.sync.get(["webhookUrl"], (data) => {
    const webhookUrl = data.webhookUrl;
    if (!webhookUrl) {
      console.error("웹훅 URL이 설정되지 않았습니다.");
      return;
    }

    const {
      problemNum, problemTitle, problemUrl,
      tierImgUrl, tierColor, language,
      executionTime, memoryUsage, memoryUnit, codeLength,
      handle, userId, userRank, userTier,
      pid, sid, solvedUsr, solvedSub, totalSub,
    } = message;

    const colorValue = tierColor && tierColor.startsWith("#")
      ? parseInt(tierColor.replace("#", ""), 16)
      : 0x4a66c3;

    const userTierIconUrl = userTier
      ? `https://wsrv.nl/?url=${encodeURIComponent(`https://s.jungol.co.kr/solved/${userTier}.svg?dm=jungol.co.kr`)}&output=png`
      : "";
    const embedTitle = [problemNum, problemTitle].filter(Boolean).join(" ") || "정올 정답 알림";

    function toFiniteNumber(value) {
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    }

    function formatMetricNumber(value, maximumFractionDigits = 1) {
      const num = toFiniteNumber(value);
      if (num === null) return String(value);

      return num.toLocaleString(undefined, { maximumFractionDigits });
    }

    function formatExecutionTime(value) {
      return `${formatMetricNumber(value)} ms`;
    }

    function formatMemory(value, unit = "KB") {
      const num = toFiniteNumber(value);
      if (num === null) return String(value);

      if (unit === "KB" && num >= 1024) {
        return `${formatMetricNumber(num / 1024)} MB`;
      }

      return `${formatMetricNumber(num)} ${unit}`;
    }

    function formatCodeLength(value) {
      const num = toFiniteNumber(value);
      if (num === null) return String(value);

      if (num >= 1024) {
        return `${formatMetricNumber(num / 1024)} KB`;
      }

      return `${formatMetricNumber(num, 0)} B`;
    }

    const embed = {
      author: {
        name: userRank
          ? `${handle || "누군가"} (🏅${userRank.toLocaleString()}등)`
          : (handle || "누군가"),
        url: userId ? `https://jungol.co.kr/account/${userId}` : undefined,
        icon_url: userTierIconUrl || undefined,
      },
      title: embedTitle,
      url: problemUrl,
      color: colorValue,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: "제출 일시",
      },
    };

    if (tierImgUrl) {
      const pngConvertedUrl = `https://wsrv.nl/?url=${encodeURIComponent(tierImgUrl)}&output=png`;
      embed.thumbnail = { url: pngConvertedUrl };
    }
    if (sid && pid) {
      embed.description = `[코드 보기](https://jungol.co.kr/problem/${pid}/submission?sid=${sid})`;
    }
    if (language) {
      embed.fields.push({ name: "언어", value: language, inline: true });
    }
    if (executionTime) {
      embed.fields.push({ name: "실행 시간", value: formatExecutionTime(executionTime), inline: true });
    }
    if (memoryUsage) {
      embed.fields.push({ name: "메모리", value: formatMemory(memoryUsage, memoryUnit), inline: true });
    }
    if (codeLength) {
      embed.fields.push({ name: "코드 길이", value: formatCodeLength(codeLength), inline: true });
    }
    if (solvedUsr) {
      embed.fields.push({ name: "맞춘 사람", value: `${solvedUsr.toLocaleString()}명`, inline: true });
    }
    if (totalSub) {
      const rate = ((solvedSub / totalSub) * 100).toFixed(1);
      embed.fields.push({ name: "정답 비율", value: `${rate}%`, inline: true });
    }

    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "정올 알리미",
        avatar_url: "https://s.jungol.co.kr/logo.png",
        embeds: [embed]
      }),
    })
      .then((res) => {
        if (!res.ok) console.error("Discord webhook failed:", res.status);
      })
      .catch((err) => console.error("Discord webhook error:", err));
  });
});
