# Solid Router and SolidStart Reference

This reference is bundled with the `solidjs-expert` skill so the skill remains useful after installation in any project.

## Router setup

Install and use `@solidjs/router` for Solid application routing.

```tsx
import { render } from "solid-js/web";
import { Router, Route, A } from "@solidjs/router";

function Root(props: { children?: JSX.Element }) {
	return (
		<>
			<nav>
				<A href="/">Home</A>
				<A href="/users">Users</A>
			</nav>
			{props.children}
		</>
	);
}

render(
	() => (
		<Router root={Root}>
			<Route path="/" component={Home} />
			<Route path="/users" component={Users} />
			<Route path="*notFound" component={NotFound} />
		</Router>
	),
	document.getElementById("root")!
);
```

Guidance:

- Put stable shell UI and providers in the `root` layout.
- Use `<A>` for router-aware internal navigation and active/inactive classes.
- Use native `<a>` for external links and full document navigations.
- Lazy-load route components when route-level splitting improves load behavior.

```tsx
import { lazy } from "solid-js";

const Users = lazy(() => import("./pages/Users"));
```

## Route params and navigation primitives

Dynamic segments use `:param`. Catch-all routes use `*` or `*paramName`.

```tsx
<Route path="/users/:id" component={User} />
<Route path="*missing" component={NotFound} />
```

Use router primitives inside router context:

```tsx
import {
	useParams,
	useLocation,
	useNavigate,
	useSearchParams
} from "@solidjs/router";

function User() {
	const params = useParams();
	return <p>User {params.id}</p>;
}
```

If route params change but the same route component instance is reused, key the dependent subtree when a fresh instance is required:

```tsx
<Show keyed when={params.id}>
	{(id) => <UserDetails id={id} />}
</Show>
```

## Queries

Use `query` to wrap data-fetching logic with router cache metadata.

```tsx
import { query, createAsync } from "@solidjs/router";

const getUser = query(async (id: string) => {
	const response = await fetch(`/api/users/${encodeURIComponent(id)}`);
	const json = await response.json();
	if (!response.ok) throw new Error(json?.message ?? "Failed to load user");
	return json as User;
}, "user");

function UserProfile(props: { id: string }) {
	const user = createAsync(() => getUser(props.id));
	return <p>{user()?.name}</p>;
}
```

Important query behavior:

- `query(fn, name)` returns a function with the same call signature plus cache metadata.
- Cache keys are built from the query name and serialized arguments.
- Calls with the same name and arguments share a cache entry.
- Queries support request deduplication, preloading reuse, active subscription reuse, native history reuse, server request-scoped reuse, and hydration reuse.
- Query fetcher errors are handled by the nearest `<ErrorBoundary>`.
- Arguments should serialize consistently.
- `query.get`, `query.set`, `query.delete`, and `query.clear` can read or mutate the active cache by key.

Use stable, unique query names.

```ts
const key = getUser.keyFor("123");
query.set(key, { id: "123", name: "Ada" });
```

## `createAsync`

`createAsync` wraps promise-backed data and returns an accessor with a `latest` property.

```tsx
const invoice = createAsync(() => getInvoice(props.invoiceId), {
	deferStream: true
});
```

Behavior:

- Internally uses `createResource`.
- Synchronous reactive reads inside the async function are tracked.
- The accessor returns `initialValue` when provided, otherwise `undefined` until resolved.
- `.latest` returns the latest resource value.
- `deferStream: true` makes server streaming wait for the resource before flushing.

Use `createAsyncStore` instead of `createAsync` when a complex array/object result should behave like a store.

## Actions and submissions

Use `action` for mutations and form submissions.

```tsx
import { action } from "@solidjs/router";

const addTodo = action(async (data: URLSearchParams) => {
	return data.get("title")?.toString();
}, "addTodo");

function TodoForm() {
	return (
		<form action={addTodo} method="post">
			<input name="title" />
			<button>Add todo</button>
		</form>
	);
}
```

Behavior:

- Native forms pass `FormData` for `multipart/form-data` and `URLSearchParams` otherwise.
- Calling an action adds a submission to router submissions state.
- Submissions expose `input`, `url`, `result`, `error`, `pending`, `clear`, and `retry`.
- `action.with(...args)` creates an action with leading arguments prefilled.
- `useAction`, `useSubmission`, and `useSubmissions` connect UI to action execution and state.
- Returned `Response` objects with `Location` headers trigger navigation.
- `X-Revalidate` response headers supply keys for revalidation.

Prefilled action example:

```tsx
const updateTodo = action(async (id: string, data: URLSearchParams) => {
	// update todo id with form data
}, "updateTodo");

<form action={updateTodo.with(props.id)} method="post" />
```

## SolidStart server functions

Use server functions for work that must execute exclusively on the server: database access, sessions, filesystem, secrets, private API calls, and privileged mutations.

```tsx
import { query, redirect } from "@solidjs/router";
import { useSession } from "vinxi/http";

const getCurrentUser = query(async () => {
	"use server";
	const session = await useSession({
		password: process.env.SESSION_SECRET as string,
		name: "session"
	});

	if (!session.data.userId) throw redirect("/login");
	return db.users.get({ id: session.data.userId });
}, "currentUser");
```

SolidStart mutation example:

```tsx
const updateProduct = action(async (id: string, data: FormData) => {
	"use server";
	const name = data.get("name")?.toString();
	await db.products.update(id, { name });
}, "updateProduct");
```

Guidance:

- Pair server reads with router `query` and `createAsync`.
- Pair server mutations with router `action` and revalidate affected reads.
- Keep secret-bearing logic behind `"use server"`.
- Do not access browser-only globals during server execution.
- Use route preloading for data needed immediately by a route.

## Streaming and headers

Once streaming begins, response headers, status, cookies, and redirects cannot be changed. Any server function or query that may set cookies, modify headers, or redirect must run before streaming starts.

Use `deferStream: true` at the async read boundary when needed:

```tsx
const user = createAsync(() => getCurrentUser(), { deferStream: true });
```

## Single-flight mutations

SolidStart can update data and stream revalidated results back in a single request when:

1. The action runs on the server using a server function.
2. The data updated by the action was preloaded, or for redirects, preloaded on the destination page.

Use this for server mutations where the UI should stay synchronized without a separate client refetch round trip.

## Browser-only code and SSR

Guard browser-only APIs or put them behind client-only boundaries.

Avoid this during server execution:

- `window`
- `document`
- `localStorage` / `sessionStorage`
- DOM constructors
- browser-only third-party libraries

Prefer `onMount` or SolidStart client-only utilities for client-exclusive work.
