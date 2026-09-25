import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parse } from "csv-parse/sync";

type SourceRow = {
  来源: string;
  日期: string;
  种子: string;
  角色: string;
  终点: string;
  胜者: string;
  败者: string;
  胜者成绩: string;
  视频: string;
  "新知识/糖"?: string;
};

type Tournament = {
  id: string;
  name: string;
};

type Stage = {
  id: string;
  tournamentId: string;
  name: string;
  sortOrder: number;
};

type Player = {
  id: string;
  displayName: string;
  streamRoom: string;
  matchCount: number;
  winCount: number;
  lossCount: number;
};

type Match = {
  id: string;
  tournamentId: string;
  stageId: string;
  tournamentName: string;
  stageName: string;
  date: string;
  seed: string;
  character: string;
  destination: string;
  winnerPlayerId: string;
  loserPlayerId: string;
  winnerName: string;
  loserName: string;
  winnerTime: string;
  videoHtml: string;
  videoUrl: string;
  videoLabel: string;
  gameVersion: string;
  modName: "bisai" | "bisai+" | "bisai_berserk";
  tags: string[];
  isSpecial: boolean;
  note: string;
  sourceRaw: string;
};

type SeriesFormat = "BO3" | "BO5" | "BO7";

type Series = {
  id: string;
  tournamentId: string;
  stageId: string;
  tournamentName: string;
  stageName: string;
  format: SeriesFormat;
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  winnerPlayerId: string;
  winnerName: string;
  loserPlayerId: string;
  loserName: string;
  playerAWins: number;
  playerBWins: number;
  matchIds: string[];
  dates: string[];
  warnings: string[];
};

type RoundEntry = {
  id: string;
  tournamentId: string;
  stageId: string;
  stageName: string;
  stageOrder: number;
  format: SeriesFormat | "BO1";
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  winnerPlayerId: string;
  winnerName: string;
  loserPlayerId: string;
  loserName: string;
  playerAWins: number;
  playerBWins: number;
  matchIds: string[];
  seriesId?: string;
};

type BracketNode = {
  id: string;
  roundName: string;
  playerId?: string;
  playerName?: string;
  winnerPlayerId?: string;
  winnerName?: string;
  loserPlayerId?: string;
  loserName?: string;
  format?: SeriesFormat | "BO1";
  score?: string;
  matchIds?: string[];
  seriesId?: string;
  championName?: string;
  displayRoundName?: string;
  left?: BracketNode;
  right?: BracketNode;
  children?: BracketNode[];
};

type SwissBracketEntry = {
  id: string;
  roundNumber: number;
  stageName: string;
  stageRank: number;
  winnerName: string;
  loserName: string;
  format: SeriesFormat;
  score: string;
  matchIds: string[];
  seriesId?: string;
};

type SwissBracketRound = {
  roundNumber: number;
  entries: SwissBracketEntry[];
};

type SwissBracketResult = {
  playerId: string;
  playerName: string;
  wins: number;
  losses: number;
};

type DoubleElimBracketEntry = {
  id: string;
  stageName: string;
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  winnerPlayerId: string;
  winnerName: string;
  loserPlayerId: string;
  loserName: string;
  format: SeriesFormat;
  score: string;
  matchIds: string[];
  seriesId?: string;
};

type DoubleElimBracketRound = {
  cycleNumber: number;
  winners: DoubleElimBracketEntry[];
  losersEarly: DoubleElimBracketEntry[];
  losersLate: DoubleElimBracketEntry[];
};

type Bracket = {
  tournamentId: string;
  tournamentName: string;
  root: BracketNode | null;
  thirdPlace: BracketNode | null;
  swissRounds?: SwissBracketRound[];
  swissResults?: SwissBracketResult[];
  doubleElimRounds?: DoubleElimBracketRound[];
  doubleElimFinal?: DoubleElimBracketEntry;
  warnings: string[];
};

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, "data.txt");
const ALT_ACCOUNT_FILE = path.join(ROOT, "alt_account.txt");
const OUTPUT_DIR = path.join(ROOT, "public", "data");
const PRESERVE_EXISTING_BRACKETS_ONLY = process.argv.includes("--preserve-existing-brackets-only");

