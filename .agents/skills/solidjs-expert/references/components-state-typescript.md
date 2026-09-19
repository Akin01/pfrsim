# SolidJS Components, State, and TypeScript Reference

This reference is bundled with the `solidjs-expert` skill so the skill remains useful after installation in any project.

## Components

Solid components are setup functions. They return JSX once; fine-grained updates happen inside the returned JSX and registered computations.

```tsx
function Counter() {
	const [count, setCount] = createSignal(0);
	return <button onClick={() => setCount((c) => c + 1)}>{count()}</button>;
}
```

Avoid React assumptions:

- Do not expect the component body to re-run for state changes.
- Do not use React hooks or React component types.
- Do not destructure props in a way that snapshots reactive values.

## Props

Props are read-only and potentially reactive. Access them through `props` inside tracking scopes.

```tsx
function Greeting(props: { name: string }) {
	return <p>Hello {props.name}</p>;
}
```

Avoid this when the value can change:

```tsx
const { name } = props; // breaks reactivity
const name = props.name; // snapshot
```

Use an accessor or Solid utilities instead:

```tsx
const name = () => props.name;
```

```tsx
import { mergeProps, splitProps } from "solid-js";

const merged = mergeProps({ tone: "neutral" }, props);
const [local, rest] = splitProps(props, ["tone", "disabled"]);
```

- `mergeProps` keeps reactivity while adding defaults.
- `splitProps` separates prop groups while preserving reactivity.
- Use `children(() => props.children)` if children are accessed multiple times or need controlled evaluation.

## JSX and DOM

- Use `class`, not `className`, in Solid JSX.
- Use `classList` for conditional classes.
- Use `e.currentTarget` in event handlers for correctly typed element access.
- Keep JSX expressions direct when they are simple reactive derivations.
- Prefer semantic HTML and accessible labels/roles.

```tsx
<input
	value={query()}
	onInput={(event) => setQuery(event.currentTarget.value)}
/>

<button classList={{ active: selected() }}>Save</button>
```

## Conditional rendering

Use Solid control-flow components for reactive UI branches.

```tsx
import { Show, Switch, Match } from "solid-js";

<Show when={user()} fallback={<p>Loading...</p>}>
	{(resolvedUser) => <p>{resolvedUser().name}</p>}
</Show>

<Switch fallback={<p>Unknown state</p>}>
	<Match when={resource.error}>Error</Match>
	<Match when={resource.loading}>Loading</Match>
	<Match when={resource()}>Ready</Match>
</Switch>
```

Use keyed boundaries when a fresh subtree instance is required after an identity changes:

```tsx
<Show keyed when={params.id}>
	{(id) => <UserDetails id={id} />}
</Show>
```

## List rendering

Use `<For>` when list order or length can change.

```tsx
import { For } from "solid-js";

<For each={items()}>
	{(item, index) => <li>{index()}: {item.name}</li>}
</For>
```

- `item` is the current value.
- `index` is an accessor.
- Solid moves DOM nodes when items move.

Use `<Index>` when order and length are stable but item contents change frequently.

```tsx
import { Index } from "solid-js";

<Index each={rows()}>
	{(row, index) => <input value={row().name} data-index={index} />}
</Index>
```

- `item` is an accessor.
- `index` is a number.
- Solid updates content at stable indexes.

## Stores

Use `createStore` for nested object/array state that benefits from property-level reactivity.

```tsx
import { createStore } from "solid-js/store";

const [state, setState] = createStore({
	users: [{ id: "1", name: "Ada", online: false }]
});

setState("users", (user) => user.id === "1", "online", true);
```

Rules:

- Do not mutate the store proxy directly.
- Use the setter and path syntax for targeted updates.
- Store property signals are created lazily when paths are read inside tracking scopes.
- Read the exact path that should trigger reactivity.
- Use `produce` for complex mutative-looking updates.
- Use `reconcile` when replacing data from the server while preserving identity where possible.

## Context

Use context for application-level shared state that would otherwise be drilled through many component layers.

```tsx
import { createContext, useContext, type ParentProps } from "solid-js";

function createCounterValue(initial = 0) {
	const [count, setCount] = createSignal(initial);
	return [count, { increment: () => setCount((c) => c + 1) }] as const;
}

type CounterContextValue = ReturnType<typeof createCounterValue>;
const CounterContext = createContext<CounterContextValue>();

export function CounterProvider(props: ParentProps<{ initial?: number }>) {
	return (
		<CounterContext.Provider value={createCounterValue(props.initial)}>
			{props.children}
		</CounterContext.Provider>
	);
}

export function useCounter() {
	const value = useContext(CounterContext);
	if (!value) throw new Error("useCounter must be used inside CounterProvider");
	return value;
}
```

Prefer a throwing accessor for required context instead of silently relying on an accidental default.

## Refs and directives

Use refs for direct DOM access and imperative libraries.

```tsx
let input!: HTMLInputElement;

onMount(() => input.focus());

return <input ref={input} />;
```

- Ref assignment happens at creation time before the element is attached to the DOM.
- In TypeScript, use a definite assignment assertion or model possible `undefined` and guard before use.
- Use callback refs when setup must happen as the element is created.
- When forwarding refs, child components receive the parent ref as a callback prop.

Directives use the `use:` JSX namespace and receive `(element, accessor)`.

```tsx
function autofocus(element: HTMLInputElement) {
	onMount(() => element.focus());
}

<input use:autofocus />
```

## TypeScript essentials

Recommended `tsconfig.json` settings for Solid JSX:

```json
{
	"compilerOptions": {
		"jsx": "preserve",
		"jsxImportSource": "solid-js"
	}
}
```

Common types:

```ts
import type {
	Accessor,
	Setter,
	Signal,
	Component,
	ParentComponent,
	ParentProps,
	JSX
} from "solid-js";
```

Guidance:

- `createSignal<T>()` without an initial value produces `Accessor<T | undefined>`.
- Provide initial values when `undefined` is not meaningful.
- `Component<P>` is useful for ordinary components but cannot type generic components. Type generic components as functions.
- Use `ParentProps<P>` or `ParentComponent<P>` for components that accept children.
- Use `JSX.EventHandler<TElement, TEvent>` for reusable event handlers.
- Inline event handlers infer types well; prefer `event.currentTarget` over `event.target`.

Generic component example:

```tsx
function SelectItem<T>(props: { item: T; label: (item: T) => string }): JSX.Element {
	return <span>{props.label(props.item)}</span>;
}
```
