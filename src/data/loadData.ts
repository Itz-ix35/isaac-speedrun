import type { AppData } from "../types/data";

const loadJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const loadData = async (): Promise<AppData> => {
  const [tournaments, stages, players, matches, arenaMatches, series, brackets, filters] = await Promise.all([
    loadJson<AppData["tournaments"]>("data/tournaments.json"),
    loadJson<AppData["stages"]>("data/stages.json"),
    loadJson<AppData["players"]>("data/players.json"),
    loadJson<AppData["matches"]>("data/matches.json"),
    loadJson<AppData["arenaMatches"]>("data/arenaMatches.json"),
    loadJson<AppData["series"]>("data/series.json"),
    loadJson<AppData["brackets"]>("data/brackets.json"),
    loadJson<AppData["filters"]>("data/filters.json")
  ]);

  return { tournaments, stages, players, matches, arenaMatches, series, brackets, filters };
};
