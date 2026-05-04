import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

/*
  다온 파트: 프론트엔드 진입 파일

  이 파일은 화면 전체를 담당합니다.
  지금은 파일을 여러 컴포넌트로 쪼개지 않고 한 파일에 모아 두었습니다.
  이유는 팀원들이 처음 코드를 볼 때 "어디서 뭐가 움직이는지" 한눈에 보이게 하기 위해서입니다.

  나중에 시간이 남으면 아래처럼 분리하면 됩니다.
  - MissionList.jsx
  - RecordPanel.jsx
  - ProgressPanel.jsx
  - CompletePanel.jsx
*/

const API_BASE = "http://localhost:3001/api";

const storyIntro = {
  chapter: "제0장",
  title: "비상계엄",
  body:
    "현재의 기록 보관소에서 모든 기록을 확인하던 순간, 비상계엄령 사이렌이 울리고 시스템은 1980년 5월 17일 밤으로 되감깁니다. 검열·차단·왜곡으로 사라진 기록을 복원해야 다시 현재로 돌아올 수 있습니다.",
};

function App() {
  /*
    useState는 화면에서 변하는 값을 저장합니다.

    missions: 백엔드에서 받아온 미션 3개 목록
    selectedMissionId: 현재 사용자가 보고 있는 미션 id
    progress: 전체 복원률
    iotState: 기억 저장소 LED 상태
    selectedClueIds: 사용자가 현재 미션에서 선택한 단서 id 목록
    notice: 화면 하단에 보여줄 안내 문구
  */
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

  /*
    selectedMission은 현재 화면 중앙에 보여줄 미션입니다.
    useMemo는 missions나 selectedMissionId가 바뀔 때만 다시 계산하게 해 줍니다.
  */
  const selectedMission = useMemo(
    () => missions.find((mission) => mission.id === selectedMissionId) ?? missions[0],
    [missions, selectedMissionId],
  );

  const selectedClues = useMemo(() => {
    if (!selectedMission) {
      return [];
    }

    return selectedMission.clues.filter((clue) => selectedClueIds.includes(clue.id));
  }, [selectedMission, selectedClueIds]);

  const correctSelectedCount = selectedClues.filter((clue) => clue.correct).length;
  const wrongSelectedCount = selectedClues.filter((clue) => !clue.correct).length;
  const totalCorrectCount = selectedMission?.clues.filter((clue) => clue.correct).length ?? 0;

  async function loadState() {
    /*
      화면이 처음 열릴 때 백엔드에서 필요한 상태를 한 번에 가져옵니다.
      Promise.all을 쓰면 3개 요청을 동시에 보내서 조금 더 빠릅니다.
    */
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
    /*
      useEffect(..., [])는 화면이 처음 렌더링될 때 한 번만 실행됩니다.
      백엔드 서버가 꺼져 있으면 catch로 들어가서 실행 안내를 보여줍니다.
    */
    loadState().catch(() => {
      setNotice("백엔드 서버를 먼저 실행해야 합니다. backend 폴더에서 npm install 후 npm start를 실행하세요.");
    });
  }, []);

  useEffect(() => {
    /*
      미션을 바꿀 때 이전 미션에서 고른 단서가 남아 있으면 사용자가 헷갈립니다.
      그래서 미션 선택이 바뀔 때마다 단서 선택 상태를 비웁니다.
    */
    setSelectedClueIds([]);
  }, [selectedMissionId]);

  function toggleClue(clueId) {
    /*
      같은 단서를 다시 누르면 선택 해제됩니다.
      배열을 직접 수정하지 않고 새 배열을 반환해야 React가 화면을 다시 그립니다.
    */
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

    /*
      완료 조건:
      - correct: true인 단서를 전부 선택해야 함
      - correct: false인 단서는 하나도 선택하면 안 됨

      왜곡 정보 제거 미션이 가볍게 보이지 않도록,
      "내 생각으로 고르기"가 아니라 "공식 기록에 맞는 표현만 남기기" 구조로 둡니다.
    */
    return JSON.stringify(correctIds) === JSON.stringify(selectedIds);
  }

  function explainCurrentSelection() {
    if (selectedClueIds.length === 0) {
      return "단서를 선택하면 이곳에 검증 상태가 표시됩니다.";
    }

    if (wrongSelectedCount > 0) {
      return "공식 기록과 맞지 않는 단서가 섞여 있습니다. 선택한 단서의 설명을 확인하고 다시 검증하세요.";
    }

    if (correctSelectedCount < totalCorrectCount) {
      return `검증 가능한 단서 ${totalCorrectCount}개 중 ${correctSelectedCount}개를 찾았습니다. 아직 연결할 단서가 남아 있습니다.`;
    }

    return "필요한 단서를 모두 모았습니다. 이제 기록 복원을 완료할 수 있습니다.";
  }

  async function completeMission() {
    if (!selectedMission) {
      return;
    }

    if (!isMissionReadyToComplete()) {
      setNotice("공식 기록 비교 카드와 맞는 단서만 선택해야 복원이 완료됩니다.");
      return;
    }

    /*
      완료 버튼을 누르면 백엔드에 POST 요청을 보냅니다.
      백엔드는 SQLite DB를 갱신하고, 새 복원률과 LED 단계를 돌려줍니다.
    */
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
    setNotice(`${selectedMission.chapter} ${selectedMission.title} 복원이 완료되었습니다. ${selectedMission.nextRecord}`);
  }

  async function resetDemo() {
    /*
      발표 리허설 때 아주 중요합니다.
      시연을 여러 번 해야 하므로 버튼 하나로 복원률을 0%로 돌릴 수 있게 했습니다.
    */
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
  const canComplete = isMissionReadyToComplete();

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

      <section className="story-intro">
        <span>{storyIntro.chapter}</span>
        <div>
          <h2>{storyIntro.title}</h2>
          <p>{storyIntro.body}</p>
        </div>
      </section>

      <section className="dashboard-grid">
        <aside className="mission-list" aria-label="복원 대기 기록">
          <div className="panel-title">
            <span>Story Route</span>
            <h2>기록 복원 경로</h2>
          </div>

          {missions.map((mission) => (
            <button
              className={`mission-card ${mission.id === selectedMission.id ? "active" : ""}`}
              key={mission.id}
              onClick={() => setSelectedMissionId(mission.id)}
            >
              <span>
                {mission.code} · {mission.chapter}
              </span>
              <strong>{mission.title}</strong>
              <small>{mission.completed ? `복원 완료 · ${mission.nextRecord}` : mission.place}</small>
            </button>
          ))}
        </aside>

        <section className="record-panel">
          <div className="record-header">
            <p>
              {selectedMission.chapter} · {selectedMission.date} · {selectedMission.place}
            </p>
            <h2>{selectedMission.title}</h2>
            <span>{selectedMission.summary}</span>
          </div>

          <blockquote className="story-quote">{selectedMission.storyQuote}</blockquote>

          <article className="mission-brief">
            <strong>미션 안내</strong>
            <p>{selectedMission.instruction}</p>
          </article>

          <div className="record-compare">
            <article className="damaged-record">
              <span>복원 전</span>
              <p>{selectedMission.damagedRecord}</p>
            </article>

            <article className={`restored-record ${canComplete || selectedMission.completed ? "visible" : ""}`}>
              <span>복원 후</span>
              <p>{canComplete || selectedMission.completed ? selectedMission.restoredText : "올바른 단서를 모두 연결하면 복원 결과가 표시됩니다."}</p>
            </article>
          </div>

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
                    <strong>{clue.label}</strong>
                    <small>{selectedClueIds.includes(clue.id) ? clue.reason : "클릭해서 검증하기"}</small>
                  </button>
                ))}
              </div>
            </div>

            <aside className="official-note">
              <h3>공식 기록 비교 카드</h3>
              <p>{selectedMission.officialNote}</p>
              <div className="source-list">
                {selectedMission.sources?.map((source) => (
                  <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
                    {source.name}
                  </a>
                ))}
              </div>
            </aside>
          </div>

          <section className="selection-report">
            <div>
              <strong>검증 상태</strong>
              <p>{explainCurrentSelection()}</p>
            </div>
            <dl>
              <div>
                <dt>필요 단서</dt>
                <dd>{totalCorrectCount}</dd>
              </div>
              <div>
                <dt>선택한 공식 단서</dt>
                <dd>{correctSelectedCount}</dd>
              </div>
              <div>
                <dt>제외해야 할 단서</dt>
                <dd>{wrongSelectedCount}</dd>
              </div>
            </dl>
          </section>

          {(canComplete || selectedMission.completed) && (
            <section className="next-record">
              <strong>{selectedMission.nextRecord}</strong>
              <p>{selectedMission.rememberPoint}</p>
            </section>
          )}

          <footer className="record-actions">
            <button className="primary-button" onClick={completeMission}>
              선택한 단서로 기록 복원
            </button>
            <p>{notice}</p>
          </footer>
        </section>

        <aside className="progress-panel">
          <div className="panel-title">
            <span>Memory Storage</span>
            <h2>복원 진행률</h2>
          </div>
          <div className="progress-ring" style={{ "--progress": `${progress}%` }}>
            <span>{progress}%</span>
          </div>
          <div className={`memory-box level-${iotState.ledLevel}`}>
            <span>기억 저장소</span>
            <strong>{iotState.message}</strong>
            <small>LED 단계 {iotState.ledLevel}</small>
          </div>
          <p className="iot-caption">
            백엔드는 복원률을 SQLite에 저장하고, 아두이노 Serial로 LED 단계 값을 보냅니다.
          </p>
        </aside>
      </section>

      {allCompleted && (
        <section className="complete-panel">
          <h2>현재로 복귀</h2>
          <p>
            봉쇄된 대학, 전남대 정문, 광주 시내의 기록이 다시 연결되었습니다.
            사라진 기록을 복원한 뒤 시스템은 현재 시점으로 돌아옵니다.
          </p>
          <strong>오늘 우리가 기억해야 할 점</strong>
          <p>기록은 지워질 수 있지만, 검증된 기록과 증언을 연결하면 잊힌 진실은 다시 나타날 수 있습니다.</p>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
