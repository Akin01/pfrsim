# SolidJS Core Reactivity Reference

This reference is bundled with the `solidjs-expert` skill so the skill remains useful after installation in any project.

## Execution model

- Solid components execute once to create DOM and register a fine-grained reactive graph.
- A component body is setup code, not a recurring render function.
- Reactive work happens where reactive values are read inside tracking scopes: JSX expressions, `createMemo`, `createEffect`, `createResource` sources/fetchers, and router async primitives.
- Passing an accessor such as `count` preserves reactivity. Passing `count()` passes the current snapshot.

## Signals

```tsx
import { createSignal } from "solid-js";

const [count, setCount] = createSignal(0);

count(); // read
setCount(1); // write value
setCount((previous) => previous + 1); // write from previous value
```

Use signals for scalar or independently replaced state. Prefer setter callbacks when the next value depends on the previous value.

### Function values in signals

If a signal stores a function, wrap the new function in a setter callback so Solid does not treat it as an updater:

```ts
setHandler(() => nextHandler);
```

## Tracking scopes

A signal read inside a tracking scope subscribes that scope to future changes. A signal read outside a tracking scope is only a snapshot.

Tracked examples:

```tsx
<div>{count()}</div>

const doubled = createMemo(() => count() * 2);

createEffect(() => {
	console.log(count());
});
```

Not tracked:

```ts
const value = count();
```

## Memos

Use `createMemo` for pure derived state and expensive derivations.

```tsx
import { createMemo } from "solid-js";

const visibleItems = createMemo(() =>
	items().filter((item) => item.name.includes(query()))
);
```

Properties:

- Runs immediately to produce an initial value.
- Re-runs only when dependencies read inside the memo change.
- Caches the result between reads.
- Suppresses downstream updates when the new value equals the previous value according to the `equals` option.
- The memo function should be pure and should not write other reactive values.

Useful shape:

```tsx
const trend = createMemo(
	(previous) => {
		const current = count();
		return current > previous.value
			? { value: current, direction: "up" }
			: { value: current, direction: "same-or-down" };
	},
	{ value: 0, direction: "same" }
);
```

## Effects

Use `createEffect` to synchronize with systems outside Solid's reactive graph:

- DOM APIs that are not naturally expressed in JSX
- browser storage
- subscriptions
- timers
- logging/instrumentation
- imperative third-party libraries

```tsx
import { createEffect } from "solid-js";

createEffect(() => {
	console.log(count());
});
```

Rules:

- Effects run once after setup and then re-run when tracked dependencies change.
- Dependency execution order is not a contract; do not rely on effect ordering.
- Avoid setting signals inside effects for pure derived values. Use `createMemo` instead.
- Nested effects track independently; reads inside the inner effect do not become dependencies of the outer effect.

## Lifecycle and cleanup

Use `onMount` for work that should run once after the component is mounted and does not need dependency tracking.

```tsx
import { onMount } from "solid-js";

onMount(() => {
	// runs once for this component instance
});
```

Use `onCleanup` for every external resource created by a component or effect.

```tsx
import { onCleanup } from "solid-js";

const id = setInterval(tick, 1000);
onCleanup(() => clearInterval(id));
```

Clean up:

- timers
- event listeners
- observers
- sockets/subscriptions
- imperative library instances
- pending external handles owned by the component/effect

## Resources

Use `createResource` for async data tied to Solid reactivity.

```tsx
import { createResource } from "solid-js";

const [userId, setUserId] = createSignal<string>();
const [user, { mutate, refetch }] = createResource(userId, async (id) => {
	const response = await fetch(`/api/users/${encodeURIComponent(id)}`);
	if (!response.ok) throw new Error("Failed to fetch user");
	return response.json() as Promise<User>;
});
```

Important behavior:

- A source value of `undefined`, `null`, or `false` prevents the fetcher from running.
- `resource()` returns `T | undefined` unless `initialValue` is provided.
- `resource.state` can be `unresolved`, `pending`, `ready`, `refreshing`, or `errored`.
- `resource.loading` is true while fetching or refreshing.
- `resource.error` contains the thrown/rejected error in errored state.
- `resource.latest` keeps the latest successful value while refreshing.
- `mutate` locally overwrites the resource value for optimistic UI.
- `refetch` re-runs the fetcher without changing the source.

Pair resources that can fail with `<ErrorBoundary>` and async UI with `<Suspense>` when the UI should show a fallback while data resolves.

## Escape hatches

Use `untrack` only when a read must not subscribe the current tracking scope. It is appropriate for previous values, logging context, or one-shot reads that must not trigger re-execution.

Use `createRoot` only when manually creating reactive ownership outside a component. If you create a root, own and dispose it deliberately.
