# SolidJS Testing Reference

This reference is bundled with the `solidjs-expert` skill so the skill remains useful after installation in any project.

## Recommended packages

Use Vitest and Testing Library for Solid component tests:

```sh
pnpm add -D vitest jsdom @solidjs/testing-library @testing-library/user-event @testing-library/jest-dom
```

Common setup:

- `vitest` for test runner/assertions.
- `jsdom` for a DOM environment in Node.
- `@solidjs/testing-library` for rendering Solid components and automatic cleanup.
- `@testing-library/user-event` for realistic user interactions.
- `@testing-library/jest-dom` for DOM matchers.

For SolidStart projects, a Vitest config commonly uses `vite-plugin-solid` and browser/development resolution conditions:

```ts
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [solid()],
	resolve: {
		conditions: ["development", "browser"]
	}
});
```

## Component test shape

Render Solid components with a function:

```tsx
import { test, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { Counter } from "./Counter";

test("increments value", async () => {
	const user = userEvent.setup();
	const { getByRole } = render(() => <Counter />);

	const button = getByRole("button", { name: /count: 1/i });
	await user.click(button);

	expect(button).toHaveTextContent("Count: 2");
});
```

Test behavior from the user's perspective. Prefer accessible queries over implementation details.

Query preference:

1. `getByRole`
2. `getByLabelText`
3. `getByPlaceholderText`
4. `getByText`
5. `getByDisplayValue`
6. `getByAltText`
7. `getByTitle`
8. `getByTestId` only as a last resort

## Query timing

Use `getBy...` for elements that should exist immediately.

Use `findBy...` for async appearance from resources, lazy routes, Suspense, or delayed UI.

Use `queryBy...` or `queryAllBy...` for absence assertions.

```tsx
expect(screen.queryByRole("alert")).not.toBeInTheDocument();
expect(await screen.findByText("Loaded")).toBeInTheDocument();
```

## Context and wrappers

Use the `wrapper` render option for context providers.

```tsx
const wrapper = (props: ParentProps) => (
	<AuthProvider value={testAuth}>{props.children}</AuthProvider>
);

render(() => <AccountMenu />, { wrapper });
```

If a component depends on router context, use the testing-library router/location support or wrap with router context according to project convention.

## Portals

Portal content leaves the render container. Query through `screen`.

```tsx
import { render, screen } from "@solidjs/testing-library";

render(() => <Toast>Saved</Toast>);
expect(screen.getByRole("log")).toHaveTextContent("Saved");
```

## Resources, Suspense, and ErrorBoundary

Cover resource states that can break user-visible behavior:

- initial/unresolved
- pending/loading
- ready
- refreshing/stale latest value
- errored

Use `findBy...` for async ready states and assert the fallback/error UI for failure paths.

```tsx
render(() => (
	<ErrorBoundary fallback={<p role="alert">Could not load</p>}>
		<Suspense fallback={<p>Loading...</p>}>
			<UserProfile id="1" />
		</Suspense>
	</ErrorBoundary>
));

expect(screen.getByText("Loading...")).toBeInTheDocument();
expect(await screen.findByText("Ada")).toBeInTheDocument();
```

## Interaction testing

Use `userEvent` instead of manually dispatching events when the interaction is user-facing.

```tsx
const user = userEvent.setup();
await user.type(screen.getByLabelText("Name"), "Ada");
await user.click(screen.getByRole("button", { name: "Save" }));
```

Assert outcomes, not implementation plumbing:

- text/content changes
- form values
- disabled/enabled states
- navigation state
- loading/error/success states
- accessible names/roles
- calls to real integration seams where appropriate

Do not test defaults that are incidental to the current implementation. Test logical behavior and edge cases.

## Cleanup-sensitive behavior

When code creates timers, subscriptions, observers, sockets, event listeners, or imperative library instances, tests should cover cleanup if the failure mode matters.

```tsx
const { unmount } = render(() => <Ticker />);
unmount();
// assert external subscription/timer cleanup through the observable behavior available to the test
```

## What to cover before finishing a Solid change

- Reactive updates after signal/store changes.
- Conditional branches with `<Show>`, `<Switch>`, and `<Match>`.
- `<For>`/`<Index>` list updates when list behavior changed.
- Resource loading/error/ready behavior when async data changed.
- Router param/search-param behavior when route logic changed.
- Server action/query success and failure behavior when SolidStart data code changed.
- Cleanup behavior when external resources are created.
- Accessibility of newly added interactive UI.
