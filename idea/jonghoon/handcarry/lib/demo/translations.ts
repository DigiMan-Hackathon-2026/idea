import type { Locale } from "../domain/types";

// Fixed demo translations. TODO(원어민 검수 필요): Japanese lines are written by the
// development agent and need native review before any external use.
export const PHRASES: readonly { ko: string; ja: string }[] = [
  { ko: "안녕하세요! 입찰 감사합니다.", ja: "こんにちは！入札ありがとうございます。" },
  { ko: "띠지가 있는 미개봉 상태로 부탁드려요.", ja: "帯付きの未開封でお願いします。" },
  { ko: "영수증도 꼭 찍어 주세요.", ja: "レシートも必ず撮ってください。" },
  { ko: "명동 거점에서 찾을게요.", ja: "明洞の拠点で受け取ります。" },
  { ko: "언제쯤 서울에 도착하세요?", ja: "いつ頃ソウルに着きますか？" },
  { ko: "감사합니다! 잘 받았어요.", ja: "ありがとうございます！無事に受け取りました。" },
  { ko: "네, 미개봉으로 구매할게요.", ja: "はい、未開封で購入します。" },
  { ko: "영수증과 사진을 올렸어요.", ja: "レシートと写真をアップしました。" },
  { ko: "토요일에 서울에 도착해요.", ja: "土曜日にソウルに着きます。" },
  { ko: "명동 거점에 맡길게요.", ja: "明洞の拠点に預けます。" },
  { ko: "포장이 이미 뜯어져 있었어요.", ja: "包装がすでに開いていました。" },
  // Item names and notes from the seed and the demo script, so travelers read them in Japanese.
  { ko: "미개봉 확장팩 박스 「별빛 탐험대」 (가상)", ja: "未開封 拡張パックBOX「星明かり探検隊」（架空）" },
  { ko: "포켓몬센터 한정 프로모 동봉판", ja: "ポケモンセンター限定プロモ同梱版" },
  { ko: "투어 한정 아크릴 스탠드 세트 (가상)", ja: "ツアー限定アクリルスタンドセット（架空）" },
  { ko: "도쿄 공연장 한정", ja: "東京公演会場限定" },
  { ko: "팬클럽 한정 포토북 (가상)", ja: "ファンクラブ限定フォトブック（架空）" },
  { ko: "한정 아크릴 키링 세트 (가상)", ja: "限定アクリルキーホルダーセット（架空）" },
  { ko: "피규어 「밤하늘 소녀」 (가상)", ja: "フィギュア「夜空の少女」（架空）" },
  { ko: "미개봉 박스", ja: "未開封BOX" },
  { ko: "아이돌 표지 잡지 12월호 (가상)", ja: "アイドル表紙雑誌 12月号（架空）" },
];

// Quick-reply chips offered to each side, in the demo script's order.
export const QUICK_REPLIES: Record<Locale, readonly string[]> = {
  ko: [PHRASES[0].ko, PHRASES[1].ko, PHRASES[2].ko, PHRASES[3].ko],
  ja: [PHRASES[6].ja, PHRASES[8].ja, PHRASES[7].ja, PHRASES[9].ja],
};

export function translate(text: string, from: Locale, to: Locale): string | null {
  if (from === to) return text;
  const hit = PHRASES.find((p) => p[from] === text.trim());
  return hit ? hit[to] : null;
}
