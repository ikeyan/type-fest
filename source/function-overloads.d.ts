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
		: DistinguishUnknownThisOverloads<FunctionType>[number]
	: never;

declare const nothing: unique symbol;
type Nothing = typeof nothing;
type AnyOverload = [This: unknown, Parameters: UnknownArray, Return: unknown];

/**
Iterates over all overload signatures from bottom to top, collecting each as a `[This, Parameters, Return]` tuple in declaration order.

The termination condition (`CheckedOverloads === PreviousCheckedOverloads`) lags by one iteration, so the last extracted overload is always a duplicate. We drop it by removing the first element of the result tuple at termination.

It also builds up a "secondary" function type where implicit-`this` overloads have their `this` replaced with `Nothing`, enabling later disambiguation between implicit `this` and explicit `this: unknown`.

@see https://github.com/microsoft/TypeScript/issues/32164#issuecomment-1146737709
*/
type CollectOverloads<
	AllOverloads,
	CheckedOverloads = unknown,
	PreviousCheckedOverloads = never,
	ResultOverloads extends AnyOverload[] = [],
	ResultFunctionType = AllOverloads,
> =
	IsEqual<CheckedOverloads, PreviousCheckedOverloads> extends true
		? [ResultOverloads extends [AnyOverload, ...infer Rest extends AnyOverload[]] ? Rest : [], ResultFunctionType]
		: AllOverloads extends (this: infer This, ...arguments_: infer Parameters_ extends UnknownArray) => infer Return
			? CollectOverloads<
				// Intersecting one signature with the full type makes the compiler infer a different "last overload"
				// each iteration, effectively iterating all overloads from bottom to top.
				((this: This, ...arguments_: Parameters_) => Return) & AllOverloads,
				((this: This, ...arguments_: Parameters_) => Return) & CheckedOverloads,
				CheckedOverloads,
				[[This, Parameters_, Return], ...ResultOverloads],
				IsUnknown<This> extends true
					? ((this: Nothing, ...arguments_: Parameters_) => Return) & ResultFunctionType
					: ResultFunctionType
			>
			: never;

/**
Maps a tuple of `[This, Parameters, Return]` overloads into a tuple of function types, omitting the `this` parameter for overloads that did not explicitly declare one.

For each overload whose `this` is `unknown`, the second-pass tuple is consulted to determine whether the `this: unknown` was explicit (present in the second pass) or implicit (absent). Implicit-`this` overloads have their `this` parameter stripped.
*/
type OverloadsToFunctions<
	Overloads extends AnyOverload[],
	SecondPassOverloads extends AnyOverload[],
> = {
	[K in keyof Overloads]: Overloads[K] extends infer Overload extends AnyOverload
		? IsUnknown<Overload[0]> extends true
			? true extends {
				[J in keyof SecondPassOverloads]: IsEqual<Overload, SecondPassOverloads[J]>
			}[number]
				? (this: Overload[0], ...arguments_: Overload[1]) => Overload[2]
				: (...arguments_: Overload[1]) => Overload[2]
			: (this: Overload[0], ...arguments_: Overload[1]) => Overload[2]
		: never
};

/**
Orchestrates the two-pass approach: collects overloads, then maps them to proper function types as a tuple.
*/
type DistinguishUnknownThisOverloads<
	FunctionType,
	Overloads extends AnyOverload[] = CollectOverloads<FunctionType>[0],
	SecondPassOverloads extends AnyOverload[] = CollectOverloads<CollectOverloads<FunctionType>[1]>[0],
> = OverloadsToFunctions<Overloads, SecondPassOverloads>;

export {};
