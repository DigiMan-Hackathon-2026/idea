export function stationCollectionKey(stationName: string) {
  // Lines 4 and 7 use different names for this interchange.
  return stationName === "이수" ? "총신대입구" : stationName;
}
