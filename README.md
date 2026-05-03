# RE:518 — 사라진 기록 복원소

5·18 기록을 단순히 읽는 서비스가 아니라, 사용자가 직접 훼손된 기록을 복원하고 왜곡 표현을 공식 기록과 대조하는 체험형 아카이브 MVP입니다.

## 이번 뼈대의 목표

이 저장소는 6일 안에 시연 가능한 최소 구조를 먼저 잡는 것을 목표로 합니다.

- `frontend/`: 사용자가 보는 기록 복원 화면
- `backend/`: 미션 목록, 미션 완료, 복원률, IoT 상태를 제공하는 Express 서버
- `iot/`: ESP32 LED 기억 저장소 예시 코드

## 팀원별 작업 위치

### 건호 — 기획&설계 + IoT

- `README.md`: 발표 흐름과 실행 방법 정리
- `backend/data/missions.json`: 미션 문구와 공식 기록 기반 설명 검수
- `iot/esp32_led.ino`: LED 밝기 단계 구현

### 민욱 — 백엔드 보조

- `backend/data/missions.json`: 미션 데이터 구조 정리
- `backend/server.js`: 복원률 계산 로직 보조
- API 응답이 프론트에서 잘 보이는지 테스트

### 대훈 — 백엔드

- `backend/server.js`: Express 서버 담당
- `/api/missions`, `/api/missions/:id/complete`, `/api/progress`, `/api/iot/state` 관리
- 시연 중 서버가 끊기지 않도록 실행 확인

### 다온 — 프론트/게임 파트

- `frontend/src/main.jsx`: 화면과 미션 인터랙션 담당
- `frontend/src/styles.css`: 기록 보관소 분위기 UI 담당
- 단서 카드 클릭, 왜곡 표현 제거, 복원 완료 화면 개선

### 세윤 — 코드 검수 + 잔업

- 전체 실행 테스트
- README 실행 방법 보완
- 프론트와 백엔드 연결 오류 수정
- 발표 전 최종 점검

## 실행 방법

터미널을 2개 열어서 각각 실행합니다.

먼저 Node.js가 설치되어 있어야 합니다.

확인:

```bash
node -v
npm -v
```

둘 중 하나라도 버전이 안 나오면 Node.js LTS를 설치해야 합니다.

### 1. 백엔드 실행

```bash
cd backend
npm install
npm start
```

백엔드 주소:

```txt
http://localhost:3001
```

확인용 주소:

```txt
http://localhost:3001/api/missions
http://localhost:3001/api/iot/state
```

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

프론트 주소:

```txt
http://localhost:5173
```

## 실행 순서 요약

1. `backend` 폴더에서 `npm install`
2. `backend` 폴더에서 `npm start`
3. 새 터미널을 열고 `frontend` 폴더에서 `npm install`
4. `frontend` 폴더에서 `npm run dev`
5. 브라우저에서 `http://localhost:5173` 접속

## 백엔드 API 설명

대훈 파트에서 주로 볼 부분입니다.

```txt
GET  /api/health
서버가 켜져 있는지 확인합니다.

GET  /api/missions
미션 3개 목록을 프론트에 보내줍니다.

GET  /api/missions/:id
특정 미션 하나만 확인합니다.

POST /api/missions/:id/complete
미션을 완료 처리하고 복원률을 다시 계산합니다.

GET  /api/progress
현재 복원률과 완료된 미션 목록을 보여줍니다.

GET  /api/iot/state
ESP32가 읽는 주소입니다. progress와 ledLevel을 보내줍니다.

POST /api/reset
시연 상태를 0%로 초기화합니다.
```

## 프론트 조작 방법

1. 왼쪽에서 복원할 기록을 선택합니다.
2. 가운데 단서 카드를 누릅니다.
3. 공식 기록 비교 카드와 맞는 단서만 남깁니다.
4. 검증 상태가 완료 조건을 만족하면 `선택한 단서로 기록 복원`을 누릅니다.
5. 오른쪽 복원률과 기억 저장소 LED 단계가 올라가는지 확인합니다.

## 미션 데이터 수정 방법

민욱/건호 파트에서 주로 볼 부분입니다.

미션 내용은 `backend/data/missions.json`에서 수정합니다.

중요한 필드:

```txt
title: 미션 제목
summary: 미션 카드와 상단 설명
instruction: 사용자가 해야 할 일
damagedRecord: 복원 전 기록
clues: 단서 카드 목록
officialNote: 공식 기록 비교 카드 문구
restoredText: 복원 완료 후 표시할 문장
rememberPoint: 최종 발표에서 말할 기억 포인트
sources: 공식 근거 링크
```

단서 하나는 이렇게 생겼습니다.

```json
{
  "id": "testimony",
  "label": "시민 증언",
  "correct": true,
  "reason": "당시 상황을 복원하는 핵심 기록 자료입니다."
}
```

`correct: true`면 사용자가 선택해야 하는 단서입니다.
`correct: false`면 공식 기록과 맞지 않거나 제외해야 하는 단서입니다.

## IoT 연결 방법

건호 파트에서 주로 볼 부분입니다.

1. `iot/esp32_led.ino`를 Arduino IDE에서 엽니다.
2. 아래 값을 본인 환경에 맞게 바꿉니다.

```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "http://YOUR_NOTEBOOK_IP:3001/api/iot/state";
```

3. 노트북 IP는 같은 와이파이에 연결된 IPv4 주소를 사용합니다.
4. 백엔드 서버를 먼저 켠 뒤 ESP32를 업로드합니다.
5. 복원률이 올라갈 때 LED 밝기가 바뀌면 성공입니다.

IoT가 실패해도 프론트 오른쪽의 `기억 저장소` 패널이 시뮬레이션 역할을 하므로 발표는 계속할 수 있습니다.

## 시연 흐름

1. 메인 화면에서 복원률 0% 확인
2. 미션 1 복원 완료 → 복원률 33%
3. 미션 2 복원 완료 → 복원률 67%
4. 미션 3 왜곡 표현 검증 완료 → 복원률 100%
5. 최종 화면에서 “기록 복원 완료” 확인
6. IoT 기억 저장소 LED가 복원률에 따라 밝아지는 모습 시연

## IoT 연결 방식

ESP32가 백엔드 서버의 아래 주소를 주기적으로 확인합니다.

```txt
http://노트북IP:3001/api/iot/state
```

응답 예시:

```json
{
  "progress": 67,
  "ledLevel": 2,
  "message": "기록 복원 중"
}
```

ESP32는 `ledLevel` 값에 따라 LED 밝기를 바꾸면 됩니다.

## 지금 버전에서 일부러 뺀 기능

완성도를 위해 아래 기능은 넣지 않습니다.

- 로그인 / 회원가입
- 실제 OCR
- 실제 음성 인식
- 지도 API
- 관리자 페이지
- 복잡한 DB
- AI 판별

이 프로젝트의 첫 목표는 “작지만 끝까지 작동하는 시연”입니다.
