import path from "path";
import * as fs from "fs";
import { GraphAI, AgentFunction } from "@/graphai";
import { ChatSession, ChatConfig, ManifestData } from "slashgpt";
import { readGraphaiData } from "~/utils/file_utils";

const config = new ChatConfig(path.resolve(__dirname));

const stringTemplateAgent: AgentFunction<{ manifest: ManifestData; template: string }, { content: string }> = async (context) => {
  console.log("executing", context.nodeId, context.params);
  const session = new ChatSession(config, context.params.manifest ?? {});
  const content = context.inputs.reduce((template, input, index) => {
    return template.replace("${" + index + "}", input["content"]);
  }, context.params.template);

  return { content };
};

const slashGPTAgent: AgentFunction<{ manifest: ManifestData; query: string }, { content: string }> = async (context) => {
  console.log("executing", context.nodeId, context.params);
  const session = new ChatSession(config, context.params.manifest ?? {});
  const query = context.inputs.reduce((prompt, input, index) => {
    return prompt.replace("${" + index + "}", input["content"]);
  }, context.params.query);
  session.append_user_question(query);

  await session.call_loop(() => {});
  const message = session.history.last_message();
  if (message === undefined) {
    throw new Error("No message in the history");
  }
  return message;
};

const runAgent = async (file: string) => {
  const file_path = path.resolve(__dirname) + file;
  const graph_data = readGraphaiData(file_path);
  const graph = new GraphAI(graph_data, { slashgpt: slashGPTAgent, stringTemplate: stringTemplateAgent });
  const results = (await graph.run()) as Record<string, any>;

  const log_path = path.resolve(__dirname) + "/../tests/logs/" + path.basename(file_path).replace(/\.yml$/, ".log");
  console.log(log_path);
  fs.writeFileSync(log_path, JSON.stringify(graph.transactionLogs(), null, 2));
  console.log(results["node3"]["content"]);
};

const main = async () => {
  await runAgent("/graphs/slash_gpt.yml");
};
main();
