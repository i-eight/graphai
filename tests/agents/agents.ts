import { AgentFunctionDictonary } from "@/graphai";
import {
  sleeperAgent,
  sleeperAgentDebug,
  nestedAgent,
  mapAgent,
  totalAgent,
  bypassAgent,
  echoAgent,
  echoForkIndexAgent,
  mergeNodeIdAgent,
} from "@/experimental_agents";

export const defaultTestAgents: AgentFunctionDictonary = {
  bypassAgent,
  echoAgent,
  echoForkIndexAgent,
  mergeNodeIdAgent,
  sleeperAgent,
  sleeperAgentDebug,
  nestedAgent,
  mapAgent,
  totalAgent,
};
