export {
  operators,
  reverseOperatorMapping,
  isOp,
  isPercent,
  isNumber,
  formatVal,
};

const isNumber = (str) => {
  const num = parseFloat(str); // Or Number(str)
  return !isNaN(num);
};

const isOp = (thing) => {
  for (const opName in operators) {
    if (thing.startsWith(opName)) {
      return opName;
    }
  }
  return false;
};

const isPercent = (str) => {
  if (str.endsWith("%")) {
    return isNumber(str.replace("%", ""));
  }
  return false;
};

const opFuzzyOr = (...args) => {
  // For now each function will handle its own input
  return Math.max(...args.map((f) => parseFloat(f)));
};

const opFuzzyAnd = (...args) => {
  // For now each function will handle its own input
  return Math.min(...args.map((f) => parseFloat(f)));
};

const opSum = (...args) => {
  // For now each function will handle its own input
  const values = args.map((f) => parseFloat(f));
  const sum = values.reduce(
    (accumulator, currentValue) => accumulator + currentValue,
    0,
  );
  return sum;
};

const opCarryMul = (...args) => {
  // For now each function will handle its own input
  const values = args.map((f) => parseFloat(f));
  const mul = values.reduce(
    (accumulator, currentValue) => accumulator * currentValue,
    1,
  );
  return mul;
};

const operators = {
  "||_": { op: opFuzzyOr, name: "op_fuzzy_or_" },
  "&&_": { op: opFuzzyAnd, name: "op_fuzzy_and_" },
  "!_": { op: (v) => 1.0 - parseFloat(v), name: "op_fuzzy_not_" },
  "+_": { op: opSum, name: "op_sum_" },
  "*=_": { op: opCarryMul, name: "op_carry_mul_" },
  ":=_": { op: (v) => parseFloat(v), name: "op_carry_id_" },
  ".=_": { op: (v) => parseFloat(v), name: "op_id_" },
};

const reverseOperatorMapping = (() => {
  let rmap = {};
  for (let k in operators) {
    rmap[operators[k].name] = k;
  }
  return rmap;
})();

const formatVal = (val) => {
  if (val === undefined) {
    return `???`;
  }
  if (val.kind == "pct") {
    return `${(100 * val.value).toFixed(0)}%`;
  }
  if (val.kind == "num") {
    return `${val.value.toFixed(2)}`;
  }
  throw {
    name: "EvaluationValueError",
    message: `Kind ${val.kind} is not valid for a value`,
  };
};
