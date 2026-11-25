export type SessionPepperKeyRing = {
  activeVersion: number;
  peppers: ReadonlyMap<number, Buffer>;
};

const MAX_HASH_VERSION = 32_767;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

export function parseSessionPepperKeyRing(
  environment: Readonly<Record<string, string | undefined>>,
): SessionPepperKeyRing {
  const activeValue = environment.SESSION_TOKEN_ACTIVE_VERSION;
  const peppersValue = environment.SESSION_TOKEN_PEPPERS;
  if (!activeValue || !peppersValue) {
    throw new Error("Visitor session pepper configuration is required");
  }

  const activeVersion = Number(activeValue);
  if (
    !Number.isInteger(activeVersion) ||
    activeVersion < 1 ||
    activeVersion > MAX_HASH_VERSION
  ) {
    throw new Error("Active visitor session hash version is invalid");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(peppersValue);
  } catch {
    throw new Error("Visitor session peppers must be valid JSON");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error("Visitor session peppers must be a versioned object");
  }

  const entries = Object.entries(parsed);
  if (entries.length < 1 || entries.length > 2) {
    throw new Error("Visitor session peppers allow current and previous only");
  }

  const peppers = new Map<number, Buffer>();
  for (const [versionValue, pepperValue] of entries) {
    const version = Number(versionValue);
    if (
      !Number.isInteger(version) ||
      String(version) !== versionValue ||
      version < 1 ||
      version > MAX_HASH_VERSION ||
      typeof pepperValue !== "string" ||
      !BASE64URL_32_BYTES.test(pepperValue)
    ) {
      throw new Error("Visitor session pepper entry is invalid");
    }
    const pepper = Buffer.from(pepperValue, "base64url");
    if (
      pepper.length !== 32 ||
      pepper.toString("base64url") !== pepperValue
    ) {
      throw new Error("Visitor session pepper entry is invalid");
    }
    peppers.set(version, pepper);
  }

  if (!peppers.has(activeVersion)) {
    throw new Error("Active visitor session hash version has no pepper");
  }
  return { activeVersion, peppers };
}
