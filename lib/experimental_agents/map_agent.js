"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapAgent = void 0;
const graphai_1 = require("../graphai");
const utils_1 = require("../utils/utils");
const mapAgent = async ({ params, inputs, agents, log, taskManager, graphData }) => {
    if (taskManager) {
        const status = taskManager.getStatus();
        (0, utils_1.assert)(status.concurrency > status.running, `mapAgent: Concurrency is too low: ${status.concurrency}`);
    }
    (0, utils_1.assert)(graphData !== undefined, "mapAgent: graphData is required");
    const input = Array.isArray(inputs[0]) ? inputs[0] : inputs;
    const injectionTo = params.injectionTo ?? "$0";
    if (graphData.nodes[injectionTo] === undefined) {
        // If the input node does not exist, automatically create a static node
        graphData.nodes[injectionTo] = { value: {} };
    }
    const graphs = input.map((data) => {
        const graphAI = new graphai_1.GraphAI(graphData, agents || {}, taskManager);
        graphAI.injectValue(injectionTo, data, "__mapAgent_inputs__");
        return graphAI;
    });
    const runs = graphs.map((graph) => {
        return graph.run(false);
    });
    const results = await Promise.all(runs);
    const nodeIds = Object.keys(results[0]);
    (0, utils_1.assert)(nodeIds.length > 0, "mapAgent: no return values (missing isResult)");
    const compositeResult = nodeIds.reduce((tmp, nodeId) => {
        tmp[nodeId] = results.map((result) => {
            return result[nodeId];
        });
        return tmp;
    }, {});
    if (log) {
        const logs = graphs.map((graph, index) => {
            return graph.transactionLogs().map((log) => {
                log.mapIndex = index;
                return log;
            });
        });
        log.push(...logs.flat());
    }
    return compositeResult;
};
exports.mapAgent = mapAgent;