import { useCallback, useEffect, useRef, useState } from "react";
import {
  createState,
  render,
  update,
  VH,
  VW,
  type Input,
} from "./engine";
import { getName, setName } from "./storage";
import {
  submitScore,
  getTopScores,
  getPlayerRank,
  type LeaderboardEntry,
} from "./leaderboard";

type View = "title" | "playing" | "over" | "leaderboard";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PixelRunner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<ReturnType<typeof createState> | null>(null);
  const [view, setView] = useState<View>("title");
  const [playerName, setPlayerName] = useState(() => getName());
  const [nameInput, setNameInput] = useState(() => getName());
  const [lastScore, setLastScore] = useState(0);
  const [lastDuration, setLastDuration] = useState(0);
  const [leaderboardData, setLeaderboardData] = useState<
    LeaderboardEntry[]
  >([]);
  const [playerRank, setPlayerRank] = useState(0);
  const [lbLoading, setLbLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lastPhaseRef = useRef<"title" | "playing" | "over">("title");
  const playerNameRef = useRef(playerName);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const [scores] = await Promise.all([getTopScores(15)]);
      setLeaderboardData(scores);
    } catch (e) {
      console.error("Failed to load leaderboard", e);
      setLeaderboardData([]);
    } finally {
      setLbLoading(false);
    }
  }, []);

  const handleSubmitScore = useCallback(
    async (score: number, duration: number) => {
      if (!playerName.trim()) return;
      setSubmitting(true);
      try {
        await submitScore(playerName.trim(), score, duration);
        const rank = await getPlayerRank(score);
        setPlayerRank(rank);
        setSubmitted(true);
      } catch (e) {
        console.error("Failed to submit score", e);
        setSubmitted(false);
      } finally {
        setSubmitting(false);
      }
    },
    [playerName],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const state = createState();
    stateRef.current = state;
    const keys = new Set<string>();
    const justPressed = new Set<string>();
    let touchJump = false;
    let touchJumpJustPressed = false;
    let touchSlide = false;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key;
      if (
        k === " " ||
        k === "ArrowUp" ||
        k === "ArrowDown" ||
        k === "w" ||
        k === "s" ||
        k === "W" ||
        k === "S"
      ) {
        e.preventDefault();
      }
      if (!keys.has(k)) justPressed.add(k);
      keys.add(k);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartY = t.clientY;
      touchJump = true;
      touchJumpJustPressed = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t.clientY - touchStartY > 30) {
        touchSlide = true;
        touchJump = false;
      }
    };
    const onTouchEnd = () => {
      touchJump = false;
      touchSlide = false;
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    const resize = () => {
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.max(
        1,
        Math.floor(Math.min(vw / VW, vh / VH)),
      );
      const cssW = VW * scale;
      const cssH = VH * scale;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.width = VW * dpr * scale;
      canvas.height = VH * dpr * scale;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60;

    const loop = (now: number) => {
      acc += now - last;
      last = now;
      if (acc > 250) acc = 250;
      while (acc >= STEP) {
        const isJump =
          keys.has(" ") ||
          keys.has("ArrowUp") ||
          keys.has("w") ||
          keys.has("W") ||
          touchJump;
        const jumpPressed =
          justPressed.has(" ") ||
          justPressed.has("ArrowUp") ||
          justPressed.has("w") ||
          justPressed.has("W") ||
          touchJumpJustPressed;
        const slide =
          keys.has("ArrowDown") ||
          keys.has("s") ||
          keys.has("S") ||
          touchSlide;
        const start = jumpPressed;
        const input: Input = {
          jumpDown: isJump,
          jumpPressed,
          slide,
          start,
        };
        update(state, input);
        justPressed.clear();
        touchJumpJustPressed = false;
        acc -= STEP;
      }
      render(ctx, state);

      if (state.phase !== lastPhaseRef.current) {
        if (state.phase === "over" && lastPhaseRef.current === "playing") {
          const finalScore = Math.floor(state.score);
          const finalDuration = state.duration;
          setLastScore(finalScore);
          setLastDuration(finalDuration);
          setSubmitted(false);
          setPlayerRank(0);
          setView("over");
          const name = playerNameRef.current?.trim();
          if (name) {
            setSubmitting(true);
            submitScore(name, finalScore, finalDuration)
              .then((submittedNow) => {
                if (submittedNow) {
                  return getPlayerRank(finalScore);
                }
                return null;
              })
              .then((rank) => {
                if (rank) setPlayerRank(rank);
                setSubmitted(true);
              })
              .catch((e) => {
                console.error("Failed to submit score", e);
                setSubmitted(false);
              })
              .finally(() => setSubmitting(false));
          }
        } else if (state.phase === "title") {
          setView("title");
        } else if (state.phase === "playing") {
          setView("playing");
        }
        lastPhaseRef.current = state.phase;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const startGame = useCallback(() => {
    if (!playerName.trim()) return;
    setName(playerName.trim());
    setView("playing");
    lastPhaseRef.current = "playing";
    const s = stateRef.current;
    if (s) {
      s.name = playerName.trim();
      s.phase = "playing";
      s.time = 0;
      s.score = 0;
      s.speed = 2.2;
      s.py = 150 - 16;
      s.vy = 0;
      s.onGround = true;
      s.sliding = false;
      s.holdFrames = 0;
      s.obstacles = [];
      s.collectibles = [];
      s.particles = [];
      s.spawnCooldown = 60;
      s.collectibleCooldown = 120;
      s.shake = 0;
      s.flash = 0;
      s.duration = 0;
      s.startTime = performance.now();
    }
  }, [playerName]);

  const openLeaderboard = useCallback(() => {
    setLeaderboardData([]);
    setView("leaderboard");
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const goBackToTitle = useCallback(() => {
    setView("title");
    const s = stateRef.current;
    if (s && s.phase !== "title") {
      s.phase = "title";
      lastPhaseRef.current = "title";
    }
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="pixelated block"
        style={{ imageRendering: "pixelated" }}
      />

      {view === "title" && (
        <>
          <button
            onClick={openLeaderboard}
            className="absolute top-10 left-1/2 -translate-x-1/2 px-8 py-3 text-xs font-[family-name:'Press_Start_2P'] border cursor-pointer transition-colors pointer-events-auto"
            style={{
              color: "#ff2e88",
              borderColor: "#ff2e88",
              backgroundColor: "transparent",
            }}
          >
            LEADERBOARD
          </button>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 mt-16 pb-8 pointer-events-auto">
              <label
                htmlFor="player-name"
                className="text-[10px] font-[family-name:'Press_Start_2P'] tracking-wider"
                style={{ color: "#9a9ac8" }}
              >
                ENTER NAME
              </label>
              <input
                id="player-name"
                type="text"
                maxLength={12}
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setPlayerName(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startGame();
                }}
                placeholder="AAA"
                className="w-48 px-3 py-2 text-center text-xs font-[family-name:'Press_Start_2P'] bg-transparent border outline-none"
                style={{
                  color: "#3ef0ff",
                  borderColor: "#7a3cff",
                }}
              />
            </div>
          </div>
        </>
      )}

      {view === "over" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
          <div
            className="flex flex-col items-center gap-3 px-8 py-6"
            style={{ backgroundColor: "rgba(11,11,42,0.85)" }}
          >
            <p
              className="text-[10px] font-[family-name:'Press_Start_2P']"
              style={{ color: "#3ef0ff" }}
            >
              SCORE {String(lastScore).padStart(5, "0")}
            </p>
            <p
              className="text-[8px] font-[family-name:'Press_Start_2P']"
              style={{ color: "#9a9ac8" }}
            >
              TIME {formatDuration(lastDuration)}
            </p>
            <p
              className="text-[10px] font-[family-name:'Press_Start_2P']"
              style={{ color: "#3ef0ff" }}
            >
              SCORE {String(lastScore).padStart(5, "0")}
            </p>
            <p
              className="text-[8px] font-[family-name:'Press_Start_2P']"
              style={{ color: "#9a9ac8" }}
            >
              TIME {formatDuration(lastDuration)}
            </p>
            {!submitted && !submitting && (
              <p
                className="text-[8px] font-[family-name:'Press_Start_2P']"
                style={{ color: "#9a9ac8" }}
              >
                SUBMITTING...
              </p>
            )}
            {submitted && playerRank > 0 && (
              <p
                className="text-[8px] font-[family-name:'Press_Start_2P']"
                style={{ color: "#ffd23e" }}
              >
                RANK #{playerRank}
              </p>
            )}
            {submitted && playerRank === 0 && (
              <p
                className="text-[8px] font-[family-name:'Press_Start_2P']"
                style={{ color: "#9a9ac8" }}
              >
                BEST RETAINED
              </p>
            )}
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => {
                  startGame();
                }}
                className="px-4 py-2 text-[8px] font-[family-name:'Press_Start_2P'] border cursor-pointer transition-colors"
                style={{
                  color: "#3ef0ff",
                  borderColor: "#3ef0ff",
                  backgroundColor: "transparent",
                }}
              >
                RETRY
              </button>
              <button
                onClick={openLeaderboard}
                className="px-4 py-2 text-[8px] font-[family-name:'Press_Start_2P'] border cursor-pointer transition-colors"
                style={{
                  color: "#ff2e88",
                  borderColor: "#ff2e88",
                  backgroundColor: "transparent",
                }}
              >
                LEADERBOARD
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "leaderboard" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
          <div
            className="flex flex-col items-center gap-4 px-8 py-6 w-full max-w-md"
            style={{ backgroundColor: "rgba(11,11,42,0.92)" }}
          >
            <h2
              className="text-sm font-[family-name:'Press_Start_2P']"
              style={{ color: "#ff2e88" }}
            >
              LEADERBOARD
            </h2>
            {lbLoading ? (
              <p
                className="text-[8px] font-[family-name:'Press_Start_2P']"
                style={{ color: "#9a9ac8" }}
              >
                LOADING...
              </p>
            ) : leaderboardData.length === 0 ? (
              <p
                className="text-[8px] font-[family-name:'Press_Start_2P']"
                style={{ color: "#9a9ac8" }}
              >
                NO SCORES YET
              </p>
            ) : (
              <div className="w-full overflow-y-auto" style={{ maxHeight: "320px" }}>
                <table className="w-full text-[7px] font-[family-name:'Press_Start_2P']">
                  <thead>
                    <tr style={{ color: "#7a3cff" }}>
                      <th className="text-left pb-2 pr-2">#</th>
                      <th className="text-left pb-2 pr-2">NAME</th>
                      <th className="text-right pb-2 pr-2">SCORE</th>
                      <th className="text-right pb-2">TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((entry, i) => (
                      <tr
                        key={entry.id}
                        style={{
                          color:
                            i < 3 ? "#ffd23e" : "#c0c0d8",
                        }}
                      >
                        <td className="py-1 pr-2">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="py-1 pr-2 truncate max-w-[100px]">
                          {entry.name}
                        </td>
                        <td className="py-1 pr-2 text-right">
                          {String(entry.score).padStart(5, "0")}
                        </td>
                        <td className="py-1 text-right">
                          {formatDuration(entry.duration)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              onClick={goBackToTitle}
              className="mt-2 px-6 py-2 text-[10px] font-[family-name:'Press_Start_2P'] border cursor-pointer transition-colors"
              style={{
                color: "#3ef0ff",
                borderColor: "#3ef0ff",
                backgroundColor: "transparent",
              }}
            >
              BACK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
