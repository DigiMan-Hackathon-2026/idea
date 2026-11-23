type AdventureOrigin = { line: number; book: string; mission: string; station?: string };

export function bookLink(line: number, book?: string, mission?: string, station?: string) {
  return {
    pathname: "/quests/adventure",
    query: { line, ...(book && { book }), ...(mission && { mission }), ...(station && { station }) },
  };
}

export function readAdventureOrigin(params: Pick<URLSearchParams, "get">): AdventureOrigin | null {
  const line = params.get("fromLine");
  const book = params.get("fromBook");
  const mission = params.get("fromMission");
  if (!line || !/^[1-9]$/.test(line) || !book || !/^(journey|experiences|station)$/.test(book)
    || !mission || !/^[a-z0-9-]{1,100}$/.test(mission)) return null;
  const station = params.get("fromStation");
  return { line: Number(line), book, mission, ...(station && /^[a-z0-9-]{1,12}$/i.test(station) && { station }) };
}

export function withAdventureOrigin(href: string, origin: AdventureOrigin | null) {
  if (!origin) return href;
  const [pathAndQuery, hash] = href.split("#");
  const [pathname, query] = pathAndQuery.split("?");
  const params = new URLSearchParams(query);
  params.set("fromLine", String(origin.line));
  params.set("fromBook", origin.book);
  params.set("fromMission", origin.mission);
  if (origin.station) params.set("fromStation", origin.station);
  return `${pathname}?${params}${hash ? `#${hash}` : ""}`;
}
