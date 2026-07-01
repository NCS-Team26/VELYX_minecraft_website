export function requireAwsCostOptIn(taskName) {
  if (process.env.ALLOW_AWS_COSTS === "1") return;

  throw new Error(
    [
      `${taskName} is blocked because it can create or update billable AWS resources.`,
      "Set ALLOW_AWS_COSTS=1 only when you intentionally want to use AWS.",
      "For zero AWS cost local signup/login, run: npm run dev:local",
    ].join("\n"),
  );
}
