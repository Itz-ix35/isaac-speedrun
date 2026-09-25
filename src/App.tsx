import { useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CalendarDays, Info, ListChecks, Scale, Shield, Swords, Users } from "lucide-react";
import aboutContent from "../about.md?raw";
import todoContent from "../tdl.md?raw";
import { loadData } from "./data/loadData";
import ArenaPage from "./routes/ArenaPage";
import CompetitionPage from "./routes/CompetitionPage";
import FullBracketPage from "./routes/FullBracketPage";
import MarkdownPage from "./routes/MarkdownPage";
import MatchesPage from "./routes/MatchesPage";
import PlayerComparePage from "./routes/PlayerComparePage";
import PlayerDetailPage from "./routes/PlayerDetailPage";
import PlayersPage from "./routes/PlayersPage";
import type { AppData } from "./types/data";

const navItems = [
  { to: "/about", label: "关于", icon: Info },
  { to: "/competitions", label: "比赛", icon: CalendarDays },
  { to: "/arena", label: "擂台", icon: Shield },
  { to: "/matches", label: "对局", icon: Swords },
  { to: "/players", label: "选手", icon: Users },
  { to: "/players/compare", label: "战绩对比", icon: Scale },
  { to: "/todo", label: "To do list", icon: ListChecks }
];

export default function App() {
  const location = useLocation();
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState("");
  const isFullscreenBracket = location.pathname.startsWith("/brackets/");

  useEffect(() => {
    loadData().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "数据加载失败");
    });
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      tournaments: data.tournaments.length,
      matches: data.matches.length,
      arenaMatches: data.arenaMatches.length,
      players: data.players.length
    };
  }, [data]);

  return (
    <div className="app-shell">
      {!isFullscreenBracket && (
        <header className="topbar">
          <div>
            <h1>以撒竞速比赛资料库</h1>
            {stats && (
              <p>
                {stats.tournaments} 项比赛 / {stats.matches} 场比赛对局 / {stats.arenaMatches} 场擂台 / {stats.players} 位选手
              </p>
            )}
          </div>
          <nav aria-label="主导航">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </header>
      )}

      <main className={isFullscreenBracket ? "fullscreen-main" : ""}>
        {error && <div className="status error">{error}</div>}
        {!data && !error && <div className="status">正在加载数据...</div>}
        {data && (
          <Routes>
            <Route path="/" element={<Navigate to="/about" replace />} />
            <Route path="/about" element={<MarkdownPage title="关于" content={aboutContent} />} />
            <Route path="/competitions" element={<CompetitionPage data={data} />} />
            <Route path="/brackets/:tournamentId" element={<FullBracketPage data={data} />} />
            <Route path="/arena" element={<ArenaPage data={data} />} />
            <Route path="/matches" element={<MatchesPage data={data} />} />
            <Route path="/players" element={<PlayersPage data={data} />} />
            <Route path="/players/compare" element={<PlayerComparePage data={data} />} />
            <Route path="/players/:playerId" element={<PlayerDetailPage data={data} />} />
            <Route path="/todo" element={<MarkdownPage title="To do list" content={todoContent} />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
