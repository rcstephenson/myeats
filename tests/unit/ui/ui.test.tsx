import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EntryRow,
  NumberField,
  NutrientBar,
  SearchField,
  Toast,
  parseDecimal,
} from '../../../src/components/ui';

describe('NutrientBar', () => {
  it('under goal: left text, clamped fill, aria', () => {
    render(
      <NutrientBar
        label="Protein"
        eaten={120}
        goal={180}
        unit="g"
        direction="min"
        color="protein"
      />,
    );
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '120');
    expect(meter).toHaveAttribute('aria-valuemax', '180');
    expect(meter).toHaveAttribute('aria-label', 'Protein 120 of 180 grams, 60 left');
    expect(screen.getByText('60 left')).toBeInTheDocument();
    expect(screen.getByTestId('nutrient-fill')).toHaveStyle({ width: '66.66666666666666%' });
    expect(screen.queryByTestId('over-tick')).toBeNull();
  });

  it('over target: full bar, danger tick, "N over"', () => {
    render(
      <NutrientBar
        label="Calories"
        eaten={2520}
        goal={2400}
        unit="kcal"
        direction="target"
        color="kcal"
      />,
    );
    expect(screen.getByTestId('nutrient-fill')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('over-tick')).toBeInTheDocument();
    const over = screen.getByText('120 over');
    expect(over.className).toContain('text-danger');
    expect(screen.getByText(/2,520/)).toBeInTheDocument();
  });

  it('over min: full bar, +N, no danger', () => {
    render(
      <NutrientBar
        label="Protein"
        eaten={195}
        goal={180}
        unit="g"
        direction="min"
        color="protein"
      />,
    );
    expect(screen.getByTestId('nutrient-fill')).toHaveStyle({ width: '100%' });
    expect(screen.getByText('+15')).toBeInTheDocument();
    expect(screen.queryByTestId('over-tick')).toBeNull();
    expect(screen.queryByText(/over$/)).toBeNull();
  });

  it('no goal: label and eaten only, no meter', () => {
    render(
      <NutrientBar
        label="Sodium"
        eaten={1840}
        goal={null}
        unit="mg"
        direction="max"
        color="nutrient"
      />,
    );
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('Sodium')).toBeInTheDocument();
    expect(screen.getByText(/1,840/)).toBeInTheDocument();
  });
});

describe('NumberField', () => {
  it('parses comma decimals', () => {
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal('.5')).toBe(0.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1.2.3')).toBeNull();
  });

  it('emits number and raw string, with mobile input attributes', () => {
    const onChange = vi.fn();
    render(<NumberField label="Amount" onChange={onChange} />);
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('enterkeyhint', 'done');
    fireEvent.change(input, { target: { value: '2,25' } });
    expect(onChange).toHaveBeenLastCalledWith(2.25, '2,25');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null, '');
  });
});

describe('Toast', () => {
  afterEach(() => vi.useRealTimers());

  it('auto-dismisses after 5s and runs the action', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    render(
      <Toast message="Added oats" actionLabel="Undo" onAction={onAction} onDismiss={onDismiss} />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Undo'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('SearchField', () => {
  it('forwards ref so the input can be focused synchronously', () => {
    const ref = createRef<HTMLInputElement>();
    render(<SearchField ref={ref} value="" onChange={() => undefined} />);
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
    expect(ref.current).toHaveAttribute('enterkeyhint', 'search');
  });

  it('clear button empties the value', () => {
    const onChange = vi.fn();
    render(<SearchField value="oat" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('EntryRow', () => {
  const base = { name: 'Oats', amount: '40 g', kcal: '150', protein: '5', carbs: '27', fat: '3' };

  it('shows the incomplete mark with an accessible name', () => {
    render(<EntryRow {...base} incomplete onSelect={() => undefined} />);
    expect(screen.getByLabelText('Some nutrients missing')).toBeInTheDocument();
    expect(screen.getByText('P 5 · C 27 · F 3')).toBeInTheDocument();
  });

  it('has no mark when complete and is not a button when disabled', () => {
    render(<EntryRow {...base} disabled />);
    expect(screen.queryByLabelText('Some nutrients missing')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
