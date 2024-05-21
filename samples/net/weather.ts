import "dotenv/config";
import { graphDataTestRunner } from "~/utils/runner";
import { groqAgent, openAIAgent, nestedAgent, copyAgent, fetchAgent, textInputAgent, jsonParserAgent, propertyFilterAgent } from "@/experimental_agents";
import input from "@inquirer/input";

const tools = [
  {
    type: "function",
    function: {
      name: "getWeather",
      description: "get wether information of the specified location",
      parameters: {
        type: "object",
        properties: {
          latitude: {
            type: "number",
            description: "The latitude of the location.",
          },
          longitude: {
            type: "number",
            description: "The longitude of the location.",
          },
        },
        required: ["latitude", "longitude"],
      },
    },
  },
];

const graph_tool = {
  nodes: {
    outputFetching: {
      // Displays the fetching message.
      agent: "stringTemplateAgent",
      params: {
        template: "... fetching weather info: ${0}",
      },
      console: {
        after: true,
      },
      inputs: [":$0.$0.function.arguments"],
    },
    parser: {
      // Parse the arguments to the function
      agent: "jsonParserAgent",
      inputs: [":$0.$0.function.arguments"]
    },
    urlPoints: {
      // Builds a URL to fetch the "grid location" from the spcified latitude and longitude
      agent: "stringTemplateAgent",
      params: {
        template: "https://api.weather.gov/points/${0},${1}",
      },
      inputs: [":parser.latitude", ":parser.longitude"],
    },
    fetchPoints: {
      // Fetches the "grid location" from the URL.
      agent: "fetchAgent",
      params: {
        returnErrorResult: true, // returns {status error} in case of error
      },
      inputs: [":urlPoints", undefined, { "User-Agent": "(receptron.org)" }],
    },
    fetchForecast: {
      // Fetches the weather forecast for that location.
      agent: "fetchAgent",
      params: {
        type: "text",
      },
      inputs: [":fetchPoints.properties.forecast", undefined, { "User-Agent": "(receptron.org)" }],
      if: ":fetchPoints.properties.forecast",
    },
    extractError: {
      // Extract error title and detail
      agent: "stringTemplateAgent",
      params: {
        template: "${0}: ${1}",
      },
      inputs: [":fetchPoints.error.title", ":fetchPoints.error.detail"],
      if: ":fetchPoints.error",
    },
    responseText: {
      // Extract the forecast and error
      agent: "copyAgent",
      anyInput: true,
      inputs: [":fetchForecast", ":extractError"],
    },
    toolMessage: {
      // Creates a tool message as the return value of the tool call.
      agent: "propertyFilterAgent",
      params: {
        inject: [{
          propId: "tool_call_id",
          from: 1,
        }, {
          propId: "name",
          from: 2,
        }, {
          propId: "content",
          from: 3,
        }]
      },
      inputs: [{ role: "tool" }, ":$0.$0.id", ":$0.$0.function.name", ":responseText"],
    },
    messagesWithToolRes: {
      // Appends that message to the messages.
      agent: "pushAgent",
      inputs: [":$1", ":toolMessage"],
    },
    llmCall: {
      // Sends those messages to LLM to get the answer.
      agent: "openAIAgent",
      inputs: [undefined, ":messagesWithToolRes"],
    },
    output: {
      // Displays the response to the user.
      agent: "stringTemplateAgent",
      params: {
        template: "Weather: ${0}",
      },
      console: {
        after: true,
      },
      inputs: [":llmCall.choices.$0.message.content"],
    },
    messagesWithSecondRes: {
      // Appends the response to the messages.
      agent: "pushAgent",
      inputs: [":messagesWithToolRes", ":llmCall.choices.$0.message"],
      isResult: true,
    },
  },
};

const graph_data = {
  version: 0.3,
  loop: {
    while: ":continue",
  },
  nodes: {
    continue: {
      // Holds a boolean data if we need to continue this chat or not.
      value: true,
      update: ":checkInput.continue",
    },
    messages: {
      // Holds the conversation, array of messages.
      value: [{ role: "system", content: "You are a meteorologist. Use getWeather API, only when the user ask for the weather information." }],
      update: ":reducer",
      isResult: true,
    },
    userInput: {
      // Receives an input from the user.
      agent: "textInputAgent",
      params: {
        message: "Location:",
      },
    },
    checkInput: {
      // Checks if the user wants to terminate the chat or not.
      agent: "propertyFilterAgent",
      params: {
        inspect: [
          {
            propId: "continue",
            notEqual: "/bye",
          },
        ],
      },
      inputs: [{}, ":userInput"],
    },
    userMessage: {
      // Generates an message object with the user input.
      agent: "propertyFilterAgent",
      params: {
        inject: [
          {
            propId: "content",
            from: 1,
          },
        ],
      },
      inputs: [{ role: "user" }, ":userInput"],
    },
    messagesWithUserInput: {
      // Appends it to the conversation
      agent: "pushAgent",
      inputs: [":messages", ":userMessage"],
      if: ":checkInput.continue",
    },
    llmCall: {
      // Sends those messages to LLM to get the answer.
      agent: "openAIAgent",
      params: {
        tools,
      },
      inputs: [undefined, ":messagesWithUserInput"],
    },
    output: {
      // Displays the response to the user.
      agent: "stringTemplateAgent",
      params: {
        template: "Weather: ${0}",
      },
      console: {
        after: true,
      },
      inputs: [":llmCall.choices.$0.message.content"],
      if: ":llmCall.choices.$0.message.content",
    },
    messagesWithFirstRes: {
      // Appends the response to the messages.
      agent: "pushAgent",
      inputs: [":messagesWithUserInput", ":llmCall.choices.$0.message"],
    },
    tool_calls: {
      // This node is activated if the LLM requests a tool call.
      agent: "nestedAgent",
      inputs: [":llmCall.choices.$0.message.tool_calls", ":messagesWithFirstRes"],
      if: ":llmCall.choices.$0.message.tool_calls",
      graph: graph_tool,
    },
    no_tool_calls: {
      // This node is activated only if this is a normal response (not a tool call).
      agent: "copyAgent",
      unless: ":llmCall.choices.$0.message.tool_calls",
      inputs: [":messagesWithFirstRes"],
    },
    reducer: {
      // Receives messages from either case.
      agent: "copyAgent",
      anyInput: true,
      inputs: [":no_tool_calls", ":tool_calls.messagesWithSecondRes"],
    },
  },
};

export const main = async () => {
  const result = await graphDataTestRunner(
    __filename,
    graph_data,
    {
      groqAgent,
      openAIAgent,
      copyAgent,
      nestedAgent,
      fetchAgent,
      textInputAgent,
      jsonParserAgent,
      propertyFilterAgent,
    },
    () => {},
    false,
  );
  console.log("Complete", result);
};

if (process.argv[1] === __filename) {
  main();
}
