import { useMemo, useState } from "react";
import MatchTable from "../components/MatchTable";
import MultiSelect from "../components/MultiSelect";
import type { AppData } from "../types/data";

type Props = {
  data: AppData;
};

const includesAny = (selected: string[], value: string) => selected.length === 0 || selected.includes(value);

export default function MatchesPage({ data }: Props) {
  const [tournaments, setTournaments] = useState<string[]>([]);
  const [characters, setCharacters] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [gameVersions, setGameVersions] = useState<string[]>([]);
  const [modNames, setModNames] = useState<string[]>([]);
  const [playerKeyword, setPlayerKeyword] = useState("");

  const allMatches = useMemo(() => [...data.matches, ...data.arenaMatches], [data.arenaMatches, data.matches]);
  const filterOptions = useMemo(
    () => ({
      tournaments: Array.from(new Set(allMatches.map((match) => match.tournamentName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "zh-Hans-CN")
      ),
      characters: Array.from(new Set(allMatches.map((match) => match.character).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "zh-Hans-CN")
      ),
      destinations: Array.from(new Set(allMatches.map((match) => match.destination).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "zh-Hans-CN")
      ),
      gameVersions: Array.from(new Set(allMatches.map((match) => match.gameVersion).filter(Boolean))).sort(),
      modNames: Array.from(new Set(allMatches.map((match) => match.modName).filter(Boolean))).sort()
    }),
    [allMatches]
  );

  const filteredMatches = useMemo(() => {
    const keyword = playerKeyword.trim().toLowerCase();
    return allMatches.filter((match) => {
      const playerMatched =
        !keyword ||
        match.winnerName.toLowerCase().includes(keyword) ||
        match.loserName.toLowerCase().includes(keyword);

      return (
        includesAny(tournaments, match.tournamentName) &&
        includesAny(characters, match.character) &&
        includesAny(destinations, match.destination) &&
        includesAny(gameVersions, match.gameVersion) &&
        includesAny(modNames, match.modName) &&
        playerMatched
      );
    });
  }, [allMatches, characters, destinations, gameVersions, modNames, playerKeyword, tournaments]);

  const resetAnd = (action: () => void) => {
    action();
  };

  return (
    <section className="stack">
      <div className="filter-panel">
        <MultiSelect
          label="比赛名称"
          values={filterOptions.tournaments}
          selected={tournaments}
          onChange={(value) => resetAnd(() => setTournaments(value))}
        />
        <label className="field">
          <span>选手 id</span>
          <input
            value={playerKeyword}
            onChange={(event) => resetAnd(() => setPlayerKeyword(event.target.value))}
            placeholder="搜索胜者或败者"
          />
        </label>
        <MultiSelect
          label="角色"
          values={filterOptions.characters}
          selected={characters}
          onChange={(value) => resetAnd(() => setCharacters(value))}
        />
        <MultiSelect
          label="终点"
          values={filterOptions.destinations}
          selected={destinations}
          onChange={(value) => resetAnd(() => setDestinations(value))}
        />
        <MultiSelect
          label="游戏版本"
          values={filterOptions.gameVersions}
          selected={gameVersions}
          onChange={(value) => resetAnd(() => setGameVersions(value))}
        />
        <MultiSelect
          label="Mod"
          values={filterOptions.modNames}
          selected={modNames}
          onChange={(value) => resetAnd(() => setModNames(value))}
        />
      </div>

      <div className="section-heading row">
        <div>
          <h2>对局</h2>
          <p>共 {filteredMatches.length} 场符合条件</p>
        </div>
      </div>
      <MatchTable matches={filteredMatches} pageSize={30} />
    </section>
  );
}
