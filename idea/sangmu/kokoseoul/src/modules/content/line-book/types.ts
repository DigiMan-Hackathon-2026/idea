import type { GeographicPoint } from "../../../lib/geolocation";
import type { SubwayLine } from "../../transit/subway-stations";

/** The sections of a line book (see docs/LINE_BOOK_PLAN_v0.1.md). */
export type LineBookCategory =
  | "course" // 노선 대표 코스
  | "station" // 역 방문
  | "food" // 맛집 한 그릇
  | "view" // 전망·사진 지점
  | "experience" // 체험
  | "local-item" // 로컬 수집품
  | "landmark" // 노선 대표 명소
  | "series" // 연작 퀘스트
  | "story" // 숨은 이야기
  | "regular" // 단골도
  | "transfer"; // 환승 마스터

export type LineBookCheck =
  /** Every listed quest has a completed run. */
  | { kind: "quest"; questSlugs: string[] }
  /** A location check within `radiusM` of `point` (the station stamp rule). */
  | { kind: "location"; point: GeographicPoint; radiusM: number }
  /** Opens once all listed entries are done. */
  | { kind: "unlock"; afterEntryIds: string[] }
  /** Partial credit per transfer finished at one of these stations with the subway guide. */
  | { kind: "transfer"; stationCodes: string[] }
  /** Partial credit per different day with a finished quest on this line, up to `targetDays`. */
  | { kind: "revisit"; targetDays: number };

export type LineBookEntry = {
  /** Stable across releases, e.g. `4:station:424`. Saved progress refers to it. */
  id: string;
  /** Lines whose book shows this entry; a quest at a transfer station fills every one. */
  lines: SubwayLine[];
  category: LineBookCategory;
  /** The station the entry is about or starts from, when there is one. */
  stationCode: string | null;
  titleJa: string;
  titleKo: string;
  check: LineBookCheck;
  weight: number;
};

export type LineBook = {
  line: SubwayLine;
  entries: LineBookEntry[];
};
