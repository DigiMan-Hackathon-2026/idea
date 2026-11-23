import Link from "next/link";
import { KoreanAwareText } from "@/components/korean-text";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilterForm } from "@/components/filter-form";
import { QuestExitLabel } from "@/components/quest-access-card";
import { QuestResultsView } from "@/components/quest-results-view";
import { SavedQuestMark, SavedQuestsPanel } from "@/components/saved-quests";
import { SiteHeader } from "@/components/site-header";
import {
  DEMO_QUESTS,
  filterDemoQuests,
  getAreaLabel,
  getPurposeLabel,
  parseQuestFilters,
} from "@/modules/content/demo-quests";
import { ScenicHero } from "@/components/scenic-hero";
import { pickLocale } from "@/lib/locale";
import { getRequestLocale } from "@/lib/locale.server";
import myeongdongKyoja from "@/modules/content/myeongdong-kyoja.json";
import museumRoom from "@/modules/content/museum-room-of-contemplation.json";
import oliveyoungShopping from "@/modules/content/seongsu-oliveyoung-shopping.json";
import oliveyoungSkin from "@/modules/content/seongsu-oliveyoung-skin-consulting.json";
import irotomo from "@/modules/content/yeouido-irotomo-first-meetup.json";
import somugwan from "@/modules/content/seongsu-somugwan-solo-gukbap.json";
import changdeokgung from "@/modules/content/changdeokgung-japanese-tour.json";
import kyobo from "@/modules/content/gwanghwamun-kyobo-find-book.json";
import moodcollect from "@/modules/content/myeongdong-moodcollect-personal-color.json";
import seoulLibrary from "@/modules/content/city-hall-seoul-library-first-loan.json";
import soonhee from "@/modules/content/gwangjang-soonhee-bindaetteok.json";
import cityModel from "@/modules/content/gwanghwamun-seoul-museum-city-model.json";
import ssamziegil from "@/modules/content/insadong-ssamziegil-craft-gift.json";
import amoreFoundation from "@/modules/content/yongsan-amore-custom-foundation.json";
import bookbogo from "@/modules/content/jamsil-seoul-bookbogo-first-book-talk.json";
import sonmat from "@/modules/content/tongin-market-sonmat-gimbap.json";
import { filterVisitGuides } from "@/modules/content/visit-guides";
import {
  DIGIMAN_HACKATHON,
  DIGIMAN_HACKATHON_PATH,
  hasDigimanHackathonEnded,
} from "@/modules/content/digiman-hackathon";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return {
    title: pickLocale(locale, "クエストを探す", "퀘스트 찾기"),
    description: pickLocale(
      locale,
      "エリア、興味、時間からソウルのクエストを探します。",
      "지역, 관심사, 시간으로 서울의 퀘스트를 찾습니다.",
    ),
  };
}