const makeId = (prefix: string, value: string) =>
  `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;

const normalize = (value?: string) => (value ?? "").trim();

const normalizeDate = (value: string) => {
  const [year, month, day] = normalize(value).split("/");
  if (!year || !month || !day) return normalize(value);
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const parseSource = (source: string) => {
  const raw = normalize(source);
  if (raw.includes("-")) {
    const [name, ...rest] = raw.split("-");
    return {
      tournamentName: normalize(name) || "未命名比赛",
      stageName: normalize(rest.join("-")) || "未分组"
    };
  }

  if (raw.startsWith("火山杯")) {
    const stageName = normalize(raw.slice("火山杯".length));
    return {
      tournamentName: "火山杯",
      stageName: stageName || "未分组"
    };
  }

  return {
    tournamentName: raw || "未命名比赛",
    stageName: "未分组"
  };
};

const parseVideo = (html: string) => {
  const value = normalize(html);
  const href = value.match(/href="([^"]+)"/i)?.[1] ?? "";
  const label = value.match(/>([^<]+)</)?.[1] ?? (href ? "视频" : "");
  return { videoUrl: href, videoLabel: label };
};

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

const getGameVersion = (tournamentName: string) => {
  if (tournamentName === "光头杯 1") return "忏悔 v1.06.J820";
  if (tournamentName === "光头杯 2") return "忏悔 v1.7.7a";
  if (tournamentName === "光头杯 3" || tournamentName === "22 年 9 月月考" || tournamentName === "22 年 10 月月考") {
    return "忏悔 v1.7.8a";
  }
  return "忏悔 v1.7.9b";
};

const parseTags = (note: string) => {
  return Array.from(note.matchAll(/【([^】]+)】/g), (match) => normalize(match[1])).filter(Boolean);
};

const getModName = (tournamentName: string, tags: string[]): Match["modName"] => {
  if (tags.includes("狂战")) return "bisai_berserk";
  if (tournamentName === "26 年 4 月月考" || tournamentName === "26 年 6 月月考" || tournamentName === "光头杯 11") {
    return "bisai+";
  }
  return "bisai";
};

const getArenaModName = (date: string, tags: string[]): Match["modName"] => {
  if (tags.includes("狂战")) return "bisai_berserk";
  return date.startsWith("2026-") ? "bisai+" : "bisai";
};

const loadPlayerAliases = async () => {
  const aliases = new Map<string, string>();

  try {
    const content = await readFile(ALT_ACCOUNT_FILE, "utf8");
    for (const [index, line] of content.split(/\r?\n/).entries()) {
      const value = normalize(line);
      if (!value) continue;

      const separator = " - ";
      const separatorIndex = value.indexOf(separator);
      if (separatorIndex === -1) {
        console.warn(`Warning: alt_account.txt line ${index + 1} missing separator`);
        continue;
      }

      const canonicalName = normalize(value.slice(0, separatorIndex));
      const aliasNames = value
        .slice(separatorIndex + separator.length)
        .split(",")
        .map(normalize)
        .filter(Boolean);

      if (!canonicalName || aliasNames.length === 0) continue;
      aliases.set(canonicalName, canonicalName);
      for (const aliasName of aliasNames) {
        const existing = aliases.get(aliasName);
        if (existing && existing !== canonicalName) {
          console.warn(`Warning: alias ${aliasName} is mapped to both ${existing} and ${canonicalName}; using ${canonicalName}`);
        }
        aliases.set(aliasName, canonicalName);
      }
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return aliases;
    }
    throw error;
  }

  return aliases;
};

const MONTHLY_DOUBLE_ELIM_BRACKET_TOURNAMENTS = new Set([
  "22 年 9 月月考",
  "22 年 10 月月考",
  "23 年 3 月月考",
  "23 年 4 月月考",
  "23 年 6 月月考",
  "23 年 9 月月考",
  "24 年 11 月月考",
  "24 年 12 月月考"
]);

const FOUR_PLAYER_DOUBLE_ELIM_BRACKET_TOURNAMENTS = new Set([
  "小登杯",
  ...MONTHLY_DOUBLE_ELIM_BRACKET_TOURNAMENTS
]);

const SWISS_TO_DOUBLE_ELIM_BRACKET_TOURNAMENTS = new Set(["25 年 3 月月考", "25 年 4 月月考"]);
const DOUBLE_ELIM_BRACKET_TOURNAMENTS = new Set(["25 年 9 月月考", "25 年 12 月月考", "26 年 4 月月考", "26 年 6 月月考"]);

const BRACKET_TOURNAMENTS = new Set([
  "光头杯 1",
  "光头杯 3",
  "光头杯 4",
  "光头杯 6",
  "光头杯 7",
  "光头杯 9",
  "光头杯 11",
  "火山杯 2",
  "狂战杯 1",
  "五一排位赛",
  ...DOUBLE_ELIM_BRACKET_TOURNAMENTS,
  ...SWISS_TO_DOUBLE_ELIM_BRACKET_TOURNAMENTS,
  ...FOUR_PLAYER_DOUBLE_ELIM_BRACKET_TOURNAMENTS
]);
const REFRESH_BRACKET_TOURNAMENTS = new Set([
  "光头杯 1",
  "光头杯 3",
  "光头杯 4",
  "光头杯 6",
  "光头杯 7",
  "光头杯 9",
  "光头杯 11",
  "火山杯 2",
  "狂战杯 1",
  "五一排位赛",
  ...DOUBLE_ELIM_BRACKET_TOURNAMENTS,
  ...SWISS_TO_DOUBLE_ELIM_BRACKET_TOURNAMENTS,
  ...FOUR_PLAYER_DOUBLE_ELIM_BRACKET_TOURNAMENTS
]);

const shouldIgnoreSeriesWarning = (tournamentName: string, stageName: string, playerAName: string, playerBName: string) => {
  const players = new Set([playerAName, playerBName]);
  return (
    (tournamentName === "火山杯" || tournamentName === "火山杯 1") &&
    stageName === "4 强" &&
    players.has("五更琉璃") &&
    players.has("TheMaidSakuya")
  ) || (tournamentName === "25 年 12 月月考" && (stageName === "半决赛" || stageName === "败者组第八轮") && players.has("五更琉璃"));
};

const swissBo3Stages = new Set(["0:2 分组", "2:0 分组", "1:2 分组", "2:1 分组", "2:2 分组"]);
const monthly2026Bo3Stages = new Set(["1:0 分组", "0:1 分组", "1:1 分组", "2:0 分组", "2:1 分组"]);
const monthly2026Bo5Stages = new Set(["3:1 分组", "3:0 分组", "4:1 分组", "半决赛", "决赛"]);
const doubleElimBo3Stages = new Set([
  "胜者组第一轮",
  "胜者组第二轮",
  "胜者组第三轮",
  "败者组第一轮",
  "败者组第二轮",
  "败者组第三轮",
  "败者组第四轮",
  "败者组第五轮"
]);
const doubleElimBo5Stages = new Set(["胜者组第四轮", "败者组第六轮", "败者组第七轮", "败者组第八轮", "决赛"]);
const monthly2026DoubleElimBo3Stages = new Set([
  "胜者组第一轮",
  "胜者组第二轮",
  "败者组第一轮",
  "败者组第二轮",
  "败者组第三轮"
]);
const monthly2026DoubleElimBo5Stages = new Set(["胜者组第三轮", "败者组第四轮", "败者组第五轮", "败者组第六轮", "决赛"]);

const getStageFormat = (tournamentName: string, stageName: string): SeriesFormat | null => {
  if ((tournamentName === "22 年 9 月月考" || tournamentName === "22 年 10 月月考") && (stageName === "16 强" || stageName === "8 强")) {
    return null;
  }
  if (
    tournamentName === "光头杯 2" &&
    ["第二天", "第三天", "第四天", "第五天", "第七天", "第八天", "第九天", "第十天"].includes(stageName)
  ) {
    return "BO3";
  }
  if (tournamentName === "光头杯 3" && stageName === "4 强循环赛") return "BO5";
  if (tournamentName === "五一排位赛") return "BO3";
  if (tournamentName === "小登杯" && stageName === "4 强双败") return "BO3";
  if (tournamentName === "光头杯 8" && (stageName === "第三天" || stageName === "第四天")) return "BO3";
  if ((tournamentName === "25 年 3 月月考" || tournamentName === "25 年 4 月月考") && swissBo3Stages.has(stageName.replace(/^16 强 /, ""))) {
    return "BO3";
  }
  if ((tournamentName === "火山杯 1" || tournamentName === "火山杯 2") && (stageName === "4 强" || stageName === "季军赛" || stageName === "决赛")) {
    return "BO3";
  }
  if (tournamentName === "25 年 9 月月考") {
    if (doubleElimBo3Stages.has(stageName)) return "BO3";
    if (doubleElimBo5Stages.has(stageName)) return "BO5";
  }
  if (tournamentName === "25 年 12 月月考") {
    if (
      ["1:0 分组", "0:1 分组", "2:0 分组", "1:1 分组", "2:1 分组", "3:0 分组", "3:1 分组"].includes(stageName) ||
      doubleElimBo3Stages.has(stageName)
    ) {
      return "BO3";
    }
    if (["六进四淘汰", "4:0 分组", "四进三淘汰", "半决赛", "决赛"].includes(stageName) || doubleElimBo5Stages.has(stageName)) {
      return "BO5";
    }
  }
  if (tournamentName === "狂战杯 1" && stageName === "12 强") return "BO3";
  if (tournamentName === "狂战杯 1" && stageName === "8 强") return "BO7";
  if (
    (tournamentName === "26 年 4 月月考" || tournamentName === "26 年 6 月月考") &&
    (monthly2026Bo3Stages.has(stageName) || monthly2026DoubleElimBo3Stages.has(stageName))
  ) {
    return "BO3";
  }
  if (
    (tournamentName === "26 年 4 月月考" || tournamentName === "26 年 6 月月考") &&
    (monthly2026Bo5Stages.has(stageName) || monthly2026DoubleElimBo5Stages.has(stageName))
  ) {
    return "BO5";
  }

  if (stageName === "16 强" || stageName === "8 强") return "BO3";
  if (stageName === "4 强" || stageName === "四强" || stageName === "季军赛" || stageName === "决赛") {
    return "BO5";
  }
  return null;
};

const getStageRank = (stageName: string) => {
  if (stageName.startsWith("16 强 ") && parseSwissStage(stageName)) return 30;
  const ranks: Record<string, number> = {
    "48 强": 10,
    "24 强": 20,
    "16 强": 30,
    "12 强": 35,
    "8 强": 40,
    "4 强": 50,
    "四强": 50,
    "4 强循环赛": 50,
    "4 强双败": 50,
    "4 强抢四": 50,
    季军赛: 60,
    决赛: 70
  };
  return ranks[stageName] ?? 0;
};

const getPairKey = (playerAId: string, playerBId: string) => [playerAId, playerBId].sort().join(":");

const getScore = (entry: Pick<RoundEntry, "playerAWins" | "playerBWins">) =>
  `${entry.playerAWins}:${entry.playerBWins}`;

const getEntryLastMatchIndex = (entry: RoundEntry) => {
  return Math.max(...entry.matchIds.map((matchId) => Number(matchId.replace(/^m-/, ""))).filter(Number.isFinite), 0);
};

const parseSwissStage = (stageName: string) => {
  const match = stageName.match(/^(?:16 强 )?(\d+):(\d+) 分组$/);
  if (!match) return null;
  const wins = Number(match[1]);
  const losses = Number(match[2]);
  return {
    wins,
    losses,
    roundNumber: wins + losses + 1
  };
};

const chineseRoundNumber = (stageName: string) => {
  const match = stageName.match(/第([一二三四五六七八九十]+)轮/);
  if (!match) return null;
  const values: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  return values[match[1]] ?? null;
};

const getWinsRequired = (format: SeriesFormat) => {
  if (format === "BO3") return 2;
  if (format === "BO5") return 3;
  return 4;
};

const getMaxGames = (format: SeriesFormat) => {
  if (format === "BO3") return 3;
  if (format === "BO5") return 5;
  return 7;
};

const getSeriesFormatOverride = (
  tournamentName: string,
  stageName: string,
  playerAName: string,
  playerBName: string,
  baseFormat: SeriesFormat
): SeriesFormat => {
  const players = new Set([playerAName, playerBName]);
  if (tournamentName === "小登杯" && stageName === "4 强双败" && players.has("风雅颂") && players.has("故障小蓝神")) {
    return "BO5";
  }
  return baseFormat;
};

const getSeriesGroupKey = (match: Match) => {
  const baseKey = `${match.tournamentId}:${match.stageId}:${getPairKey(match.winnerPlayerId, match.loserPlayerId)}`;
  if (match.tournamentName === "小登杯" && match.stageName === "4 强双败") {
    if (["m-758", "m-759", "m-760"].includes(match.id)) return `${baseKey}:set-1`;
    if (["m-768", "m-769", "m-770"].includes(match.id)) return `${baseKey}:set-2`;
  }
  return baseKey;
};

const buildSeries = (matches: Match[], stageList: Stage[]) => {
  const stageById = new Map(stageList.map((stage) => [stage.id, stage]));
  const grouped = new Map<string, Match[]>();
  const series: Series[] = [];
  const warnings: string[] = [];

  for (const match of matches) {
    const format = getStageFormat(match.tournamentName, match.stageName);
    if (!format) continue;
    const key = getSeriesGroupKey(match);
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }

  for (const [key, group] of grouped.entries()) {
    const sortedMatches = group.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const first = sortedMatches[0];
    const playerIds = Array.from(
      new Set(sortedMatches.flatMap((match) => [match.winnerPlayerId, match.loserPlayerId]))
    ).sort();
    const playerAId = playerIds[0];
    const playerBId = playerIds[1];
    const playerAName =
      sortedMatches.find((match) => match.winnerPlayerId === playerAId)?.winnerName ??
      sortedMatches.find((match) => match.loserPlayerId === playerAId)?.loserName ??
      "未知选手";
    const playerBName =
      sortedMatches.find((match) => match.winnerPlayerId === playerBId)?.winnerName ??
      sortedMatches.find((match) => match.loserPlayerId === playerBId)?.loserName ??
      "未知选手";
    const playerAWins = sortedMatches.filter((match) => match.winnerPlayerId === playerAId).length;
    const playerBWins = sortedMatches.filter((match) => match.winnerPlayerId === playerBId).length;
    const baseFormat = getStageFormat(first.tournamentName, first.stageName)!;
    const format = getSeriesFormatOverride(first.tournamentName, first.stageName, playerAName, playerBName, baseFormat);
    const localWarnings: string[] = [];
    const winnerWins = Math.max(playerAWins, playerBWins);
    const requiredWins = getWinsRequired(format);
    const maxGames = getMaxGames(format);

    if (playerIds.length !== 2) {
      localWarnings.push(`${first.tournamentName} ${first.stageName} 有一组系列赛选手数不是 2`);
    }
    if (playerAWins === playerBWins) {
      localWarnings.push(`${first.tournamentName} ${first.stageName} ${playerAName} vs ${playerBName} 胜场相同`);
    }
    if (!shouldIgnoreSeriesWarning(first.tournamentName, first.stageName, playerAName, playerBName)) {
      if (winnerWins !== requiredWins) {
        localWarnings.push(
          `${first.tournamentName} ${first.stageName} ${playerAName} vs ${playerBName} ${format} 胜者胜场为 ${winnerWins}，应为 ${requiredWins}`
        );
      }
      if (sortedMatches.length > maxGames) {
        localWarnings.push(
          `${first.tournamentName} ${first.stageName} ${playerAName} vs ${playerBName} ${format} 对局数为 ${sortedMatches.length}，超过 ${maxGames}`
        );
      }
    }

    const winnerIsA = playerAWins >= playerBWins;
    const id = makeId("series", key);
    const item: Series = {
      id,
      tournamentId: first.tournamentId,
      stageId: first.stageId,
      tournamentName: first.tournamentName,
      stageName: first.stageName,
      format,
      playerAId,
      playerBId,
      playerAName,
      playerBName,
      winnerPlayerId: winnerIsA ? playerAId : playerBId,
      winnerName: winnerIsA ? playerAName : playerBName,
      loserPlayerId: winnerIsA ? playerBId : playerAId,
      loserName: winnerIsA ? playerBName : playerAName,
      playerAWins,
      playerBWins,
      matchIds: sortedMatches.map((match) => match.id),
      dates: uniqueSorted(sortedMatches.map((match) => match.date)),
      warnings: localWarnings
    };
    series.push(item);
    warnings.push(...localWarnings);

    if (!stageById.has(first.stageId)) {
      warnings.push(`缺失赛段记录：${first.stageName}`);
    }
  }

  return {
    series: series.sort((a, b) => a.tournamentName.localeCompare(b.tournamentName, "zh-Hans-CN") || a.stageName.localeCompare(b.stageName, "zh-Hans-CN")),
    warnings
  };
};

const buildRoundEntries = (matches: Match[], series: Series[], stageList: Stage[]) => {
  const stageById = new Map(stageList.map((stage) => [stage.id, stage]));
  const seriesMatchIds = new Set(series.flatMap((item) => item.matchIds));
  const entries: RoundEntry[] = [];

  for (const item of series) {
    entries.push({
      id: item.id,
      tournamentId: item.tournamentId,
      stageId: item.stageId,
      stageName: item.stageName,
      stageOrder: getStageRank(item.stageName) || stageById.get(item.stageId)?.sortOrder || 0,
      format: item.format,
      playerAId: item.playerAId,
      playerBId: item.playerBId,
      playerAName: item.playerAName,
      playerBName: item.playerBName,
      winnerPlayerId: item.winnerPlayerId,
      winnerName: item.winnerName,
      loserPlayerId: item.loserPlayerId,
      loserName: item.loserName,
      playerAWins: item.playerAWins,
      playerBWins: item.playerBWins,
      matchIds: item.matchIds,
      seriesId: item.id
    });
  }

  for (const match of matches) {
    if (seriesMatchIds.has(match.id)) continue;
    entries.push({
      id: match.id,
      tournamentId: match.tournamentId,
      stageId: match.stageId,
      stageName: match.stageName,
      stageOrder: getStageRank(match.stageName) || stageById.get(match.stageId)?.sortOrder || 0,
      format: "BO1",
      playerAId: match.winnerPlayerId,
      playerBId: match.loserPlayerId,
      playerAName: match.winnerName,
      playerBName: match.loserName,
      winnerPlayerId: match.winnerPlayerId,
      winnerName: match.winnerName,
      loserPlayerId: match.loserPlayerId,
      loserName: match.loserName,
      playerAWins: 1,
      playerBWins: 0,
      matchIds: [match.id]
    });
  }

  return entries;
};

const buildBrackets = (tournamentList: Tournament[], entries: RoundEntry[]) => {
  const brackets: Bracket[] = [];

  for (const tournament of tournamentList) {
    if (!BRACKET_TOURNAMENTS.has(tournament.name)) continue;

    const warnings: string[] = [];
    const tournamentEntries = entries
      .filter((entry) => entry.tournamentId === tournament.id)
      .sort((a, b) => a.stageOrder - b.stageOrder || a.id.localeCompare(b.id));
    const mainEntries = tournamentEntries.filter((entry) => entry.stageName !== "季军赛");
    const finalEntry =
      mainEntries.find((entry) => entry.stageName === "决赛") ??
      mainEntries.reduce<RoundEntry | null>((latest, entry) => (!latest || entry.stageOrder > latest.stageOrder ? entry : latest), null);
    const thirdPlaceEntry = tournamentEntries.find((entry) => entry.stageName === "季军赛") ?? null;

    if (!finalEntry) {
      warnings.push(`${tournament.name} 没有可用于还原赛程图的对局`);
      brackets.push({ tournamentId: tournament.id, tournamentName: tournament.name, root: null, thirdPlace: null, warnings });
      continue;
    }

    const usesSpecialFourPlayerFinal =
      tournament.name === "光头杯 3" ||
      tournament.name === "五一排位赛" ||
      tournament.name === "狂战杯 1" ||
      SWISS_TO_DOUBLE_ELIM_BRACKET_TOURNAMENTS.has(tournament.name) ||
      FOUR_PLAYER_DOUBLE_ELIM_BRACKET_TOURNAMENTS.has(tournament.name);

    if (finalEntry.stageName !== "决赛" && !usesSpecialFourPlayerFinal) {
      warnings.push(`${tournament.name} 缺失决赛，使用 ${finalEntry.stageName} 作为当前赛程图根节点`);
    }

    const findSourceEntry = (playerId: string, before: RoundEntry) => {
      return mainEntries
        .filter((entry) => entry.stageOrder < before.stageOrder && entry.winnerPlayerId === playerId)
        .sort((a, b) => b.stageOrder - a.stageOrder || b.id.localeCompare(a.id))[0];
    };

    const leafNode = (playerId: string, playerName: string, roundName: string): BracketNode => ({
      id: makeId("leaf", `${tournament.id}:${roundName}:${playerId}`),
      roundName,
      playerId,
      playerName,
      winnerPlayerId: playerId,
      winnerName: playerName
    });

    const buildPlayerNode = (playerId: string, playerName: string, before: RoundEntry, seen: Set<string>): BracketNode => {
      const source = findSourceEntry(playerId, before);
      if (!source) {
        return leafNode(playerId, playerName, before.stageName);
      }
      return buildEntryNode(source, seen);
    };

    const buildPlayerNodeFromStage = (
      playerId: string,
      playerName: string,
      before: RoundEntry,
      seen: Set<string>,
      minStageOrder: number
    ): BracketNode => {
      const source = mainEntries
        .filter((entry) => entry.stageOrder >= minStageOrder && entry.stageOrder < before.stageOrder && entry.winnerPlayerId === playerId)
        .sort((a, b) => b.stageOrder - a.stageOrder || b.id.localeCompare(a.id))[0];
      if (!source) {
        return leafNode(playerId, playerName, before.stageName);
      }
      return buildEntryNodeFromStage(source, seen, minStageOrder);
    };

    const buildEntryNodeFromStage = (entry: RoundEntry, seen = new Set<string>(), minStageOrder: number): BracketNode => {
      if (seen.has(entry.id)) {
        warnings.push(`${tournament.name} 赛程图检测到循环来源：${entry.stageName}`);
        return leafNode(entry.winnerPlayerId, entry.winnerName, entry.stageName);
      }
      const nextSeen = new Set(seen);
      nextSeen.add(entry.id);
      return {
        id: makeId("bracket", `${tournament.id}:${entry.id}:min-${minStageOrder}`),
        roundName: entry.stageName,
        winnerPlayerId: entry.winnerPlayerId,
        winnerName: entry.winnerName,
        loserPlayerId: entry.loserPlayerId,
        loserName: entry.loserName,
        format: entry.format,
        score: getScore(entry),
        matchIds: entry.matchIds,
        seriesId: entry.seriesId,
        left: buildPlayerNodeFromStage(entry.playerAId, entry.playerAName, entry, nextSeen, minStageOrder),
        right: buildPlayerNodeFromStage(entry.playerBId, entry.playerBName, entry, nextSeen, minStageOrder)
      };
    };

    const buildEntryNode = (entry: RoundEntry, seen = new Set<string>()): BracketNode => {
      if (seen.has(entry.id)) {
        warnings.push(`${tournament.name} 赛程图检测到循环来源：${entry.stageName}`);
        return leafNode(entry.winnerPlayerId, entry.winnerName, entry.stageName);
      }
      const nextSeen = new Set(seen);
      nextSeen.add(entry.id);
      return {
        id: makeId("bracket", `${tournament.id}:${entry.id}`),
        roundName: entry.stageName,
        winnerPlayerId: entry.winnerPlayerId,
        winnerName: entry.winnerName,
        loserPlayerId: entry.loserPlayerId,
        loserName: entry.loserName,
        format: entry.format,
        score: getScore(entry),
        matchIds: entry.matchIds,
        seriesId: entry.seriesId,
        left: buildPlayerNode(entry.playerAId, entry.playerAName, entry, nextSeen),
        right: buildPlayerNode(entry.playerBId, entry.playerBName, entry, nextSeen)
      };
    };

    if (tournament.name === "五一排位赛") {
      const rounds = new Map<number, SwissBracketEntry[]>();
      const playerRecords = new Map<string, SwissBracketResult>();
      const ensurePlayerRecord = (playerId: string, playerName: string) => {
        const existing = playerRecords.get(playerId);
        if (existing) return existing;
        const created = { playerId, playerName, wins: 0, losses: 0 };
        playerRecords.set(playerId, created);
        return created;
      };

      for (const entry of mainEntries) {
        const swissStage = parseSwissStage(entry.stageName);
        if (!swissStage) continue;
        const winnerWins = entry.winnerPlayerId === entry.playerAId ? entry.playerAWins : entry.playerBWins;
        const loserWins = entry.loserPlayerId === entry.playerAId ? entry.playerAWins : entry.playerBWins;
        ensurePlayerRecord(entry.winnerPlayerId, entry.winnerName).wins += 1;
        ensurePlayerRecord(entry.loserPlayerId, entry.loserName).losses += 1;
        const item: SwissBracketEntry = {
          id: makeId("swiss", `${tournament.id}:${entry.id}`),
          roundNumber: swissStage.roundNumber,
          stageName: entry.stageName,
          stageRank: swissStage.wins,
          winnerName: entry.winnerName,
          loserName: entry.loserName,
          format: entry.format as SeriesFormat,
          score: `${winnerWins}:${loserWins}`,
          matchIds: entry.matchIds,
          seriesId: entry.seriesId
        };
        rounds.set(swissStage.roundNumber, [...(rounds.get(swissStage.roundNumber) ?? []), item]);
      }

      brackets.push({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        root: null,
        thirdPlace: null,
        swissRounds: Array.from(rounds.entries())
          .sort(([roundA], [roundB]) => roundA - roundB)
          .map(([roundNumber, roundEntries]) => ({
            roundNumber,
            entries: roundEntries.sort((a, b) => b.stageRank - a.stageRank || a.stageName.localeCompare(b.stageName, "zh-Hans-CN") || a.id.localeCompare(b.id))
          })),
        swissResults: Array.from(playerRecords.values()).sort(
          (a, b) => b.wins - a.wins || a.losses - b.losses || a.playerName.localeCompare(b.playerName, "zh-Hans-CN")
        ),
        warnings
      });
      continue;
    }

    const toDoubleElimEntry = (entry: RoundEntry): DoubleElimBracketEntry => {
      const winnerWins = entry.winnerPlayerId === entry.playerAId ? entry.playerAWins : entry.playerBWins;
      const loserWins = entry.loserPlayerId === entry.playerAId ? entry.playerAWins : entry.playerBWins;
      return {
        id: makeId("double-elim", `${tournament.id}:${entry.id}`),
        stageName: entry.stageName,
        playerAId: entry.playerAId,
        playerBId: entry.playerBId,
        playerAName: entry.playerAName,
        playerBName: entry.playerBName,
        winnerPlayerId: entry.winnerPlayerId,
        winnerName: entry.winnerName,
        loserPlayerId: entry.loserPlayerId,
        loserName: entry.loserName,
        format: entry.format as SeriesFormat,
        score: `${winnerWins}:${loserWins}`,
        matchIds: entry.matchIds,
        seriesId: entry.seriesId
      };
    };

    if (DOUBLE_ELIM_BRACKET_TOURNAMENTS.has(tournament.name)) {
      const cycles = new Map<number, DoubleElimBracketRound>();
      const ensureCycle = (cycleNumber: number) => {
        const existing = cycles.get(cycleNumber);
        if (existing) return existing;
        const created = { cycleNumber, winners: [], losersEarly: [], losersLate: [] };
        cycles.set(cycleNumber, created);
        return created;
      };
      let doubleElimFinal: DoubleElimBracketEntry | undefined;

      for (const entry of mainEntries) {
        if (entry.stageName === "决赛") {
          doubleElimFinal = toDoubleElimEntry(entry);
          continue;
        }

        const roundNumber = chineseRoundNumber(entry.stageName);
        if (!roundNumber) continue;
        const item = toDoubleElimEntry(entry);
        if (entry.stageName.startsWith("胜者组")) {
          ensureCycle(roundNumber).winners.push(item);
        } else if (entry.stageName.startsWith("败者组")) {
          const cycleNumber = Math.ceil(roundNumber / 2);
          const cycle = ensureCycle(cycleNumber);
          if (roundNumber % 2 === 1) {
            cycle.losersEarly.push(item);
          } else {
            cycle.losersLate.push(item);
          }
        }
      }

      brackets.push({
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        root: null,
        thirdPlace: null,
        doubleElimRounds: Array.from(cycles.values()).sort((a, b) => a.cycleNumber - b.cycleNumber),
        doubleElimFinal,
        warnings
      });
      continue;
    }

    const buildSpecialFourPlayerFinal = (stageName: string, displayRoundName: string, preferredOrder: string[] = []) => {
      const finalStageEntries = mainEntries.filter((entry) => entry.stageName === stageName);
      const sourceStageOrder = finalStageEntries.length
        ? Math.max(...mainEntries.filter((entry) => entry.stageOrder < finalStageEntries[0].stageOrder).map((entry) => entry.stageOrder))
        : 0;
      const sourceEntries =
        sourceStageOrder > 0 ? mainEntries.filter((entry) => entry.stageOrder === sourceStageOrder && entry.winnerPlayerId) : [];

      const sourceSemifinalists = new Map(sourceEntries.map((entry) => [entry.winnerPlayerId, entry.winnerName]));
      const finalStageSemifinalists = new Map<string, string>();
      for (const entry of finalStageEntries) {
        finalStageSemifinalists.set(entry.playerAId, entry.playerAName);
        finalStageSemifinalists.set(entry.playerBId, entry.playerBName);
      }
      const semifinalists = sourceSemifinalists.size === 4 ? sourceSemifinalists : finalStageSemifinalists;

      const orderedSemifinalists = Array.from(semifinalists.entries()).sort(([, nameA], [, nameB]) => {
        const indexA = preferredOrder.indexOf(nameA);
        const indexB = preferredOrder.indexOf(nameB);
        if (indexA !== -1 || indexB !== -1) return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB);
        return nameA.localeCompare(nameB, "zh-Hans-CN");
      });

      if (finalStageEntries.length > 0 && orderedSemifinalists.length === 4) {
        const lastEntry = [...finalStageEntries].sort((a, b) => getEntryLastMatchIndex(b) - getEntryLastMatchIndex(a))[0];
        const championName = lastEntry.winnerName;
        brackets.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          root: {
            id: makeId("bracket", `${tournament.id}:${stageName}:special-final`),
            roundName: stageName,
            displayRoundName,
            winnerPlayerId: lastEntry.winnerPlayerId,
            winnerName: championName,
            championName,
            matchIds: finalStageEntries.flatMap((entry) => entry.matchIds),
            children: orderedSemifinalists.map(([playerId, playerName]) => {
              const source = sourceEntries.find((entry) => entry.winnerPlayerId === playerId) ?? findSourceEntry(playerId, finalStageEntries[0]);
              return source ? buildEntryNode(source) : leafNode(playerId, playerName, stageName);
            })
          },
          thirdPlace: null,
          warnings
        });
        return true;
      }

      warnings.push(`${tournament.name} ${displayRoundName} 无法识别为 4 名选手，使用普通赛程图根节点`);
      return false;
    };

    const buildSwissRounds = (entriesForSwiss: RoundEntry[]) => {
      const rounds = new Map<number, SwissBracketEntry[]>();
      for (const entry of entriesForSwiss) {
        const swissStage = parseSwissStage(entry.stageName);
        if (!swissStage) continue;
        const winnerWins = entry.winnerPlayerId === entry.playerAId ? entry.playerAWins : entry.playerBWins;
        const loserWins = entry.loserPlayerId === entry.playerAId ? entry.playerAWins : entry.playerBWins;
        const item: SwissBracketEntry = {
          id: makeId("swiss", `${tournament.id}:${entry.id}`),
          roundNumber: swissStage.roundNumber,
          stageName: entry.stageName,
          stageRank: swissStage.wins,
          winnerName: entry.winnerName,
          loserName: entry.loserName,
          format: entry.format as SeriesFormat,
          score: `${winnerWins}:${loserWins}`,
          matchIds: entry.matchIds,
          seriesId: entry.seriesId
        };
        rounds.set(swissStage.roundNumber, [...(rounds.get(swissStage.roundNumber) ?? []), item]);
      }

      return Array.from(rounds.entries())
        .sort(([roundA], [roundB]) => roundA - roundB)
        .map(([roundNumber, roundEntries]) => ({
          roundNumber,
          entries: roundEntries.sort((a, b) => b.stageRank - a.stageRank || a.stageName.localeCompare(b.stageName, "zh-Hans-CN") || a.id.localeCompare(b.id))
        }));
    };

    const buildSpecialFourPlayerRoot = (stageName: string, displayRoundName: string) => {
      const finalStageEntries = mainEntries.filter((entry) => entry.stageName === stageName);
      const sourceStageOrder = finalStageEntries.length
        ? Math.max(...mainEntries.filter((entry) => entry.stageOrder < finalStageEntries[0].stageOrder).map((entry) => entry.stageOrder))
        : 0;
      const sourceEntries =
        sourceStageOrder > 0 ? mainEntries.filter((entry) => entry.stageOrder === sourceStageOrder && entry.winnerPlayerId) : [];
      const semifinalists = new Map(sourceEntries.map((entry) => [entry.winnerPlayerId, entry.winnerName]));
      if (finalStageEntries.length === 0 || semifinalists.size !== 4) return null;

      const lastEntry = [...finalStageEntries].sort((a, b) => getEntryLastMatchIndex(b) - getEntryLastMatchIndex(a))[0];
      const championName = lastEntry.winnerName;
      return {
        id: makeId("bracket", `${tournament.id}:${stageName}:special-final`),
        roundName: stageName,
        displayRoundName,
        winnerPlayerId: lastEntry.winnerPlayerId,
        winnerName: championName,
        championName,
        matchIds: finalStageEntries.flatMap((entry) => entry.matchIds),
        children: Array.from(semifinalists.entries())
          .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB, "zh-Hans-CN"))
          .map(([playerId, playerName]) => {
            const source = sourceEntries.find((entry) => entry.winnerPlayerId === playerId);
            return source ? buildEntryNode(source) : leafNode(playerId, playerName, stageName);
          })
      } satisfies BracketNode;
    };

    if (SWISS_TO_DOUBLE_ELIM_BRACKET_TOURNAMENTS.has(tournament.name)) {
      const root = buildSpecialFourPlayerRoot("4 强双败", "4 强双败赛");
      if (root) {
        root.children = root.children?.map((child) => {
          if (!child.matchIds?.length) return child;
          const source = mainEntries.find((entry) => entry.matchIds.join(":") === child.matchIds?.join(":"));
          return source ? buildEntryNodeFromStage(source, new Set<string>(), getStageRank("8 强")) : child;
        });
        brackets.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          root,
          thirdPlace: null,
          swissRounds: buildSwissRounds(mainEntries.filter((entry) => entry.stageName.startsWith("16 强 "))),
          warnings
        });
        continue;
      }

      warnings.push(`${tournament.name} 4 强双败赛无法识别为 4 名选手，使用普通赛程图根节点`);
    }

    if (tournament.name === "光头杯 3") {
      if (buildSpecialFourPlayerFinal("4 强循环赛", "4 强循环赛", ["一块蓝冰", "凉茶和凉皮", "冰糖", "路遇一只鲈鱼"])) {
        continue;
      }
    }

    if (tournament.name === "狂战杯 1") {
      const finalStageEntries = mainEntries.filter((entry) => entry.stageName === "4 强抢四");
      const sourceEntries = mainEntries.filter((entry) => entry.stageName === "8 强");
      const semifinalists = new Map(sourceEntries.map((entry) => [entry.winnerPlayerId, entry.winnerName]));
      if (finalStageEntries.length > 0 && semifinalists.size === 4) {
        brackets.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          root: {
            id: makeId("bracket", `${tournament.id}:4 强抢四:special-final`),
            roundName: "4 强抢四",
            displayRoundName: "4 强抢四赛",
            winnerName: "DSNT",
            championName: "DSNT",
            matchIds: finalStageEntries.flatMap((entry) => entry.matchIds),
            children: Array.from(semifinalists.entries())
              .sort(([, nameA], [, nameB]) => nameA.localeCompare(nameB, "zh-Hans-CN"))
              .map(([playerId, playerName]) => {
                const source = sourceEntries.find((entry) => entry.winnerPlayerId === playerId);
                return source ? buildEntryNode(source) : leafNode(playerId, playerName, "4 强抢四");
              })
          },
          thirdPlace: null,
          warnings
        });
        continue;
      }

      warnings.push(`${tournament.name} 4 强抢四赛无法识别为 4 名选手，使用普通赛程图根节点`);
    }

    if (FOUR_PLAYER_DOUBLE_ELIM_BRACKET_TOURNAMENTS.has(tournament.name)) {
      if (buildSpecialFourPlayerFinal("4 强双败", "4 强双败赛")) {
        continue;
      }
    }

    brackets.push({
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      root: buildEntryNode(finalEntry),
      thirdPlace: thirdPlaceEntry ? buildEntryNode(thirdPlaceEntry) : null,
      warnings
    });
  }

  return brackets;
};

const loadExistingBrackets = async () => {
  try {
    const content = await readFile(path.join(OUTPUT_DIR, "brackets.json"), "utf8");
    return JSON.parse(content) as Bracket[];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const preserveExistingBrackets = (
  generatedBrackets: Bracket[],
  existingBrackets: Bracket[],
  preserveExistingOnly = false
) => {
  const existingById = new Map(existingBrackets.map((bracket) => [bracket.tournamentId, bracket]));
  const existingByName = new Map(existingBrackets.map((bracket) => [bracket.tournamentName, bracket]));
  let preservedCount = 0;

  if (preserveExistingOnly) {
    const generatedIds = new Set(generatedBrackets.map((bracket) => bracket.tournamentId));
    const generatedNames = new Set(generatedBrackets.map((bracket) => bracket.tournamentName));
    const brackets = existingBrackets.filter(
      (bracket) => generatedIds.has(bracket.tournamentId) || generatedNames.has(bracket.tournamentName)
    );
    return { brackets, preservedCount: brackets.length };
  }

  const brackets = generatedBrackets.map((bracket) => {
    const existing = existingById.get(bracket.tournamentId) ?? existingByName.get(bracket.tournamentName);
    if (!existing || REFRESH_BRACKET_TOURNAMENTS.has(bracket.tournamentName)) return bracket;
    preservedCount += 1;
    return existing;
  });

  return { brackets, preservedCount };
};

const main = async () => {
  const content = await readFile(DATA_FILE, "utf8");
  const playerAliases = await loadPlayerAliases();
  const rows = parse(content, {
    columns: true,
    bom: true,
    quote: false,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true
  }) as SourceRow[];

  const tournaments = new Map<string, Tournament>();
  const stages = new Map<string, Stage>();
  const players = new Map<string, Player>();
  const matches: Match[] = [];
  const arenaMatches: Match[] = [];

  const getTournament = (name: string) => {
    const id = makeId("t", name);
    if (!tournaments.has(id)) tournaments.set(id, { id, name });
    return tournaments.get(id)!;
  };

  const getStage = (tournamentId: string, name: string) => {
    const key = `${tournamentId}:${name}`;
    const id = makeId("s", key);
    if (!stages.has(id)) {
      stages.set(id, { id, tournamentId, name, sortOrder: stages.size + 1 });
    }
    return stages.get(id)!;
  };

  const getPlayer = (name: string) => {
    const rawName = normalize(name) || "未知选手";
    const displayName = playerAliases.get(rawName) ?? rawName;
    const id = makeId("p", displayName);
    if (!players.has(id)) {
      players.set(id, {
        id,
        displayName,
        streamRoom: "",
        matchCount: 0,
        winCount: 0,
        lossCount: 0
      });
    }
    return players.get(id)!;
  };

  for (const [index, row] of rows.entries()) {
    const sourceRaw = normalize(row.来源);
    const seed = normalize(row.种子);
    const character = normalize(row.角色);
    const destination = normalize(row.终点);
    const winner = getPlayer(row.胜者);
    const loser = getPlayer(row.败者);
    const { videoUrl, videoLabel } = parseVideo(row.视频);
    const note = normalize(row["新知识/糖"]);
    const tags = parseTags(note);
    const date = normalizeDate(row.日期);

    winner.matchCount += 1;
    winner.winCount += 1;
    loser.matchCount += 1;
    loser.lossCount += 1;

    if (sourceRaw === "常规擂台") {
      arenaMatches.push({
        id: `a-${index + 1}`,
        tournamentId: "arena",
        stageId: "arena",
        tournamentName: "常规擂台",
        stageName: "",
        date,
        seed,
        character,
        destination,
        winnerPlayerId: winner.id,
        loserPlayerId: loser.id,
        winnerName: winner.displayName,
        loserName: loser.displayName,
        winnerTime: normalize(row.胜者成绩),
        videoHtml: normalize(row.视频),
        videoUrl,
        videoLabel,
        gameVersion: "忏悔 v1.7.9b",
        modName: getArenaModName(date, tags),
        tags,
        isSpecial: tags.includes("特殊"),
        note,
        sourceRaw
      });
      continue;
    }

    const { tournamentName, stageName } = parseSource(sourceRaw);
    const tournament = getTournament(tournamentName);
    const stage = getStage(tournament.id, stageName);

    matches.push({
      id: `m-${index + 1}`,
      tournamentId: tournament.id,
      stageId: stage.id,
      tournamentName,
      stageName,
      date,
      seed,
      character,
      destination,
      winnerPlayerId: winner.id,
      loserPlayerId: loser.id,
      winnerName: winner.displayName,
      loserName: loser.displayName,
      winnerTime: normalize(row.胜者成绩),
      videoHtml: normalize(row.视频),
      videoUrl,
      videoLabel,
      gameVersion: getGameVersion(tournamentName),
      modName: getModName(tournamentName, tags),
      tags,
      isSpecial: tags.includes("特殊"),
      note,
      sourceRaw
    });
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const tournamentList = Array.from(tournaments.values());
  const stageList = Array.from(stages.values());
  const playerList = Array.from(players.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "zh-Hans-CN")
  );
  const { series, warnings: seriesWarnings } = buildSeries(matches, stageList);
  const roundEntries = buildRoundEntries(matches, series, stageList);
  const generatedBrackets = buildBrackets(tournamentList, roundEntries);
  const existingBrackets = await loadExistingBrackets();
  const { brackets, preservedCount } = preserveExistingBrackets(
    generatedBrackets,
    existingBrackets,
    PRESERVE_EXISTING_BRACKETS_ONLY
  );

  const files = {
    "tournaments.json": tournamentList,
    "stages.json": stageList,
    "players.json": playerList,
    "matches.json": matches,
    "arenaMatches.json": arenaMatches,
    "series.json": series,
    "brackets.json": brackets,
    "filters.json": {
      tournaments: tournamentList,
      stages: stageList,
      characters: uniqueSorted(matches.map((match) => match.character)),
      destinations: uniqueSorted(matches.map((match) => match.destination))
    }
  };

  await Promise.all(
    Object.entries(files).map(([fileName, data]) =>
      writeFile(path.join(OUTPUT_DIR, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8")
    )
  );

  const bracketWarnings = brackets.flatMap((bracket) => bracket.warnings);
  const tagList = uniqueSorted([...matches, ...arenaMatches].flatMap((match) => match.tags));
  for (const warning of [...seriesWarnings, ...bracketWarnings]) {
    console.warn(`Warning: ${warning}`);
  }
  console.log(
    `Generated ${matches.length} matches, ${arenaMatches.length} arena matches, ${series.length} series, ${brackets.length} brackets, ${playerList.length} players. Preserved ${preservedCount} existing brackets.`
  );
  console.log(`Player aliases: ${playerAliases.size}`);
  console.log(`Tags: ${tagList.length ? tagList.join(", ") : "none"}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
