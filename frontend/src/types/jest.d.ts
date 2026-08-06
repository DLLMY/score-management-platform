/// <reference types="@types/jest" />

declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toHaveValue(value: string | number): R;
    toBeChecked(): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(className: string): R;
  }
}

declare global {
  const describe: jest.Describe;
  const test: jest.It;
  const it: jest.It;
  const expect: jest.Expect;
  const beforeEach: jest.Hook;
  const afterEach: jest.Hook;
  const beforeAll: jest.Hook;
  const afterAll: jest.Hook;
  const jest: jest.Jest;
}