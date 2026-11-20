import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "desmind-lands";
export default defineRailway(() => {
  const desmindLands = service("desmind-lands", {
    source: github("DesmondObe/lands-platform", { branch: "main", checkSuites: false }),
    build: { buildCommand: "npm ci --include=dev && npm run build --workspace @lands/backend && npm run build --workspace @lands/frontend", buildEnvironment: "V3", builder: "RAILPACK" },
    start: "node scripts/start.mjs",
    healthcheck: "/",
    healthcheckTimeout: 300,
    replicas: { "europe-west4-drams3a": 1 },
    domains: ["lands.desmindlabs.com"],
  });

  return project("loyal-amazement", {
    variables: { managed: false },
    resources: [desmindLands],
  });
});
