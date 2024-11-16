(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('graphai')) :
    typeof define === 'function' && define.amd ? define(['exports', 'graphai'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.openai_fetch_agent = {}, global.graphai));
})(this, (function (exports, graphai) { 'use strict';

    var lib = {};

    var hasRequiredLib;

    function requireLib () {
    	if (hasRequiredLib) return lib;
    	hasRequiredLib = 1;
    	(function (exports) {
    		Object.defineProperty(exports, "__esModule", { value: true });
    		exports.getMessages = exports.getMergeValue = exports.flatString = void 0;
    		const flatString = (input) => {
    		    return Array.isArray(input) ? input.filter((a) => a).join("\n") : (input ?? "");
    		};
    		exports.flatString = flatString;
    		const getMergeValue = (namedInputs, params, key, values) => {
    		    const inputValue = namedInputs[key];
    		    const paramsValue = params[key];
    		    return inputValue || paramsValue ? [(0, exports.flatString)(inputValue), (0, exports.flatString)(paramsValue)].filter((a) => a).join("\n") : (0, exports.flatString)(values);
    		};
    		exports.getMergeValue = getMergeValue;
    		const getMessages = (systemPrompt, messages) => {
    		    const messagesCopy = [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), ...(messages ?? [])];
    		    return messagesCopy;
    		};
    		exports.getMessages = getMessages; 
    	} (lib));
    	return lib;
    }

    var libExports = requireLib();

    const convertOpenAIChatCompletion = (response, messages) => {
        const message = response?.choices[0] && response?.choices[0].message ? response?.choices[0].message : null;
        const text = message && message.content ? message.content : null;
        const functionResponse = message?.tool_calls && message?.tool_calls[0] ? message?.tool_calls[0] : null;
        // const functionId = message?.tool_calls && message?.tool_calls[0] ? message?.tool_calls[0]?.id : null;
        const tool = functionResponse
            ? {
                id: functionResponse.id,
                name: functionResponse?.function?.name,
                arguments: (() => {
                    try {
                        return JSON.parse(functionResponse?.function?.arguments);
                    }
                    catch (__e) {
                        return undefined;
                    }
                })(),
            }
            : undefined;
        if (message) {
            messages.push(message);
        }
        return {
            ...response,
            text,
            tool,
            message,
            messages,
        };
    };
    const openAIFetchAgent = async ({ params, namedInputs, }) => {
        const { verbose, system, images, temperature, tools, tool_choice, max_tokens, /* baseURL, stream, */ apiKey, prompt, messages, response_format } = {
            ...params,
            ...namedInputs,
        };
        const userPrompt = libExports.getMergeValue(namedInputs, params, "mergeablePrompts", prompt);
        const systemPrompt = libExports.getMergeValue(namedInputs, params, "mergeableSystem", system);
        const messagesCopy = libExports.getMessages(systemPrompt, messages);
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY key is not set in params. params: {apiKey: 'sk-xxx'}");
        }
        if (userPrompt) {
            messagesCopy.push({
                role: "user",
                content: userPrompt,
            });
        }
        if (images) {
            const image_url = params.model === "gpt-4-vision-preview"
                ? images[0]
                : {
                    url: images[0],
                    detail: "high",
                };
            messagesCopy.push({
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url,
                    },
                ],
            });
        }
        if (verbose) {
            console.log(messagesCopy);
        }
        const chatParams = {
            model: params.model || "gpt-4o",
            messages: messagesCopy,
            tools,
            tool_choice,
            max_tokens,
            temperature: temperature ?? 0.7,
            response_format,
        };
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(chatParams),
        });
        if (response.status === 200) {
            const result = await response.json();
            return convertOpenAIChatCompletion(result, messagesCopy);
        }
        throw new Error("OPENAI API Error");
    };
    const input_sample = "this is response result";
    const result_sample = {
        object: "chat.completion",
        id: "chatcmpl-9N7HxXYbwjmdbdiQE94MHoVluQhyt",
        choices: [
            {
                message: {
                    role: "assistant",
                    content: input_sample,
                },
                finish_reason: "stop",
                index: 0,
                logprobs: null,
            },
        ],
        created: 1715296589,
        model: "gpt-3.5-turbo-0125",
    };
    const openAIMockAgent = async ({ filterParams }) => {
        for await (const token of input_sample.split("")) {
            if (filterParams && filterParams.streamTokenCallback && token) {
                await graphai.sleep(100);
                filterParams.streamTokenCallback(token);
            }
        }
        return result_sample;
    };
    const openAIFetchAgentInfo = {
        name: "openAIFetchAgent",
        agent: openAIFetchAgent,
        mock: openAIMockAgent,
        inputs: {
            type: "object",
            properties: {
                model: { type: "string" },
                system: { type: "string" },
                tools: { type: "object" },
                tool_choice: {
                    anyOf: [{ type: "array" }, { type: "object" }],
                },
                max_tokens: { type: "number" },
                verbose: { type: "boolean" },
                temperature: { type: "number" },
                // baseURL: { type: "string" },
                apiKey: {
                    anyOf: [{ type: "string" }, { type: "object" }],
                },
                // stream: { type: "boolean" },
                prompt: {
                    type: "string",
                    description: "query string",
                },
                messages: {
                    anyOf: [{ type: "string" }, { type: "object" }, { type: "array" }],
                    description: "chat messages",
                },
            },
        },
        output: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                },
                object: {
                    type: "string",
                },
                created: {
                    type: "integer",
                },
                model: {
                    type: "string",
                },
                choices: {
                    type: "array",
                    items: [
                        {
                            type: "object",
                            properties: {
                                index: {
                                    type: "integer",
                                },
                                message: {
                                    type: "array",
                                    items: [
                                        {
                                            type: "object",
                                            properties: {
                                                content: {
                                                    type: "string",
                                                },
                                                role: {
                                                    type: "string",
                                                },
                                            },
                                            required: ["content", "role"],
                                        },
                                    ],
                                },
                            },
                            required: ["index", "message", "logprobs", "finish_reason"],
                        },
                    ],
                },
                usage: {
                    type: "object",
                    properties: {
                        prompt_tokens: {
                            type: "integer",
                        },
                        completion_tokens: {
                            type: "integer",
                        },
                        total_tokens: {
                            type: "integer",
                        },
                    },
                    required: ["prompt_tokens", "completion_tokens", "total_tokens"],
                },
                text: {
                    type: "string",
                },
                tool: {
                    arguments: {
                        type: "object",
                    },
                    name: {
                        type: "string",
                    },
                },
                message: {
                    type: "object",
                    properties: {
                        content: {
                            type: "string",
                        },
                        role: {
                            type: "string",
                        },
                    },
                    required: ["content", "role"],
                },
            },
            required: ["id", "object", "created", "model", "choices", "usage"],
        },
        params: {
            type: "object",
            properties: {
                model: { type: "string" },
                system: { type: "string" },
                tools: { type: "object" },
                tool_choice: { anyOf: [{ type: "array" }, { type: "object" }] },
                max_tokens: { type: "number" },
                verbose: { type: "boolean" },
                temperature: { type: "number" },
                // baseURL: { type: "string" },
                apiKey: { anyOf: [{ type: "string" }, { type: "object" }] },
                // stream: { type: "boolean" },
                prompt: { type: "string", description: "query string" },
                messages: { anyOf: [{ type: "string" }, { type: "object" }, { type: "array" }], description: "chat messages" },
            },
        },
        outputFormat: {
            llmResponse: {
                key: "choices.$0.message.content",
                type: "string",
            },
        },
        samples: [
            {
                inputs: { prompt: input_sample },
                params: {},
                result: result_sample,
            },
        ],
        description: "OpenAI Fetch Agent",
        category: ["llm"],
        author: "Receptron team",
        repository: "https://github.com/receptron/graphai",
        license: "MIT",
        stream: false,
        npms: ["openai"],
    };

    exports.openAIFetchAgent = openAIFetchAgentInfo;

}));
//# sourceMappingURL=bundle.umd.js.map