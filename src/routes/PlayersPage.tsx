import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { AppData } from "../types/data";

type Props = {
  data: AppData;
};

type PlayerSortKey = "displayName" | "streamRoom" | "matchCount" | "winCount" | "lossCount";

const columns: Array<{ key: PlayerSortKey; label: string }> = [
  { key: "displayName", label: "选手 id" },
  { key: "streamRoom", label: "直播间号" },
  { key: "matchCount", label: "对局数" },
  { key: "winCount", label: "胜场" },
  { key: "lossCount", label: "负场" }
];

export default function PlayersPage({ data }: Props) {
  const [keyword, setKeyword] = useState("");
  const [sortKey, setSortKey] = useState<PlayerSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: PlayerSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("desc");
      return;
    }
    setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
  };

  const players = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    const filtered = normalized
      ? data.players.filter((player) => player.displayName.toLowerCase().includes(normalized))
      : data.players;
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const result = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "zh-Hans-CN", { numeric: true });
      return sortDirection === "asc" ? result : -result;
    });
  }, [data.players, keyword, sortDirection, sortKey]);

  return (
    <section className="stack">
      <div className="section-heading row">
        <div>
          <h2>选手</h2>
          <p>共 {players.length} 位选手</p>
        </div>
        <label className="search-box">
          <span>选手 id</span>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索选手" />
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  <button type="button" className="sort-header" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    {sortKey === column.key && <span>{sortDirection === "desc" ? "↓" : "↑"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  <Link to={`/players/${encodeURIComponent(player.id)}`}>{player.displayName}</Link>
                </td>
                <td>{player.streamRoom || <span className="muted">待补充</span>}</td>
                <td>{player.matchCount}</td>
                <td>{player.winCount}</td>
                <td>{player.lossCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
