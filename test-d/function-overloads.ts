import {expectType} from 'tsd';
import type {FunctionOverloads, IsEqual, UnknownArray} from '../index.d.ts';

// Neither `expectType` nor `IsEqual` can distinguish implicit `this` from explicit `this: unknown`:
//   expectType<() => void>(x as (this: unknown) => void); // no error
//   IsEqual<() => void, (this: unknown) => void> // => true
// `IsEqualStrict` resolves this by also comparing the extracted `this` parameter via a sentinel type.
declare const isEqualStrictNothing: unique symbol;
type IsEqualStrictNothing = typeof isEqualStrictNothing;
type FuncToTuple<Function_ extends (...arguments_: never) => unknown> =
	Function_ extends (...arguments_: infer Parameters_ extends UnknownArray) => infer Return
		? ((this: IsEqualStrictNothing, ...arguments_: Parameters_) => Return) & Function_ extends (this: infer This, ...arguments_: never) => unknown
			? [This, Parameters_, Return]
			: never
		: never;
type IsEqualStrict<
	Function1_ extends (...arguments_: never) => unknown,
	Function2_ extends (...arguments_: never) => unknown,
> = IsEqual<[Function1_, FuncToTuple<Function1_>], [Function2_, FuncToTuple<Function2_>]>;

type Function1 = (foo: string, bar: number) => object;
type Function2 = (foo: bigint, ...bar: any[]) => void;

// Single function (no overload)
declare const normalFunction: FunctionOverloads<Function1>;
expectType<Function1>(normalFunction);

// Two overloads via intersection
declare const twoOverloads: FunctionOverloads<Function1 & Function2>;
expectType<Function1 | Function2>(twoOverloads);

// Two overloads via interface syntax
declare const twoOverloadsInterface: FunctionOverloads<{
	(foo: string, bar: number): object;
	(foo: bigint, ...bar: any[]): void;
}>;
expectType<Function1 | Function2>(twoOverloadsInterface);

// Identical overloads collapse
declare const twoIdenticalOverloads: FunctionOverloads<{
	(foo: string, bar: number): object;
	(foo: string, bar: number): object;
}>;
expectType<Function1>(twoIdenticalOverloads);

type Function3 = (foo: string, bar: number, baz?: boolean) => object;

// Two overloads with assignable but distinct signatures
declare const twoOverloadsWithAssignableSignature: FunctionOverloads<Function1 & Function3>;
expectType<Function1 | Function3>(twoOverloadsWithAssignableSignature);

// Three overloads
declare const threeOverloads: FunctionOverloads<Function1 & Function2 & Function3>;
expectType<Function1 | Function2 | Function3>(threeOverloads);

type Function4 = (...foo: any[]) => void;
type Function5 = (...foo: readonly any[]) => void;

// Rest parameter overloads
declare const normalFunctionWithOnlyRestWritableParameter: FunctionOverloads<Function4>;
expectType<Function4>(normalFunctionWithOnlyRestWritableParameter);

declare const normalFunctionWithOnlyRestReadonlyParameter: FunctionOverloads<Function5>;
expectType<Function5>(normalFunctionWithOnlyRestReadonlyParameter);

// The compiler ignores subsequent identical-up-to-readonly overloads
declare const twoOverloadsWithDifferentRestParameterReadonliness: FunctionOverloads<Function4 & Function5>;
expectType<Function4>(twoOverloadsWithDifferentRestParameterReadonliness);

declare const twoOverloadsWithDifferentRestParameterReadonlinessReversed: FunctionOverloads<Function5 & Function4>;
expectType<Function5>(twoOverloadsWithDifferentRestParameterReadonlinessReversed);

type Function6 = (foo: string, ...bar: any[]) => void;
type Function7 = (foo: string, ...bar: readonly any[]) => void;

declare const normalFunctionWithNormalAndRestWritableParameter: FunctionOverloads<Function6>;
expectType<Function6>(normalFunctionWithNormalAndRestWritableParameter);

// Readonly rest parameter cannot be represented with tuples
declare const normalFunctionWithNormalAndRestReadonlyParameter: FunctionOverloads<Function7>;
expectType<(foo: string, ...bar: any[]) => void>(normalFunctionWithNormalAndRestReadonlyParameter);

type Function8 = () => never;

declare const normalFunctionNoParameters: FunctionOverloads<Function8>;
expectType<Function8>(normalFunctionNoParameters);

declare const twoOverloadsWithNoAndPresentParameters: FunctionOverloads<Function8 & Function6>;
expectType<Function8 | Function6>(twoOverloadsWithNoAndPresentParameters);

type Function9 = (event: 'event9', argument: string) => void;
type Function10 = (event: 'event10', argument: number) => string;
type Function11 = (event: 'event11', argument: boolean) => never;
type Function12 = (event: 'event12', argument: bigint) => object;

// Many overloads
declare const manyOverloads: FunctionOverloads<
	Function1
	& Function2
	& Function3
	& Function4
	& Function5
	& Function6
	& Function7
	& Function8
	& Function9
	& Function10
	& Function11
	& Function12
>;
expectType<
	| Function1
	| Function2
	| Function3
	| Function4
	| Function5
	| Function6
	| Function7
	| Function8
	| Function9
	| Function10
	| Function11
	| Function12
>(manyOverloads);

// Non-callable type returns never
declare const noOverloads: FunctionOverloads<{}>;
expectType<never>(noOverloads);

