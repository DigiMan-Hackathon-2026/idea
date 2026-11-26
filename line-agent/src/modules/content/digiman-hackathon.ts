import event from "./digiman-hackathon.json";

export const DIGIMAN_HACKATHON = event;
export const DIGIMAN_HACKATHON_PATH = "/quests/digiman-hackathon";
export const DIGIMAN_HACKATHON_ENDED_JA = "DigiManハッカソンは終了しました。";
export const DIGIMAN_HACKATHON_ENDED_KO = "디지망 해커톤이 끝났어요.";

export function hasDigimanHackathonEnded(
  questId: string,
  now = Date.now(),
): boolean {
  return questId === event.id && now >= Date.parse(event.endsAt);
}
