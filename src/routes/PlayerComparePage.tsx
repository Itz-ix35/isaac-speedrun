import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import MatchTable from "../components/MatchTable";
import type { AppData, Player } from "../types/data";

type Props = {
  data: AppData;
};

const findPlayer = (data: AppData, value: string) => {
  const normalized = value.trim();
  const normalizedLower = normalized.toLowerCase();
  return normalized
    ? data.players.find(
        (player) => player.id === normalized || player.displayName === normalized || player.displayName.toLowerCase() === normalizedLower
      )
    : undefined;
};

type PlayerIdInputProps = {
  label: string;
  players: Player[];
  value: string;
  onChange: (value: string) => void;
};

function PlayerIdInput({ label, players, value, onChange }: PlayerIdInputProps) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) return [];
    return players
      .filter((player) => player.displayName.toLowerCase().includes(keyword) || player.id.toLowerCase().includes(keyword))
      .slice(0, 20);
  }, [players, value]);
  const showSuggestions = focused && suggestions.length > 0;

  return (
    <label className="field player-id-field">
      <span>{label}</span>
      <input
        value={value}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder="输入选手 id"
      />
      {showSuggestions && (
        <div className="player-id-suggestions">
          {suggestions.map((player) => (
            <button
              type="button"
              key={player.id}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(player.displayName);
                setFocused(false);
              }}
            >
              <span>{player.displayName}</span>
              <small>{player.id}</small>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

export default function PlayerComparePage({ data }: Props) {
  const [playerAInput, setPlayerAInput] = useState("");
  const [playerBInput, setPlayerBInput] = useState("");
  const [confirmedIds, setConfirmedIds] = useState<{ playerAId: string; playerBId: string } | null>(null);

  const allMatches = useMemo(() => [...data.matches, ...data.arenaMatches], [data.arenaMatches, data.matches]);
  const playerA = confirmedIds ? findPlayer(data, confirmedIds.playerAId) : undefined;
  const playerB = confirmedIds ? findPlayer(data, confirmedIds.playerBId) : undefined;

  const headToHeadMatches = useMemo(() => {
    if (!confirmedIds || !playerA || !playerB) return [];
    const { playerAId, playerBId } = confirmedIds;
    return allMatches.filter(
      (match) =>
        (match.winnerPlayerId === playerAId && match.loserPlayerId === playerBId) ||
        (match.winnerPlayerId === playerBId && match.loserPlayerId === playerAId)
    );
  }, [allMatches, confirmedIds, playerA, playerB]);

  const playerAWins = confirmedIds
    ? headToHeadMatches.filter((match) => match.winnerPlayerId === confirmedIds.playerAId).length
    : 0;
  const playerBWins = confirmedIds
    ? headToHeadMatches.filter((match) => match.winnerPlayerId === confirmedIds.playerBId).length
    : 0;
  const hasSubmitted = Boolean(confirmedIds);
  const hasMissingPlayer = hasSubmitted && (!playerA || !playerB);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPlayerA = findPlayer(data, playerAInput);
    const nextPlayerB = findPlayer(data, playerBInput);
    setConfirmedIds({
      playerAId: nextPlayerA?.id ?? playerAInput.trim(),
      playerBId: nextPlayerB?.id ?? playerBInput.trim()
    });
  };

  return (
    <section className="stack">
      <div className="section-heading">
        <h2>战绩对比</h2>
        <p>输入两个选手 id，查看双方直接交手记录</p>
      </div>

      <form className="compare-form" onSubmit={handleSubmit}>
        <PlayerIdInput label="选手 A id" players={data.players} value={playerAInput} onChange={setPlayerAInput} />
        <PlayerIdInput label="选手 B id" players={data.players} value={playerBInput} onChange={setPlayerBInput} />
        <button type="submit">确认</button>
      </form>

      {hasMissingPlayer && (
        <div className="status error">
          {!playerA && <p>找不到选手：{confirmedIds?.playerAId || "空"}</p>}
          {!playerB && <p>找不到选手：{confirmedIds?.playerBId || "空"}</p>}
        </div>
      )}

      {hasSubmitted && playerA && playerB && (
        <>
          <div className="compare-summary">
            <div>
              <span>{playerA.displayName}</span>
              <strong>{playerAWins}</strong>
            </div>
            <div className="compare-divider">:</div>
            <div>
              <span>{playerB.displayName}</span>
              <strong>{playerBWins}</strong>
            </div>
          </div>

          <div className="section-heading">
            <h2>对局</h2>
            <p>共 {headToHeadMatches.length} 场直接交手</p>
          </div>
          <MatchTable matches={headToHeadMatches} pageSize={30} />
        </>
      )}
    </section>
  );
}
