function isStation(value) {
  return value &&
    typeof value.code === "string" &&
    /^(?:2\d{2}(?:-[1-4])?|3\d{2})$/.test(value.code) &&
    [value.ko, value.ja, value.en].every((name) => typeof name === "string" && name.length > 0);
}

function showStation(id, station) {
  const target = document.getElementById(id);
  const korean = document.createElement("span");
  korean.lang = "ko";
  korean.textContent = station.ko;
  const english = document.createElement("span");
  english.lang = "en";
  english.textContent = station.en;
  target.append(station.code + " " + station.ja + " · ", korean, " · ", english);
}

function showSavedRide() {
  let ride;
  try {
    // Keep this key in sync with the saved ride module.
    ride = JSON.parse(localStorage.getItem("yeogiseoul.subway-ride.v1") || "null");
  } catch {
    return;
  }
  if (!isStation(ride?.origin) || !isStation(ride?.destination)) return;

  showStation("origin", ride.origin);
  showStation("destination", ride.destination);
  const transferTo = isStation(ride.transferTo) ? ride.transferTo : null;
  if (transferTo) {
    showStation("transfer-to", transferTo);
    document.getElementById("transfer-to-label").hidden = false;
    document.getElementById("transfer-to").hidden = false;
  }
  if (isStation(ride.next)) {
    showStation("next", ride.next);
  } else {
    document.getElementById("next-label").hidden = true;
    document.getElementById("next").hidden = true;
  }
  document.getElementById("transfer").hidden = !transferTo && ride.transfer !== ride.origin.code;
  const phrase = document.getElementById("phrase");
  const phraseJa = document.getElementById("phrase-ja");
  if (transferTo) {
    const line = transferTo.code[0];
    phrase.textContent = line + "호선으로 갈아타려고 해요. 어느 쪽으로 가면 되나요?";
    phraseJa.textContent = line + "号線に乗り換えたいです。どちらへ行けばいいですか？";
  } else if (ride.origin.code === ride.destination.code) {
    phrase.textContent = "여기가 " + ride.destination.ko + "역이 맞나요?";
    phraseJa.textContent = "ここは" + ride.destination.ja + "駅ですか？";
  } else {
    phrase.textContent = ride.destination.ko + "역에 가고 싶어요. 어느 방향으로 가야 하나요?";
    phraseJa.textContent = ride.destination.ja + "駅へ行きたいです。どちらの方向へ行けばいいですか？";
  }
  document.getElementById("empty").hidden = true;
  document.getElementById("saved").hidden = false;
}

showSavedRide();
