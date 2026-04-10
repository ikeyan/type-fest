import type {IsAny} from './is-any.d.ts';
import type {IsEqual} from './is-equal.d.ts';
import type {IsUnknown} from './is-unknown.d.ts';
import type {UnknownArray} from './unknown-array.d.ts';

/**
Create a union of all overload signatures of the given function type.

TypeScript's built-in utility types like `Parameters` and `ReturnType` only work with the last overload signature, [by design](https://github.com/microsoft/TypeScript/issues/32164). This type extracts all overload signatures as a union, allowing you to work with each overload individually.

Use-cases:
- Extract parameter types from specific overloads using `Extract` and `Parameters`
- Analyze all possible function signatures in type-level code
- Extract event handler signatures from framework APIs

Known limitations:
- Generic type parameters are lost and inferred as `unknown`.
- TypeScript deduplicates overloads that share the same parameters and return type. When one has implicit `this` (no annotation) and another has explicit `this`, they are treated as duplicates — whichever appears first in the intersection suppresses the other. See the internal documentation comment in this file for details.

@example
```
import type {FunctionOverloads} from 'type-fest';

declare function request(url: string): Promise<string>;
declare function request(url: string, options: {json: true}): Promise<unknown>;

type RequestOverloads = FunctionOverloads<typeof request>;
//=> ((url: string) => Promise<string>) | ((url: string, options: {
// 	json: true;
// }) => Promise<unknown>)

// You can also get all parameters and return types using built-in `Parameters` and `ReturnType` utilities:

type RequestParameters = Parameters<RequestOverloads>;
//=> [url: string] | [url: string, options: {json: true}]

type RequestReturnType = ReturnType<RequestOverloads>;
//=> Promise<string> | Promise<unknown>
```

@see https://github.com/microsoft/TypeScript/issues/14107
@see https://github.com/microsoft/TypeScript/issues/32164

@category Function
*/
export type FunctionOverloads<FunctionType extends (...args: any) => any> = OverloadsToTuple<FunctionType>[number];

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
//
// ## Detecting implicit `this` vs explicit `this: unknown`
//
// Both implicit `this` and explicit `this: unknown` give `ThisParameterType`
// = `unknown`. To distinguish them, we intersect a sentinel signature
// `(this: Nothing, ...args) => ...` from the **right**:
//
// - If the original has implicit `this`: TypeScript's deduplication treats
//   them as the same (implicit → compare by (P,R) only). The original wins
//   (first-wins rule), so the Nothing signature is absorbed. The result's
//   ThisParameterType remains `unknown` (not Nothing).
//
// - If the original has explicit `this: unknown`: Both are explicit, so
//   TypeScript compares (This, P, R). `unknown ≠ Nothing`, so they are NOT
//   duplicates — both survive. The rightmost is the Nothing signature, so
//   ThisParameterType returns `Nothing`.
//
// This is what `HasExplicitThis` implements below.
//
// ## What CollectOverloads returns
//
// `CollectOverloads` extracts TypeScript's **enumerated** overload list (as
// described above), not necessarily all **declared** overloads. In particular,
// when an implicit-`this` overload and an explicit-`this` overload share the
// same params/return, whichever appears first in the intersection suppresses
// the other. This is a fundamental property of TypeScript's overload
// deduplication and cannot be worked around.
//
// @see https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
// ========================================================================

declare const nothing: unique symbol;
type Nothing = typeof nothing;

/**
 * Obtain the parameters of a function type in a tuple
 * This works even when the parameters type is a readonly array
 */
type Parameters<T extends (...args: any) => any> = T extends (...args: infer P extends UnknownArray) => any ? P : never;

/**
Detect whether a function type has an explicit `this` annotation.

Both implicit `this` and explicit `this: unknown` give `ThisParameterType` = `unknown`.
To tell them apart, we intersect a `(this: Nothing, ...)` signature from the right.
If the original `this` was implicit, the Nothing signature is absorbed by deduplication
and ThisParameterType remains `unknown`. If it was explicit `this: unknown`, the Nothing
signature survives as a separate overload, and ThisParameterType returns `Nothing`.
*/
type HasExplicitThis<T extends (...args: any) => any> =
	IsUnknown<ThisParameterType<T>> extends true
		? IsEqual<ThisParameterType<T & ((this: Nothing, ...args: Parameters<T>) => ReturnType<T>)>, Nothing> extends true
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
Iterates over overload signatures right to left, collecting each into a tuple.

Uses the intersection trick: intersecting the just-extracted signature onto the left
of the function type makes TypeScript's pattern matching skip it on the next iteration,
effectively advancing through all enumerated overloads.

The termination condition (`CheckedOverloads === PreviousCheckedOverloads`) lags by one
iteration, so the last extracted overload is always a duplicate. We compensate by dropping
the first element of the result tuple at termination.
*/
type CollectOverloads<
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
		>
;

/**
Extract all overload signatures of the given function type as a tuple, preserving declaration order.

This is the tuple counterpart to {@link FunctionOverloads}, which returns a union. Use this when overload order matters.

@example
```
import type {OverloadsToTuple} from 'type-fest';

declare function request(url: string): Promise<string>;
declare function request(url: string, options: {json: true}): Promise<unknown>;

type RequestOverloads = OverloadsToTuple<typeof request>;
//=> [(url: string) => Promise<string>, (url: string, options: {
// 	json: true;
// }) => Promise<unknown>]
```

@see https://github.com/microsoft/TypeScript/issues/14107
@see https://github.com/microsoft/TypeScript/issues/32164

@category Function
*/
export type OverloadsToTuple<FunctionType extends (...args: any) => any> = FunctionType extends unknown
	? IsAny<FunctionType> extends true
		? [(...arguments_: any[]) => any]
		: CollectOverloads<FunctionType>
	: never;

export {};
