# RE:518 — 사라진 기록 복원소

5·18 기록을 단순히 읽는 서비스가 아니라, 사용자가 스토리보드 흐름을 따라 훼손된 기록을 직접 복원하는 체험형 아카이브 MVP입니다.

## 이번 뼈대의 목표

이 저장소는 6일 안에 시연 가능한 최소 구조를 먼저 잡는 것을 목표로 합니다.

- `frontend/`: 사용자가 보는 기록 복원 화면
- `backend/`: 미션 목록, 미션 완료, 복원률, SQLite DB, 아두이노 Serial 연동을 제공하는 Express 서버
- `iot/`: 아두이노 전구/LED 제어 예시 코드

## 팀원별 작업 위치

### 건호 — 기획&설계 + IoT

- `README.md`: 발표 흐름과 실행 방법 정리
- `backend/data/missions.json`: 미션 문구와 공식 기록 기반 설명 검수
- `iot/arduino_bulb_control.ino`: LED/전구 밝기 단계 구현

### 민욱 — 백엔드 보조

- `backend/data/missions.json`: 미션 데이터 구조 정리
- `backend/server.js`: SQLite 진행도 저장 로직 보조
- API 응답이 프론트에서 잘 보이는지 테스트

### 대훈 — 백엔드

- `backend/server.js`: Express 서버 담당
- `/api/missions`, `/api/missions/:id/complete`, `/api/progress`, `/api/iot/state` 관리
- SQLite DB와 아두이노 Serial 연결 관리
- 시연 중 서버가 끊기지 않도록 실행 확인

### 다온 — 프론트/게임 파트

- `frontend/src/main.jsx`: 화면과 미션 인터랙션 담당
- `frontend/src/styles.css`: 기록 보관소 분위기 UI 담당
- 제0장 인트로, 장별 기록 복원 화면, 단서 카드 클릭, 복원 완료 화면 개선

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

아두이노까지 같이 연결할 때는 `npm start` 전에 포트를 지정합니다.

PowerShell 예시:

```powershell
cd backend
npm install
$env:ARDUINO_PORT="COM3"
npm start
```

아두이노 포트는 Arduino IDE 오른쪽 아래나 장치 관리자에서 확인합니다.
포트를 설정하지 않으면 웹/DB 기능만 실행되고, 아두이노 전송은 자동으로 꺼집니다.

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
프론트의 기억 저장소 패널이 읽는 주소입니다. progress와 ledLevel을 보내줍니다.
아두이노는 이 주소를 직접 읽지 않고, 백엔드가 Serial로 ledLevel을 보내줍니다.

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
chapter: 스토리보드 장 번호
summary: 미션 카드와 상단 설명
storyQuote: 장면 분위기를 잡는 스토리 문장
instruction: 사용자가 해야 할 일
damagedRecord: 복원 전 기록
clues: 단서 카드 목록
officialNote: 공식 기록 비교 카드 문구
restoredText: 복원 완료 후 표시할 문장
rememberPoint: 최종 발표에서 말할 기억 포인트
nextRecord: 다음 기록 위치
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

1. `iot/arduino_bulb_control.ino`를 Arduino IDE에서 엽니다.
2. 아두이노 보드에 업로드합니다.
3. LED 또는 제어 모듈의 입력 핀을 5번 핀에 연결합니다.
4. 백엔드를 실행할 때 아두이노 포트를 지정합니다.

```powershell
$env:ARDUINO_PORT="COM3"
npm start
```

5. 웹에서 미션을 완료하면 백엔드가 Serial로 `0`, `1`, `2`, `3` 중 하나를 보냅니다.
6. 아두이노는 받은 숫자에 따라 5번 핀 PWM 밝기를 바꿉니다.

IoT가 실패해도 프론트 오른쪽의 `기억 저장소` 패널이 시뮬레이션 역할을 하므로 발표는 계속할 수 있습니다.

## 시연 흐름

1. 제0장 비상계엄 인트로를 보여주며 기록 보관소 시스템이 1980년 5월 17일 밤으로 되감겼다고 설명합니다.
2. 제1장 봉쇄된 대학 복원 → 복원률 33% → LED 1단계
3. 제2장 5.18 전남대 정문 복원 → 복원률 67% → LED 2단계
4. 제3장 시민항쟁의 전개 복원 → 복원률 100% → LED 3단계
5. 최종 화면에서 “현재로 복귀”와 기록 복원 완료 메시지를 확인합니다.
6. IoT 기억 저장소 LED가 복원률에 따라 밝아지는 모습 시연

## DB 저장 방식

진행도는 `backend/data/re518.sqlite`에 저장됩니다.

서버가 처음 실행될 때 자동으로 `progress` 테이블을 만듭니다.

```txt
user_id: 지금은 demo로 고정
mission_id: 완료한 미션 번호
completed_at: 완료 시간
```

`POST /api/reset`을 호출하면 demo 사용자의 완료 기록이 삭제됩니다.

## IoT 연결 방식

현재 IoT는 아두이노 USB Serial 방식입니다.

```txt
웹에서 미션 완료
→ 백엔드가 SQLite에 완료 기록 저장
→ 복원률 계산
→ ledLevel 계산
→ 아두이노 Serial로 ledLevel 전송
→ 아두이노 5번 핀 PWM 밝기 변경
```

아두이노가 받는 값:

```txt
0: 꺼짐
1: 약한 밝기
2: 중간 밝기
3: 최대 밝기
```

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
