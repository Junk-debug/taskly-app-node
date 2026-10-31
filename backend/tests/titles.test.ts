import { describe, expect, it } from 'vitest';
import { normalizeTitle, titlesMatch } from '../src/features/todos/titles.ts';

describe('normalizeTitle', () => {
  it.each([
    ['  Buy milk  ', 'Buy milk'],
    ['Buy    milk', 'Buy milk'],
    ['Buy\t\nmilk', 'Buy milk'],
    ['Buy milk', 'Buy milk'],
    ['   ', ''],
    ['', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });
});

describe('titlesMatch', () => {
  it.each([
    ['Buy milk', 'buy milk', true],
    ['  Buy   MILK ', 'buy milk', true],
    ['buy milk', '  Buy   MILK ', true],
    ['Buy\tmilk', 'BUY MILK', true],
    ['Buy milk', 'Buy  milks', false],
    ['Buy milk', 'Buy bread', false],
    ['Buymilk', 'Buy milk', false],
  ])('compares %j and %j → %s', (a, b, expected) => {
    expect(titlesMatch(a, b)).toBe(expected);
  });
});
