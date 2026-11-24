/**
 * Splits text into Hangul runs and the rest, so Korean words inside Japanese
 * copy (an address, a sign to look for) can be marked `lang="ko"` for screen readers.
 * A run may continue over spaces, digits and light punctuation, as in "종로 266".
 * `public/quest-offline.js` uses the same pattern.
 */
const hangulRun = /[가-힣ㄱ-ㆎ]+(?:[\s\d.,·-]*[가-힣ㄱ-ㆎ\d]+)*/g;

export type TextRun = { text: string; korean: boolean };

export function splitKoreanRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const match of text.matchAll(hangulRun)) {
    const start = match.index;
    if (start > last) runs.push({ text: text.slice(last, start), korean: false });
    runs.push({ text: match[0], korean: true });
    last = start + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), korean: false });
  return runs;
}
