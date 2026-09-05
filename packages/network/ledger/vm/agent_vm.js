/**
 * MYCA Agent VM — Deterministic Task Orchestration Machine
 * 
 * Strict Invariant §23 & §24:
 * The Agent VM is a deterministic task orchestration machine, NOT a general-purpose language.
 * Strictly executes 12 primitive opcodes.
 * NO eval, NO new Function, NO arbitrary native execution.
 */
export const AGENT_VM_STATES = {
  CREATED: "CREATED",
  READY: "READY",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  VERIFYING: "VERIFYING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
};

export class MycAgentVM {
  constructor(options = {}) {
    this.maxSteps = options.maxSteps || 100;
    this.memoryLimitKb = options.memoryLimitKb || 512;
    this.tools = new Map(); // toolName -> handlerFunction
    this.allowlistedTools = new Set(options.allowlistedTools || [
      "math_eval", "memory_query", "intent_parse", "spectral_match"
    ]);
  }

  registerTool(name, fn) {
    this.tools.set(name, fn);
    this.allowlistedTools.add(name);
  }

  async executePlan(planJson, initialContext = {}) {
    let plan = typeof planJson === "string" ? JSON.parse(planJson) : planJson;
    if (!plan || !Array.isArray(plan.instructions)) {
      throw new Error("INVALID_AGENT_PLAN: 'instructions' array required");
    }

    const state = {
      status: AGENT_VM_STATES.READY,
      step: 0,
      memory: new Map(Object.entries(initialContext.memory || {})),
      registers: { ...initialContext },
      events: [],
      returnValue: null,
      error: null
    };

    state.status = AGENT_VM_STATES.RUNNING;

    for (let i = 0; i < plan.instructions.length; i++) {
      if (state.step >= this.maxSteps) {
        state.status = AGENT_VM_STATES.FAILED;
        state.error = `MAX_STEPS_EXCEEDED: ${this.maxSteps}`;
        break;
      }

      state.step++;
      const instr = plan.instructions[i];
      const op = (instr.op || "").toUpperCase();

      try {
        switch (op) {
          case "LOAD_CONTEXT": {
            const val = this.resolvePath(state.registers, instr.key);
            state.registers[instr.target || "context"] = val;
            break;
          }

          case "MEMORY_GET": {
            const val = state.memory.get(instr.key);
            state.registers["result"] = val;
            break;
          }

          case "MEMORY_PUT": {
            const val = instr.value !== undefined ? instr.value : state.registers["result"];
            state.memory.set(instr.key, val);
            break;
          }

          case "ROUTE": {
            state.registers["selected_capability"] = instr.capability;
            break;
          }

          case "CALL_TOOL": {
            if (!this.allowlistedTools.has(instr.tool)) {
              throw new Error(`TOOL_NOT_ALLOWLISTED: '${instr.tool}'`);
            }
            const toolFn = this.tools.get(instr.tool);
            if (!toolFn) {
              // Default deterministic tool mock if not registered
              state.registers["result"] = {
                tool: instr.tool,
                args: instr.args,
                valid: true,
                data: "PROCESSED_DETERMINISTIC_TOOL_OUTPUT"
              };
            } else {
              const res = await toolFn(instr.args, state.registers);
              state.registers["result"] = res;
            }
            break;
          }

          case "ASSERT": {
            const actual = this.resolvePath(state.registers, instr.condition);
            if (actual !== instr.expected) {
              throw new Error(`ASSERTION_FAILED: condition '${instr.condition}' expected ${instr.expected}, got ${actual}`);
            }
            break;
          }

          case "WAIT": {
            state.status = AGENT_VM_STATES.WAITING;
            const ms = Math.min(instr.timeoutMs || 10, 100);
            await new Promise(r => setTimeout(r, ms));
            state.status = AGENT_VM_STATES.RUNNING;
            break;
          }

          case "EMIT": {
            state.events.push({ event: instr.event, data: instr.data, timestamp: Date.now() });
            break;
          }

          case "CREATE_TASK": {
            state.registers["last_task_id"] = "task_" + state.step;
            break;
          }

          case "LOCK_ESCROW": {
            state.registers["escrow_locked"] = true;
            break;
          }

          case "SUBMIT_PROOF": {
            state.status = AGENT_VM_STATES.VERIFYING;
            state.registers["proof_submitted"] = instr.proofHash || "0x_por_hash";
            state.status = AGENT_VM_STATES.RUNNING;
            break;
          }

          case "RETURN": {
            state.returnValue = this.resolvePath(state.registers, instr.value);
            state.status = AGENT_VM_STATES.COMPLETED;
            return state;
          }

          default:
            throw new Error(`UNKNOWN_AGENT_OPCODE: '${op}'`);
        }
      } catch (err) {
        state.status = AGENT_VM_STATES.FAILED;
        state.error = err.message;
        return state;
      }
    }

    if (state.status === AGENT_VM_STATES.RUNNING) {
      state.status = AGENT_VM_STATES.COMPLETED;
    }
    return state;
  }

  resolvePath(obj, path) {
    if (path === undefined || path === null) return undefined;
    if (typeof path !== "string") return path;
    const parts = path.split(".");
    let curr = obj;
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr !== undefined ? curr : path;
  }
}
