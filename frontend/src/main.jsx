import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Terminal, Cpu, Database, AlertTriangle, ShieldCheck, ShieldAlert, Zap } from "lucide-react";
import "./styles.css";

const API_BASE = "http://localhost:3001/api";

function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([]);
  const bootLogs = [
    "ARCHIVE OS v1.0.5 BOOTING...",
    "MEMORY CHECK: 640K OK",
    "LOADING KERNEL...",
    "CONNECTING TO DATABASE [re518.sqlite]...",
    "WARNING: UNAUTHORIZED CENSORSHIP DETECTED",
    "INITIALIZING TIME ATTEMPT PROTOCOL...",
    "RESTORING SYSTEM TO 1980-05-17 23:59:00...",
    "ACCESS GRANTED."
  ];

  useEffect(() => {
    let currentLine = 0;
    const interval = setInterval(() => {
      const lineToAdd = bootLogs[currentLine];
      setLines(prev => [...prev, lineToAdd]);
      currentLine++;
      if (currentLine >= bootLogs.length) {
        clearInterval(interval);
        setTimeout(onComplete, 1000);
      }
    }, 400); // 400ms 마다 한 줄씩 타이핑 효과
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="boot-screen">
      {lines.map((line, i) => (
        <div key={i} className={line?.includes("WARNING") ? "glow-text" : ""} style={{ color: line?.includes("WARNING") ? "var(--term-danger)" : "var(--term-primary)" }}>
          {"> "}{line}
        </div>
      ))}
      <div className="glitch-text" style={{ marginTop: "2rem", opacity: lines.length === bootLogs.length ? 1 : 0 }} data-text="SYSTEM READY">SYSTEM READY_</div>
    </div>
  );
}

