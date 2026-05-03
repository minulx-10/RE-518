import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = "http://localhost:3001/api";

function App() {
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [iotState, setIotState] = useState({
    progress: 0,
    ledLevel: 0,
    message: "복원 대기 중",
  });
  const [selectedClueIds, setSelectedClueIds] = useState([]);
  const [notice, setNotice] = useState("복원 대기 중인 기록을 선택하세요.");

  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) ?? missions[0],
    [missions, selectedMissionId],
  );

  async function loadState() {
    const [missionsResponse, progressResponse, iotResponse] = await Promise.all([
      fetch(`${API_BASE}/missions`),
      fetch(`${API_BASE}/progress`),
      fetch(`${API_BASE}/iot/state`),
    ]);

    const nextMissions = await missionsResponse.json();
    const nextProgress = await progressResponse.json();
    const nextIotState = await iotResponse.json();

    setMissions(nextMissions);
    setProgress(nextProgress.progress);
    setIotState(nextIotState);

    if (!selectedMissionId && nextMissions.length > 0) {
      setSelectedMissionId(nextMissions[0].id);
    }
  }

  useEffect(() => {
    loadState().catch(() => {
      setNotice("백엔드 서버를 먼저 실행해야 합니다. backend 폴더에서 npm start를 실행하세요.");
    });
  }, []);

  useEffect(() => {
    // 미션을 바꿀 때 이전 미션에서 고른 단서가 남아 있으면 헷갈리므로 초기화합니다.
    setSelectedClueIds([]);
  }, [selectedMissionId]);

  function toggleClue(clueId) {
    setSelectedClueIds((current) =>
      current.includes(clueId) ? current.filter((id) => id !== clueId) : [...current, clueId],
    );
  }

  function isMissionReadyToComplete() {
    if (!selectedMission) {
      return false;
    }

    const correctIds = selectedMission.clues
      .filter((clue) => clue.correct)
      .map((clue) => clue.id)
      .sort();

    const selectedIds = [...selectedClueIds].sort();

    // 정답 단서를 모두 고르고, 오답 단서는 고르지 않았을 때만 완료할 수 있습니다.
    return JSON.stringify(correctIds) === JSON.stringify(selectedIds);
  }

  async function completeMission() {
    if (!selectedMission) {
      return;
    }

    if (!isMissionReadyToComplete()) {
      setNotice("공식 기록 비교 카드와 맞는 단서만 선택해야 복원이 완료됩니다.");
      return;
    }

    const response = await fetch(`${API_BASE}/missions/${selectedMission.id}/complete`, {
      method: "POST",
    });
    const result = await response.json();

    setMissions(result.missions);
    setProgress(result.progress);
    setIotState({
      progress: result.progress,
      ledLevel: result.ledLevel,
      message: result.message,
    });
    setNotice(`${selectedMission.title} 복원이 완료되었습니다.`);
  }

  async function resetDemo() {
    const response = await fetch(`${API_BASE}/reset`, {
      method: "POST",
    });
    const result = await response.json();

    setMissions(result.missions);
    setProgress(result.progress);
    setIotState({
      progress: result.progress,
      ledLevel: result.ledLevel,
      message: result.message,
    });
    setSelectedClueIds([]);
    setNotice("시연 상태를 0%로 초기화했습니다.");
  }

  if (missions.length === 0) {
    return (
      <main className="app-shell">
        <section className="empty-state">
          <p>{notice}</p>
        </section>
      </main>
    );
  }

  const allCompleted = progress === 100;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">5·18 기록 복원 체험형 아카이브</p>
          <h1>RE:518 — 사라진 기록 복원소</h1>
        </div>
        <button className="ghost-button" onClick={resetDemo}>
          시연 초기화
        </button>
      </header>

      <section className="dashboard-grid">
        <aside className="mission-list" aria-label="복원 대기 기록">
          <h2>복원 대기 중인 기록</h2>
          {missions.map((mission) => (
            <button
              className={`mission-card ${mission.id === selectedMission.id ? "active" : ""}`}
              key={mission.id}
              onClick={() => setSelectedMissionId(mission.id)}
            >
              <span>{mission.code}</span>
              <strong>{mission.title}</strong>
              <small>{mission.completed ? "복원 완료" : "미복원"}</small>
            </button>
          ))}
        </aside>

        <section className="record-panel">
          <div className="record-header">
            <p>{selectedMission.date} · {selectedMission.place}</p>
            <h2>{selectedMission.title}</h2>
          </div>

          <article className="damaged-record">
            <p>{selectedMission.damagedRecord}</p>
          </article>

          <div className="clue-area">
            <div>
              <h3>단서 카드</h3>
              <div className="clue-grid">
                {selectedMission.clues.map((clue) => (
                  <button
                    className={`clue-card ${selectedClueIds.includes(clue.id) ? "selected" : ""}`}
                    key={clue.id}
                    onClick={() => toggleClue(clue.id)}
                  >
                    {clue.label}
                  </button>
                ))}
              </div>
            </div>

            <aside className="official-note">
              <h3>공식 기록 비교 카드</h3>
              <p>{selectedMission.officialNote}</p>
            </aside>
          </div>

          <footer className="record-actions">
            <button className="primary-button" onClick={completeMission}>
              선택한 단서로 기록 복원
            </button>
            <p>{notice}</p>
          </footer>
        </section>

        <aside className="progress-panel">
          <h2>복원 진행률</h2>
          <div className="progress-ring" style={{ "--progress": `${progress}%` }}>
            <span>{progress}%</span>
          </div>
          <div className={`memory-box level-${iotState.ledLevel}`}>
            <span>기억 저장소</span>
            <strong>{iotState.message}</strong>
            <small>LED 단계 {iotState.ledLevel}</small>
          </div>
        </aside>
      </section>

      {allCompleted && (
        <section className="complete-panel">
          <h2>복원 완료</h2>
          <p>
            이 기록은 1980년 5월 광주에서 남겨진 증언과 공식 기록을 바탕으로 재구성되었습니다.
            기록은 지워질 수 있지만, 다시 연결될 수 있습니다.
          </p>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
