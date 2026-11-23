export function bookLink(line: number, book?: string, mission?: string, station?: string) {
  return {
    pathname: "/quests/adventure",
    query: { line, ...(book && { book }), ...(mission && { mission }), ...(station && { station }) },
  };
}
