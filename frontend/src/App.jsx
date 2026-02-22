import { useEffect, useMemo, useState } from "react";
import "./App.css";

const DEFAULT_LANES = [
  {
    id: "lane-a",
    name: "Lane A",
    vehicles: 28,
    type: "straight",
    density: "medium",
  },
  { id: "lane-b", name: "Lane B", vehicles: 18, type: "turn", density: "low" },
  {
    id: "lane-c",
    name: "Lane C",
    vehicles: 36,
    type: "straight",
    density: "high",
  },
];

const DENSITY_FACTORS = {
  low: 0.8,
  medium: 1,
  high: 1.25,
};

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const formatNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";

const buildPayload = ({
  intersectionName,
  lanes,
  timing,
  optimizeFor,
  balanceLanes,
  emergencyPriority,
}) => ({
  intersectionName,
  lanes: lanes.map((lane) => ({
    name: lane.name,
    vehicles: Number(lane.vehicles) || 0,
    type: lane.type,
    density: lane.density,
  })),
  timing: {
    green: Number(timing.green) || 0,
    yellow: Number(timing.yellow) || 0,
    red: Number(timing.red) || 0,
    cycle: Number(timing.cycle) || 0,
  },
  options: {
    optimizeFor,
    balanceLanes,
    emergencyPriority,
  },
});

async function postSimulation(payload) {
  const response = await fetch(`${API_BASE_URL}/traffic/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Simulation request failed");
  }

  return response.json();
}

async function postPlayback(payload, stepMs) {
  const response = await fetch(`${API_BASE_URL}/traffic/playback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stepMs }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Playback request failed");
  }

  return response.json();
}

function estimateMetrics(lanes, timing) {
  const totalVehicles = lanes.reduce(
    (sum, lane) => sum + Number(lane.vehicles || 0),
    0,
  );
  const weightedDensity = lanes.reduce((sum, lane) => {
    const vehicles = Number(lane.vehicles || 0);
    return sum + vehicles * (DENSITY_FACTORS[lane.density] || 1);
  }, 0);
  const green = Math.max(Number(timing.green) || 0, 1);
  const red = Math.max(Number(timing.red) || 0, 1);
  const cycle = Math.max(
    Number(timing.cycle) || green + red + (Number(timing.yellow) || 0),
    1,
  );
  const greenRatio = green / cycle;
  const baseWait = totalVehicles * 0.6 + weightedDensity * 0.4;
  const avgWait = baseWait * (1.25 - greenRatio);
  const queueLength = totalVehicles * (1.1 - greenRatio);
  const congestion = Math.min(100, (avgWait / 60) * 100);
  return {
    avgWait,
    queueLength,
    congestion,
  };
}