async function QuestResults({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseQuestFilters(await searchParams);
  const quests = filterDemoQuests(DEMO_QUESTS, filters);
  const locale = await getRequestLocale();
  const event = DIGIMAN_HACKATHON;
  await connection();
  const showHackathon =
    (filters.area === "all" || filters.area === "sinchon") &&
    (!filters.purpose || filters.purpose === "discovery") &&
    filters.tags.length === 0 &&
    filters.durationMax === null &&
    filters.timeAvailable !== "30" && filters.timeAvailable !== "60" &&
    (!filters.budget || filters.budget === "unlimited") &&
    !hasDigimanHackathonEnded(event.id);
  const showMyeongdongKyoja =
    (filters.area === "all" || filters.area === "myeongdong") &&
    (!filters.purpose || filters.purpose === "food") &&
    filters.tags.every((tag) => tag === "food") &&
    (filters.durationMax === null || filters.durationMax >= 60) &&
    filters.timeAvailable !== "30" &&
    (!filters.party || filters.party === "solo") &&
    (!filters.budget || filters.budget === "unlimited");
  const showSomugwan =
    (filters.area === "all" || filters.area === "seongsu") &&
    (!filters.purpose || filters.purpose === "food") &&
    filters.tags.every((tag) => tag === "food") &&
    (filters.durationMax === null || filters.durationMax >= somugwan.durationMinutes) &&
    filters.timeAvailable !== "30" &&
    (!filters.party || filters.party === "solo") &&
    (!filters.budget || filters.budget === "under30000" || filters.budget === "unlimited");
  const showSoonhee =
    (filters.area === "all" || filters.area === "jongno") &&
    (!filters.purpose || filters.purpose === "food") &&
    filters.tags.every((tag) => tag === "food") &&
    (filters.durationMax === null || filters.durationMax >= soonhee.durationMinutes) &&
    filters.timeAvailable !== "30" &&
    (!filters.party || filters.party === "solo") &&
    (!filters.budget || filters.budget === "unlimited");
  const showSonmat =
    (filters.area === "all" || filters.area === "jongno") &&
    (!filters.purpose || filters.purpose === "food") &&
    filters.tags.every((tag) => tag === "food") &&
    (filters.durationMax === null || filters.durationMax >= sonmat.durationMinutes) &&
    (!filters.budget || filters.budget === "unlimited");
  const showMuseumRoom =
    (filters.area === "all" || filters.area === "yongsan") &&
    (!filters.purpose || filters.purpose === "culture") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= museumRoom.durationMinutes);
  const showChangdeokgung =
    (filters.area === "all" || filters.area === "jongno") &&
    (!filters.purpose || filters.purpose === "culture") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= changdeokgung.durationMinutes) &&
    filters.timeAvailable !== "30" && filters.timeAvailable !== "60";
  const showCityModel =
    (filters.area === "all" || filters.area === "jongno") &&
    (!filters.purpose || filters.purpose === "culture") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= cityModel.durationMinutes);
  const showOliveyoungShopping =
    (filters.area === "all" || filters.area === "seongsu") &&
    (!filters.purpose || filters.purpose === "shopping") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= oliveyoungShopping.durationMinutes) &&
    (!filters.budget || filters.budget === "unlimited");
  const showOliveyoungSkin =
    (filters.area === "all" || filters.area === "seongsu") &&
    (!filters.purpose || filters.purpose === "beauty") &&
    filters.tags.length === 0 &&
    filters.durationMax === null &&
    filters.timeAvailable !== "30" && filters.timeAvailable !== "60" &&
    (!filters.budget || filters.budget === "unlimited");
  const showMoodcollect =
    (filters.area === "all" || filters.area === "myeongdong") &&
    (!filters.purpose || filters.purpose === "beauty") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= moodcollect.durationMinutes) &&
    filters.timeAvailable !== "30" &&
    (!filters.party || filters.party === "solo") &&
    (!filters.budget || filters.budget === "unlimited");
  const showAmoreFoundation =
    (filters.area === "all" || filters.area === "yongsan") &&
    (!filters.purpose || filters.purpose === "beauty") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= amoreFoundation.durationMinutes) &&
    filters.timeAvailable !== "30" &&
    (!filters.party || filters.party === "solo" || filters.party === "two") &&
    (!filters.budget || filters.budget === "unlimited");
  const showKyobo =
    (filters.area === "all" || filters.area === "jongno") &&
    (!filters.purpose || filters.purpose === "shopping") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= kyobo.durationMinutes) &&
    (!filters.budget || filters.budget === "unlimited");
  const showSsamziegil =
    (filters.area === "all" || filters.area === "jongno") &&
    (!filters.purpose || filters.purpose === "shopping") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= ssamziegil.durationMinutes) &&
    (!filters.budget || filters.budget === "unlimited");
  const showIrotomo =
    (filters.area === "all" || filters.area === "yeouido") &&
    (!filters.purpose || filters.purpose === "discovery") &&
    filters.tags.length === 0 &&
    filters.durationMax === null &&
    filters.timeAvailable !== "30" && filters.timeAvailable !== "60" &&
    (!filters.budget || filters.budget === "under30000" || filters.budget === "unlimited");
  const showSeoulLibrary =
    (filters.area === "all" || filters.area === "city-hall") &&
    (!filters.purpose || filters.purpose === "discovery") &&
    filters.tags.length === 0 &&
    (filters.durationMax === null || filters.durationMax >= seoulLibrary.durationMinutes) &&
    filters.timeAvailable !== "30";
  const showBookbogo =
    (filters.area === "all" || filters.area === "jamsil") &&
    (!filters.purpose || filters.purpose === "discovery") &&
    filters.tags.length === 0 &&
    filters.durationMax === null &&
    filters.timeAvailable !== "30" && filters.timeAvailable !== "60" &&
    (!filters.budget || filters.budget === "unlimited");
  const featured: {
    quest: { id: string; titleJa: string; titleKo: string; summaryJa: string; summaryKo: string };
    href: string;
    label: string;
    detail: string;
    action: string;
  }[] = [
    ...(showHackathon ? [{
      quest: event,
      href: DIGIMAN_HACKATHON_PATH,
      label: pickLocale(locale, "本選参加者向け · 応募受付終了", "본선 참가자용 · 모집 마감"),
      detail: pickLocale(locale, event.scheduleJa, event.scheduleKo),
      action: pickLocale(locale, "参加ガイドを見る", "참여 안내 보기"),
    }] : []),
    ...(showMyeongdongKyoja ? [{
      quest: myeongdongKyoja,
      href: "/quests/myeongdong-kyoja",
      label: pickLocale(locale, "明洞 · グルメ", "명동 · 식도락"),
      detail: myeongdongKyoja.place.addressKo,
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showSomugwan ? [{
      quest: somugwan,
      href: "/quests/seongsu-somugwan-solo-gukbap",
      label: pickLocale(locale, "聖水 · グルメ", "성수 · 식도락"),
      detail: pickLocale(locale, "平日のみ営業 · 牛肉クッパ 12,000ウォン", "평일 영업 · 소고기국밥 12,000원"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showSoonhee ? [{
      quest: soonhee,
      href: "/quests/gwangjang-soonhee-bindaetteok",
      label: pickLocale(locale, "鍾路 · グルメ", "종로 · 식도락"),
      detail: pickLocale(locale, "広蔵市場 · 持ち帰り可 · 値段は店頭で確認", "광장시장 · 포장 가능 · 가격은 매장 확인"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showSonmat ? [{
      quest: sonmat,
      href: "/quests/tongin-market-sonmat-gimbap",
      label: pickLocale(locale, "鍾路 · グルメ", "종로 · 식도락"),
      detail: pickLocale(locale, "通仁市場 · 支払い方法と値段は店頭で確認", "통인시장 · 결제 방법과 가격은 매장 확인"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showMuseumRoom ? [{
      quest: museumRoom,
      href: "/quests/museum-room-of-contemplation",
      label: pickLocale(locale, "龍山 · 文化体験", "용산 · 문화 체험"),
      detail: pickLocale(locale, "国立中央博物館2階 · 無料", "국립중앙박물관 2층 · 무료"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showChangdeokgung ? [{
      quest: changdeokgung,
      href: "/quests/changdeokgung-japanese-tour",
      label: pickLocale(locale, "鍾路 · 文化体験", "종로 · 문화 체험"),
      detail: pickLocale(locale, "日本語ガイド · 水・金・日 11:00", "일본어 해설 · 수·금·일 11:00"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showCityModel ? [{
      quest: cityModel,
      href: "/quests/gwanghwamun-seoul-museum-city-model",
      label: pickLocale(locale, "鍾路 · 文化体験", "종로 · 문화 체험"),
      detail: pickLocale(locale, "ソウル歴史博物館3階 · 無料", "서울역사박물관 3층 · 무료"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showOliveyoungShopping ? [{
      quest: oliveyoungShopping,
      href: "/quests/seongsu-oliveyoung-shopping",
      label: pickLocale(locale, "聖水 · ショッピング", "성수 · 쇼핑"),
      detail: oliveyoungShopping.place.addressKo,
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showKyobo ? [{
      quest: kyobo,
      href: "/quests/gwanghwamun-kyobo-find-book",
      label: pickLocale(locale, "鍾路 · ショッピング", "종로 · 쇼핑"),
      detail: pickLocale(locale, "教保生命ビル 地下1階", "교보생명빌딩 지하 1층"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showSsamziegil ? [{
      quest: ssamziegil,
      href: "/quests/insadong-ssamziegil-craft-gift",
      label: pickLocale(locale, "鍾路 · ショッピング", "종로 · 쇼핑"),
      detail: pickLocale(locale, "仁寺洞 · 値段と包装はお店で確認", "인사동 · 가격과 포장은 매장 확인"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showOliveyoungSkin ? [{
      quest: oliveyoungSkin,
      href: "/quests/seongsu-oliveyoung-skin-consulting",
      label: pickLocale(locale, "聖水 · ビューティー", "성수 · 뷰티"),
      detail: pickLocale(locale, "店頭受付 · 待ち時間は店頭で確認", "현장 접수 · 대기 시간은 매장 확인"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showMoodcollect ? [{
      quest: moodcollect,
      href: "/quests/myeongdong-moodcollect-personal-color",
      label: pickLocale(locale, "明洞 · ビューティー", "명동 · 뷰티"),
      detail: pickLocale(
        locale,
        "要予約 · 1人50分 · 日本語通訳込み20万ウォン",
        "사전 예약 · 1인 50분 · 일본어 통역 포함 20만 원",
      ),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showAmoreFoundation ? [{
      quest: amoreFoundation,
      href: "/quests/yongsan-amore-custom-foundation",
      label: pickLocale(locale, "龍山 · ビューティー", "용산 · 뷰티"),
      detail: pickLocale(locale, "70,000〜72,000ウォン · 店頭でセルフ測定可", "70,000~72,000원 · 매장 셀프 진단 가능"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showIrotomo ? [{
      quest: irotomo,
      href: "/quests/yeouido-irotomo-first-meetup",
      label: pickLocale(locale, "汝矣島 · 日常の中の新しい体験", "여의도 · 일상 속 새로운 경험"),
      detail: pickLocale(locale, "日曜 15:00〜17:30 · 事前申込制", "일요일 15:00~17:30 · 사전 신청"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showSeoulLibrary ? [{
      quest: seoulLibrary,
      href: "/quests/city-hall-seoul-library-first-loan",
      label: pickLocale(locale, "市庁 · 日常の中の新しい体験", "시청 · 일상 속 새로운 경험"),
      detail: pickLocale(locale, "ソウル在住の方向け · 貸出無料", "서울 거주자용 · 무료 대출"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
    ...(showBookbogo ? [{
      quest: bookbogo,
      href: "/quests/jamsil-seoul-bookbogo-first-book-talk",
      label: pickLocale(locale, "蚕室 · 日常の中の新しい体験", "잠실 · 일상 속 새로운 경험"),
      detail: pickLocale(locale, "日程・料金は回ごとに確認", "일정·비용은 회차별 확인"),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    }] : []),
  ];
  for (const guide of filterVisitGuides(filters)) {
    featured.push({
      quest: guide,
      href: `/quests/${guide.slug}`,
      label: `${getAreaLabel(guide.areaCode, locale)} · ${getPurposeLabel(guide.purpose, locale)}`,
      detail: pickLocale(locale, guide.detailJa, guide.detailKo),
      action: pickLocale(locale, "訪問ガイドを見る", "방문 안내 보기"),
    });
  }
  const resultCount = quests.length + featured.length;

  return (
    <>
      <ScenicHero
        theme="dusk"
        title={pickLocale(locale, "あなたに合うクエスト", "나에게 맞는 퀘스트")}
        description={[getAreaLabel(filters.area, locale), filters.purpose ? getPurposeLabel(filters.purpose, locale) : null,
          pickLocale(locale, `${resultCount}件`, `${resultCount}개`)].filter(Boolean).join(" · ")}
      />
      <section className="scenic-content seoul-surface rounded-2xl px-4 py-3 sm:px-6">
        <FilterForm filters={filters} />
      </section>
      <div className="mt-2 flex flex-wrap gap-x-5 text-sm font-bold text-[var(--primary)]">
        <Link href="/quests/nearby" className="inline-flex min-h-11 items-center underline">
          {pickLocale(locale, "駅の出口からクエストを探す", "역 출구 주변 퀘스트 찾기")}
        </Link>
        <Link href="/quests/courses" className="inline-flex min-h-11 items-center underline">
          {pickLocale(locale, "地下鉄の路線でつなぐコース", "지하철 노선으로 잇는 코스")}
        </Link>
        <Link href="/subway#station-interior-title" className="inline-flex min-h-11 items-center underline">
          {pickLocale(locale, "現在地から近くの駅・構内図を探す", "현재 위치에서 가까운 역과 안내도 찾기")}
        </Link>
      </div>
      <SavedQuestsPanel />

      {quests.length > 0 ? (
        <QuestResultsView
          quests={quests}
          filters={filters}
          naverMapKeyId={process.env.NEXT_PUBLIC_NAVER_MAP_NCP_KEY_ID?.trim() || null}
        />
      ) : null}
      {featured.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {featured.map(({ quest, href, label, detail, action }) => (
            <article key={quest.id} className="seoul-surface flex min-w-0 flex-col items-start rounded-xl p-5 [overflow-wrap:anywhere] sm:p-6">
              <p className="seoul-kicker text-sm">{label}</p>
              <QuestExitLabel questId={quest.id} locale={locale} />
              <SavedQuestMark path={href} className="mt-1.5" />
              <h2 className="mt-2 text-2xl font-black text-[#504e49]">{pickLocale(locale, quest.titleJa, quest.titleKo)}</h2>
              <p className="mt-2 font-bold text-slate-600"><KoreanAwareText text={detail} locale={locale} /></p>
              <p className="mt-2 leading-7 text-slate-600"><KoreanAwareText text={pickLocale(locale, quest.summaryJa, quest.summaryKo)} locale={locale} /></p>
              <Link href={href} className="seoul-button-dark mt-4 inline-flex min-h-11 items-center rounded-lg px-5 text-sm font-black">
                {action}
              </Link>
            </article>
          ))}
        </div>
      ) : null}
      {quests.length === 0 && featured.length === 0 ? (
        <section className="seoul-surface mt-8 max-w-2xl rounded-xl border-dashed px-6 py-16 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-xl bg-[#f7ecee] text-2xl text-[#941e34]" aria-hidden="true">↺</span>
          <h2 className="mt-5 text-2xl font-black tracking-tight text-[#504e49]">
            {pickLocale(locale, "条件を変えて、もう一度探してみましょう", "조건을 바꿔 다시 찾아보세요")}
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
            {pickLocale(locale, "今の条件に合うクエストはありません。条件を減らすと見つけやすくなります。", "현재 조건과 맞는 퀘스트가 없어요. 조건을 줄이면 더 쉽게 찾을 수 있어요.")}
          </p>
          <Link href="/quests" className="seoul-button-dark mt-6 inline-flex min-h-12 items-center rounded-lg px-6 text-sm font-black">
            {pickLocale(locale, "条件を変更する", "조건 변경하기")}
          </Link>
        </section>
      ) : null}
    </>
  );
}

async function ResultsFallback() {
  const locale = await getRequestLocale();
  return (
    <section className="seoul-surface mt-8 max-w-2xl animate-pulse rounded-xl p-8" aria-label={pickLocale(locale, "クエストを読み込み中", "퀘스트를 불러오는 중")}>
      <div className="h-7 w-1/3 rounded-full bg-slate-200" />
      <div className="mt-5 h-64 rounded-3xl bg-slate-200" />
    </section>
  );
}

export default function QuestsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="min-h-dvh pb-20">
      <SiteHeader />
      <div className="seoul-page">
        <Suspense fallback={<ResultsFallback />}>
          <QuestResults searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
