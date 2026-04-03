export const VALDR_PACK_KEY = "valdr";
export const VALDR_PACK_VERSION = "0.1.0";
export const VALDR_TIER_SOURCE_ROOT = "valdr-packs/valdr";
export const VALDR_TIER_SOURCE_SYSTEM = "valdr-pack/scripts/build-valdr-tier";

const raiderIncludes = [
  {
    path: "agents",
    description: "Domain and utility agents covering language expertise, CI/CD, security, infrastructure, docs, refactors, and dependency audits."
  },
  {
    path: "planner",
    description: "Planner agents for research, schema design, and structured task generation."
  },
  {
    path: "reviewer",
    description: "Reviewer agents, scoring guidance, and quality gate workflows."
  }
];

const vanguardIncludes = [
  ...raiderIncludes,
  {
    path: "auditor",
    description: "Auditor agents and scoring guidance for evidence-backed session evaluation."
  },
  {
    path: "base",
    description: "Shared behavioral fragments and reusable Valdr guidance."
  },
  {
    path: "core",
    description: "Core tool documentation, registry conventions, sizing guidance, and spec references."
  },
  {
    path: "executor",
    description: "Executor task and workflow capabilities for MCP-enabled implementation without live session orchestration."
  },
  {
    path: "orchestrator",
    description: "Navigation and registry orchestrators for PM discovery, authoring, and task creation."
  }
];

export const VALDR_TIER_CONFIG = {
  raider: {
    artifactName: "valdr-raider",
    name: "Valdr Raider Pack",
    description: "Base-tier Valdr pack with manual and UI-driven guidance only. Raider ships the shared domain agents, planner, and reviewer without MCP-powered orchestration.",
    layers: ["shared", "raider"],
    includes: raiderIncludes
  },
  vanguard: {
    artifactName: "valdr-vanguard",
    name: "Valdr Vanguard Pack",
    description: "MCP-enabled Valdr pack for task, project, review, registry, and audit workflows. Vanguard adds hot-loaded PM tools and Tyr v2 without live session orchestration.",
    layers: ["shared", "raider", "vanguard"],
    includes: vanguardIncludes
  },
  sovereign: {
    artifactName: "valdr-sovereign",
    name: "Valdr Sovereign Pack",
    description: "Full Valdr orchestration pack with live session management, spawning, session messaging, worktree coordination, and end-to-end orchestration flows.",
    layers: ["shared", "raider", "vanguard", "sovereign"],
    includes: vanguardIncludes
  }
};

export const VALDR_TIERS = Object.keys(VALDR_TIER_CONFIG);