function App() {
  const [intersectionName, setIntersectionName] = useState(
    "North Avenue / 5th St",
  );
  const [lanes, setLanes] = useState(DEFAULT_LANES);
  const [timing, setTiming] = useState({
    green: 32,
    yellow: 5,
    red: 28,
    cycle: 65,
  });
  const [optimizeFor, setOptimizeFor] = useState("min_wait");
  const [balanceLanes, setBalanceLanes] = useState(true);
  const [emergencyEnabled, setEmergencyEnabled] = useState(false);
  const [emergencyLane, setEmergencyLane] = useState(DEFAULT_LANES[0]?.name || "");
  const [emergencyLevel, setEmergencyLevel] = useState("medium");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playback, setPlayback] = useState({
    frames: [],
    stepMs: 500,
    durationSec: 0,
  });
  const [playIndex, setPlayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playbackError, setPlaybackError] = useState("");

  const setTimingWithCycle = (updates) => {
    setTiming((prev) => {
      const next = { ...prev, ...updates };
      const green = Number(next.green) || 0;
      const yellow = Number(next.yellow) || 0;
      const red = Number(next.red) || 0;
      return { ...next, cycle: green + yellow + red };
    });
  };

  const timingMismatch = useMemo(() => {
    const total =
      Number(timing.green) + Number(timing.yellow) + Number(timing.red);
    return Number(timing.cycle) !== total;
  }, [timing]);

  const estimatedBefore = useMemo(
    () => estimateMetrics(lanes, timing),
    [lanes, timing],
  );

  const handleLaneChange = (id, key, value) => {
    setLanes((prev) =>
      prev.map((lane) => (lane.id === id ? { ...lane, [key]: value } : lane)),
    );
  };

  useEffect(() => {
    if (lanes.length === 0) {
      setEmergencyLane("");
      return;
    }

    const hasLane = lanes.some((lane) => lane.name === emergencyLane);
    if (!hasLane) {
      setEmergencyLane(lanes[0].name);
    }
  }, [lanes, emergencyLane]);

  const addLane = () => {
    const nextIndex = lanes.length + 1;
    setLanes((prev) => [
      ...prev,
      {
        id: `lane-${nextIndex}`,
        name: `Lane ${String.fromCharCode(64 + nextIndex)}`,
        vehicles: 20,
        type: "straight",
        density: "medium",
      },
    ]);
  };

  const removeLane = (id) => {
    setLanes((prev) => prev.filter((lane) => lane.id !== id));
  };

  const handleSimulate = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPlaybackError("");

    const payload = buildPayload({
      intersectionName,
      lanes,
      timing,
      optimizeFor,
      balanceLanes,
      emergencyPriority: {
        enabled: emergencyEnabled,
        laneName: emergencyLane,
        level: emergencyLevel,
      },
    });

    try {
      const data = await postSimulation(payload);
      setResult(data);
      const playbackData = await postPlayback(payload, 500);
      setPlayback(playbackData);
      setPlayIndex(0);
      setIsPlaying(false);
      setHistory((prev) => [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          payload,
          result: data,
        },
        ...prev,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Simulation failed";
      setError(message);
      setPlaybackError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPlaying || playback.frames.length === 0) {
      return undefined;
    }

    const tickMs = Math.max(playback.stepMs / speed, 120);
    const timer = setInterval(() => {
      setPlayIndex((current) => {
        const next = current + 1;
        if (next >= playback.frames.length - 1) {
          setIsPlaying(false);
          return playback.frames.length - 1;
        }
        return next;
      });
    }, tickMs);

    return () => clearInterval(timer);
  }, [isPlaying, playback.frames.length, playback.stepMs, speed]);

  const currentFrame = playback.frames[playIndex];
  const maxQueue = useMemo(() => {
    if (!currentFrame?.queues) {
      return 1;
    }
    return Math.max(
      1,
      ...currentFrame.queues.map((lane) => Number(lane.queueLength) || 0),
    );
  }, [currentFrame]);

  const derivedBefore = result?.metrics?.before || estimatedBefore;
  const derivedAfter = result?.metrics?.after;
  const optimizedTiming = result?.optimizedTiming;
  const emergencyPriority = result?.emergencyPriority;
  const hasAfterMetrics = Boolean(derivedAfter);
  const waitReduction = hasAfterMetrics
    ? ((derivedBefore.avgWait - derivedAfter.avgWait) / derivedBefore.avgWait) *
      100
    : 0;

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Traffic Flow Optimization Simulator</p>
          <h1>Design smarter signals for real-world congestion.</h1>
          <p className="subhead">
            Configure lanes and current timing, then run a simulation to compare
            before vs after wait time and queue length.
          </p>
        </div>
        <div className="hero-card">
          <div>
            <span className="label">Intersection</span>
            <input
              className="text-input"
              value={intersectionName}
              onChange={(event) => setIntersectionName(event.target.value)}
              placeholder="Intersection name"
            />
          </div>
          <div className="hero-stats">
            <div>
              <span className="label">Total vehicles</span>
              <strong>
                {lanes.reduce(
                  (sum, lane) => sum + Number(lane.vehicles || 0),
                  0,
                )}
              </strong>
            </div>
            <div>
              <span className="label">Cycle length</span>
              <strong>{timing.cycle}s</strong>
            </div>
            <div>
              <span className="label">Optimization focus</span>
              <strong>
                {optimizeFor === "min_wait" ? "Min wait" : "Max throughput"}
              </strong>
            </div>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Lane configuration</h2>
              <p>Capture lane types, vehicles, and density levels.</p>
            </div>
            <button className="ghost" type="button" onClick={addLane}>
              Add lane
            </button>
          </div>
          <div className="lane-grid">
            {lanes.map((lane, index) => (
              <div className="lane-card" key={lane.id}>
                <div className="lane-title">
                  <input
                    className="text-input"
                    value={lane.name}
                    onChange={(event) =>
                      handleLaneChange(lane.id, "name", event.target.value)
                    }
                  />
                  {lanes.length > 1 ? (
                    <button
                      className="remove-button"
                      type="button"
                      onClick={() => removeLane(lane.id)}
                    >
                      Remove lane
                    </button>
                  ) : null}
                </div>
                <label>
                  Vehicles per lane
                  <input
                    className="text-input"
                    type="number"
                    min="0"
                    value={lane.vehicles}
                    onChange={(event) =>
                      handleLaneChange(lane.id, "vehicles", event.target.value)
                    }
                  />
                </label>
                <label>
                  Lane type
                  <select
                    className="text-input"
                    value={lane.type}
                    onChange={(event) =>
                      handleLaneChange(lane.id, "type", event.target.value)
                    }
                  >
                    <option value="straight">Straight</option>
                    <option value="turn">Turn</option>
                  </select>
                </label>
                <label>
                  Density level
                  <select
                    className="text-input"
                    value={lane.density}
                    onChange={(event) =>
                      handleLaneChange(lane.id, "density", event.target.value)
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <div className="chip">Lane {index + 1}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Signal timing</h2>
              <p>Enter the current signal cycle to simulate queueing.</p>
            </div>
          </div>
          <div className="timing-grid">
            <label>
              Green (sec)
              <input
                className="text-input"
                type="number"
                min="0"
                value={timing.green}
                onChange={(event) =>
                  setTimingWithCycle({ green: event.target.value })
                }
              />
            </label>
            <label>
              Yellow (sec)
              <input
                className="text-input"
                type="number"
                min="0"
                value={timing.yellow}
                onChange={(event) =>
                  setTimingWithCycle({ yellow: event.target.value })
                }
              />
            </label>
            <label>
              Red (sec)
              <input
                className="text-input"
                type="number"
                min="0"
                value={timing.red}
                onChange={(event) => setTimingWithCycle({ red: event.target.value })}
              />
            </label>
            <label>
              Total cycle (sec)
              <input
                className="text-input"
                type="number"
                min="0"
                value={timing.cycle}
                onChange={(event) =>
                  setTiming((prev) => ({ ...prev, cycle: event.target.value }))
                }
              />
            </label>
          </div>
          {timingMismatch ? (
            <p className="warning">
              Cycle does not match green + yellow + red.
            </p>
          ) : (
            <p className="hint">Cycle matches the sum of phases.</p>
          )}

          <div className="panel-header">
            <div>
              <h2>Optimization settings</h2>
              <p>
                Control how the optimizer balances wait time and throughput.
              </p>
            </div>
          </div>
          <div className="timing-grid">
            <label>
              Optimize for
              <select
                className="text-input"
                value={optimizeFor}
                onChange={(event) => setOptimizeFor(event.target.value)}
              >
                <option value="min_wait">Minimize wait time</option>
                <option value="max_throughput">Maximize throughput</option>
              </select>
            </label>
            <label className="toggle">
              Load balancing
              <span>
                <input
                  type="checkbox"
                  checked={balanceLanes}
                  onChange={(event) => setBalanceLanes(event.target.checked)}
                />
                <span className="toggle-slider" />
              </span>
            </label>
            <label className="toggle">
              Emergency priority
              <span>
                <input
                  type="checkbox"
                  checked={emergencyEnabled}
                  onChange={(event) => setEmergencyEnabled(event.target.checked)}
                />
                <span className="toggle-slider" />
              </span>
            </label>
            <label>
              Priority lane
              <select
                className="text-input"
                value={emergencyLane}
                onChange={(event) => setEmergencyLane(event.target.value)}
              >
                {lanes.map((lane) => (
                  <option value={lane.name} key={lane.id}>
                    {lane.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority level
              <select
                className="text-input"
                value={emergencyLevel}
                onChange={(event) => setEmergencyLevel(event.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <form onSubmit={handleSimulate}>
            <div className="action-row">
              <button className="primary" type="submit" disabled={loading}>
                {loading ? "Running simulation..." : "Run simulation"}
              </button>
              <div className="api-meta">
                <span className="label">Endpoint</span>
                <strong>{`${API_BASE_URL}/traffic/simulate`}</strong>
              </div>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </section>

        <section className="panel results">
          <div className="panel-header">
            <div>
              <h2>Simulation outcome</h2>
              <p>Compare before vs after congestion metrics.</p>
            </div>
            <div className="pill">
              {result ? "Backend response" : "Estimated"}
            </div>
          </div>
          <div className="result-grid">
            <div className="result-card">
              <span className="label">Avg wait (before)</span>
              <strong>{formatNumber(derivedBefore.avgWait)}s</strong>
              <span className="mini">
                Queue: {formatNumber(derivedBefore.queueLength)} veh
              </span>
            </div>
            <div className="result-card">
              <span className="label">Avg wait (after)</span>
              <strong>{formatNumber(derivedAfter?.avgWait)}s</strong>
              <span className="mini">
                Queue: {formatNumber(derivedAfter?.queueLength)} veh
              </span>
            </div>
            <div className="result-card">
              <span className="label">Congestion change</span>
              <strong>
                {hasAfterMetrics
                  ? `${formatNumber(derivedAfter.congestion - derivedBefore.congestion)}%`
                  : "—"}
              </strong>
              <span className="mini">
                Before: {formatNumber(derivedBefore.congestion)}%
              </span>
            </div>
            <div className="result-card accent">
              <span className="label">Wait-time reduction</span>
              <strong>
                {hasAfterMetrics ? `${formatNumber(waitReduction)}%` : "—"}
              </strong>
              <span className="mini">
                Goal: {optimizeFor === "min_wait" ? "Min wait" : "Throughput"}
              </span>
            </div>
          </div>
          <div className="timing-output">
            <div>
              <span className="label">Optimized timing</span>
              <p>
                {optimizedTiming
                  ? `Green ${optimizedTiming.green}s / Yellow ${optimizedTiming.yellow}s / Red ${optimizedTiming.red}s`
                  : "Awaiting optimized timing from backend."}
              </p>
            </div>
            <div>
              <span className="label">Load balancing</span>
              <p>
                {result?.laneBalancing
                  ? `Shift ${result.laneBalancing.shiftPercentage}% of flow to ${result.laneBalancing.targetLane}`
                  : "Backend will suggest lane balancing adjustments."}
              </p>
            </div>
            <div>
              <span className="label">Emergency priority</span>
              <p>
                {emergencyPriority?.enabled
                  ? `Active on ${emergencyPriority.laneName} (${emergencyPriority.level})`
                  : "Not enabled"}
              </p>
            </div>
          </div>
        </section>

        <section className="panel playback">
          <div className="panel-header">
            <div>
              <h2>Live simulation playback</h2>
              <p>Watch queues evolve per lane and adjust signal phases.</p>
            </div>
            <div className="playback-controls">
              <button
                className="ghost"
                type="button"
                disabled={playback.frames.length === 0}
                onClick={() => setIsPlaying((prev) => !prev)}
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <select
                className="text-input speed"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>
          </div>

          {playback.frames.length === 0 ? (
            <div className="empty-state">
              <p>Run a simulation to generate playback frames.</p>
            </div>
          ) : (
            <div className="playback-grid">
              <div className="playback-lanes">
                {currentFrame?.queues?.map((lane) => (
                  <div className="lane-row" key={lane.name}>
                    <div className="lane-meta">
                      <strong>
                        {lane.name}
                        <span
                          className={`lane-phase ${lane.phase || "red"}`}
                        >
                          {lane.phase || "red"}
                        </span>
                      </strong>
                      <span>{lane.queueLength} veh</span>
                    </div>
                    <div className="lane-bar">
                      <span
                        style={{
                          width: `${(lane.queueLength / maxQueue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="playback-stats">
                <div>
                  <span className="label">Time</span>
                  <strong>{currentFrame?.timeSec ?? 0}s</strong>
                </div>
                <div>
                  <span className="label">Straight phase</span>
                  <strong
                    className={`phase ${currentFrame?.straightPhase || "red"}`}
                  >
                    {currentFrame?.straightPhase || "—"}
                  </strong>
                </div>
                <div>
                  <span className="label">Turn phase</span>
                  <strong
                    className={`phase ${currentFrame?.turnPhase || "red"}`}
                  >
                    {currentFrame?.turnPhase || "—"}
                  </strong>
                </div>
                <div>
                  <span className="label">Total queue</span>
                  <strong>{currentFrame?.totalQueue ?? 0} veh</strong>
                </div>
                <div>
                  <span className="label">Avg wait</span>
                  <strong>{currentFrame?.avgWait ?? 0}s</strong>
                </div>
                <div>
                  <span className="label">Emergency mode</span>
                  <strong
                    className={
                      emergencyEnabled ? "emergency-on" : "emergency-off"
                    }
                  >
                    {emergencyEnabled && emergencyLane
                      ? `${emergencyLane} (${emergencyLevel})`
                      : "Off"}
                  </strong>
                </div>
                <div className="timeline">
                  <span
                    style={{
                      width: `${
                        playback.frames.length
                          ? (playIndex / (playback.frames.length - 1)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="mini">
                  {playIndex + 1} / {playback.frames.length} frames
                </p>
                {playbackError ? <p className="error">{playbackError}</p> : null}
              </div>
            </div>
          )}
        </section>

        <section className="panel history">
          <div className="panel-header">
            <div>
              <h2>Saved simulations</h2>
              <p>Store results for quick comparison.</p>
            </div>
            <span className="pill">{history.length} runs</span>
          </div>
          {history.length === 0 ? (
            <div className="empty-state">
              <p>
                No saved simulations yet. Run your first scenario to capture
                metrics.
              </p>
            </div>
          ) : (
            <div className="history-grid">
              {history.slice(0, 4).map((entry) => (
                <div className="history-card" key={entry.id}>
                  <div>
                    <span className="label">
                      {entry.payload.intersectionName}
                    </span>
                    <strong>
                      {new Date(entry.createdAt).toLocaleString()}
                    </strong>
                  </div>
                  <div className="history-metrics">
                    <span>Lanes: {entry.payload.lanes.length}</span>
                    <span>Cycle: {entry.payload.timing.cycle}s</span>
                    <span>
                      After wait:{" "}
                      {formatNumber(entry.result?.metrics?.after?.avgWait)}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
