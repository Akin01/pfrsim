---
name: solidjs-expert
description: Use when building, debugging, reviewing, or refactoring SolidJS, Solid Router, SolidStart, or Solid Meta applications, including fine-grained reactivity, JSX components, stores, resources, routing, server functions, SSR, hydration, and Solid component testing.
---

# SolidJS Expert

## When to use

Use this skill for SolidJS application work: component implementation, reactive state design, performance debugging, routing, SolidStart full-stack code, data loading, mutations, SSR/hydration issues, TypeScript typing, tests, and reviews of Solid code.

Do not treat Solid as React with different imports. Solid components execute once to set up a fine-grained reactive graph; signals, stores, resources, memos, effects, and JSX expressions update independently afterward.

## Bundled references

This skill is portable. Do not depend on the Solid docs repository being present in the target project. The following reference files live beside `SKILL.md` and are installed with the skill by `npx skills add`:

- `references/core-reactivity.md` — execution model, signals, memos, effects, lifecycle, cleanup, resources, and reactivity escape hatches.
- `references/components-state-typescript.md` — components, props, JSX, control flow, lists, stores, context, refs, directives, and TypeScript.
- `references/router-solidstart.md` — Solid Router setup, params, navigation primitives, queries, `createAsync`, actions, submissions, SolidStart server functions, streaming, and SSR/browser boundaries.
- `references/testing.md` — Vitest, Solid Testing Library, Testing Library queries, context/router testing, portals, resources, async UI, interactions, and cleanup-sensitive tests.

Before non-trivial Solid work, read the relevant bundled reference file. If working inside a project that also has local Solid documentation, use local docs to confirm project-specific conventions, but keep this skill self-contained.

## Solid mental model

1. Components are setup functions, not recurring render functions. Avoid React patterns that rely on rerendering component bodies.
2. A signal is read by calling its accessor, e.g. `count()`. Reading a signal inside JSX, `createMemo`, `createEffect`, a resource source, or another tracking scope creates a dependency.
3. Setter callbacks receive the previous value: prefer `setCount((c) => c + 1)` over `setCount(count() + 1)` when deriving from current state.
4. JSX expressions are reactive when they read reactive values. Do not wrap routine JSX derivations in effects.
5. Derived values belong in `createMemo`; side effects belong in `createEffect`, `onMount`, or explicit event handlers.
6. Effects are for synchronization outside the reactive graph: DOM APIs, subscriptions, logging, imperative libraries, storage, and network effects. Avoid writing signals from effects unless there is a specific synchronization boundary; use `createMemo` for derived state.
7. Use `onCleanup` for timers, subscriptions, observers, event listeners, and external resources created in a component or effect.
8. Use `untrack` only to intentionally avoid dependency tracking; document the reason in code when it is not obvious.

## State and data design

- Use `createSignal` for scalar or independently replaced values.
- Use `createMemo` for pure computed values, expensive derivations, and values consumed from multiple places.
- Use `createStore` from `solid-js/store` for nested objects and arrays that benefit from property-level reactivity. Update through the store setter and path syntax rather than mutating the proxy directly.
- Stores create property tracking lazily when values are read in a tracking scope. If code must react to a store path, read that exact path inside the tracking scope.
- Use store path syntax, `produce`, or `reconcile` for nested updates depending on whether the update is targeted, mutative-looking, or replacement/reconciliation oriented.
- Keep read and write capabilities separate when passing state down: pass accessors/store values to readers and setter functions/actions only to writers.

## JSX and control flow

- Use Solid control-flow components instead of array mapping or boolean tricks when the result is reactive UI:
  - `<Show when={value()} fallback={...}>` for one conditional branch.
  - `<Switch>` and `<Match>` for ordered mutually exclusive branches.
  - `<For each={items()}>` when list order or length can change; item is the value and index is an accessor.
  - `<Index each={items()}>` when order and length are stable but item contents change; item is an accessor and index is a number.
- Prefer semantic DOM and direct event handlers. Use `e.currentTarget` for typed input handlers.
- Use `class` in JSX. Use `classList` for conditional classes where appropriate.
- For refs, assign the element variable synchronously through Solid's `ref` behavior and clean up any imperative use.
- Use `<ErrorBoundary>` for recoverable UI failures and resource errors that the UI can handle locally.
- Use `<Suspense>` around async reads/resources when the UI should wait for async children and show a fallback.

