import { AgentFunction } from "@/graphai";

// This agent returned a sorted array of one array (A) based on another array (B).
// The default sorting order is "decendant".
//
// Parameters:
//  acendant: Specifies if the sorting order should be acendant. The default is "false" (decendant).
// Inputs:
//  inputs[0]: Array<any>; // array to be sorted
//  inputs[1]: Array<number>; // array of numbers for sorting
//
export const sortByValuesAgent: AgentFunction<
  {
    assendant?: boolean;
  },
  {
    contents: Array<any>;
  },
  Array<any>
> = async ({ params, inputs }) => {
  const direction = params?.assendant ?? false ? -1 : 1;
  const sources: Array<any> = inputs[0];
  const values: Array<any> = inputs[1];
  const joined = sources.map((item, index) => {
    return { item, value: values[index] };
  });
  const contents = joined
    .sort((a, b) => {
      return (b.value - a.value) * direction;
    })
    .map((a) => {
      return a.item;
    });
  return { contents };
};

const sortByValuesAgentInfo = {
  name: "sortByValuesAgent",
  agent: sortByValuesAgent,
  mock: sortByValuesAgent,
  samples: [],
  description: "sortByValues Agent",
  author: "Receptron team",
  repository: "https://github.com/receptron/graphai",
  license: "MIT",
};
export default sortByValuesAgentInfo;