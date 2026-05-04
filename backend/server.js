const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3001;
const DEMO_USER_ID = "demo";

/*
  대훈 파트: Express 서버 기본 설정

  Express는 "웹 요청을 받으면 JSON을 돌려주는 서버"라고 보면 됩니다.
  프론트엔드는 localhost:5173, 백엔드는 localhost:3001에서 실행됩니다.
  포트가 다르면 브라우저가 요청을 막을 수 있어서 cors()를 켜 둡니다.
*/
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, "data");
const missionsPath = path.join(dataDir, "missions.json");
const databasePath = path.join(dataDir, "re518.sqlite");

/*
  민욱 파트: SQLite DB 연결

  기존에는 progress.json 파일에 완료한 미션 id를 저장했습니다.
  이제는 SQLite DB의 progress 테이블에 저장합니다.

  장점:
  - "DB 사용"을 발표에서 말할 수 있습니다.
  - 미션 완료 기록이 한 줄씩 남습니다.
  - 나중에 user_id를 실제 로그인 사용자로 바꾸기 쉽습니다.
*/
const db = new sqlite3.Database(databasePath);

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initDatabase() {
  /*
    progress 테이블 설명:

    user_id:
    지금은 demo 한 명으로 고정합니다. 로그인 만들 시간이 없기 때문입니다.

    mission_id:
    완료한 미션 번호입니다.

    completed_at:
    언제 완료했는지 남기는 시간입니다. 발표 때 "DB에 기록이 남는다"고 설명하기 좋습니다.

    PRIMARY KEY(user_id, mission_id):
    같은 사용자가 같은 미션을 여러 번 완료해도 DB에 중복 저장되지 않게 막습니다.
  */
  await dbRun(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id TEXT NOT NULL,
      mission_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, mission_id)
    )
  `);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    /*
      시연 중 JSON 파일이 없거나 깨졌을 때 서버가 바로 죽으면 발표가 끊깁니다.
      그래서 fallback을 돌려주고, 터미널에는 원인을 찍어 둡니다.
    */
    console.error(`Failed to read ${filePath}:`, error.message);
    return fallback;
  }
}

function getMissions() {
  return readJson(missionsPath, []);
}

async function getCompletedMissionIds(userId = DEMO_USER_ID) {
  const rows = await dbAll(
    "SELECT mission_id FROM progress WHERE user_id = ? ORDER BY mission_id ASC",
    [userId],
  );

  return rows.map((row) => row.mission_id);
}

async function markMissionComplete(missionId, userId = DEMO_USER_ID) {
  /*
    INSERT OR IGNORE는 이미 완료한 미션이면 아무것도 하지 않습니다.
    덕분에 버튼을 여러 번 눌러도 복원률이 중복으로 올라가지 않습니다.
  */
  await dbRun(
    "INSERT OR IGNORE INTO progress (user_id, mission_id) VALUES (?, ?)",
    [userId, missionId],
  );
}

async function resetProgress(userId = DEMO_USER_ID) {
  await dbRun("DELETE FROM progress WHERE user_id = ?", [userId]);
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
  */
  return Math.round((completedMissionIds.length / missions.length) * 100);
}

function getLedLevel(progress) {
  /*
    건호 IoT 파트와 연결되는 함수입니다.

    아두이노 코드는 Serial로 0, 1, 2, 3 중 하나를 받습니다.
    이 함수가 복원률을 아두이노 LED 단계로 바꿔 줍니다.
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

async function buildMissionResponse() {
  const missions = getMissions();
  const completedMissionIds = await getCompletedMissionIds();
  const completedSet = new Set(completedMissionIds);

  /*
    missions.json은 미션 원본 데이터만 가지고 있습니다.
    completed 여부는 SQLite DB를 보고 그때그때 붙입니다.
  */
  return missions.map((mission) => ({
    ...mission,
    completed: completedSet.has(mission.id),
  }));
}

/*
  건호 IoT 파트: 아두이노 Serial 연결

  ESP32 Wi-Fi 방식 대신 Arduino UNO 같은 보드가 USB Serial로 값을 받는 방식입니다.

  실행 전 PowerShell에서 예를 들어 이렇게 설정합니다.
  $env:ARDUINO_PORT="COM3"
  npm start

  ARDUINO_PORT를 설정하지 않으면 서버는 그냥 웹/DB 기능만 실행됩니다.
  즉, 아두이노가 없어도 프론트 시연은 가능합니다.
*/
let arduinoPort = null;
let arduinoStatus = "disabled";

function initArduinoSerial() {
  const portPath = process.env.ARDUINO_PORT;

  if (!portPath) {
    console.log("Arduino serial disabled. Set ARDUINO_PORT=COM3 to enable it.");
    return;
  }

  try {
    const { SerialPort } = require("serialport");

    arduinoPort = new SerialPort({
      path: portPath,
      baudRate: 9600,
      autoOpen: false,
    });

    arduinoPort.open((error) => {
      if (error) {
        arduinoStatus = "error";
        console.error(`Arduino serial open failed on ${portPath}:`, error.message);
        return;
      }

      arduinoStatus = "connected";
      console.log(`Arduino serial connected on ${portPath}`);
    });

    arduinoPort.on("error", (error) => {
      arduinoStatus = "error";
      console.error("Arduino serial error:", error.message);
    });

    arduinoPort.on("close", () => {
      arduinoStatus = "closed";
      console.log("Arduino serial closed");
    });
  } catch (error) {
    arduinoStatus = "missing dependency";
    console.error("serialport package is not available:", error.message);
  }
}

function sendLedLevelToArduino(ledLevel) {
  /*
    아두이노 코드는 readStringUntil('\n')으로 한 줄을 읽습니다.
    그래서 "2\n"처럼 숫자와 줄바꿈을 같이 보내야 합니다.
  */
  if (!arduinoPort || !arduinoPort.isOpen) {
    return;
  }

  arduinoPort.write(`${ledLevel}\n`, (error) => {
    if (error) {
      arduinoStatus = "error";
      console.error("Failed to write LED level to Arduino:", error.message);
    }
  });
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "RE:518 backend",
    database: "sqlite",
    arduinoStatus,
  });
});

app.get("/api/missions", asyncRoute(async (req, res) => {
  res.json(await buildMissionResponse());
}));

app.get("/api/missions/:id", asyncRoute(async (req, res) => {
  const missionId = Number(req.params.id);
  const mission = (await buildMissionResponse()).find((item) => item.id === missionId);

  if (!mission) {
    return res.status(404).json({
      success: false,
      message: "미션을 찾을 수 없습니다.",
    });
  }

  res.json(mission);
}));

app.post("/api/missions/:id/complete", asyncRoute(async (req, res) => {
  /*
    프론트에서 "선택한 단서로 기록 복원" 버튼을 누르면 호출됩니다.
    완료 기록은 SQLite DB에 저장하고, 새 LED 단계는 아두이노로 바로 보냅니다.
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

  await markMissionComplete(missionId);

  const completedMissionIds = await getCompletedMissionIds();
  const progress = calculateProgress(missions, completedMissionIds);
  const ledLevel = getLedLevel(progress);

  sendLedLevelToArduino(ledLevel);

  res.json({
    success: true,
    progress,
    ledLevel,
    message: getIotMessage(progress),
    arduinoStatus,
    missions: await buildMissionResponse(),
  });
}));

app.get("/api/progress", asyncRoute(async (req, res) => {
  const missions = getMissions();
  const completedMissionIds = await getCompletedMissionIds();
  const progress = calculateProgress(missions, completedMissionIds);

  res.json({
    progress,
    completedMissionIds,
    totalMissions: missions.length,
  });
}));

app.get("/api/iot/state", asyncRoute(async (req, res) => {
  /*
    프론트의 기억 저장소 패널이 읽는 API입니다.
    아두이노 자체는 이 API를 직접 읽지 않고, 백엔드가 Serial로 값을 보내 줍니다.
  */
  const missions = getMissions();
  const completedMissionIds = await getCompletedMissionIds();
  const progress = calculateProgress(missions, completedMissionIds);

  res.json({
    progress,
    ledLevel: getLedLevel(progress),
    message: getIotMessage(progress),
    arduinoStatus,
  });
}));

app.post("/api/reset", asyncRoute(async (req, res) => {
  await resetProgress();
  sendLedLevelToArduino(0);

  res.json({
    success: true,
    progress: 0,
    ledLevel: 0,
    message: "복원 상태가 초기화되었습니다.",
    arduinoStatus,
    missions: await buildMissionResponse(),
  });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    success: false,
    message: "서버 처리 중 오류가 발생했습니다.",
  });
});

initDatabase()
  .then(() => {
    initArduinoSerial();

    app.listen(PORT, () => {
      console.log(`RE:518 backend running on http://localhost:${PORT}`);
      console.log(`SQLite database: ${databasePath}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
