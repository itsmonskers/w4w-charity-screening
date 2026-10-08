export type Segment = [number, number[]]
const range = (from: number, to: number) => Array.from({ length: Math.abs(from - to) + 1 }, (_, i) => from > to ? from - i : from + i)
export const seatLayout: Record<string, Segment[]> = Object.fromEntries([
  ...'ABCDEF'.split('').map(row => [row, [[1, range(22, 16)], [10, range(15, 8)], [20, range(7, 1)]]]),
  ...'GHIJKLMN'.split('').map(row => [row, [[4, range(15, 12)], [10, range(11, 5)], [19, range(4, 1)]]]),
  ...'OP'.split('').map(row => [row, [[1, range(21, 15)], [10, range(14, 8)], [19, range(7, 1)]]]),
  ['Q', [[3, range(21, 1)]]],
])
