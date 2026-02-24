# @dgca/result

A tiny utility for cleaner error handling in TypeScript. Wraps a function call and returns a `{ data, error }` tuple instead of throwing.

## Install

```bash
pnpm add @dgca/result
```

## Usage

### Async

```ts
import { result } from "@dgca/result";

const { data, error } = await result(async () => {
  const response = await fetch("https://api.example.com/data");

  if (!response.ok) throw new Error("Request failed");

  return response.json();
});

if (error) {
  console.error("Something went wrong:", error.message);
} else {
  console.log("Got data:", data);
}
```

### Sync

```ts
import { result } from "@dgca/result";

const { data, error } = result(() => {
  return JSON.parse(someString);
});

if (error) {
  console.error("Invalid JSON:", error.message);
} else {
  console.log("Parsed:", data);
}
```

### How it works

- If the function **returns** a value, you get `{ data: value, error: null }`.
- If the function **throws**, you get `{ data: null, error: Error }`.
- If something non-Error is thrown (e.g. a string), it gets wrapped in `new Error()`.
- If the function is async, `result()` returns a `Promise` — just `await` it.