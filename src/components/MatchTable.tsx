import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Match } from "../types/data";
import Pagination from "./Pagination";

type Props = {
  matches: Match[];
  pageSize?: number;
};

type SortKey =
  | "date"
  | "tournamentName"
  | "stageName"
  | "seed"
  | "character"
  | "destination"
  | "winnerName"
  | "loserName"
  | "winnerTime"
  | "gameVersion"
  | "modName"
  | "isSpecial";

const columns: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: "date", label: "日期" },
  { key: "tournamentName", label: "比赛" },
  { key: "stageName", label: "赛段" },
  { key: "seed", label: "种子" },
  { key: "character", label: "角色" },
  { key: "destination", label: "终点" },
  { key: "winnerName", label: "胜者" },
  { key: "loserName", label: "败者" },
  { key: "winnerTime", label: "成绩" },
  { key: "gameVersion", label: "版本" },
  { key: "modName", label: "Mod" },
  { key: "isSpecial", label: "标记" }
];

const getSortValue = (match: Match, key: SortKey) => {
  if (key === "isSpecial") return match.isSpecial ? "1" : "0";
  return String(match[key] ?? "");
};

const compareMatches = (a: Match, b: Match, key: SortKey, direction: "asc" | "desc") => {
  const result = getSortValue(a, key).localeCompare(getSortValue(b, key), "zh-Hans-CN", { numeric: true });
  return direction === "asc" ? result : -result;
};

export default function MatchTable({ matches, pageSize }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [matches, sortKey, sortDirection]);

  const sortedMatches = useMemo(() => {
    if (!sortKey) return matches;
    return [...matches].sort((a, b) => compareMatches(a, b, sortKey, sortDirection));
  }, [matches, sortDirection, sortKey]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sortedMatches.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const visibleMatches = pageSize
    ? sortedMatches.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : sortedMatches;

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("desc");
      return;
    }
    setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
  };

  if (matches.length === 0) {
    return <div className="empty">没有符合条件的对局</div>;
  }

  return (
    <div className="stack">
      {pageSize && <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />}
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
              <th>视频</th>
            </tr>
          </thead>
          <tbody>
            {visibleMatches.map((match) => (
              <tr key={match.id}>
                <td>{match.date}</td>
                <td>{match.tournamentName}</td>
                <td>{match.stageName || <span className="muted">无</span>}</td>
                <td className="mono">{match.seed}</td>
                <td>{match.character}</td>
                <td>{match.destination}</td>
                <td>
                  <Link to={`/players/${encodeURIComponent(match.winnerPlayerId)}`}>{match.winnerName}</Link>
                </td>
                <td>
                  <Link to={`/players/${encodeURIComponent(match.loserPlayerId)}`}>{match.loserName}</Link>
                </td>
                <td className="mono">{match.winnerTime}</td>
                <td>{match.gameVersion}</td>
                <td className="mono">{match.modName}</td>
                <td>{match.isSpecial ? "特殊" : <span className="muted">无</span>}</td>
                <td>
                  {match.videoUrl ? (
                    <a href={match.videoUrl} target="_blank" rel="noreferrer">
                      {match.videoLabel || "视频"}
                    </a>
                  ) : (
                    <span className="muted">无</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageSize && <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />}
    </div>
  );
}
