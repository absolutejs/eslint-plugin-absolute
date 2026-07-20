# AbsoluteJS eslint plugin

ESLint rule collection for AbsoluteJS applications and packages.

## Elysia composition boundaries

`absolute/elysia-composition-boundaries` prevents a route application from
being extended through a second variable such as
`const adminApp = publicApp.get(...)`. Each route surface must start from its
own named `new Elysia(...)`, install shared dependencies explicitly, and be
mounted at a shallow root. This keeps TypeScript from repeatedly instantiating
the accumulated server graph and preserves real sub-app types for Eden.

The rule also auto-fixes adjacent plugin chains:

```ts
new Elysia().use(auth).use(metrics);
```

becomes:

```ts
new Elysia().use([auth, metrics]);
```

Chains containing comments are reported without an automatic rewrite so the
ordering rationale cannot be lost.

`absolute/no-inline-prop-types` remains the narrow compatibility rule for
destructured component props. It is intentionally distinct from the broader
`absolute/no-inline-object-types` policy so upgrades do not silently expand a
repository's lint surface.

`absolute/elysia-route-boundaries` makes the corresponding file architecture
enforceable without filename or symbol-name conventions. It detects Elysia
route registration chains, exported route factories, their actual inferred
type references, and terminal composed graphs from AST structure and symbol
resolution. Configured composition entrypoints may assemble route surfaces but
may not register routes themselves; configured route directories require
isolated exported contracts. Route factories elsewhere remain valid. The rule
reports cross-file extractions without autofixing them because captured services
and route closures must become explicit factory dependencies.

## Typed request boundaries

`absolute/eden-requires-react-query` requires browser Eden Treaty requests to
execute inside a TanStack React Query `queryFn` or `mutationFn`. The rule follows
aliased React Query imports, same-file helper functions, and request closures
passed through `mutate` or `mutateAsync`, without depending on application client,
component, or endpoint names.

`absolute/elysia-no-response-return` prevents Elysia application handlers from
returning `Response.json(...)` or `new Response(...)`, including through
same-file helpers. Routes retain their inferred Eden contract by returning plain
typed data, `status(...)`, or `redirect(...)`. Exact streaming, file, and HTML
route paths can allow `new Response(...)`; `Response.json(...)` remains forbidden
because JSON application data never needs the Fetch escape hatch.
