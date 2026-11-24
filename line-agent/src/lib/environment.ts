const APP_ENVIRONMENTS = ["local", "test", "preview", "production"] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export function parseAppEnvironment(value: string | undefined): AppEnvironment {
  if (value && APP_ENVIRONMENTS.includes(value as AppEnvironment)) {
    return value as AppEnvironment;
  }

  throw new Error(
    `APP_ENV must be one of ${APP_ENVIRONMENTS.join(", ")}; received ${
      value ?? "missing"
    }`,
  );
}
