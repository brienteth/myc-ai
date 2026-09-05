/**
 * MYCA Policy VM — Deterministic Authorization Policy Evaluator
 * 
 * Strict Invariant §26 & §27:
 * Evaluates authorization policies using a constrained JSON AST.
 * Primitives supported:
 *  - Logical: AND, OR, NOT
 *  - Comparison: EQ, NEQ, GT, GTE, LT, LTE, IN, NOT_IN
 *  - Value resolvers: field(path), constant(val)
 * 
 * NO arbitrary code execution.
 */
export class MycPolicyVM {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth || 16;
  }

  evaluate(ast, context = {}) {
    if (!ast || typeof ast !== "object") {
      return { allowed: false, reason: "INVALID_AST_OBJECT" };
    }
    try {
      const result = this.evalNode(ast, context, 0);
      return { allowed: Boolean(result), trace: "DETERMINISTIC_EVAL_COMPLETE" };
    } catch (err) {
      return { allowed: false, reason: err.message };
    }
  }

  evalNode(node, context, depth) {
    if (depth > this.maxDepth) {
      throw new Error(`MAX_POLICY_DEPTH_EXCEEDED: ${this.maxDepth}`);
    }

    if (typeof node !== "object" || node === null) {
      return node;
    }

    // Check for field resolver: { field: "task.amount" }
    if ("field" in node) {
      return this.resolveField(context, node.field);
    }

    // Check for constant: { constant: 100 }
    if ("constant" in node) {
      return node.constant;
    }

    const keys = Object.keys(node);
    if (keys.length !== 1) {
      throw new Error(`MALFORMED_AST_NODE: exactly one operator expected, got [${keys.join(", ")}]`);
    }

    const op = keys[0].toLowerCase();
    const arg = node[keys[0]];

    switch (op) {
      case "and": {
        if (!Array.isArray(arg)) throw new Error("'and' expects an array of expressions");
        return arg.every(child => this.evalNode(child, context, depth + 1));
      }

      case "or": {
        if (!Array.isArray(arg)) throw new Error("'or' expects an array of expressions");
        return arg.some(child => this.evalNode(child, context, depth + 1));
      }

      case "not": {
        return !this.evalNode(arg, context, depth + 1);
      }

      case "eq": {
        const [left, right] = this.evalBinaryArgs(arg, context, depth);
        return left === right;
      }

      case "neq": {
        const [left, right] = this.evalBinaryArgs(arg, context, depth);
        return left !== right;
      }

      case "gt": {
        const [left, right] = this.evalBinaryArgs(arg, context, depth);
        return left > right;
      }

      case "gte": {
        const [left, right] = this.evalBinaryArgs(arg, context, depth);
        return left >= right;
      }

      case "lt": {
        const [left, right] = this.evalBinaryArgs(arg, context, depth);
        return left < right;
      }

      case "lte": {
        const [left, right] = this.evalBinaryArgs(arg, context, depth);
        return left <= right;
      }

      case "in": {
        const [item, list] = this.evalBinaryArgs(arg, context, depth);
        return Array.isArray(list) && list.includes(item);
      }

      case "not_in": {
        const [item, list] = this.evalBinaryArgs(arg, context, depth);
        return Array.isArray(list) && !list.includes(item);
      }

      default:
        throw new Error(`UNKNOWN_POLICY_OPERATOR: '${op}'`);
    }
  }

  evalBinaryArgs(args, context, depth) {
    if (!Array.isArray(args) || args.length !== 2) {
      throw new Error(`Binary operator requires array of 2 expressions, got: ${JSON.stringify(args)}`);
    }
    return [
      this.evalNode(args[0], context, depth + 1),
      this.evalNode(args[1], context, depth + 1)
    ];
  }

  resolveField(context, path) {
    if (!path || typeof path !== "string") return undefined;
    const parts = path.split(".");
    let curr = context;
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr;
  }
}
