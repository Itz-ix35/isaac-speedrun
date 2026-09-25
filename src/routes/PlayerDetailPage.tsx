import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MatchTable from "../components/MatchTable";
import MultiSelect from "../components/MultiSelect";
import type { AppData } from "../types/data";

type Props = {
  data: AppData;
};

const includesAny = (selected: string[], value: string) => selected.length === 0 || selected.includes(value);

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

export default function PlayerDetailPage({ data }: Props) {
  const { playerId = "" } = useParams();
  const decodedPlayerId = decodeURIComponent(playerId);
  const player = data.players.find((item) => item.id === decodedPlayerId);
  const [tournaments, setTournaments] = useState<string[]>([]);
  const [characters, setCharacters] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [gameVersions, setGameVersions] = useState<string[]>([]);
  const [modNames, setModNames] = useState<string[]>([]);

  const playerMatches = useMemo(() => {
    return [...data.matches, ...data.arenaMatches].filter(
      (match) => match.winnerPlayerId === decodedPlayerId || match.loserPlayerId === decodedPlayerId
    );
  }, [data.arenaMatches, data.matches, decodedPlayerId]);

  const filterOptions = useMemo(
    () => ({
      tournaments: uniqueSorted(playerMatches.map((match) => match.tournamentName)),
      characters: uniqueSorted(playerMatches.map((match) => match.character)),
      destinations: uniqueSorted(playerMatches.map((match) => match.destination)),
      gameVersions: uniqueSorted(playerMatches.map((match) => match.gameVersion)),
      modNames: uniqueSorted(playerMatches.map((match) => match.modName))
    }),
    [playerMatches]
  );

  const filteredMatches = useMemo(() => {
    return playerMatches.filter(
      (match) =>
        includesAny(tournaments, match.tournamentName) &&
        includesAny(characters, match.character) &&
        includesAny(destinations, match.destination) &&
        includesAny(gameVersions, match.gameVersion) &&
        includesAny(modNames, match.modName)
    );
  }, [characters, destinations, gameVersions, modNames, playerMatches, tournaments]);

  if (!player) {
    return (
      <section className="stack">
        <div className="status error">找不到该选手</div>
        <Link to="/players">返回选手列表</Link>
      </section>
    );
  }

  return (
    <section className="stack">
      <div className="section-heading row">
        <div>
          <h2>{player.displayName}</h2>
          <p>
            {player.matchCount} 场对局 / {player.winCount} 胜 / {player.lossCount} 负
          </p>
        </div>
        <Link to="/players">返回选手列表</Link>
      </div>

      <div className="filter-panel">
        <MultiSelect label="比赛名称" values={filterOptions.tournaments} selected={tournaments} onChange={setTournaments} />
        <MultiSelect label="角色" values={filterOptions.characters} selected={characters} onChange={setCharacters} />
        <MultiSelect label="终点" values={filterOptions.destinations} selected={destinations} onChange={setDestinations} />
        <MultiSelect label="游戏版本" values={filterOptions.gameVersions} selected={gameVersions} onChange={setGameVersions} />
        <MultiSelect label="Mod" values={filterOptions.modNames} selected={modNames} onChange={setModNames} />
      </div>

      <div className="section-heading">
        <h2>对局</h2>
        <p>共 {filteredMatches.length} 场符合条件</p>
      </div>
      <MatchTable matches={filteredMatches} pageSize={30} />
    </section>
  );
}