// Edge case: `any` returns a generic function signature
declare const anyOverload: FunctionOverloads<any>;
expectType<(...arguments_: readonly unknown[]) => unknown>(anyOverload);

// Edge case: `never` returns never
declare const neverOverload: FunctionOverloads<never>;
expectType<never>(neverOverload);

// Edge case: `unknown` returns never
declare const unknownOverload: FunctionOverloads<unknown>;
expectType<never>(unknownOverload);

// `declare function` overloads
declare function declaredOverload(input: string): {kind: 'string'};
declare function declaredOverload(input: number, flag: boolean): {kind: 'number'};

declare const declaredOverloadResult: FunctionOverloads<typeof declaredOverload>;
expectType<((input: string) => {kind: 'string'}) | ((input: number, flag: boolean) => {kind: 'number'})>(declaredOverloadResult);

// Overloads with explicit `this` parameters
type ThisOverload1 = (this: Date, foo: string) => void;
type ThisOverload2 = (this: URL, foo: number) => void;

declare const thisOverloads: FunctionOverloads<ThisOverload1 & ThisOverload2>;
// Verify `this` is preserved
expectType<ThisOverload1 | ThisOverload2>(thisOverloads);

// Same parameters, different return types
type SameParametersDifferentReturn1 = (foo: string) => string;
type SameParametersDifferentReturn2 = (foo: string) => number;

declare const sameParametersDifferentReturn: FunctionOverloads<SameParametersDifferentReturn1 & SameParametersDifferentReturn2>;
expectType<SameParametersDifferentReturn1 | SameParametersDifferentReturn2>(sameParametersDifferentReturn);

// Generic overloads — generic parameters become `unknown`
declare function genericOverload<T>(input: T): T;
declare function genericOverload(input: string): string;

declare const genericOverloadResult: FunctionOverloads<typeof genericOverload>;
expectType<((input: unknown) => unknown) | ((input: string) => string)>(genericOverloadResult);

// Interface-style overload
type InterfaceOverload = {
	(input: string): 1;
	(input: number): 2;
};

declare const interfaceOverload: FunctionOverloads<InterfaceOverload>;
expectType<((input: string) => 1) | ((input: number) => 2)>(interfaceOverload);

// Same parameters, different `this` types
type SameParametersDifferentThis1 = (this: Date, foo: string) => number;
type SameParametersDifferentThis2 = (this: URL, foo: string) => number;

declare const sameParametersDifferentThis: FunctionOverloads<SameParametersDifferentThis1 & SameParametersDifferentThis2>;
expectType<SameParametersDifferentThis1 | SameParametersDifferentThis2>(sameParametersDifferentThis);

// Duplicate overloads in interface are collapsed
declare const duplicateOverloads: FunctionOverloads<{
	(foo: string, bar: number): object;
	(): string;
	(): string;
}>;
expectType<Function1 | (() => string)>(duplicateOverloads);

// Generic overload at intersection level stops iteration — only the last inferred overload
declare const genericIntersectionOverload: FunctionOverloads<((this: string) => string) & (<T>(this: T, argument: T) => T)>;
expectType<(this: unknown, argument: unknown) => unknown>(genericIntersectionOverload);

// Verify that explicit `this: unknown` is preserved while implicit `this` is omitted.
// `IsEqualStrict` is needed here because neither `expectType` nor `IsEqual` can distinguish the two.

type Function1WithThis<This> = (this: This, foo: string, bar: number) => object;
type Function2WithThis<This> = (this: This, foo: bigint, ...bar: any[]) => void;

// Single overload with explicit `this: unknown`
expectType<IsEqualStrict<
	FunctionOverloads<Function1WithThis<unknown>>,
	Function1WithThis<unknown>
>>(true);

// Single overload with implicit `this`
expectType<IsEqualStrict<
	FunctionOverloads<Function1>,
	Function1
>>(true);

// Mixed explicit `this: unknown` and implicit `this` overloads
expectType<IsEqualStrict<
	FunctionOverloads<Function1WithThis<unknown> & Function2>,
	Function1WithThis<unknown> | Function2
>>(true);

// Multiple explicit and implicit `this` overloads
expectType<IsEqualStrict<
	FunctionOverloads<{
		(this: unknown, foo: string, bar: number): object;
		(this: unknown, foo: bigint, ...bar: any[]): void;
		(foo: string, bar: number, baz?: boolean): object;
		(...foo: any[]): void;
	}>,
	| Function1WithThis<unknown>
	| Function2WithThis<unknown>
	| Function3
	| Function4
>>(true);

// When implicit `this` and explicit `this: unknown` overloads share same params/return, implicit may be lost
expectType<IsEqualStrict<FunctionOverloads<Function1 & Function1WithThis<1>>, Function1 | Function1WithThis<1>>>(true);
// When the explicit `this` overload comes first, the implicit `this` overload may be absorbed
expectType<IsEqualStrict<FunctionOverloads<Function1WithThis<1> & Function1>, Function1WithThis<1>>>(true);
// With `this: unknown` specifically, implicit `this` is always absorbed
expectType<IsEqualStrict<FunctionOverloads<Function1 & Function1WithThis<unknown>>, Function1WithThis<unknown>>>(true);
expectType<IsEqualStrict<FunctionOverloads<Function1WithThis<unknown> & Function1>, Function1WithThis<unknown>>>(true);
