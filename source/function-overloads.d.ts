import type {CollectOverloads} from './internal/index.d.ts';
import type {IsAny} from './is-any.d.ts';

/**
Create a union of all overload signatures of the given function type.

TypeScript's built-in utility types like `Parameters` and `ReturnType` only work with the last overload signature, [by design](https://github.com/microsoft/TypeScript/issues/32164). This type extracts all overload signatures as a union, allowing you to work with each overload individually.

Use-cases:
- Extract parameter types from specific overloads using `Extract` and `Parameters`
- Analyze all possible function signatures in type-level code
- Extract event handler signatures from framework APIs

Known limitations:
- Generic type parameters are lost and inferred as `unknown`.
- TypeScript deduplicates overloads that share the same parameters and return type. When one has implicit `this` (no annotation) and another has explicit `this`, they are treated as duplicates — whichever appears first in the intersection suppresses the other. See `source/internal/function.d.ts` for details on TypeScript's overload enumeration behavior.

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

/**
Extract all overload signatures of the given function type as a tuple, preserving declaration order.

This is the tuple counterpart to {@link FunctionOverloads}, which returns a union. Use this when overload order matters.

Known limitations are the same as {@link FunctionOverloads}.

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
