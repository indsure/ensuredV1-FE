console.log(
  [
    "The legacy API scaffolder has been retired.",
    "next-api is now maintained directly in src/, and the checked-in route files are the source of truth.",
    "This script is intentionally a no-op so it cannot regenerate stale mock auth, broken template literals, or schema-drifted routes.",
  ].join("\n")
);
