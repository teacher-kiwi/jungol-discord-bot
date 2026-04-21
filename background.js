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
      handle, userId, userRank, userTier,
      pid, sid, solvedUsr, solvedSub, totalSub,
    } = message;

    const colorValue = tierColor && tierColor.startsWith("#")
      ? parseInt(tierColor.replace("#", ""), 16)
      : 0x4a66c3;

    const userTierIconUrl = userTier
      ? `https://wsrv.nl/?url=${encodeURIComponent(`https://s.jungol.co.kr/solved/${userTier}.svg?dm=jungol.co.kr`)}&output=png`
      : "";

    const embed = {
      author: {
        name: userRank
          ? `${handle || "누군가"} (🏅${userRank.toLocaleString()}등)`
          : (handle || "누군가"),
        url: userId ? `https://jungol.co.kr/account/${userId}` : undefined,
        icon_url: userTierIconUrl || undefined,
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
