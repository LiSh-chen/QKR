import { useState, useCallback } from 'react';

export type CalcOperator = '+' | '-' | '×' | '÷';

interface CalcState {
  previousValue: number | null;
  operator: CalcOperator | null;
  currentEntry: string; // raw text of the number currently being typed
}

const MAX_ENTRY_LENGTH = 9;

function applyOp(op: CalcOperator, a: number, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? a : a / b;
  }
}

function roundClean(n: number): number {
  // Avoid float artefacts like 0.1 + 0.2 = 0.300000004
  return Math.round(n * 100) / 100;
}

export function useCalculator() {
  const [state, setState] = useState<CalcState>({ previousValue: null, operator: null, currentEntry: '' });

  const pressDigit = useCallback((d: '0' | '00' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9') => {
    setState((prev) => {
      const base = prev.currentEntry === '0' ? '' : prev.currentEntry;
      const next = base + d;
      return next.length > MAX_ENTRY_LENGTH ? prev : { ...prev, currentEntry: next };
    });
  }, []);

  const pressOperator = useCallback((op: CalcOperator) => {
    setState((prev) => {
      if (prev.currentEntry === '' && prev.previousValue === null) return prev; // nothing entered yet
      if (prev.operator && prev.currentEntry !== '') {
        // Chain: compute the pending operation first, like a real calculator
        const result = roundClean(applyOp(prev.operator, prev.previousValue!, parseFloat(prev.currentEntry)));
        return { previousValue: result, operator: op, currentEntry: '' };
      }
      const pv = prev.currentEntry !== '' ? parseFloat(prev.currentEntry) : prev.previousValue!;
      return { previousValue: pv, operator: op, currentEntry: '' };
    });
  }, []);

  const pressEquals = useCallback(() => {
    setState((prev) => {
      if (prev.operator === null || prev.previousValue === null) return prev;
      const b = prev.currentEntry !== '' ? parseFloat(prev.currentEntry) : prev.previousValue;
      const result = roundClean(applyOp(prev.operator, prev.previousValue, b));
      return { previousValue: null, operator: null, currentEntry: String(result) };
    });
  }, []);

  const pressBackspace = useCallback(() => {
    setState((prev) => {
      if (prev.currentEntry !== '') {
        return { ...prev, currentEntry: prev.currentEntry.slice(0, -1) };
      }
      if (prev.operator !== null) {
        // undo the pending operator, go back to editing the previous value
        return { previousValue: null, operator: null, currentEntry: prev.previousValue !== null ? String(prev.previousValue) : '' };
      }
      return prev;
    });
  }, []);

  const clear = useCallback(() => {
    setState({ previousValue: null, operator: null, currentEntry: '' });
  }, []);

  const setDirectValue = useCallback((value: string) => {
    setState({ previousValue: null, operator: null, currentEntry: value });
  }, []);

  /** The number that would be used right now if the user tapped a category button without pressing "=". */
  const getEvaluatedAmount = useCallback((): number => {
    if (state.operator !== null && state.previousValue !== null) {
      const b = state.currentEntry !== '' ? parseFloat(state.currentEntry) : state.previousValue;
      return roundClean(applyOp(state.operator, state.previousValue, b));
    }
    if (state.currentEntry !== '') return parseFloat(state.currentEntry);
    if (state.previousValue !== null) return state.previousValue;
    return NaN;
  }, [state]);

  const display =
    state.operator !== null
      ? `${state.previousValue}${state.operator}${state.currentEntry}`
      : state.currentEntry || (state.previousValue !== null ? String(state.previousValue) : '');

  const hasPendingOperator = state.operator !== null;

  return {
    display,
    hasPendingOperator,
    pressDigit,
    pressOperator,
    pressEquals,
    pressBackspace,
    clear,
    setDirectValue,
    getEvaluatedAmount,
  };
}
