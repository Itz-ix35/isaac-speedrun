export type Tournament = {
  id: string;
  name: string;
};

export type Stage = {
  id: string;
  tournamentId: string;
  name: string;
  sortOrder: number;
};

export type Player = {
  id: string;
  displayName: string;
  streamRoom: string;
  matchCount: number;
  winCount: number;
  lossCount: number;
};

export type Match = {
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

export type SeriesFormat = "BO3" | "BO5" | "BO7";

export type Series = {
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

export type BracketNode = {
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

export type SwissBracketEntry = {
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

export type SwissBracketRound = {
  roundNumber: number;
  entries: SwissBracketEntry[];
};

export type SwissBracketResult = {
  playerId: string;
  playerName: string;
  wins: number;
  losses: number;
};

export type DoubleElimBracketEntry = {
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

export type DoubleElimBracketRound = {
  cycleNumber: number;
  winners: DoubleElimBracketEntry[];
  losersEarly: DoubleElimBracketEntry[];
  losersLate: DoubleElimBracketEntry[];
};

export type Bracket = {
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

export type FilterData = {
  tournaments: Tournament[];
  stages: Stage[];
  characters: string[];
  destinations: string[];
};

export type AppData = {
  tournaments: Tournament[];
  stages: Stage[];
  players: Player[];
  matches: Match[];
  arenaMatches: Match[];
  series: Series[];
  brackets: Bracket[];
  filters: FilterData;
};
