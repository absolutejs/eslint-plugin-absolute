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
