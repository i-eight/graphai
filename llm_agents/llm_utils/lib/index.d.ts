export type GrapAILLInputType = string | (string | undefined)[] | undefined;
export type GrapAILLMInputBase = {
    prompt?: GrapAILLInputType;
    system?: GrapAILLInputType;
    mergeablePrompts?: GrapAILLInputType;
    mergeableSystem?: GrapAILLInputType;
};
export type GraphAILLInputType = string | (string | undefined)[] | undefined;
export type GraphAILLMInputBase = {
    prompt?: GraphAILLInputType;
    system?: GraphAILLInputType;
    mergeablePrompts?: GraphAILLInputType;
    mergeableSystem?: GraphAILLInputType;
};
export declare const flatString: (input: GraphAILLInputType) => string;
export declare const getMergeValue: (namedInputs: GraphAILLMInputBase, params: GraphAILLMInputBase, key: "mergeablePrompts" | "mergeableSystem", values: GraphAILLInputType) => string;
type GraphAILlmMessageRole = "user" | "system" | "assistant";
export type GraphAILlmMessage = {
    role: GraphAILlmMessageRole;
    content: string | string[] | Record<string, unknown>[];
};
export declare const getMessages: (systemPrompt?: string, messages?: GraphAILlmMessage[]) => GraphAILlmMessage[];
export {};