function App() {
  const [booting, setBooting] = useState(true);
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [iotState, setIotState] = useState({ progress: 0, ledLevel: 0, message: "대기 중" });
  const [selectedClueIds, setSelectedClueIds] = useState([]);
  const [fetchError, setFetchError] = useState(false); // 추가: 백엔드 연결 에러 상태
  
  // 고도화 로직 상태
  const [timeLeft, setTimeLeft] = useState(60);
  const [iotInput, setIotInput] = useState(0);
  const [isFrequencyMatched, setIsFrequencyMatched] = useState(true);
  const [frequencyOverride, setFrequencyOverride] = useState(false); // 추가: 수동 오버라이드
  const [glitchActive, setGlitchActive] = useState(true);
  
  // Drag & Drop 상태
  const [draggedClue, setDraggedClue] = useState(null);

  const selectedMission = useMemo(() => missions.find((m) => m.id === selectedMissionId) ?? missions[0], [missions, selectedMissionId]);
  const selectedClues = useMemo(() => selectedMission ? selectedMission.clues.filter((c) => selectedClueIds.includes(c.id)) : [], [selectedMission, selectedClueIds]);
  const totalCorrectCount = selectedMission?.clues.filter((c) => c.correct).length ?? 0;

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/missions`).then(r => r.json()),
      fetch(`${API_BASE}/progress`).then(r => r.json()),
      fetch(`${API_BASE}/iot/state`).then(r => r.json())
    ]).then(([missionsData, progressData, iotData]) => {
      setMissions(missionsData);
      if (missionsData.length > 0) setSelectedMissionId(missionsData[0].id);
      setProgress(progressData.progress);
      setIotState(iotData);
    }).catch(err => {
      console.error("Backend fetch error:", err);
      setFetchError(true);
    });
  }, []);

  useEffect(() => {
    setSelectedClueIds([]);
    setTimeLeft(60);
    setGlitchActive(true);
    setFrequencyOverride(false); // 미션 변경 시 오버라이드 초기화
  }, [selectedMissionId]);

  useEffect(() => {
    if (booting) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
      fetch(`${API_BASE}/iot/input`).then(r => r.json()).then(data => {
        setIotInput(data.value);
        if (selectedMission?.id === 2 && !selectedMission.completed) {
          setIsFrequencyMatched(data.value >= 500 && data.value <= 600);
        } else {
          setIsFrequencyMatched(true);
        }
      }).catch(() => {});
    }, 1000);
    return () => clearInterval(timer);
  }, [selectedMission, booting]);

  // 글자를 깨뜨리는 마스킹 함수
  function maskRecordText(text) {
    if (!text || selectedMission?.completed) return text;
    const maskRatio = Math.max(0, (60 - timeLeft) / 60);
    if (maskRatio === 0) return text;
    
    return text.split("").map((char) => {
      if (char === " " || char === "\n") return char;
      return Math.random() < maskRatio ? "█" : char;
    }).join("");
  }

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e, clue) => {
    setDraggedClue(clue);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (draggedClue && !selectedClueIds.includes(draggedClue.id)) {
      setSelectedClueIds(prev => [...prev, draggedClue.id]);
    }
    setDraggedClue(null);
  };

  function isMissionReadyToComplete() {
    if (!selectedMission) return false;
    const correctIds = selectedMission.clues.filter(c => c.correct).map(c => c.id).sort();
    const selectedIds = [...selectedClueIds].sort();
    return JSON.stringify(correctIds) === JSON.stringify(selectedIds);
  }

  async function completeMission() {
    const actuallyMatched = isFrequencyMatched || frequencyOverride;
    if (!actuallyMatched || timeLeft <= 0 || !isMissionReadyToComplete()) return;
    
    const res = await fetch(`${API_BASE}/missions/${selectedMission.id}/complete`, { method: "POST" });
    const result = await res.json();
    setMissions(result.missions);
    setProgress(result.progress);
    setIotState({ progress: result.progress, ledLevel: result.ledLevel, message: result.message });
    setGlitchActive(false);
  }

  async function resetDemo() {
    const res = await fetch(`${API_BASE}/reset`, { method: "POST" });
    const result = await res.json();
    setMissions(result.missions);
    setProgress(result.progress);
    setIotState({ progress: result.progress, ledLevel: result.ledLevel, message: result.message });
    setSelectedClueIds([]);
  }

  if (booting) return <BootSequence onComplete={() => setBooting(false)} />;
  
  if (fetchError) {
    return (
      <div className="terminal-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--term-danger)' }}>
        <AlertTriangle size={64} style={{ marginBottom: '1rem' }} />
        <h1 className="glitch-text" data-text="CONNECTION ERROR">CONNECTION ERROR</h1>
        <p style={{ marginTop: '1rem', fontSize: '1.2rem', color: 'var(--term-white)' }}>
          백엔드 서버(localhost:3001)에 연결할 수 없습니다.
        </p>
        <p style={{ marginTop: '0.5rem', color: 'var(--term-primary-dim)' }}>
          터미널을 열고 backend 폴더에서 npm start를 실행했는지 확인하세요.
        </p>
      </div>
    );
  }

  if (missions.length === 0) return <div className="terminal-container" style={{color: 'var(--term-primary)'}}>LOADING DATA...</div>;

  const canComplete = isMissionReadyToComplete();
  const allCompleted = progress === 100;

  return (
    <>
      <div className="crt-overlay"></div>
      <div className="terminal-container">
        
        <header className="sys-header">
          <div>
            <h1 className="glow-text"><Terminal size={36} style={{display:'inline', marginBottom:'-4px'}}/> ARCHIVE_SYS RE:518</h1>
            <div className="sys-meta">
              <span><Database size={16}/> SYSTEM: re518.sqlite</span>
              <span><Cpu size={16}/> IOT_PORT: {iotState.arduinoStatus}</span>
            </div>
          </div>
          <button className="ghost-button" onClick={resetDemo} style={{border: '1px solid var(--term-primary-dim)', color: 'var(--term-primary)', padding: '0.5rem 1rem', background: 'transparent', cursor: 'pointer'}}>
            <Zap size={14} style={{marginRight: '8px'}}/> SYSTEM RESET
          </button>
        </header>

        {allCompleted ? (
          <div className="panel" style={{textAlign: 'center', justifyContent: 'center'}}>
            <h2 className="glitch-text" data-text="SYSTEM RESTORED" style={{fontSize: '4rem', color: 'var(--term-primary)', marginBottom: '2rem'}}>SYSTEM RESTORED</h2>
            <p style={{fontSize: '1.5rem', color: 'var(--term-white)'}}>모든 기록이 복원되었습니다. 왜곡된 역사가 정화되었습니다.</p>
          </div>
        ) : (
          <div className="main-grid">
            
            {/* Left Panel: Missions */}
            <aside className="panel">
              <div className="panel-title"><ShieldCheck size={20}/> RECORDS_AVAILABLE</div>
              {missions.map(m => (
                <button 
                  key={m.id} 
                  className={`mission-btn ${m.id === selectedMission.id ? 'active' : ''}`}
                  onClick={() => setSelectedMissionId(m.id)}
                >
                  <span style={{fontSize: '0.8rem', opacity: 0.8}}>{m.code} / {m.chapter}</span>
                  <strong style={{fontSize: '1.2rem'}}>{m.title}</strong>
                  <span style={{fontSize: '0.9rem'}}>{m.completed ? '[RESTORED]' : '[CORRUPTED]'}</span>
                </button>
              ))}
            </aside>

            {/* Center Panel: Restoration & Drag/Drop */}
            <section className="panel record-board">
              <div className="panel-title"><Terminal size={20}/> SECTOR: {selectedMission.chapter}</div>
              <blockquote className="story-quote">{selectedMission.storyQuote}</blockquote>
              
              <div className={`timer-display ${timeLeft < 20 ? 'danger' : ''}`}>
                <span>TIME_REMAINING</span>
                <span>00:{timeLeft.toString().padStart(2, '0')}</span>
              </div>

              <div className="dnd-container">
                {/* Clue Pool (Draggable) */}
                <div className="clue-pool">
                  <h3 style={{fontSize: '1rem', color: 'var(--term-white)', borderBottom: '1px solid var(--term-primary-dim)', paddingBottom: '0.5rem'}}>DATA_CHIPS (DRAG)</h3>
                  {selectedMission.clues.filter(c => !selectedClueIds.includes(c.id)).map(clue => (
                    <div 
                      key={clue.id} 
                      className="draggable-clue"
                      draggable
                      onDragStart={(e) => handleDragStart(e, clue)}
                    >
                      <Database size={16}/> {clue.label}
                    </div>
                  ))}
                </div>

                {/* Drop Zone (Damaged Record) */}
                <div 
                  className={`drop-zone ${selectedMission.completed ? '' : 'drag-over'}`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <h3 style={{fontSize: '1rem', color: 'var(--term-white)', borderBottom: '1px solid var(--term-primary-dim)', paddingBottom: '0.5rem'}}>
                    {selectedMission.completed ? "CLEAN_DATA" : "CORRUPTED_DATA (DROP HERE)"}
                  </h3>
                  <p className={`damaged-text ${glitchActive ? 'glitch-text' : ''}`} data-text="CORRUPTED">
                    {selectedMission.completed ? selectedMission.restoredText : maskRecordText(selectedMission.damagedRecord)}
                  </p>
                  
                  <div style={{marginTop: '1rem'}}>
                    {selectedClues.map(clue => (
                      <div key={clue.id} className="matched-clue">
                        {clue.correct ? <ShieldCheck size={16}/> : <AlertTriangle size={16} color="var(--term-danger)"/>}
                        {clue.label}: {clue.reason}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedMission.id === 2 && !(isFrequencyMatched || frequencyOverride) && !selectedMission.completed && (
                <div style={{ background: 'rgba(255,51,51,0.2)', padding: '1rem', color: 'var(--term-danger)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--term-danger)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <ShieldAlert size={24}/>
                    <div>
                      <strong>FREQ_ERROR:</strong> 아두이노 라디오 다이얼을 500-600으로 맞추십시오 (현재: {iotInput})
                    </div>
                  </div>
                  <button 
                    onClick={() => setFrequencyOverride(true)} 
                    style={{ background: 'var(--term-danger)', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 'bold', borderRadius: '4px' }}
                  >
                    [OVERRIDE]
                  </button>
                </div>
              )}

              <button 
                className="action-btn" 
                disabled={!canComplete || selectedMission.completed || !(isFrequencyMatched || frequencyOverride) || timeLeft <= 0}
                onClick={completeMission}
              >
                {selectedMission.completed ? "ALREADY RESTORED" : "EXECUTE RESTORATION"}
              </button>
            </section>

            {/* Right Panel: Progress & System Status */}
            <aside className="panel">
              <div className="panel-title"><Cpu size={20}/> SYSTEM_STATUS</div>
              
              <div className="progress-ring-container">
                <div className="progress-circle" style={{ '--prog': `${progress}%` }}>
                  <span className="progress-value">{progress}%</span>
                </div>
              </div>

              <div className="iot-status">
                <div style={{marginBottom: '0.5rem', opacity: 0.8}}>IOT_MODULE</div>
                <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{iotState.message}</div>
                <div style={{marginTop: '0.5rem'}}>LED_LEVEL: {iotState.ledLevel}</div>
              </div>

              <div style={{marginTop: 'auto', borderTop: '1px solid var(--term-primary-dim)', paddingTop: '1rem', color: 'var(--term-primary-dim)', fontSize: '0.85rem'}}>
                <p>&gt; WAITING FOR INPUT...</p>
                <p>&gt; DB_SYNC: OK</p>
              </div>
            </aside>

          </div>
        )}
      </div>
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '2rem', background: '#000', fontFamily: 'monospace' }}>
          <h2>CRITICAL SYSTEM ERROR</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', color: '#ffaaaa' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
