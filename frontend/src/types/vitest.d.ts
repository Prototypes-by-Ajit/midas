declare module "vitest" {
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: () => void | Promise<void>): void
  export function beforeEach(fn: () => void | Promise<void>): void

  export function expect<T>(value: T): {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toBeDefined(): void
    toBeTruthy(): void
    toBeFalsy(): void
  }

  export const vi: {
    fn: <T extends (...args: any[]) => any>(impl?: T) => T
  }
}
