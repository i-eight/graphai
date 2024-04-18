import type { NodeDataParams, TransactionLog, ResultData, DataSource, NodeData } from "@/type";

import type { GraphAI } from "@/graphai";

import { NodeState } from "@/type";

import { parseNodeName } from "@/utils/utils";
import { injectValueLog, executeLog, timeoutLog, callbackLog, errorLog } from "@/log";

export class Node {
  public nodeId: string;
  public sources: Record<string, DataSource> = {}; // data sources.
  public anyInput: boolean; // any input makes this node ready
  public inputs: Array<string>; // List of nodes this node needs data from. The order is significant.
  public pendings: Set<string>; // List of nodes this node is waiting data from.
  public waitlist = new Set<string>(); // List of nodes which need data from this node.
  public state = NodeState.Waiting;
  public fork?: number;
  public forkIndex?: number;
  public result: ResultData = undefined;
  public transactionId: undefined | number; // To reject callbacks from timed-out transactions

  protected graph: GraphAI;

  constructor(nodeId: string, forkIndex: number | undefined, data: NodeData, graph: GraphAI) {
    this.nodeId = nodeId;
    this.forkIndex = forkIndex;
    this.anyInput = data.anyInput ?? false;
    this.inputs = (data.inputs ?? []).map((input) => {
      const source = parseNodeName(input);
      this.sources[source.nodeId] = source;
      return source.nodeId;
    });
    this.pendings = new Set(this.inputs);
    this.fork = data.fork;
    this.graph = graph;
  }

  public asString() {
    return `${this.nodeId}: ${this.state} ${[...this.waitlist]}`;
  }

  public removePending(nodeId: string) {
    if (this.anyInput) {
      const [result] = this.graph.resultsOf([this.sources[nodeId]]);
      if (result) {
        this.pendings.clear();
      }
    } else {
      this.pendings.delete(nodeId);
    }
  }

  protected setResult(result: ResultData, state: NodeState) {
    this.state = state;
    this.result = result;
    this.waitlist.forEach((nodeId) => {
      const node = this.graph.nodes[nodeId];
      // Todo: Avoid running before Run()
      node.removePending(this.nodeId);
    });
  }
}

export class ComputedNode extends Node {
  public params: NodeDataParams; // Agent-specific parameters
  public retryLimit: number;
  public retryCount: number = 0;
  public agentId?: string;
  public timeout?: number; // msec
  public error?: Error;
  public outputs?: Record<string, string>; // Mapping from routeId to nodeId
  public readonly isStaticNode = false;

  constructor(nodeId: string, forkIndex: number | undefined, data: NodeData, graph: GraphAI) {
    super(nodeId, forkIndex, data, graph);
    this.params = data.params ?? {};
    this.agentId = data.agentId ?? graph.agentId;
    this.retryLimit = data.retry ?? 0;
    this.timeout = data.timeout;
    this.outputs = data.outputs;
  }
  // for completed
  public pushQueueIfReady() {
    if (this.pendings.size === 0) {
      // If input property is specified, we need to ensure that the property value exists.
      const count = this.inputs.reduce((count, nodeId) => {
        const source = this.sources[nodeId];
        if (source.propId) {
          const [result] = this.graph.resultsOf([source]);
          if (!result) {
            return count;
          }
        }
        return count + 1;
      }, 0);

      if ((this.anyInput && count > 0) || count == this.inputs.length) {
        this.graph.pushQueue(this);
      }
    }
  }

  // for computed
  private retry(state: NodeState, error: Error) {
    if (this.retryCount < this.retryLimit) {
      this.retryCount++;
      this.execute();
    } else {
      this.state = state;
      this.result = undefined;
      this.error = error;
      this.transactionId = undefined; // This is necessary for timeout case
      this.graph.removeRunning(this);
    }
  }

  public removePending(nodeId: string) {
    super.removePending(nodeId);
    if (this.graph.isRunning) {
      this.pushQueueIfReady();
    }
  }

  public async execute() {
    const results = this.graph
      .resultsOf(
        this.inputs.map((input) => {
          return this.sources[input];
        }),
      )
      .filter((result) => {
        // Remove undefined if anyInput flag is set.
        return !this.anyInput || result !== undefined;
      });
    const transactionId = Date.now();
    const log: TransactionLog = executeLog(this.nodeId, this.retryCount, transactionId, this.agentId, this.params, results);
    this.graph.appendLog(log);
    this.state = NodeState.Executing;
    this.transactionId = transactionId;

    if (this.timeout && this.timeout > 0) {
      setTimeout(() => {
        if (this.state === NodeState.Executing && this.transactionId === transactionId) {
          console.log(`-- ${this.nodeId}: timeout ${this.timeout}`);
          timeoutLog(log);
          this.retry(NodeState.TimedOut, Error("Timeout"));
        }
      }, this.timeout);
    }

    try {
      const callback = this.graph.getCallback(this.agentId);
      const localLog: TransactionLog[] = [];
      const result = await callback({
        nodeId: this.nodeId,
        retry: this.retryCount,
        params: this.params,
        inputs: results,
        forkIndex: this.forkIndex,
        verbose: this.graph.verbose,
        agents: this.graph.callbackDictonary,
        log: localLog,
      });
      if (this.transactionId !== transactionId) {
        console.log(`-- ${this.nodeId}: transactionId mismatch`);
        return;
      }

      callbackLog(log, result, localLog);

      const outputs = this.outputs;
      if (outputs !== undefined) {
        Object.keys(outputs).forEach((outputId) => {
          const nodeId = outputs[outputId];
          const value = result[outputId];
          if (value) {
            this.graph.injectValue(nodeId, value);
          } else {
            console.error("-- Invalid outputId", outputId, result);
          }
        });
        log.state = NodeState.Dispatched;
        this.state = NodeState.Dispatched;
        this.graph.removeRunning(this);
        return;
      }
      log.state = NodeState.Completed;
      this.setResult(result, NodeState.Completed);
      this.graph.removeRunning(this);
    } catch (error) {
      if (this.transactionId !== transactionId) {
        console.log(`-- ${this.nodeId}: transactionId mismatch(error)`);
        return;
      }
      const isError = error instanceof Error;
      errorLog(log, isError ? error.message : "Unknown");
      if (isError) {
        this.retry(NodeState.Failed, error);
      } else {
        console.error(`-- ${this.nodeId}: Unexpecrted error was caught`);
        this.retry(NodeState.Failed, Error("Unknown"));
      }
    }
  }
}
export class StaticNode extends Node {
  public value?: ResultData;
  public update?: string;
  public readonly isStaticNode = true;

  constructor(nodeId: string, forkIndex: number | undefined, data: NodeData, graph: GraphAI) {
    super(nodeId, forkIndex, data, graph);
    this.value = data.value;
    this.update = data.update;
  }

  // for static
  public injectValue(value: ResultData) {
    const log = injectValueLog(this.nodeId, value);
    this.graph.appendLog(log);
    this.setResult(value, NodeState.Injected);
    //console.error("- injectValue called on non-source node.", this.nodeId);
  }
}