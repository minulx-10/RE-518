const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

/*
  대훈 파트: Express 서버 기본 설정

  Express는 "웹 요청을 받으면 JSON을 돌려주는 서버"라고 보면 됩니다.
  프론트엔드는 localhost:5173에서 실행되고, 백엔드는 localhost:3001에서 실행됩니다.
  포트가 다르면 브라우저가 기본적으로 요청을 막을 수 있어서 cors()를 켜 둡니다.
*/
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, "data");
const missionsPath = path.join(dataDir, "missions.json");
const progressPath = path.join(dataDir, "progress.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    /*
      시연 중 JSON 파일이 없거나 깨졌을 때 서버가 바로 죽으면 발표가 끊깁니다.
      그래서 fallback을 돌려주고, 터미널에는 원인을 찍어 둡니다.
      세윤이 디버깅할 때는 이 console.error 메시지를 먼저 보면 됩니다.
    */
    console.error(`Failed to read ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, value) {
  // JSON.stringify의 세 번째 인자 2는 파일을 사람이 읽기 좋게 줄바꿈/들여쓰기 해 줍니다.
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function getMissions() {
  return readJson(missionsPath, []);
}

function getProgressState() {
  return readJson(progressPath, { completedMissionIds: [] });
}

function saveProgressState(state) {
  writeJson(progressPath, state);
}

function calculateProgress(missions, completedMissionIds) {
  if (missions.length === 0) {
    return 0;
  }

  /*
    민욱 파트: 복원률 계산

    미션 3개라면:
    - 1개 완료: 33%
    - 2개 완료: 67%
    - 3개 완료: 100%

    Math.round를 쓰는 이유는 2/3이 66.666...이라서 화면에 67%로 보이게 하기 위함입니다.
  */
  return Math.round((completedMissionIds.length / missions.length) * 100);
}

function getLedLevel(progress) {
  /*
    건호 IoT 파트와 연결되는 함수입니다.

    프론트와 ESP32가 둘 다 ledLevel을 읽으면 됩니다.
    0: 꺼짐
    1: 약한 빛
    2: 중간 빛
    3: 최대 밝기
  */
  if (progress === 0) return 0;
  if (progress < 50) return 1;
  if (progress < 100) return 2;
  return 3;
}

function getIotMessage(progress) {
  if (progress === 0) return "복원 대기 중";
  if (progress < 100) return "기록 복원 중";
  return "기록 복원 완료";
}

function buildMissionResponse() {
  const missions = getMissions();
  const progressState = getProgressState();
  const completedSet = new Set(progressState.completedMissionIds);

  /*
    missions.json은 원본 미션 데이터만 가지고 있습니다.
    completed 여부는 progress.json을 보고 그때그때 붙입니다.
    이렇게 나누면 미션 내용과 진행 상태가 섞이지 않아 수정하기 쉽습니다.
  */
  return missions.map((mission) => ({
    ...mission,
    completed: completedSet.has(mission.id),
  }));
}

app.get("/api/health", (req, res) => {
  // 서버가 살아 있는지 빠르게 확인하는 주소입니다. 브라우저에서 /api/health를 열어 보면 됩니다.
  res.json({
    ok: true,
    service: "RE:518 backend",
  });
});

app.get("/api/missions", (req, res) => {
  // 다온 프론트에서 미션 카드 목록을 그릴 때 쓰는 API입니다.
  res.json(buildMissionResponse());
});

app.get("/api/missions/:id", (req, res) => {
  // 특정 미션 하나만 보고 싶을 때 쓰는 API입니다. 예: /api/missions/1
  const missionId = Number(req.params.id);
  const mission = buildMissionResponse().find((item) => item.id === missionId);

  if (!mission) {
    return res.status(404).json({
      success: false,
      message: "미션을 찾을 수 없습니다.",
    });
  }

  res.json(mission);
});

app.post("/api/missions/:id/complete", (req, res) => {
  /*
    프론트에서 "선택한 단서로 기록 복원" 버튼을 누르면 호출됩니다.
    실제 서비스라면 userId도 받아야 하지만, 해커톤 시연 MVP에서는 한 명의 demo 사용자처럼 처리합니다.
  */
  const missionId = Number(req.params.id);
  const missions = getMissions();
  const mission = missions.find((item) => item.id === missionId);

  if (!mission) {
    return res.status(404).json({
      success: false,
      message: "미션을 찾을 수 없습니다.",
    });
  }

  const progressState = getProgressState();
  const completedMissionIds = new Set(progressState.completedMissionIds);

  // 같은 미션을 여러 번 눌러도 복원률이 중복으로 올라가지 않게 Set으로 관리합니다.
  completedMissionIds.add(missionId);

  const nextState = {
    completedMissionIds: Array.from(completedMissionIds).sort((a, b) => a - b),
  };

  saveProgressState(nextState);

  const progress = calculateProgress(missions, nextState.completedMissionIds);

  res.json({
    success: true,
    progress,
    ledLevel: getLedLevel(progress),
    message: getIotMessage(progress),
    missions: buildMissionResponse(),
  });
});

app.get("/api/progress", (req, res) => {
  // 프론트 오른쪽 복원률 패널이 이 값을 사용합니다.
  const missions = getMissions();
  const progressState = getProgressState();
  const progress = calculateProgress(missions, progressState.completedMissionIds);

  res.json({
    progress,
    completedMissionIds: progressState.completedMissionIds,
    totalMissions: missions.length,
  });
});

app.get("/api/iot/state", (req, res) => {
  /*
    건호 IoT 파트에서 가장 중요한 API입니다.

    ESP32는 복잡한 미션 데이터를 알 필요가 없습니다.
    그냥 1초마다 이 주소를 확인하고 ledLevel만 읽어서 LED 밝기를 바꾸면 됩니다.
  */
  const missions = getMissions();
  const progressState = getProgressState();
  const progress = calculateProgress(missions, progressState.completedMissionIds);

  res.json({
    progress,
    ledLevel: getLedLevel(progress),
    message: getIotMessage(progress),
  });
});

app.post("/api/reset", (req, res) => {
  // 발표 리허설이나 실제 발표 직전에 복원률을 0%로 되돌리는 버튼용 API입니다.
  saveProgressState({ completedMissionIds: [] });

  res.json({
    success: true,
    progress: 0,
    ledLevel: 0,
    message: "복원 상태가 초기화되었습니다.",
    missions: buildMissionResponse(),
  });
});

app.listen(PORT, () => {
  console.log(`RE:518 backend running on http://localhost:${PORT}`);
});
