import "dotenv/config";

import { AgentFunction } from "@/graphai";

import { graphDataTestRunner } from "~/utils/runner";
import { wikipediaAgent } from "./agents/wikipedia";
import { stringTemplateAgent, slashGPTAgent } from "@/experimental_agents";
import { get_encoding } from "tiktoken";

// see example
//  tests/agents/test_string_agent.ts
export const stringSplitterAgent: AgentFunction<
  {
    chunkSize?: number;
    overlap?: number;
    inputKey?: string;
  },
  {
    contents: Array<string>;
  }
> = async ({ params, inputs }) => {
  const source: string = inputs[0][params.inputKey ?? "content"];
  const chunkSize = params.chunkSize ?? 2048;
  const overlap = params.overlap ?? Math.floor(chunkSize / 8);
  const count = Math.floor(source.length / (chunkSize - overlap)) + 1;
  const contents = new Array(count).fill(undefined).map((_, i) => {
    const startIndex = i * (chunkSize - overlap);
    return source.substring(startIndex, startIndex + chunkSize);
  });

  return { contents, count, chunkSize, overlap };
};

interface EmbeddingResponse {
  object: string;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  data: [
    {
      object: string;
      index: number;
      embedding: number[];
    },
  ];
}

export const stringEmbeddingsAgent: AgentFunction<
  {
    inputKey?: string;
    model?: string;
  },
  {
    contents: any;
  }
> = async ({ params, inputs }) => {
  const input = inputs[0][params?.inputKey ?? "contents"];
  const sources: Array<string> = Array.isArray(input) ? input : [input];
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("API key is not set in environment variables.");
  }
  const url = "https://api.openai.com/v1/embeddings";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({
      input: sources,
      model: params?.model ?? "text-embedding-3-small",
    }),
  });
  const jsonResponse: EmbeddingResponse = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const embeddings = jsonResponse.data.map((object) => {
    return object.embedding;
  });
  return { contents: embeddings };
};

export const cosineSimilarityAgent: AgentFunction<
  {
    inputKey?: string;
  },
  {
    contents: Array<number>;
  }
> = async ({ params, inputs }) => {
  const embeddings: Array<Array<number>> = inputs[0][params.inputKey ?? "contents"];
  const reference: Array<number> = inputs[1][params.inputKey ?? "contents"][0];
  const contents = embeddings.map((embedding) => {
    return embedding.reduce((dotProduct: number, value, index) => {
      return dotProduct + value * reference[index];
    }, 0);
  });
  return { contents };
};

export const sortByValuesAgent: AgentFunction<
  {
    inputKey?: string;
  },
  {
    contents: Array<any>;
  }
> = async ({ params, inputs }) => {
  const sources: Array<any> = inputs[0][params.inputKey ?? "contents"];
  const values: Array<any> = inputs[1][params.inputKey ?? "contents"];
  const joined = sources.map((item, index) => {
    return { item, value: values[index] };
  });
  const contents = joined
    .sort((a, b) => {
      return b.value - a.value; // Descendant
    })
    .map((a) => {
      return a.item;
    });
  return { contents };
};

export const tokenBoundStringsAgent: AgentFunction<
  {
    inputKey?: string;
    limit?: number;
  },
  {
    content: string;
  }
> = async ({ params, inputs }) => {
  const enc = get_encoding("cl100k_base");
  const contents: Array<string> = inputs[0][params?.inputKey ?? "contents"];
  const limit = params?.limit ?? 5000;
  const addNext = (total: number, index: number): number => {
    const length = enc.encode(contents[index]).length;
    if (total + length < limit && index + 1 < contents.length) {
      return addNext(total + length, index + 1);
    }
    return index + 1;
  };
  const endIndex = addNext(0, 0);
  const content = contents
    .filter((value, index) => {
      return index < endIndex;
    })
    .join("\n");
  return { content, endIndex };
};

const graph_data = {
  nodes: {
    source: {
      value: {
        name: "Sam Bankman-Fried",
        topic: "sentence by the court",
        content: "describe the final sentence by the court for Sam Bank-Fried",
      },
    },
    wikipedia: {
      agentId: "wikipediaAgent",
      inputs: ["source"],
      params: {
        inputKey: "name",
        lang: "en",
      },
    },
    chunks: {
      agentId: "stringSplitterAgent",
      inputs: ["wikipedia"],
    },
    embeddings: {
      agentId: "stringEmbeddingsAgent",
      inputs: ["chunks"],
    },
    topicEmbedding: {
      agentId: "stringEmbeddingsAgent",
      inputs: ["source"],
      params: {
        inputKey: "topic",
      },
    },
    similarityCheck: {
      agentId: "cosineSimilarityAgent",
      inputs: ["embeddings", "topicEmbedding"],
    },
    sortedChunks: {
      agentId: "sortByValuesAgent",
      inputs: ["chunks", "similarityCheck"],
    },
    referenceText: {
      agentId: "tokenBoundStringsAgent",
      inputs: ["sortedChunks"],
      params: {
        limit: 5000,
      },
    },
    prompt: {
      agentId: "stringTemplateAgent",
      inputs: ["source", "referenceText"],
      params: {
        template: "Using the following document, ${0}\n\n${1}",
      },
    },
    query: {
      agentId: "slashGPTAgent",
      inputs: ["prompt"],
    },
  },
};

const main = async () => {
  const result = await graphDataTestRunner("sample_wiki.log", graph_data, {
    tokenBoundStringsAgent,
    sortByValuesAgent,
    cosineSimilarityAgent,
    stringEmbeddingsAgent,
    stringSplitterAgent,
    stringTemplateAgent,
    slashGPTAgent,
    wikipediaAgent,
  });
  console.log(result.query);
  console.log("COMPLETE 1");
};
if (process.argv[1] === __filename) {
  main();
}