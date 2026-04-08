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
- Generic type parameters are lost and inferred as `unknown`
- When overloads share identical parameters but differ only in the `this` parameter, the implicit `this` (no `this` annotation) overload may be merged with an explicit `this: unknown` overload. See tests for detailed behavior.

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
export type FunctionOverloads<FunctionType> = FunctionType extends unknown
	? IsAny<FunctionType> extends true
		? (...arguments_: readonly unknown[]) => unknown
		: DistinguishUnknownThisOverloads<FunctionType>
	: never;

declare const nothing: unique symbol;
type Nothing = typeof nothing;
type AnyOverload = [This: unknown, Parameters: UnknownArray, Return: unknown];

type MatchesAnyOverload<Overload, TargetOverloads> =
	true extends (
		TargetOverloads extends unknown ? IsEqual<Overload, TargetOverloads> : never
	)
		? true
		: false;

/**
Iterates over all overload signatures from bottom to top, collecting each as a `[This, Parameters, Return]` tuple union.

It also builds up a "secondary" function type where implicit-`this` overloads have their `this` replaced with `Nothing`, enabling later disambiguation between implicit `this` and explicit `this: unknown`.

@see https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
*/
type CollectOverloads<
	AllOverloads,
	CheckedOverloads = unknown,
	PreviousCheckedOverloads = never,
	ResultOverloads extends AnyOverload = never,
	ResultFunctionType = AllOverloads,
> =
	IsEqual<CheckedOverloads, PreviousCheckedOverloads> extends true
		? [ResultOverloads, ResultFunctionType]
		: AllOverloads extends (this: infer This, ...arguments_: infer Parameters_ extends UnknownArray) => infer Return
			? CollectOverloads<
				// Intersecting one signature with the full type makes the compiler infer a different "last overload"
				// each iteration, effectively iterating all overloads from bottom to top.
				((this: This, ...arguments_: Parameters_) => Return) & AllOverloads,
				((this: This, ...arguments_: Parameters_) => Return) & CheckedOverloads,
				CheckedOverloads,
				ResultOverloads | [This, Parameters_, Return],
				IsUnknown<This> extends true
					? ((this: Nothing, ...arguments_: Parameters_) => Return) & ResultFunctionType
					: ResultFunctionType
			>
			: never;

/**
Finds overloads that explicitly declare `this: unknown` (as opposed to having no `this` annotation, which TypeScript also infers as `unknown`).

The second pass (running `CollectOverloads` on the secondary function type where implicit-`this` was replaced with `Nothing`) lets us distinguish the two cases.
*/
type ExtractExplicitUnknownThisOverloads<SecondPassOverloads, Overloads> = Overloads extends AnyOverload
	? IsUnknown<Overloads[0]> extends true
		? MatchesAnyOverload<Overloads, SecondPassOverloads> extends true
			? Overloads
			: never
		: never
	: never;

type IsImplicitThisOverload<Overload extends AnyOverload, ExplicitUnknownThisOverloads> = [
	IsUnknown<Overload[0]>,
	MatchesAnyOverload<Overload, ExplicitUnknownThisOverloads>,
] extends [true, false]
	? true
	: false;

/**
Reconstructs each overload as a proper function type, omitting the `this` parameter for overloads that did not explicitly declare one.
*/
type DistinguishUnknownThisOverloads<
	FunctionType,
	Overloads = CollectOverloads<FunctionType>[0],
	SecondPassOverloads = CollectOverloads<CollectOverloads<FunctionType>[1]>[0],
	ExplicitUnknownThisOverloads = ExtractExplicitUnknownThisOverloads<SecondPassOverloads, Overloads>,
> = Overloads extends [infer This, infer Parameters_ extends UnknownArray, infer Return]
	? IsImplicitThisOverload<Overloads, ExplicitUnknownThisOverloads> extends true
		? (...arguments_: Parameters_) => Return
		: (this: This, ...arguments_: Parameters_) => Return
	: never;

export {};
