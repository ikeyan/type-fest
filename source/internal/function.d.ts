import type {IsAny} from '../is-any.d.ts';
import type {IsEqual} from '../is-equal.d.ts';
import type {IsUnknown} from '../is-unknown.d.ts';
import type {UnknownArray} from '../unknown-array.d.ts';

/**
Obtain the parameters of a function type in a tuple.

This works even when the parameters type is a readonly array.
*/
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P extends UnknownArray) => any ? P : never;

// ========================================================================
// Internal documentation: TypeScript's overload enumeration behavior
// ========================================================================
//
// Understanding how TypeScript enumerates overloads from an intersection
// type is essential for understanding (and correctly using) CollectOverloads.
//
// ## Overload enumeration
//
// Given an intersection of function types (e.g. `F1 & F2 & F3`), TypeScript
// builds an overload list by scanning left to right and **deduplicating**:
//
// - Two overloads with the same (This, Parameters, Return) are considered
//   duplicates. The first one wins; later ones are dropped.
// - HOWEVER, if one or both of the overloads has **implicit `this`** (i.e. no
//   `this` annotation), the comparison ignores `This` and only checks
//   (Parameters, Return). This means an implicit-`this` overload and an
//   explicit-`this` overload with the same params/return are considered
//   duplicates — whichever appears first wins.
//
// Example (F1 = implicit this, F1wT<T> = explicit this: T, same params/return):
//
//   F1 & F1wT<1> & F1wT<2>
//   → Enumerated as: [F1]
//     F1wT<1> has same (P,R) as F1 (implicit) → duplicate, dropped.
//     F1wT<2> likewise dropped.
//
//   F1wT<1> & F1 & F1wT<2>
//   → Enumerated as: [F1wT<1>, F1wT<2>]
//     F1 has same (P,R) as F1wT<1>, and F1 is implicit → duplicate, dropped.
//     F1wT<2> vs F1wT<1>: both explicit, This differs → NOT duplicate, kept.
//
// ## Pattern matching: `X extends (this: T, ...args: P) => R`
//
// TypeScript enumerates the overloads of X as above, replaces implicit `this`
// with `this: unknown`, then matches the **rightmost** overload satisfying
// the constraint on the right-hand side.
// ========================================================================

declare const unique: unique symbol;
type Unique = typeof unique;

/**
Detect whether the last overload of a function type has an explicit `this` annotation.

Intersects `(this: Unique, ...)` from the right. Per TypeScript's deduplication rules
(see "Overload enumeration" above), implicit `this` absorbs the sentinel (same (P,R) →
duplicate, first-wins), so `ThisParameterType` stays `unknown`. Explicit `this: unknown`
does not absorb it (both explicit, different `This` → not duplicate), so
`ThisParameterType` returns `Unique`.
*/
type HasExplicitThis<T extends (...args: any) => any> =
	IsUnknown<ThisParameterType<T>> extends true
		? IsEqual<ThisParameterType<T & ((this: Unique, ...args: Parameters<T>) => ReturnType<T>)>, Unique> extends true
			? true
			: false
		: true;

/**
Extract the last overload of a function type as a standalone function,
correctly preserving implicit `this` (omitted) vs explicit `this` (kept).
*/
type LastOverload<T extends (...args: any) => any> =
	HasExplicitThis<T> extends true
		? (this: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T>
		: (...args: Parameters<T>) => ReturnType<T>;

/**
Extracts TypeScript's enumerated overload list into a tuple (see "Overload enumeration" above).

Uses the intersection trick: intersecting `LastOverload<AllOverloads>` onto the left
makes TypeScript's pattern matching skip it on the next iteration, effectively advancing
through all overloads right to left. `LastOverload` preserves implicit-vs-explicit `this`
via `HasExplicitThis`.

The termination condition (`CheckedOverloads === PreviousCheckedOverloads`) lags by one
iteration, so the last extracted overload is always a duplicate. We compensate by dropping
the first element of the result tuple at termination.

@see https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
*/
export type CollectOverloads<
	AllOverloads extends (...args: any) => any,
	CheckedOverloads = unknown,
	PreviousCheckedOverloads = never,
	ResultOverloads extends Array<(...args: any) => any> = [],
> =
	IsEqual<CheckedOverloads, PreviousCheckedOverloads> extends true
		? ResultOverloads extends [(...args: any) => any, ...infer Rest extends Array<(...args: any) => any>] ? Rest : []
		: CollectOverloads<
			// Intersecting one signature with the full type makes the compiler infer a different "last overload"
			// each iteration, effectively iterating all overloads from bottom to top.
			LastOverload<AllOverloads> & AllOverloads,
			LastOverload<AllOverloads> & CheckedOverloads,
			CheckedOverloads,
			[LastOverload<AllOverloads>, ...ResultOverloads]
		>;

export {};
