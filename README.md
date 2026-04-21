# 정올 알리미

[정올(Jungol)](https://jungol.co.kr)에서 문제를 맞추면 디스코드 웹훅으로 자동 알림을 보내는 크롬 확장 프로그램입니다.

![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## 미리보기

디스코드에 다음 정보가 포함된 임베드 메시지가 전송됩니다:

- 사용자 닉네임, 등수, 티어 아이콘
- 문제 번호, 제목, 난이도
- 사용 언어, 맞춘 사람 수, 정답 비율
- 코드 보기 링크

## 설치 방법

### 1. 파일 다운로드

이 저장소를 클론하거나 ZIP으로 다운로드합니다.

```bash
git clone https://github.com/teacher-kiwi/jungol-discord-bot.git
```

또는 **Code > Download ZIP**을 클릭하여 다운로드 후 압축을 해제합니다.

### 2. 크롬에 확장 프로그램 설치

1. 크롬 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 다운로드한 폴더 선택

### 3. 디스코드 웹훅 생성

1. 디스코드에서 알림을 받을 채널의 **채널 설정** 진입
2. **연동** > **웹후크** > **새 웹후크** 클릭
3. 웹훅 이름 설정 후 **웹후크 URL 복사** 클릭

### 4. 확장 프로그램 설정

1. 크롬 툴바에서 **정올 알리미** 아이콘 클릭
2. 복사한 웹훅 URL 붙여넣기
3. **저장하기** 클릭

## 사용 방법

설정 완료 후 별도의 조작 없이 [정올](https://jungol.co.kr)에서 문제를 풀고 **정답 판정**을 받으면 자동으로 디스코드에 알림이 전송됩니다.

## 파일 구조

```
├── manifest.json   # 확장 프로그램 설정
├── content.js      # 정답 감지 및 문제 데이터 수집
├── background.js   # 디스코드 웹훅 전송
├── popup.html      # 설정 팝업 UI
└── popup.js        # 설정 팝업 로직
```

## 주의사항

- 웹훅 URL은 **절대 타인에게 공유하지 마세요.** 악용될 수 있습니다.
- 대회 페이지(`/contest/`)에서는 알림이 전송되지 않습니다.
- 동일 정답에 대한 중복 알림 방지를 위해 5초 쿨다운이 적용됩니다.

## 라이선스

MIT
