const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3001;

// 프론트엔드가 다른 포트(localhost:5173)에서 접속하므로 CORS를 열어둡니다.
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, "data");
const missionsPath = path.join(dataDir, "missions.json");
const progressPath = path.join(dataDir, "progress.json");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    // 시연 중 파일이 없거나 깨졌을 때 서버가 바로 죽지 않도록 기본값을 돌려줍니다.
    console.error(`Failed to read ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, value) {
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

  // 미션 3개 기준으로 33%, 67%, 100%가 나오게 반올림합니다.
  return Math.round((completedMissionIds.length / missions.length) * 100);
}

function getLedLevel(progress) {
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

  return missions.map((mission) => ({
    ...mission,
    completed: completedSet.has(mission.id),
  }));
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "RE:518 backend",
  });
});

app.get("/api/missions", (req, res) => {
  res.json(buildMissionResponse());
});

app.get("/api/missions/:id", (req, res) => {
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
  const missions = getMissions();
  const progressState = getProgressState();
  const progress = calculateProgress(missions, progressState.completedMissionIds);

  // ESP32는 이 응답에서 progress 또는 ledLevel만 읽으면 됩니다.
  res.json({
    progress,
    ledLevel: getLedLevel(progress),
    message: getIotMessage(progress),
  });
});

app.post("/api/reset", (req, res) => {
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