## Data fetching

- In client-side Solid, use `createResource` for async data tied to reactive sources. A source value of `undefined`, `null`, or `false` prevents the fetcher from running.
- Handle resource states deliberately: `state`, `loading`, `error`, `latest`, and `data()` may differ during pending, refreshing, ready, and errored states.
- Use `mutate` for local optimistic resource updates and `refetch` to re-run the fetcher without changing the source.
- Put resources that can throw under an `ErrorBoundary`, and put async UI under `Suspense` when appropriate.
- Avoid ad hoc async work in effects for ordinary data loading when `createResource`, router queries, or SolidStart server functions fit.

## Router and navigation

- Use `@solidjs/router` for application routing. Set up `<Router>` at the root and use the `root` layout for stable app shell/provider UI.
- Use `<Route path="..." component={...} />` for route declarations and lazy components for route-level splitting when useful.
- Use `<A href="...">` for router-aware navigation and active/inactive classes. Use native anchors for external navigation or full document behavior.
- Use `useParams`, `useLocation`, `useNavigate`, and `useSearchParams` inside router context.
- Dynamic route params use `:id`; catch-all routes use `*` or `*paramName`.
- If route params change but Solid reuses the same route component, key the dependent subtree with `<Show keyed when={params.id}>` or another keyed boundary when a fresh instance is required.
- For router data APIs, prefer `query`, `createAsync`, `action`, `useAction`, `useSubmission(s)`, and `revalidate` over hand-rolled global loading/mutation plumbing.

## SolidStart and server work

- SolidStart server functions run exclusively on the server when marked with `"use server"`; use them for database, session, filesystem, private API, and secret-bearing work.
- Pair server functions with router `query`/`createAsync` for server-backed reads.
- Use actions for mutations and revalidate affected queries after successful mutations.
- Be careful with streaming: once streaming starts, headers, cookies, redirects, and status cannot be changed. For queries/server work that may modify headers or redirect, use `deferStream: true` at the async read boundary.
- Keep browser-only code behind client-only boundaries or guards. Do not access `window`, `document`, `localStorage`, or browser APIs during server execution.
- Use SolidStart file routing, API routes, metadata/head utilities, and route prerendering according to the existing app's conventions.

## TypeScript and API shape

- Type props explicitly and prefer `ParentProps`, `Component`, or narrow prop types only when they clarify intent. Do not force React types into Solid.
- Preserve accessors as accessors in APIs when callers need reactivity. Passing `value()` passes a snapshot; passing `value` passes a reactive getter.
- Do not destructure props directly when doing so would break reactivity. Use `splitProps`, `mergeProps`, or access `props.name` inside tracking scopes.
- Keep reactive primitives close to their owning lifetime. Use `createRoot` only when manually creating a reactive owner outside component setup.
- Avoid unnecessary object/array recreation in tracked expressions when it causes downstream churn; memoize real derived work.

## Testing

- Use Vitest with `@solidjs/testing-library`, `@testing-library/user-event`, `jsdom`, and `@testing-library/jest-dom` for component tests.
- Render components with `render(() => <Component />)`. For context, supply the testing-library `wrapper`; for router-dependent components, use the `location` option or wrap in router context according to project convention.
- Test behavior from the user's perspective: roles, labels, text, form values, and navigation outcomes. Use `data-testid` only as a last resort.
- Use `findBy...` for async appearance from resources/router lazy loading. Use `queryBy...`/`queryAllBy...` for absence assertions.
- For portals, query through `screen` because portal content leaves the render container.
- Cover conditional branches, loading/error/ready resource states, cleanup-sensitive behavior, and mutation/revalidation behavior.

## Review checklist

Before finishing Solid work, verify:

1. Reactive reads happen in tracking scopes where updates are expected.
2. No effect is being used for pure derived state.
3. Async data paths handle loading, error, refresh, and stale/latest data intentionally.
4. Props and accessors have not been destructured or snapshotted in a way that breaks reactivity.
5. Lists use `<For>` or `<Index>` according to data stability.
6. Cleanup exists for every created external resource.
7. SSR paths do not access browser-only APIs and header-modifying server code runs before streaming.
8. Tests exercise user-visible behavior and changed edge cases.