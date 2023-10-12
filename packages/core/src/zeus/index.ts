/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';
export const HOST = "https://local.graphql.nhost.run/v1"


export const HEADERS = {}
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: Record<string, unknown> }) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: ExtractVariables<Z> }) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: Z | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(initialOp as string, response, [ops[initialOp]]);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const);
    const objectFromEntries = entries.reduce<Record<string, unknown>>((a, [k, v]) => {
      a[k] = v;
      return a;
    }, {});
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment ? pOriginals : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <X, T extends keyof ResolverInputTypes, Z extends keyof ResolverInputTypes[T]>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : never,
) => fn as (args?: any, source?: any) => ReturnType<typeof fn>;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : IsArray<R, '__typename' extends keyof DST ? { __typename: true } : never, SCLR>
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariables<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = never
export type ScalarCoders = {
	bigint?: ScalarResolver;
	bytea?: ScalarResolver;
	citext?: ScalarResolver;
	jsonb?: ScalarResolver;
	timestamptz?: ScalarResolver;
	uuid?: ScalarResolver;
}
type ZEUS_UNIONS = never

export type ValueTypes = {
    /** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
	_eq?: boolean | undefined | null | Variable<any, string>,
	_gt?: boolean | undefined | null | Variable<any, string>,
	_gte?: boolean | undefined | null | Variable<any, string>,
	_in?: Array<boolean> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: boolean | undefined | null | Variable<any, string>,
	_lte?: boolean | undefined | null | Variable<any, string>,
	_neq?: boolean | undefined | null | Variable<any, string>,
	_nin?: Array<boolean> | undefined | null | Variable<any, string>
};
	/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
	_eq?: number | undefined | null | Variable<any, string>,
	_gt?: number | undefined | null | Variable<any, string>,
	_gte?: number | undefined | null | Variable<any, string>,
	_in?: Array<number> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: number | undefined | null | Variable<any, string>,
	_lte?: number | undefined | null | Variable<any, string>,
	_neq?: number | undefined | null | Variable<any, string>,
	_nin?: Array<number> | undefined | null | Variable<any, string>
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
	_eq?: string | undefined | null | Variable<any, string>,
	_gt?: string | undefined | null | Variable<any, string>,
	_gte?: string | undefined | null | Variable<any, string>,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined | null | Variable<any, string>,
	_in?: Array<string> | undefined | null | Variable<any, string>,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	/** does the column match the given pattern */
	_like?: string | undefined | null | Variable<any, string>,
	_lt?: string | undefined | null | Variable<any, string>,
	_lte?: string | undefined | null | Variable<any, string>,
	_neq?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined | null | Variable<any, string>,
	_nin?: Array<string> | undefined | null | Variable<any, string>,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined | null | Variable<any, string>,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined | null | Variable<any, string>,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined | null | Variable<any, string>,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined | null | Variable<any, string>
};
	/** Oauth requests, inserted before redirecting to the provider's site. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviderRequests"]: AliasType<{
	id?:boolean | `@${string}`,
options?: [{	/** JSON select path */
	path?: string | undefined | null | Variable<any, string>},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.provider_requests" */
["authProviderRequests_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authProviderRequests_aggregate_fields"],
	nodes?:ValueTypes["authProviderRequests"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.provider_requests" */
["authProviderRequests_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["authProviderRequests_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authProviderRequests_max_fields"],
	min?:ValueTypes["authProviderRequests_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** append existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_append_input"]: {
	options?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "auth.provider_requests". All fields are combined with a logical 'AND'. */
["authProviderRequests_bool_exp"]: {
	_and?: Array<ValueTypes["authProviderRequests_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authProviderRequests_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authProviderRequests_bool_exp"]> | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	options?: ValueTypes["jsonb_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.provider_requests" */
["authProviderRequests_constraint"]:authProviderRequests_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authProviderRequests_delete_at_path_input"]: {
	options?: Array<string> | undefined | null | Variable<any, string>
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authProviderRequests_delete_elem_input"]: {
	options?: number | undefined | null | Variable<any, string>
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authProviderRequests_delete_key_input"]: {
	options?: string | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "auth.provider_requests" */
["authProviderRequests_insert_input"]: {
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	options?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authProviderRequests_max_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authProviderRequests_min_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.provider_requests" */
["authProviderRequests_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authProviderRequests"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.provider_requests" */
["authProviderRequests_on_conflict"]: {
	constraint: ValueTypes["authProviderRequests_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authProviderRequests_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authProviderRequests_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.provider_requests". */
["authProviderRequests_order_by"]: {
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	options?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.provider_requests */
["authProviderRequests_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_prepend_input"]: {
	options?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** select columns of table "auth.provider_requests" */
["authProviderRequests_select_column"]:authProviderRequests_select_column;
	/** input type for updating data in table "auth.provider_requests" */
["authProviderRequests_set_input"]: {
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	options?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authProviderRequests" */
["authProviderRequests_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authProviderRequests_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authProviderRequests_stream_cursor_value_input"]: {
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	options?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.provider_requests" */
["authProviderRequests_update_column"]:authProviderRequests_update_column;
	["authProviderRequests_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["authProviderRequests_append_input"] | undefined | null | Variable<any, string>,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["authProviderRequests_delete_at_path_input"] | undefined | null | Variable<any, string>,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["authProviderRequests_delete_elem_input"] | undefined | null | Variable<any, string>,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["authProviderRequests_delete_key_input"] | undefined | null | Variable<any, string>,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["authProviderRequests_prepend_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authProviderRequests_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authProviderRequests_bool_exp"] | Variable<any, string>
};
	/** List of available Oauth providers. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviders"]: AliasType<{
	id?:boolean | `@${string}`,
userProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders"]],
userProviders_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.providers" */
["authProviders_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authProviders_aggregate_fields"],
	nodes?:ValueTypes["authProviders"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.providers" */
["authProviders_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["authProviders_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authProviders_max_fields"],
	min?:ValueTypes["authProviders_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "auth.providers". All fields are combined with a logical 'AND'. */
["authProviders_bool_exp"]: {
	_and?: Array<ValueTypes["authProviders_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authProviders_bool_exp"]> | undefined | null | Variable<any, string>,
	id?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	userProviders?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>,
	userProviders_aggregate?: ValueTypes["authUserProviders_aggregate_bool_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.providers" */
["authProviders_constraint"]:authProviders_constraint;
	/** input type for inserting data into table "auth.providers" */
["authProviders_insert_input"]: {
	id?: string | undefined | null | Variable<any, string>,
	userProviders?: ValueTypes["authUserProviders_arr_rel_insert_input"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authProviders_max_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authProviders_min_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.providers" */
["authProviders_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authProviders"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "auth.providers" */
["authProviders_obj_rel_insert_input"]: {
	data: ValueTypes["authProviders_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["authProviders_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "auth.providers" */
["authProviders_on_conflict"]: {
	constraint: ValueTypes["authProviders_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authProviders_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.providers". */
["authProviders_order_by"]: {
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userProviders_aggregate?: ValueTypes["authUserProviders_aggregate_order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.providers */
["authProviders_pk_columns_input"]: {
	id: string | Variable<any, string>
};
	/** select columns of table "auth.providers" */
["authProviders_select_column"]:authProviders_select_column;
	/** input type for updating data in table "auth.providers" */
["authProviders_set_input"]: {
	id?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authProviders" */
["authProviders_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authProviders_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authProviders_stream_cursor_value_input"]: {
	id?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.providers" */
["authProviders_update_column"]:authProviders_update_column;
	["authProviders_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authProviders_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authProviders_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "auth.refresh_token_types" */
["authRefreshTokenTypes"]: AliasType<{
	comment?:boolean | `@${string}`,
refreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens"]],
refreshTokens_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens_aggregate"]],
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authRefreshTokenTypes_aggregate_fields"],
	nodes?:ValueTypes["authRefreshTokenTypes"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["authRefreshTokenTypes_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authRefreshTokenTypes_max_fields"],
	min?:ValueTypes["authRefreshTokenTypes_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "auth.refresh_token_types". All fields are combined with a logical 'AND'. */
["authRefreshTokenTypes_bool_exp"]: {
	_and?: Array<ValueTypes["authRefreshTokenTypes_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authRefreshTokenTypes_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authRefreshTokenTypes_bool_exp"]> | undefined | null | Variable<any, string>,
	comment?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	refreshTokens?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>,
	refreshTokens_aggregate?: ValueTypes["authRefreshTokens_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	value?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.refresh_token_types" */
["authRefreshTokenTypes_constraint"]:authRefreshTokenTypes_constraint;
	["authRefreshTokenTypes_enum"]:authRefreshTokenTypes_enum;
	/** Boolean expression to compare columns of type "authRefreshTokenTypes_enum". All fields are combined with logical 'AND'. */
["authRefreshTokenTypes_enum_comparison_exp"]: {
	_eq?: ValueTypes["authRefreshTokenTypes_enum"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["authRefreshTokenTypes_enum"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["authRefreshTokenTypes_enum"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["authRefreshTokenTypes_enum"]> | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "auth.refresh_token_types" */
["authRefreshTokenTypes_insert_input"]: {
	comment?: string | undefined | null | Variable<any, string>,
	refreshTokens?: ValueTypes["authRefreshTokens_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	value?: string | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authRefreshTokenTypes_max_fields"]: AliasType<{
	comment?:boolean | `@${string}`,
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authRefreshTokenTypes_min_fields"]: AliasType<{
	comment?:boolean | `@${string}`,
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.refresh_token_types" */
["authRefreshTokenTypes_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authRefreshTokenTypes"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.refresh_token_types" */
["authRefreshTokenTypes_on_conflict"]: {
	constraint: ValueTypes["authRefreshTokenTypes_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authRefreshTokenTypes_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authRefreshTokenTypes_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.refresh_token_types". */
["authRefreshTokenTypes_order_by"]: {
	comment?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshTokens_aggregate?: ValueTypes["authRefreshTokens_aggregate_order_by"] | undefined | null | Variable<any, string>,
	value?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.refresh_token_types */
["authRefreshTokenTypes_pk_columns_input"]: {
	value: string | Variable<any, string>
};
	/** select columns of table "auth.refresh_token_types" */
["authRefreshTokenTypes_select_column"]:authRefreshTokenTypes_select_column;
	/** input type for updating data in table "auth.refresh_token_types" */
["authRefreshTokenTypes_set_input"]: {
	comment?: string | undefined | null | Variable<any, string>,
	value?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authRefreshTokenTypes" */
["authRefreshTokenTypes_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authRefreshTokenTypes_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokenTypes_stream_cursor_value_input"]: {
	comment?: string | undefined | null | Variable<any, string>,
	value?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.refresh_token_types" */
["authRefreshTokenTypes_update_column"]:authRefreshTokenTypes_update_column;
	["authRefreshTokenTypes_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRefreshTokenTypes_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authRefreshTokenTypes_bool_exp"] | Variable<any, string>
};
	/** User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRefreshTokens"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	expiresAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
metadata?: [{	/** JSON select path */
	path?: string | undefined | null | Variable<any, string>},boolean | `@${string}`],
	refreshTokenHash?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	/** An object relationship */
	user?:ValueTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.refresh_tokens" */
["authRefreshTokens_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authRefreshTokens_aggregate_fields"],
	nodes?:ValueTypes["authRefreshTokens"],
		__typename?: boolean | `@${string}`
}>;
	["authRefreshTokens_aggregate_bool_exp"]: {
	count?: ValueTypes["authRefreshTokens_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["authRefreshTokens_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "auth.refresh_tokens" */
["authRefreshTokens_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authRefreshTokens_max_fields"],
	min?:ValueTypes["authRefreshTokens_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.refresh_tokens" */
["authRefreshTokens_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["authRefreshTokens_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["authRefreshTokens_min_order_by"] | undefined | null | Variable<any, string>
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_append_input"]: {
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "auth.refresh_tokens" */
["authRefreshTokens_arr_rel_insert_input"]: {
	data: Array<ValueTypes["authRefreshTokens_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["authRefreshTokens_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "auth.refresh_tokens". All fields are combined with a logical 'AND'. */
["authRefreshTokens_bool_exp"]: {
	_and?: Array<ValueTypes["authRefreshTokens_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authRefreshTokens_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	expiresAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb_comparison_exp"] | undefined | null | Variable<any, string>,
	refreshTokenHash?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["authRefreshTokenTypes_enum_comparison_exp"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.refresh_tokens" */
["authRefreshTokens_constraint"]:authRefreshTokens_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authRefreshTokens_delete_at_path_input"]: {
	metadata?: Array<string> | undefined | null | Variable<any, string>
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authRefreshTokens_delete_elem_input"]: {
	metadata?: number | undefined | null | Variable<any, string>
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authRefreshTokens_delete_key_input"]: {
	metadata?: string | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "auth.refresh_tokens" */
["authRefreshTokens_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	expiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	refreshTokenHash?: string | undefined | null | Variable<any, string>,
	type?: ValueTypes["authRefreshTokenTypes_enum"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authRefreshTokens_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	expiresAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	refreshTokenHash?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_max_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	expiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshTokenHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["authRefreshTokens_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	expiresAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	refreshTokenHash?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_min_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	expiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshTokenHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "auth.refresh_tokens" */
["authRefreshTokens_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authRefreshTokens"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.refresh_tokens" */
["authRefreshTokens_on_conflict"]: {
	constraint: ValueTypes["authRefreshTokens_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authRefreshTokens_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.refresh_tokens". */
["authRefreshTokens_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	expiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshTokenHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	type?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.refresh_tokens */
["authRefreshTokens_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_prepend_input"]: {
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** select columns of table "auth.refresh_tokens" */
["authRefreshTokens_select_column"]:authRefreshTokens_select_column;
	/** input type for updating data in table "auth.refresh_tokens" */
["authRefreshTokens_set_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	expiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	refreshTokenHash?: string | undefined | null | Variable<any, string>,
	type?: ValueTypes["authRefreshTokenTypes_enum"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authRefreshTokens" */
["authRefreshTokens_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authRefreshTokens_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokens_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	expiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	refreshTokenHash?: string | undefined | null | Variable<any, string>,
	type?: ValueTypes["authRefreshTokenTypes_enum"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.refresh_tokens" */
["authRefreshTokens_update_column"]:authRefreshTokens_update_column;
	["authRefreshTokens_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["authRefreshTokens_append_input"] | undefined | null | Variable<any, string>,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["authRefreshTokens_delete_at_path_input"] | undefined | null | Variable<any, string>,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["authRefreshTokens_delete_elem_input"] | undefined | null | Variable<any, string>,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["authRefreshTokens_delete_key_input"] | undefined | null | Variable<any, string>,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["authRefreshTokens_prepend_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRefreshTokens_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authRefreshTokens_bool_exp"] | Variable<any, string>
};
	/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRoles"]: AliasType<{
	role?:boolean | `@${string}`,
userRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles"]],
userRoles_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles_aggregate"]],
usersByDefaultRole?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["users_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["users"]],
usersByDefaultRole_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["users_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["users_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.roles" */
["authRoles_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authRoles_aggregate_fields"],
	nodes?:ValueTypes["authRoles"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.roles" */
["authRoles_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["authRoles_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authRoles_max_fields"],
	min?:ValueTypes["authRoles_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "auth.roles". All fields are combined with a logical 'AND'. */
["authRoles_bool_exp"]: {
	_and?: Array<ValueTypes["authRoles_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authRoles_bool_exp"]> | undefined | null | Variable<any, string>,
	role?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	userRoles?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>,
	userRoles_aggregate?: ValueTypes["authUserRoles_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	usersByDefaultRole?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	usersByDefaultRole_aggregate?: ValueTypes["users_aggregate_bool_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.roles" */
["authRoles_constraint"]:authRoles_constraint;
	/** input type for inserting data into table "auth.roles" */
["authRoles_insert_input"]: {
	role?: string | undefined | null | Variable<any, string>,
	userRoles?: ValueTypes["authUserRoles_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	usersByDefaultRole?: ValueTypes["users_arr_rel_insert_input"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authRoles_max_fields"]: AliasType<{
	role?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authRoles_min_fields"]: AliasType<{
	role?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.roles" */
["authRoles_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authRoles"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "auth.roles" */
["authRoles_obj_rel_insert_input"]: {
	data: ValueTypes["authRoles_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["authRoles_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "auth.roles" */
["authRoles_on_conflict"]: {
	constraint: ValueTypes["authRoles_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authRoles_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.roles". */
["authRoles_order_by"]: {
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userRoles_aggregate?: ValueTypes["authUserRoles_aggregate_order_by"] | undefined | null | Variable<any, string>,
	usersByDefaultRole_aggregate?: ValueTypes["users_aggregate_order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.roles */
["authRoles_pk_columns_input"]: {
	role: string | Variable<any, string>
};
	/** select columns of table "auth.roles" */
["authRoles_select_column"]:authRoles_select_column;
	/** input type for updating data in table "auth.roles" */
["authRoles_set_input"]: {
	role?: string | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authRoles" */
["authRoles_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authRoles_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authRoles_stream_cursor_value_input"]: {
	role?: string | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.roles" */
["authRoles_update_column"]:authRoles_update_column;
	["authRoles_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRoles_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authRoles_bool_exp"] | Variable<any, string>
};
	/** Active providers for a given user. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserProviders"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	provider?:ValueTypes["authProviders"],
	providerId?:boolean | `@${string}`,
	providerUserId?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ValueTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.user_providers" */
["authUserProviders_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authUserProviders_aggregate_fields"],
	nodes?:ValueTypes["authUserProviders"],
		__typename?: boolean | `@${string}`
}>;
	["authUserProviders_aggregate_bool_exp"]: {
	count?: ValueTypes["authUserProviders_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["authUserProviders_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "auth.user_providers" */
["authUserProviders_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authUserProviders_max_fields"],
	min?:ValueTypes["authUserProviders_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.user_providers" */
["authUserProviders_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["authUserProviders_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["authUserProviders_min_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "auth.user_providers" */
["authUserProviders_arr_rel_insert_input"]: {
	data: Array<ValueTypes["authUserProviders_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["authUserProviders_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "auth.user_providers". All fields are combined with a logical 'AND'. */
["authUserProviders_bool_exp"]: {
	_and?: Array<ValueTypes["authUserProviders_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authUserProviders_bool_exp"]> | undefined | null | Variable<any, string>,
	accessToken?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	provider?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>,
	providerId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	providerUserId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	refreshToken?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.user_providers" */
["authUserProviders_constraint"]:authUserProviders_constraint;
	/** input type for inserting data into table "auth.user_providers" */
["authUserProviders_insert_input"]: {
	accessToken?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	provider?: ValueTypes["authProviders_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	providerId?: string | undefined | null | Variable<any, string>,
	providerUserId?: string | undefined | null | Variable<any, string>,
	refreshToken?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authUserProviders_max_fields"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	providerId?:boolean | `@${string}`,
	providerUserId?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.user_providers" */
["authUserProviders_max_order_by"]: {
	accessToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	providerId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	providerUserId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["authUserProviders_min_fields"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	providerId?:boolean | `@${string}`,
	providerUserId?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.user_providers" */
["authUserProviders_min_order_by"]: {
	accessToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	providerId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	providerUserId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "auth.user_providers" */
["authUserProviders_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authUserProviders"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.user_providers" */
["authUserProviders_on_conflict"]: {
	constraint: ValueTypes["authUserProviders_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authUserProviders_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.user_providers". */
["authUserProviders_order_by"]: {
	accessToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	provider?: ValueTypes["authProviders_order_by"] | undefined | null | Variable<any, string>,
	providerId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	providerUserId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.user_providers */
["authUserProviders_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "auth.user_providers" */
["authUserProviders_select_column"]:authUserProviders_select_column;
	/** input type for updating data in table "auth.user_providers" */
["authUserProviders_set_input"]: {
	accessToken?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	providerId?: string | undefined | null | Variable<any, string>,
	providerUserId?: string | undefined | null | Variable<any, string>,
	refreshToken?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authUserProviders" */
["authUserProviders_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authUserProviders_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authUserProviders_stream_cursor_value_input"]: {
	accessToken?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	providerId?: string | undefined | null | Variable<any, string>,
	providerUserId?: string | undefined | null | Variable<any, string>,
	refreshToken?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.user_providers" */
["authUserProviders_update_column"]:authUserProviders_update_column;
	["authUserProviders_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserProviders_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authUserProviders_bool_exp"] | Variable<any, string>
};
	/** Roles of users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserRoles"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	/** An object relationship */
	roleByRole?:ValueTypes["authRoles"],
	/** An object relationship */
	user?:ValueTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.user_roles" */
["authUserRoles_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authUserRoles_aggregate_fields"],
	nodes?:ValueTypes["authUserRoles"],
		__typename?: boolean | `@${string}`
}>;
	["authUserRoles_aggregate_bool_exp"]: {
	count?: ValueTypes["authUserRoles_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["authUserRoles_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "auth.user_roles" */
["authUserRoles_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authUserRoles_max_fields"],
	min?:ValueTypes["authUserRoles_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.user_roles" */
["authUserRoles_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["authUserRoles_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["authUserRoles_min_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "auth.user_roles" */
["authUserRoles_arr_rel_insert_input"]: {
	data: Array<ValueTypes["authUserRoles_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["authUserRoles_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "auth.user_roles". All fields are combined with a logical 'AND'. */
["authUserRoles_bool_exp"]: {
	_and?: Array<ValueTypes["authUserRoles_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authUserRoles_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	roleByRole?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.user_roles" */
["authUserRoles_constraint"]:authUserRoles_constraint;
	/** input type for inserting data into table "auth.user_roles" */
["authUserRoles_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	roleByRole?: ValueTypes["authRoles_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authUserRoles_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.user_roles" */
["authUserRoles_max_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["authUserRoles_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.user_roles" */
["authUserRoles_min_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "auth.user_roles" */
["authUserRoles_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authUserRoles"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.user_roles" */
["authUserRoles_on_conflict"]: {
	constraint: ValueTypes["authUserRoles_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authUserRoles_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.user_roles". */
["authUserRoles_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	roleByRole?: ValueTypes["authRoles_order_by"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.user_roles */
["authUserRoles_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "auth.user_roles" */
["authUserRoles_select_column"]:authUserRoles_select_column;
	/** input type for updating data in table "auth.user_roles" */
["authUserRoles_set_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authUserRoles" */
["authUserRoles_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authUserRoles_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authUserRoles_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.user_roles" */
["authUserRoles_update_column"]:authUserRoles_update_column;
	["authUserRoles_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserRoles_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authUserRoles_bool_exp"] | Variable<any, string>
};
	/** User webauthn security keys. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserSecurityKeys"]: AliasType<{
	counter?:boolean | `@${string}`,
	credentialId?:boolean | `@${string}`,
	credentialPublicKey?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	nickname?:boolean | `@${string}`,
	transports?:boolean | `@${string}`,
	/** An object relationship */
	user?:ValueTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate"]: AliasType<{
	aggregate?:ValueTypes["authUserSecurityKeys_aggregate_fields"],
	nodes?:ValueTypes["authUserSecurityKeys"],
		__typename?: boolean | `@${string}`
}>;
	["authUserSecurityKeys_aggregate_bool_exp"]: {
	count?: ValueTypes["authUserSecurityKeys_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["authUserSecurityKeys_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["authUserSecurityKeys_avg_fields"],
count?: [{	columns?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["authUserSecurityKeys_max_fields"],
	min?:ValueTypes["authUserSecurityKeys_min_fields"],
	stddev?:ValueTypes["authUserSecurityKeys_stddev_fields"],
	stddev_pop?:ValueTypes["authUserSecurityKeys_stddev_pop_fields"],
	stddev_samp?:ValueTypes["authUserSecurityKeys_stddev_samp_fields"],
	sum?:ValueTypes["authUserSecurityKeys_sum_fields"],
	var_pop?:ValueTypes["authUserSecurityKeys_var_pop_fields"],
	var_samp?:ValueTypes["authUserSecurityKeys_var_samp_fields"],
	variance?:ValueTypes["authUserSecurityKeys_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_order_by"]: {
	avg?: ValueTypes["authUserSecurityKeys_avg_order_by"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["authUserSecurityKeys_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["authUserSecurityKeys_min_order_by"] | undefined | null | Variable<any, string>,
	stddev?: ValueTypes["authUserSecurityKeys_stddev_order_by"] | undefined | null | Variable<any, string>,
	stddev_pop?: ValueTypes["authUserSecurityKeys_stddev_pop_order_by"] | undefined | null | Variable<any, string>,
	stddev_samp?: ValueTypes["authUserSecurityKeys_stddev_samp_order_by"] | undefined | null | Variable<any, string>,
	sum?: ValueTypes["authUserSecurityKeys_sum_order_by"] | undefined | null | Variable<any, string>,
	var_pop?: ValueTypes["authUserSecurityKeys_var_pop_order_by"] | undefined | null | Variable<any, string>,
	var_samp?: ValueTypes["authUserSecurityKeys_var_samp_order_by"] | undefined | null | Variable<any, string>,
	variance?: ValueTypes["authUserSecurityKeys_variance_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "auth.user_security_keys" */
["authUserSecurityKeys_arr_rel_insert_input"]: {
	data: Array<ValueTypes["authUserSecurityKeys_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["authUserSecurityKeys_on_conflict"] | undefined | null | Variable<any, string>
};
	/** aggregate avg on columns */
["authUserSecurityKeys_avg_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_avg_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "auth.user_security_keys". All fields are combined with a logical 'AND'. */
["authUserSecurityKeys_bool_exp"]: {
	_and?: Array<ValueTypes["authUserSecurityKeys_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["authUserSecurityKeys_bool_exp"]> | undefined | null | Variable<any, string>,
	counter?: ValueTypes["bigint_comparison_exp"] | undefined | null | Variable<any, string>,
	credentialId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	credentialPublicKey?: ValueTypes["bytea_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	nickname?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	transports?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.user_security_keys" */
["authUserSecurityKeys_constraint"]:authUserSecurityKeys_constraint;
	/** input type for incrementing numeric columns in table "auth.user_security_keys" */
["authUserSecurityKeys_inc_input"]: {
	counter?: ValueTypes["bigint"] | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "auth.user_security_keys" */
["authUserSecurityKeys_insert_input"]: {
	counter?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	credentialId?: string | undefined | null | Variable<any, string>,
	credentialPublicKey?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nickname?: string | undefined | null | Variable<any, string>,
	transports?: string | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["authUserSecurityKeys_max_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
	credentialId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	nickname?:boolean | `@${string}`,
	transports?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_max_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	credentialId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nickname?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transports?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["authUserSecurityKeys_min_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
	credentialId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	nickname?:boolean | `@${string}`,
	transports?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_min_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	credentialId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nickname?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transports?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "auth.user_security_keys" */
["authUserSecurityKeys_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["authUserSecurityKeys"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.user_security_keys" */
["authUserSecurityKeys_on_conflict"]: {
	constraint: ValueTypes["authUserSecurityKeys_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["authUserSecurityKeys_update_column"]> | Variable<any, string>,
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.user_security_keys". */
["authUserSecurityKeys_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	credentialId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	credentialPublicKey?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	nickname?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	transports?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.user_security_keys */
["authUserSecurityKeys_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "auth.user_security_keys" */
["authUserSecurityKeys_select_column"]:authUserSecurityKeys_select_column;
	/** input type for updating data in table "auth.user_security_keys" */
["authUserSecurityKeys_set_input"]: {
	counter?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	credentialId?: string | undefined | null | Variable<any, string>,
	credentialPublicKey?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nickname?: string | undefined | null | Variable<any, string>,
	transports?: string | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["authUserSecurityKeys_stddev_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_pop on columns */
["authUserSecurityKeys_stddev_pop_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_pop_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_samp on columns */
["authUserSecurityKeys_stddev_samp_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_samp_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "authUserSecurityKeys" */
["authUserSecurityKeys_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["authUserSecurityKeys_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["authUserSecurityKeys_stream_cursor_value_input"]: {
	counter?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	credentialId?: string | undefined | null | Variable<any, string>,
	credentialPublicKey?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	nickname?: string | undefined | null | Variable<any, string>,
	transports?: string | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["authUserSecurityKeys_sum_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_sum_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.user_security_keys" */
["authUserSecurityKeys_update_column"]:authUserSecurityKeys_update_column;
	["authUserSecurityKeys_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["authUserSecurityKeys_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserSecurityKeys_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["authUserSecurityKeys_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["authUserSecurityKeys_var_pop_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_pop_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate var_samp on columns */
["authUserSecurityKeys_var_samp_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_samp_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate variance on columns */
["authUserSecurityKeys_variance_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_variance_order_by"]: {
	counter?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	["bigint"]:unknown;
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
	_eq?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["bigint"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["bigint"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["bigint"]> | undefined | null | Variable<any, string>
};
	/** columns and relationships of "storage.buckets" */
["buckets"]: AliasType<{
	cacheControl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	downloadExpiration?:boolean | `@${string}`,
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["files"]],
files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["files_aggregate"]],
	id?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
	presignedUrlsEnabled?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "storage.buckets" */
["buckets_aggregate"]: AliasType<{
	aggregate?:ValueTypes["buckets_aggregate_fields"],
	nodes?:ValueTypes["buckets"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "storage.buckets" */
["buckets_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["buckets_avg_fields"],
count?: [{	columns?: Array<ValueTypes["buckets_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["buckets_max_fields"],
	min?:ValueTypes["buckets_min_fields"],
	stddev?:ValueTypes["buckets_stddev_fields"],
	stddev_pop?:ValueTypes["buckets_stddev_pop_fields"],
	stddev_samp?:ValueTypes["buckets_stddev_samp_fields"],
	sum?:ValueTypes["buckets_sum_fields"],
	var_pop?:ValueTypes["buckets_var_pop_fields"],
	var_samp?:ValueTypes["buckets_var_samp_fields"],
	variance?:ValueTypes["buckets_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["buckets_avg_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "storage.buckets". All fields are combined with a logical 'AND'. */
["buckets_bool_exp"]: {
	_and?: Array<ValueTypes["buckets_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["buckets_bool_exp"]> | undefined | null | Variable<any, string>,
	cacheControl?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	downloadExpiration?: ValueTypes["Int_comparison_exp"] | undefined | null | Variable<any, string>,
	files?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>,
	files_aggregate?: ValueTypes["files_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	maxUploadFileSize?: ValueTypes["Int_comparison_exp"] | undefined | null | Variable<any, string>,
	minUploadFileSize?: ValueTypes["Int_comparison_exp"] | undefined | null | Variable<any, string>,
	presignedUrlsEnabled?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "storage.buckets" */
["buckets_constraint"]:buckets_constraint;
	/** input type for incrementing numeric columns in table "storage.buckets" */
["buckets_inc_input"]: {
	downloadExpiration?: number | undefined | null | Variable<any, string>,
	maxUploadFileSize?: number | undefined | null | Variable<any, string>,
	minUploadFileSize?: number | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "storage.buckets" */
["buckets_insert_input"]: {
	cacheControl?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	downloadExpiration?: number | undefined | null | Variable<any, string>,
	files?: ValueTypes["files_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	maxUploadFileSize?: number | undefined | null | Variable<any, string>,
	minUploadFileSize?: number | undefined | null | Variable<any, string>,
	presignedUrlsEnabled?: boolean | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["buckets_max_fields"]: AliasType<{
	cacheControl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	downloadExpiration?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["buckets_min_fields"]: AliasType<{
	cacheControl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	downloadExpiration?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "storage.buckets" */
["buckets_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["buckets"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "storage.buckets" */
["buckets_obj_rel_insert_input"]: {
	data: ValueTypes["buckets_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["buckets_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "storage.buckets" */
["buckets_on_conflict"]: {
	constraint: ValueTypes["buckets_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["buckets_update_column"]> | Variable<any, string>,
	where?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "storage.buckets". */
["buckets_order_by"]: {
	cacheControl?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	downloadExpiration?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	files_aggregate?: ValueTypes["files_aggregate_order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	maxUploadFileSize?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	minUploadFileSize?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	presignedUrlsEnabled?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: storage.buckets */
["buckets_pk_columns_input"]: {
	id: string | Variable<any, string>
};
	/** select columns of table "storage.buckets" */
["buckets_select_column"]:buckets_select_column;
	/** input type for updating data in table "storage.buckets" */
["buckets_set_input"]: {
	cacheControl?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	downloadExpiration?: number | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	maxUploadFileSize?: number | undefined | null | Variable<any, string>,
	minUploadFileSize?: number | undefined | null | Variable<any, string>,
	presignedUrlsEnabled?: boolean | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["buckets_stddev_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["buckets_stddev_pop_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["buckets_stddev_samp_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "buckets" */
["buckets_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["buckets_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["buckets_stream_cursor_value_input"]: {
	cacheControl?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	downloadExpiration?: number | undefined | null | Variable<any, string>,
	id?: string | undefined | null | Variable<any, string>,
	maxUploadFileSize?: number | undefined | null | Variable<any, string>,
	minUploadFileSize?: number | undefined | null | Variable<any, string>,
	presignedUrlsEnabled?: boolean | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["buckets_sum_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "storage.buckets" */
["buckets_update_column"]:buckets_update_column;
	["buckets_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["buckets_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["buckets_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["buckets_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["buckets_var_pop_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["buckets_var_samp_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["buckets_variance_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["bytea"]:unknown;
	/** Boolean expression to compare columns of type "bytea". All fields are combined with logical 'AND'. */
["bytea_comparison_exp"]: {
	_eq?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["bytea"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["bytea"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["bytea"]> | undefined | null | Variable<any, string>
};
	["citext"]:unknown;
	/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
["citext_comparison_exp"]: {
	_eq?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	/** does the column match the given case-insensitive pattern */
	_ilike?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["citext"]> | undefined | null | Variable<any, string>,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	/** does the column match the given pattern */
	_like?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["citext"]> | undefined | null | Variable<any, string>,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	/** does the column NOT match the given pattern */
	_nlike?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	/** does the column match the given SQL regular expression */
	_similar?: ValueTypes["citext"] | undefined | null | Variable<any, string>
};
	/** ordering argument of a cursor */
["cursor_ordering"]:cursor_ordering;
	/** columns and relationships of "event_files" */
["event_files"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	/** An object relationship */
	event?:ValueTypes["events"],
	eventId?:boolean | `@${string}`,
	/** An object relationship */
	file?:ValueTypes["files"],
	fileId?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ValueTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "event_files" */
["event_files_aggregate"]: AliasType<{
	aggregate?:ValueTypes["event_files_aggregate_fields"],
	nodes?:ValueTypes["event_files"],
		__typename?: boolean | `@${string}`
}>;
	["event_files_aggregate_bool_exp"]: {
	count?: ValueTypes["event_files_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["event_files_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "event_files" */
["event_files_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["event_files_max_fields"],
	min?:ValueTypes["event_files_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "event_files" */
["event_files_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["event_files_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["event_files_min_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "event_files" */
["event_files_arr_rel_insert_input"]: {
	data: Array<ValueTypes["event_files_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["event_files_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "event_files". All fields are combined with a logical 'AND'. */
["event_files_bool_exp"]: {
	_and?: Array<ValueTypes["event_files_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["event_files_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	event?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "event_files" */
["event_files_constraint"]:event_files_constraint;
	/** input type for inserting data into table "event_files" */
["event_files_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	event?: ValueTypes["events_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["files_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["event_files_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	fileId?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "event_files" */
["event_files_max_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["event_files_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	fileId?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "event_files" */
["event_files_min_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "event_files" */
["event_files_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["event_files"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "event_files" */
["event_files_on_conflict"]: {
	constraint: ValueTypes["event_files_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["event_files_update_column"]> | Variable<any, string>,
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "event_files". */
["event_files_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	event?: ValueTypes["events_order_by"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	file?: ValueTypes["files_order_by"] | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: event_files */
["event_files_pk_columns_input"]: {
	eventId: ValueTypes["uuid"] | Variable<any, string>,
	fileId: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "event_files" */
["event_files_select_column"]:event_files_select_column;
	/** input type for updating data in table "event_files" */
["event_files_set_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "event_files" */
["event_files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["event_files_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["event_files_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** update columns of table "event_files" */
["event_files_update_column"]:event_files_update_column;
	["event_files_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["event_files_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["event_files_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "event_participants" */
["event_participants"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	/** An object relationship */
	event?:ValueTypes["events"],
	eventId?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ValueTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "event_participants" */
["event_participants_aggregate"]: AliasType<{
	aggregate?:ValueTypes["event_participants_aggregate_fields"],
	nodes?:ValueTypes["event_participants"],
		__typename?: boolean | `@${string}`
}>;
	["event_participants_aggregate_bool_exp"]: {
	count?: ValueTypes["event_participants_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["event_participants_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "event_participants" */
["event_participants_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["event_participants_max_fields"],
	min?:ValueTypes["event_participants_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "event_participants" */
["event_participants_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["event_participants_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["event_participants_min_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "event_participants" */
["event_participants_arr_rel_insert_input"]: {
	data: Array<ValueTypes["event_participants_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["event_participants_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "event_participants". All fields are combined with a logical 'AND'. */
["event_participants_bool_exp"]: {
	_and?: Array<ValueTypes["event_participants_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["event_participants_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	event?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "event_participants" */
["event_participants_constraint"]:event_participants_constraint;
	/** input type for inserting data into table "event_participants" */
["event_participants_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	event?: ValueTypes["events_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["event_participants_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "event_participants" */
["event_participants_max_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["event_participants_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "event_participants" */
["event_participants_min_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "event_participants" */
["event_participants_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["event_participants"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "event_participants" */
["event_participants_on_conflict"]: {
	constraint: ValueTypes["event_participants_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["event_participants_update_column"]> | Variable<any, string>,
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "event_participants". */
["event_participants_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	event?: ValueTypes["events_order_by"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	role?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: event_participants */
["event_participants_pk_columns_input"]: {
	eventId: ValueTypes["uuid"] | Variable<any, string>,
	userId: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "event_participants" */
["event_participants_select_column"]:event_participants_select_column;
	/** input type for updating data in table "event_participants" */
["event_participants_set_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "event_participants" */
["event_participants_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["event_participants_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["event_participants_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	eventId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	role?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** update columns of table "event_participants" */
["event_participants_update_column"]:event_participants_update_column;
	["event_participants_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["event_participants_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["event_participants_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "events" */
["events"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	/** An object relationship */
	creator?:ValueTypes["users"],
	creatorId?:boolean | `@${string}`,
	endAt?:boolean | `@${string}`,
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_files"]],
files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_files_aggregate"]],
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
params?: [{	/** JSON select path */
	path?: string | undefined | null | Variable<any, string>},boolean | `@${string}`],
participants?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_participants_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_participants"]],
participants_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_participants_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_participants_aggregate"]],
	slug?:boolean | `@${string}`,
	startAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "events" */
["events_aggregate"]: AliasType<{
	aggregate?:ValueTypes["events_aggregate_fields"],
	nodes?:ValueTypes["events"],
		__typename?: boolean | `@${string}`
}>;
	["events_aggregate_bool_exp"]: {
	count?: ValueTypes["events_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["events_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "events" */
["events_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["events_max_fields"],
	min?:ValueTypes["events_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "events" */
["events_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["events_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["events_min_order_by"] | undefined | null | Variable<any, string>
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["events_append_input"]: {
	params?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "events" */
["events_arr_rel_insert_input"]: {
	data: Array<ValueTypes["events_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["events_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "events". All fields are combined with a logical 'AND'. */
["events_bool_exp"]: {
	_and?: Array<ValueTypes["events_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["events_bool_exp"]> | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	creator?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	creatorId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	endAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	files?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>,
	files_aggregate?: ValueTypes["event_files_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	params?: ValueTypes["jsonb_comparison_exp"] | undefined | null | Variable<any, string>,
	participants?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>,
	participants_aggregate?: ValueTypes["event_participants_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	slug?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	startAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "events" */
["events_constraint"]:events_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["events_delete_at_path_input"]: {
	params?: Array<string> | undefined | null | Variable<any, string>
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["events_delete_elem_input"]: {
	params?: number | undefined | null | Variable<any, string>
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["events_delete_key_input"]: {
	params?: string | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "events" */
["events_insert_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	creator?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	creatorId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	endAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	files?: ValueTypes["event_files_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	params?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	participants?: ValueTypes["event_participants_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	startAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["events_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	creatorId?:boolean | `@${string}`,
	endAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	slug?:boolean | `@${string}`,
	startAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "events" */
["events_max_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	creatorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	endAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	slug?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	startAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["events_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	creatorId?:boolean | `@${string}`,
	endAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	slug?:boolean | `@${string}`,
	startAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "events" */
["events_min_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	creatorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	endAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	slug?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	startAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "events" */
["events_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["events"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "events" */
["events_obj_rel_insert_input"]: {
	data: ValueTypes["events_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["events_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "events" */
["events_on_conflict"]: {
	constraint: ValueTypes["events_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["events_update_column"]> | Variable<any, string>,
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "events". */
["events_order_by"]: {
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	creator?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	creatorId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	endAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	files_aggregate?: ValueTypes["event_files_aggregate_order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	params?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	participants_aggregate?: ValueTypes["event_participants_aggregate_order_by"] | undefined | null | Variable<any, string>,
	slug?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	startAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: events */
["events_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["events_prepend_input"]: {
	params?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** select columns of table "events" */
["events_select_column"]:events_select_column;
	/** input type for updating data in table "events" */
["events_set_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	creatorId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	endAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	params?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	startAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "events" */
["events_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["events_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["events_stream_cursor_value_input"]: {
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	creatorId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	endAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	params?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	slug?: string | undefined | null | Variable<any, string>,
	startAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** update columns of table "events" */
["events_update_column"]:events_update_column;
	["events_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["events_append_input"] | undefined | null | Variable<any, string>,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["events_delete_at_path_input"] | undefined | null | Variable<any, string>,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["events_delete_elem_input"] | undefined | null | Variable<any, string>,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["events_delete_key_input"] | undefined | null | Variable<any, string>,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["events_prepend_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["events_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["events_bool_exp"] | Variable<any, string>
};
	/** columns and relationships of "storage.files" */
["files"]: AliasType<{
	/** An object relationship */
	bucket?:ValueTypes["buckets"],
	bucketId?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	etag?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isUploaded?:boolean | `@${string}`,
	mimeType?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	uploadedByUserId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "storage.files" */
["files_aggregate"]: AliasType<{
	aggregate?:ValueTypes["files_aggregate_fields"],
	nodes?:ValueTypes["files"],
		__typename?: boolean | `@${string}`
}>;
	["files_aggregate_bool_exp"]: {
	bool_and?: ValueTypes["files_aggregate_bool_exp_bool_and"] | undefined | null | Variable<any, string>,
	bool_or?: ValueTypes["files_aggregate_bool_exp_bool_or"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["files_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["files_aggregate_bool_exp_bool_and"]: {
	arguments: ValueTypes["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"] | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Boolean_comparison_exp"] | Variable<any, string>
};
	["files_aggregate_bool_exp_bool_or"]: {
	arguments: ValueTypes["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"] | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Boolean_comparison_exp"] | Variable<any, string>
};
	["files_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "storage.files" */
["files_aggregate_fields"]: AliasType<{
	avg?:ValueTypes["files_avg_fields"],
count?: [{	columns?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["files_max_fields"],
	min?:ValueTypes["files_min_fields"],
	stddev?:ValueTypes["files_stddev_fields"],
	stddev_pop?:ValueTypes["files_stddev_pop_fields"],
	stddev_samp?:ValueTypes["files_stddev_samp_fields"],
	sum?:ValueTypes["files_sum_fields"],
	var_pop?:ValueTypes["files_var_pop_fields"],
	var_samp?:ValueTypes["files_var_samp_fields"],
	variance?:ValueTypes["files_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "storage.files" */
["files_aggregate_order_by"]: {
	avg?: ValueTypes["files_avg_order_by"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["files_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["files_min_order_by"] | undefined | null | Variable<any, string>,
	stddev?: ValueTypes["files_stddev_order_by"] | undefined | null | Variable<any, string>,
	stddev_pop?: ValueTypes["files_stddev_pop_order_by"] | undefined | null | Variable<any, string>,
	stddev_samp?: ValueTypes["files_stddev_samp_order_by"] | undefined | null | Variable<any, string>,
	sum?: ValueTypes["files_sum_order_by"] | undefined | null | Variable<any, string>,
	var_pop?: ValueTypes["files_var_pop_order_by"] | undefined | null | Variable<any, string>,
	var_samp?: ValueTypes["files_var_samp_order_by"] | undefined | null | Variable<any, string>,
	variance?: ValueTypes["files_variance_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "storage.files" */
["files_arr_rel_insert_input"]: {
	data: Array<ValueTypes["files_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["files_on_conflict"] | undefined | null | Variable<any, string>
};
	/** aggregate avg on columns */
["files_avg_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "storage.files" */
["files_avg_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "storage.files". All fields are combined with a logical 'AND'. */
["files_bool_exp"]: {
	_and?: Array<ValueTypes["files_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["files_bool_exp"]> | undefined | null | Variable<any, string>,
	bucket?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>,
	bucketId?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	etag?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	isUploaded?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	mimeType?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	size?: ValueTypes["Int_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	uploadedByUserId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "storage.files" */
["files_constraint"]:files_constraint;
	/** input type for incrementing numeric columns in table "storage.files" */
["files_inc_input"]: {
	size?: number | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "storage.files" */
["files_insert_input"]: {
	bucket?: ValueTypes["buckets_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	bucketId?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	etag?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isUploaded?: boolean | undefined | null | Variable<any, string>,
	mimeType?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	uploadedByUserId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["files_max_fields"]: AliasType<{
	bucketId?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	etag?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	mimeType?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	uploadedByUserId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "storage.files" */
["files_max_order_by"]: {
	bucketId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	etag?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	mimeType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	uploadedByUserId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["files_min_fields"]: AliasType<{
	bucketId?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	etag?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	mimeType?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	uploadedByUserId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "storage.files" */
["files_min_order_by"]: {
	bucketId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	etag?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	mimeType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	uploadedByUserId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "storage.files" */
["files_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["files"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "storage.files" */
["files_obj_rel_insert_input"]: {
	data: ValueTypes["files_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["files_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "storage.files" */
["files_on_conflict"]: {
	constraint: ValueTypes["files_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["files_update_column"]> | Variable<any, string>,
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "storage.files". */
["files_order_by"]: {
	bucket?: ValueTypes["buckets_order_by"] | undefined | null | Variable<any, string>,
	bucketId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	etag?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	isUploaded?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	mimeType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	name?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	uploadedByUserId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: storage.files */
["files_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "storage.files" */
["files_select_column"]:files_select_column;
	/** select "files_aggregate_bool_exp_bool_and_arguments_columns" columns of table "storage.files" */
["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"]:files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "files_aggregate_bool_exp_bool_or_arguments_columns" columns of table "storage.files" */
["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"]:files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "storage.files" */
["files_set_input"]: {
	bucketId?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	etag?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isUploaded?: boolean | undefined | null | Variable<any, string>,
	mimeType?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	uploadedByUserId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev on columns */
["files_stddev_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "storage.files" */
["files_stddev_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_pop on columns */
["files_stddev_pop_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "storage.files" */
["files_stddev_pop_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate stddev_samp on columns */
["files_stddev_samp_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "storage.files" */
["files_stddev_samp_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "files" */
["files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["files_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["files_stream_cursor_value_input"]: {
	bucketId?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	etag?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isUploaded?: boolean | undefined | null | Variable<any, string>,
	mimeType?: string | undefined | null | Variable<any, string>,
	name?: string | undefined | null | Variable<any, string>,
	size?: number | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	uploadedByUserId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate sum on columns */
["files_sum_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "storage.files" */
["files_sum_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** update columns of table "storage.files" */
["files_update_column"]:files_update_column;
	["files_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["files_inc_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["files_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["files_bool_exp"] | Variable<any, string>
};
	/** aggregate var_pop on columns */
["files_var_pop_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "storage.files" */
["files_var_pop_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate var_samp on columns */
["files_var_samp_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "storage.files" */
["files_var_samp_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate variance on columns */
["files_variance_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "storage.files" */
["files_variance_order_by"]: {
	size?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** columns and relationships of "installations" */
["installations"]: AliasType<{
	appIdentifier?:boolean | `@${string}`,
	appVersion?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	deviceLocale?:boolean | `@${string}`,
	deviceName?:boolean | `@${string}`,
	deviceType?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isActive?:boolean | `@${string}`,
	osName?:boolean | `@${string}`,
	osVersion?:boolean | `@${string}`,
	pushToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ValueTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "installations" */
["installations_aggregate"]: AliasType<{
	aggregate?:ValueTypes["installations_aggregate_fields"],
	nodes?:ValueTypes["installations"],
		__typename?: boolean | `@${string}`
}>;
	["installations_aggregate_bool_exp"]: {
	bool_and?: ValueTypes["installations_aggregate_bool_exp_bool_and"] | undefined | null | Variable<any, string>,
	bool_or?: ValueTypes["installations_aggregate_bool_exp_bool_or"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["installations_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["installations_aggregate_bool_exp_bool_and"]: {
	arguments: ValueTypes["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"] | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Boolean_comparison_exp"] | Variable<any, string>
};
	["installations_aggregate_bool_exp_bool_or"]: {
	arguments: ValueTypes["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"] | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Boolean_comparison_exp"] | Variable<any, string>
};
	["installations_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "installations" */
["installations_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["installations_max_fields"],
	min?:ValueTypes["installations_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "installations" */
["installations_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["installations_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["installations_min_order_by"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "installations" */
["installations_arr_rel_insert_input"]: {
	data: Array<ValueTypes["installations_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["installations_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "installations". All fields are combined with a logical 'AND'. */
["installations_bool_exp"]: {
	_and?: Array<ValueTypes["installations_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["installations_bool_exp"]> | undefined | null | Variable<any, string>,
	appIdentifier?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	appVersion?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	deviceLocale?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	deviceName?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	deviceType?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	isActive?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	osName?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	osVersion?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	pushToken?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "installations" */
["installations_constraint"]:installations_constraint;
	/** input type for inserting data into table "installations" */
["installations_insert_input"]: {
	appIdentifier?: string | undefined | null | Variable<any, string>,
	appVersion?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	deviceLocale?: string | undefined | null | Variable<any, string>,
	deviceName?: string | undefined | null | Variable<any, string>,
	deviceType?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	osName?: string | undefined | null | Variable<any, string>,
	osVersion?: string | undefined | null | Variable<any, string>,
	pushToken?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["installations_max_fields"]: AliasType<{
	appIdentifier?:boolean | `@${string}`,
	appVersion?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	deviceLocale?:boolean | `@${string}`,
	deviceName?:boolean | `@${string}`,
	deviceType?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	osName?:boolean | `@${string}`,
	osVersion?:boolean | `@${string}`,
	pushToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "installations" */
["installations_max_order_by"]: {
	appIdentifier?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	appVersion?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceLocale?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	osName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	osVersion?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pushToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["installations_min_fields"]: AliasType<{
	appIdentifier?:boolean | `@${string}`,
	appVersion?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	deviceLocale?:boolean | `@${string}`,
	deviceName?:boolean | `@${string}`,
	deviceType?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	osName?:boolean | `@${string}`,
	osVersion?:boolean | `@${string}`,
	pushToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "installations" */
["installations_min_order_by"]: {
	appIdentifier?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	appVersion?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceLocale?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	osName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	osVersion?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pushToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "installations" */
["installations_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["installations"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "installations" */
["installations_on_conflict"]: {
	constraint: ValueTypes["installations_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["installations_update_column"]> | Variable<any, string>,
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "installations". */
["installations_order_by"]: {
	appIdentifier?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	appVersion?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceLocale?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	deviceType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	isActive?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	osName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	osVersion?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	pushToken?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	user?: ValueTypes["users_order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: installations */
["installations_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>,
	userId: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "installations" */
["installations_select_column"]:installations_select_column;
	/** select "installations_aggregate_bool_exp_bool_and_arguments_columns" columns of table "installations" */
["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"]:installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "installations_aggregate_bool_exp_bool_or_arguments_columns" columns of table "installations" */
["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"]:installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "installations" */
["installations_set_input"]: {
	appIdentifier?: string | undefined | null | Variable<any, string>,
	appVersion?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	deviceLocale?: string | undefined | null | Variable<any, string>,
	deviceName?: string | undefined | null | Variable<any, string>,
	deviceType?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	osName?: string | undefined | null | Variable<any, string>,
	osVersion?: string | undefined | null | Variable<any, string>,
	pushToken?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "installations" */
["installations_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["installations_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["installations_stream_cursor_value_input"]: {
	appIdentifier?: string | undefined | null | Variable<any, string>,
	appVersion?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	deviceLocale?: string | undefined | null | Variable<any, string>,
	deviceName?: string | undefined | null | Variable<any, string>,
	deviceType?: string | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isActive?: boolean | undefined | null | Variable<any, string>,
	osName?: string | undefined | null | Variable<any, string>,
	osVersion?: string | undefined | null | Variable<any, string>,
	pushToken?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** update columns of table "installations" */
["installations_update_column"]:installations_update_column;
	["installations_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["installations_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["installations_bool_exp"] | Variable<any, string>
};
	["jsonb"]:unknown;
	["jsonb_cast_exp"]: {
	String?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
["jsonb_comparison_exp"]: {
	_cast?: ValueTypes["jsonb_cast_exp"] | undefined | null | Variable<any, string>,
	/** is the column contained in the given json value */
	_contained_in?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	/** does the column contain the given json value at the top level */
	_contains?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	_eq?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	/** does the string exist as a top-level key in the column */
	_has_key?: string | undefined | null | Variable<any, string>,
	/** do all of these strings exist as top-level keys in the column */
	_has_keys_all?: Array<string> | undefined | null | Variable<any, string>,
	/** do any of these strings exist as top-level keys in the column */
	_has_keys_any?: Array<string> | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["jsonb"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["jsonb"]> | undefined | null | Variable<any, string>
};
	/** mutation root */
["mutation_root"]: AliasType<{
deleteAuthProvider?: [{	id: string | Variable<any, string>},ValueTypes["authProviders"]],
deleteAuthProviderRequest?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authProviderRequests"]],
deleteAuthProviderRequests?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authProviderRequests_bool_exp"] | Variable<any, string>},ValueTypes["authProviderRequests_mutation_response"]],
deleteAuthProviders?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authProviders_bool_exp"] | Variable<any, string>},ValueTypes["authProviders_mutation_response"]],
deleteAuthRefreshToken?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authRefreshTokens"]],
deleteAuthRefreshTokenType?: [{	value: string | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
deleteAuthRefreshTokenTypes?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authRefreshTokenTypes_bool_exp"] | Variable<any, string>},ValueTypes["authRefreshTokenTypes_mutation_response"]],
deleteAuthRefreshTokens?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authRefreshTokens_bool_exp"] | Variable<any, string>},ValueTypes["authRefreshTokens_mutation_response"]],
deleteAuthRole?: [{	role: string | Variable<any, string>},ValueTypes["authRoles"]],
deleteAuthRoles?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authRoles_bool_exp"] | Variable<any, string>},ValueTypes["authRoles_mutation_response"]],
deleteAuthUserProvider?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserProviders"]],
deleteAuthUserProviders?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authUserProviders_bool_exp"] | Variable<any, string>},ValueTypes["authUserProviders_mutation_response"]],
deleteAuthUserRole?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserRoles"]],
deleteAuthUserRoles?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authUserRoles_bool_exp"] | Variable<any, string>},ValueTypes["authUserRoles_mutation_response"]],
deleteAuthUserSecurityKey?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
deleteAuthUserSecurityKeys?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["authUserSecurityKeys_bool_exp"] | Variable<any, string>},ValueTypes["authUserSecurityKeys_mutation_response"]],
deleteBucket?: [{	id: string | Variable<any, string>},ValueTypes["buckets"]],
deleteBuckets?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["buckets_bool_exp"] | Variable<any, string>},ValueTypes["buckets_mutation_response"]],
deleteFile?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["files"]],
deleteFiles?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["files_bool_exp"] | Variable<any, string>},ValueTypes["files_mutation_response"]],
deleteUser?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["users"]],
deleteUsers?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["users_bool_exp"] | Variable<any, string>},ValueTypes["users_mutation_response"]],
delete_event_files?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["event_files_bool_exp"] | Variable<any, string>},ValueTypes["event_files_mutation_response"]],
delete_event_files_by_pk?: [{	eventId: ValueTypes["uuid"] | Variable<any, string>,	fileId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["event_files"]],
delete_event_participants?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["event_participants_bool_exp"] | Variable<any, string>},ValueTypes["event_participants_mutation_response"]],
delete_event_participants_by_pk?: [{	eventId: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["event_participants"]],
delete_events?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["events_bool_exp"] | Variable<any, string>},ValueTypes["events_mutation_response"]],
delete_events_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["events"]],
delete_installations?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["installations_bool_exp"] | Variable<any, string>},ValueTypes["installations_mutation_response"]],
delete_installations_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["installations"]],
delete_user_files?: [{	/** filter the rows which have to be deleted */
	where: ValueTypes["user_files_bool_exp"] | Variable<any, string>},ValueTypes["user_files_mutation_response"]],
delete_user_files_by_pk?: [{	fileId: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["user_files"]],
insertAuthProvider?: [{	/** the row to be inserted */
	object: ValueTypes["authProviders_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authProviders_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authProviders"]],
insertAuthProviderRequest?: [{	/** the row to be inserted */
	object: ValueTypes["authProviderRequests_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authProviderRequests_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authProviderRequests"]],
insertAuthProviderRequests?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authProviderRequests_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authProviderRequests_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authProviderRequests_mutation_response"]],
insertAuthProviders?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authProviders_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authProviders_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authProviders_mutation_response"]],
insertAuthRefreshToken?: [{	/** the row to be inserted */
	object: ValueTypes["authRefreshTokens_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authRefreshTokens_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens"]],
insertAuthRefreshTokenType?: [{	/** the row to be inserted */
	object: ValueTypes["authRefreshTokenTypes_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authRefreshTokenTypes_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
insertAuthRefreshTokenTypes?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authRefreshTokenTypes_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authRefreshTokenTypes_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokenTypes_mutation_response"]],
insertAuthRefreshTokens?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authRefreshTokens_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authRefreshTokens_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens_mutation_response"]],
insertAuthRole?: [{	/** the row to be inserted */
	object: ValueTypes["authRoles_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authRoles_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authRoles"]],
insertAuthRoles?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authRoles_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authRoles_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authRoles_mutation_response"]],
insertAuthUserProvider?: [{	/** the row to be inserted */
	object: ValueTypes["authUserProviders_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authUserProviders_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders"]],
insertAuthUserProviders?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authUserProviders_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authUserProviders_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders_mutation_response"]],
insertAuthUserRole?: [{	/** the row to be inserted */
	object: ValueTypes["authUserRoles_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authUserRoles_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles"]],
insertAuthUserRoles?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authUserRoles_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authUserRoles_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles_mutation_response"]],
insertAuthUserSecurityKey?: [{	/** the row to be inserted */
	object: ValueTypes["authUserSecurityKeys_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authUserSecurityKeys_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
insertAuthUserSecurityKeys?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["authUserSecurityKeys_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["authUserSecurityKeys_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys_mutation_response"]],
insertBucket?: [{	/** the row to be inserted */
	object: ValueTypes["buckets_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["buckets_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["buckets"]],
insertBuckets?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["buckets_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["buckets_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["buckets_mutation_response"]],
insertFile?: [{	/** the row to be inserted */
	object: ValueTypes["files_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["files_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["files"]],
insertFiles?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["files_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["files_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["files_mutation_response"]],
insertUser?: [{	/** the row to be inserted */
	object: ValueTypes["users_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["users_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["users"]],
insertUsers?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["users_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["users_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["users_mutation_response"]],
insert_event_files?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["event_files_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["event_files_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["event_files_mutation_response"]],
insert_event_files_one?: [{	/** the row to be inserted */
	object: ValueTypes["event_files_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["event_files_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["event_files"]],
insert_event_participants?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["event_participants_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["event_participants_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["event_participants_mutation_response"]],
insert_event_participants_one?: [{	/** the row to be inserted */
	object: ValueTypes["event_participants_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["event_participants_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["event_participants"]],
insert_events?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["events_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["events_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["events_mutation_response"]],
insert_events_one?: [{	/** the row to be inserted */
	object: ValueTypes["events_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["events_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["events"]],
insert_installations?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["installations_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["installations_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["installations_mutation_response"]],
insert_installations_one?: [{	/** the row to be inserted */
	object: ValueTypes["installations_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["installations_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["installations"]],
insert_user_files?: [{	/** the rows to be inserted */
	objects: Array<ValueTypes["user_files_insert_input"]> | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["user_files_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["user_files_mutation_response"]],
insert_user_files_one?: [{	/** the row to be inserted */
	object: ValueTypes["user_files_insert_input"] | Variable<any, string>,	/** upsert condition */
	on_conflict?: ValueTypes["user_files_on_conflict"] | undefined | null | Variable<any, string>},ValueTypes["user_files"]],
updateAuthProvider?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authProviders_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authProviders_pk_columns_input"] | Variable<any, string>},ValueTypes["authProviders"]],
updateAuthProviderRequest?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["authProviderRequests_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["authProviderRequests_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["authProviderRequests_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["authProviderRequests_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["authProviderRequests_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authProviderRequests_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authProviderRequests_pk_columns_input"] | Variable<any, string>},ValueTypes["authProviderRequests"]],
updateAuthProviderRequests?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["authProviderRequests_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["authProviderRequests_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["authProviderRequests_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["authProviderRequests_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["authProviderRequests_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authProviderRequests_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authProviderRequests_bool_exp"] | Variable<any, string>},ValueTypes["authProviderRequests_mutation_response"]],
updateAuthProviders?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authProviders_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authProviders_bool_exp"] | Variable<any, string>},ValueTypes["authProviders_mutation_response"]],
updateAuthRefreshToken?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["authRefreshTokens_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["authRefreshTokens_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["authRefreshTokens_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["authRefreshTokens_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["authRefreshTokens_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRefreshTokens_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authRefreshTokens_pk_columns_input"] | Variable<any, string>},ValueTypes["authRefreshTokens"]],
updateAuthRefreshTokenType?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRefreshTokenTypes_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authRefreshTokenTypes_pk_columns_input"] | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
updateAuthRefreshTokenTypes?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRefreshTokenTypes_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authRefreshTokenTypes_bool_exp"] | Variable<any, string>},ValueTypes["authRefreshTokenTypes_mutation_response"]],
updateAuthRefreshTokens?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["authRefreshTokens_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["authRefreshTokens_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["authRefreshTokens_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["authRefreshTokens_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["authRefreshTokens_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRefreshTokens_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authRefreshTokens_bool_exp"] | Variable<any, string>},ValueTypes["authRefreshTokens_mutation_response"]],
updateAuthRole?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRoles_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authRoles_pk_columns_input"] | Variable<any, string>},ValueTypes["authRoles"]],
updateAuthRoles?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authRoles_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authRoles_bool_exp"] | Variable<any, string>},ValueTypes["authRoles_mutation_response"]],
updateAuthUserProvider?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserProviders_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authUserProviders_pk_columns_input"] | Variable<any, string>},ValueTypes["authUserProviders"]],
updateAuthUserProviders?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserProviders_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authUserProviders_bool_exp"] | Variable<any, string>},ValueTypes["authUserProviders_mutation_response"]],
updateAuthUserRole?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserRoles_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authUserRoles_pk_columns_input"] | Variable<any, string>},ValueTypes["authUserRoles"]],
updateAuthUserRoles?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserRoles_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authUserRoles_bool_exp"] | Variable<any, string>},ValueTypes["authUserRoles_mutation_response"]],
updateAuthUserSecurityKey?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["authUserSecurityKeys_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserSecurityKeys_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["authUserSecurityKeys_pk_columns_input"] | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
updateAuthUserSecurityKeys?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["authUserSecurityKeys_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["authUserSecurityKeys_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["authUserSecurityKeys_bool_exp"] | Variable<any, string>},ValueTypes["authUserSecurityKeys_mutation_response"]],
updateBucket?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["buckets_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["buckets_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["buckets_pk_columns_input"] | Variable<any, string>},ValueTypes["buckets"]],
updateBuckets?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["buckets_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["buckets_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["buckets_bool_exp"] | Variable<any, string>},ValueTypes["buckets_mutation_response"]],
updateFile?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["files_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["files_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["files_pk_columns_input"] | Variable<any, string>},ValueTypes["files"]],
updateFiles?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ValueTypes["files_inc_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["files_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["files_bool_exp"] | Variable<any, string>},ValueTypes["files_mutation_response"]],
updateUser?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["users_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["users_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["users_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["users_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["users_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["users_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["users_pk_columns_input"] | Variable<any, string>},ValueTypes["users"]],
updateUsers?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["users_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["users_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["users_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["users_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["users_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["users_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["users_bool_exp"] | Variable<any, string>},ValueTypes["users_mutation_response"]],
update_authProviderRequests_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authProviderRequests_updates"]> | Variable<any, string>},ValueTypes["authProviderRequests_mutation_response"]],
update_authProviders_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authProviders_updates"]> | Variable<any, string>},ValueTypes["authProviders_mutation_response"]],
update_authRefreshTokenTypes_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authRefreshTokenTypes_updates"]> | Variable<any, string>},ValueTypes["authRefreshTokenTypes_mutation_response"]],
update_authRefreshTokens_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authRefreshTokens_updates"]> | Variable<any, string>},ValueTypes["authRefreshTokens_mutation_response"]],
update_authRoles_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authRoles_updates"]> | Variable<any, string>},ValueTypes["authRoles_mutation_response"]],
update_authUserProviders_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authUserProviders_updates"]> | Variable<any, string>},ValueTypes["authUserProviders_mutation_response"]],
update_authUserRoles_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authUserRoles_updates"]> | Variable<any, string>},ValueTypes["authUserRoles_mutation_response"]],
update_authUserSecurityKeys_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["authUserSecurityKeys_updates"]> | Variable<any, string>},ValueTypes["authUserSecurityKeys_mutation_response"]],
update_buckets_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["buckets_updates"]> | Variable<any, string>},ValueTypes["buckets_mutation_response"]],
update_event_files?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["event_files_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["event_files_bool_exp"] | Variable<any, string>},ValueTypes["event_files_mutation_response"]],
update_event_files_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["event_files_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["event_files_pk_columns_input"] | Variable<any, string>},ValueTypes["event_files"]],
update_event_files_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["event_files_updates"]> | Variable<any, string>},ValueTypes["event_files_mutation_response"]],
update_event_participants?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["event_participants_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["event_participants_bool_exp"] | Variable<any, string>},ValueTypes["event_participants_mutation_response"]],
update_event_participants_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["event_participants_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["event_participants_pk_columns_input"] | Variable<any, string>},ValueTypes["event_participants"]],
update_event_participants_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["event_participants_updates"]> | Variable<any, string>},ValueTypes["event_participants_mutation_response"]],
update_events?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["events_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["events_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["events_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["events_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["events_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["events_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["events_bool_exp"] | Variable<any, string>},ValueTypes["events_mutation_response"]],
update_events_by_pk?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["events_append_input"] | undefined | null | Variable<any, string>,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["events_delete_at_path_input"] | undefined | null | Variable<any, string>,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["events_delete_elem_input"] | undefined | null | Variable<any, string>,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["events_delete_key_input"] | undefined | null | Variable<any, string>,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["events_prepend_input"] | undefined | null | Variable<any, string>,	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["events_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["events_pk_columns_input"] | Variable<any, string>},ValueTypes["events"]],
update_events_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["events_updates"]> | Variable<any, string>},ValueTypes["events_mutation_response"]],
update_files_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["files_updates"]> | Variable<any, string>},ValueTypes["files_mutation_response"]],
update_installations?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["installations_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["installations_bool_exp"] | Variable<any, string>},ValueTypes["installations_mutation_response"]],
update_installations_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["installations_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["installations_pk_columns_input"] | Variable<any, string>},ValueTypes["installations"]],
update_installations_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["installations_updates"]> | Variable<any, string>},ValueTypes["installations_mutation_response"]],
update_user_files?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["user_files_set_input"] | undefined | null | Variable<any, string>,	/** filter the rows which have to be updated */
	where: ValueTypes["user_files_bool_exp"] | Variable<any, string>},ValueTypes["user_files_mutation_response"]],
update_user_files_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["user_files_set_input"] | undefined | null | Variable<any, string>,	pk_columns: ValueTypes["user_files_pk_columns_input"] | Variable<any, string>},ValueTypes["user_files"]],
update_user_files_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["user_files_updates"]> | Variable<any, string>},ValueTypes["user_files_mutation_response"]],
update_users_many?: [{	/** updates to execute, in order */
	updates: Array<ValueTypes["users_updates"]> | Variable<any, string>},ValueTypes["users_mutation_response"]],
		__typename?: boolean | `@${string}`
}>;
	/** column ordering options */
["order_by"]:order_by;
	["query_root"]: AliasType<{
authProvider?: [{	id: string | Variable<any, string>},ValueTypes["authProviders"]],
authProviderRequest?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authProviderRequests"]],
authProviderRequests?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviderRequests_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviderRequests_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviderRequests_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviderRequests"]],
authProviderRequestsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviderRequests_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviderRequests_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviderRequests_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviderRequests_aggregate"]],
authProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviders"]],
authProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviders_aggregate"]],
authRefreshToken?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authRefreshTokens"]],
authRefreshTokenType?: [{	value: string | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
authRefreshTokenTypes?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokenTypes_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokenTypes_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokenTypes_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
authRefreshTokenTypesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokenTypes_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokenTypes_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokenTypes_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokenTypes_aggregate"]],
authRefreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens"]],
authRefreshTokensAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens_aggregate"]],
authRole?: [{	role: string | Variable<any, string>},ValueTypes["authRoles"]],
authRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRoles"]],
authRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRoles_aggregate"]],
authUserProvider?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserProviders"]],
authUserProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders"]],
authUserProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders_aggregate"]],
authUserRole?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserRoles"]],
authUserRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles"]],
authUserRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles_aggregate"]],
authUserSecurityKey?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
authUserSecurityKeys?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserSecurityKeys_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
authUserSecurityKeysAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserSecurityKeys_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys_aggregate"]],
bucket?: [{	id: string | Variable<any, string>},ValueTypes["buckets"]],
buckets?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["buckets_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["buckets_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["buckets"]],
bucketsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["buckets_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["buckets_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["buckets_aggregate"]],
event_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_files"]],
event_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_files_aggregate"]],
event_files_by_pk?: [{	eventId: ValueTypes["uuid"] | Variable<any, string>,	fileId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["event_files"]],
event_participants?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_participants_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_participants"]],
event_participants_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_participants_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_participants_aggregate"]],
event_participants_by_pk?: [{	eventId: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["event_participants"]],
events?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["events_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["events"]],
events_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["events_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["events_aggregate"]],
events_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["events"]],
file?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["files"]],
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["files"]],
filesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["files_aggregate"]],
installations?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["installations_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["installations"]],
installations_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["installations_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["installations_aggregate"]],
installations_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["installations"]],
user?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["users"]],
user_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["user_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["user_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["user_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["user_files"]],
user_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["user_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["user_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["user_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["user_files_aggregate"]],
user_files_by_pk?: [{	fileId: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["user_files"]],
users?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["users_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["users"]],
usersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["users_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["users_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	["subscription_root"]: AliasType<{
authProvider?: [{	id: string | Variable<any, string>},ValueTypes["authProviders"]],
authProviderRequest?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authProviderRequests"]],
authProviderRequests?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviderRequests_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviderRequests_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviderRequests_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviderRequests"]],
authProviderRequestsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviderRequests_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviderRequests_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviderRequests_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviderRequests_aggregate"]],
authProviderRequests_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authProviderRequests_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviderRequests_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviderRequests"]],
authProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviders"]],
authProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviders_aggregate"]],
authProviders_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authProviders_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authProviders"]],
authRefreshToken?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authRefreshTokens"]],
authRefreshTokenType?: [{	value: string | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
authRefreshTokenTypes?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokenTypes_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokenTypes_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokenTypes_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
authRefreshTokenTypesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokenTypes_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokenTypes_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokenTypes_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokenTypes_aggregate"]],
authRefreshTokenTypes_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authRefreshTokenTypes_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokenTypes_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokenTypes"]],
authRefreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens"]],
authRefreshTokensAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens_aggregate"]],
authRefreshTokens_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authRefreshTokens_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens"]],
authRole?: [{	role: string | Variable<any, string>},ValueTypes["authRoles"]],
authRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRoles"]],
authRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRoles_aggregate"]],
authRoles_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authRoles_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRoles"]],
authUserProvider?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserProviders"]],
authUserProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders"]],
authUserProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders_aggregate"]],
authUserProviders_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authUserProviders_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders"]],
authUserRole?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserRoles"]],
authUserRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles"]],
authUserRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles_aggregate"]],
authUserRoles_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authUserRoles_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles"]],
authUserSecurityKey?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
authUserSecurityKeys?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserSecurityKeys_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
authUserSecurityKeysAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserSecurityKeys_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys_aggregate"]],
authUserSecurityKeys_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["authUserSecurityKeys_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
bucket?: [{	id: string | Variable<any, string>},ValueTypes["buckets"]],
buckets?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["buckets_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["buckets_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["buckets"]],
bucketsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["buckets_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["buckets_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["buckets_aggregate"]],
buckets_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["buckets_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["buckets_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["buckets"]],
event_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_files"]],
event_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_files_aggregate"]],
event_files_by_pk?: [{	eventId: ValueTypes["uuid"] | Variable<any, string>,	fileId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["event_files"]],
event_files_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["event_files_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_files"]],
event_participants?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_participants_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_participants"]],
event_participants_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["event_participants_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["event_participants_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_participants_aggregate"]],
event_participants_by_pk?: [{	eventId: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["event_participants"]],
event_participants_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["event_participants_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["event_participants_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["event_participants"]],
events?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["events_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["events"]],
events_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["events_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["events_aggregate"]],
events_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["events"]],
events_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["events_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["events"]],
file?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["files"]],
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["files"]],
filesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["files_aggregate"]],
files_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["files_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["files"]],
installations?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["installations_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["installations"]],
installations_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["installations_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["installations_aggregate"]],
installations_by_pk?: [{	id: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["installations"]],
installations_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["installations_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["installations"]],
user?: [{	id: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["users"]],
user_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["user_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["user_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["user_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["user_files"]],
user_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["user_files_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["user_files_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["user_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["user_files_aggregate"]],
user_files_by_pk?: [{	fileId: ValueTypes["uuid"] | Variable<any, string>,	userId: ValueTypes["uuid"] | Variable<any, string>},ValueTypes["user_files"]],
user_files_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["user_files_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["user_files_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["user_files"]],
users?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["users_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["users"]],
usersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["users_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["users_aggregate"]],
users_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number | Variable<any, string>,	/** cursor to stream the results returned by the query */
	cursor: Array<ValueTypes["users_stream_cursor_input"] | undefined | null> | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["users"]],
		__typename?: boolean | `@${string}`
}>;
	["timestamptz"]:unknown;
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
	_eq?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["timestamptz"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["timestamptz"]> | undefined | null | Variable<any, string>
};
	/** columns and relationships of "user_files" */
["user_files"]: AliasType<{
	fileId?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "user_files" */
["user_files_aggregate"]: AliasType<{
	aggregate?:ValueTypes["user_files_aggregate_fields"],
	nodes?:ValueTypes["user_files"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "user_files" */
["user_files_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["user_files_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["user_files_max_fields"],
	min?:ValueTypes["user_files_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "user_files". All fields are combined with a logical 'AND'. */
["user_files_bool_exp"]: {
	_and?: Array<ValueTypes["user_files_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["user_files_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["user_files_bool_exp"]> | undefined | null | Variable<any, string>,
	fileId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "user_files" */
["user_files_constraint"]:user_files_constraint;
	/** input type for inserting data into table "user_files" */
["user_files_insert_input"]: {
	fileId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["user_files_max_fields"]: AliasType<{
	fileId?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["user_files_min_fields"]: AliasType<{
	fileId?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "user_files" */
["user_files_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["user_files"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "user_files" */
["user_files_on_conflict"]: {
	constraint: ValueTypes["user_files_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["user_files_update_column"]> | Variable<any, string>,
	where?: ValueTypes["user_files_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "user_files". */
["user_files_order_by"]: {
	fileId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: user_files */
["user_files_pk_columns_input"]: {
	fileId: ValueTypes["uuid"] | Variable<any, string>,
	userId: ValueTypes["uuid"] | Variable<any, string>
};
	/** select columns of table "user_files" */
["user_files_select_column"]:user_files_select_column;
	/** input type for updating data in table "user_files" */
["user_files_set_input"]: {
	fileId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "user_files" */
["user_files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["user_files_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["user_files_stream_cursor_value_input"]: {
	fileId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	userId?: ValueTypes["uuid"] | undefined | null | Variable<any, string>
};
	/** update columns of table "user_files" */
["user_files_update_column"]:user_files_update_column;
	["user_files_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["user_files_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["user_files_bool_exp"] | Variable<any, string>
};
	/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
["users"]: AliasType<{
	activeMfaType?:boolean | `@${string}`,
	avatarUrl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	currentChallenge?:boolean | `@${string}`,
	defaultRole?:boolean | `@${string}`,
	/** An object relationship */
	defaultRoleByRole?:ValueTypes["authRoles"],
	disabled?:boolean | `@${string}`,
	displayName?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	emailVerified?:boolean | `@${string}`,
events?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["events_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["events"]],
events_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["events_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["events_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["events_aggregate"]],
	id?:boolean | `@${string}`,
installations?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["installations_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["installations"]],
installations_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["installations_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["installations_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["installations_aggregate"]],
	isAnonymous?:boolean | `@${string}`,
	lastSeen?:boolean | `@${string}`,
	locale?:boolean | `@${string}`,
metadata?: [{	/** JSON select path */
	path?: string | undefined | null | Variable<any, string>},boolean | `@${string}`],
	newEmail?:boolean | `@${string}`,
	otpHash?:boolean | `@${string}`,
	otpHashExpiresAt?:boolean | `@${string}`,
	otpMethodLastUsed?:boolean | `@${string}`,
	passwordHash?:boolean | `@${string}`,
	phoneNumber?:boolean | `@${string}`,
	phoneNumberVerified?:boolean | `@${string}`,
refreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens"]],
refreshTokens_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authRefreshTokens_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authRefreshTokens_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authRefreshTokens_aggregate"]],
roles?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles"]],
roles_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserRoles_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserRoles_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserRoles_aggregate"]],
securityKeys?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserSecurityKeys_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys"]],
securityKeys_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserSecurityKeys_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserSecurityKeys_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserSecurityKeys_aggregate"]],
	ticket?:boolean | `@${string}`,
	ticketExpiresAt?:boolean | `@${string}`,
	totpSecret?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
userProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders"]],
userProviders_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ValueTypes["authUserProviders_select_column"]> | undefined | null | Variable<any, string>,	/** limit the number of rows returned */
	limit?: number | undefined | null | Variable<any, string>,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null | Variable<any, string>,	/** sort the rows by one or more columns */
	order_by?: Array<ValueTypes["authUserProviders_order_by"]> | undefined | null | Variable<any, string>,	/** filter the rows returned */
	where?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>},ValueTypes["authUserProviders_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.users" */
["users_aggregate"]: AliasType<{
	aggregate?:ValueTypes["users_aggregate_fields"],
	nodes?:ValueTypes["users"],
		__typename?: boolean | `@${string}`
}>;
	["users_aggregate_bool_exp"]: {
	bool_and?: ValueTypes["users_aggregate_bool_exp_bool_and"] | undefined | null | Variable<any, string>,
	bool_or?: ValueTypes["users_aggregate_bool_exp_bool_or"] | undefined | null | Variable<any, string>,
	count?: ValueTypes["users_aggregate_bool_exp_count"] | undefined | null | Variable<any, string>
};
	["users_aggregate_bool_exp_bool_and"]: {
	arguments: ValueTypes["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"] | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Boolean_comparison_exp"] | Variable<any, string>
};
	["users_aggregate_bool_exp_bool_or"]: {
	arguments: ValueTypes["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"] | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Boolean_comparison_exp"] | Variable<any, string>
};
	["users_aggregate_bool_exp_count"]: {
	arguments?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,
	distinct?: boolean | undefined | null | Variable<any, string>,
	filter?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	predicate: ValueTypes["Int_comparison_exp"] | Variable<any, string>
};
	/** aggregate fields of "auth.users" */
["users_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ValueTypes["users_select_column"]> | undefined | null | Variable<any, string>,	distinct?: boolean | undefined | null | Variable<any, string>},boolean | `@${string}`],
	max?:ValueTypes["users_max_fields"],
	min?:ValueTypes["users_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.users" */
["users_aggregate_order_by"]: {
	count?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	max?: ValueTypes["users_max_order_by"] | undefined | null | Variable<any, string>,
	min?: ValueTypes["users_min_order_by"] | undefined | null | Variable<any, string>
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["users_append_input"]: {
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** input type for inserting array relation for remote table "auth.users" */
["users_arr_rel_insert_input"]: {
	data: Array<ValueTypes["users_insert_input"]> | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["users_on_conflict"] | undefined | null | Variable<any, string>
};
	/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
["users_bool_exp"]: {
	_and?: Array<ValueTypes["users_bool_exp"]> | undefined | null | Variable<any, string>,
	_not?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["users_bool_exp"]> | undefined | null | Variable<any, string>,
	activeMfaType?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	avatarUrl?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	currentChallenge?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	defaultRole?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	defaultRoleByRole?: ValueTypes["authRoles_bool_exp"] | undefined | null | Variable<any, string>,
	disabled?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	displayName?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["citext_comparison_exp"] | undefined | null | Variable<any, string>,
	emailVerified?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	events?: ValueTypes["events_bool_exp"] | undefined | null | Variable<any, string>,
	events_aggregate?: ValueTypes["events_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid_comparison_exp"] | undefined | null | Variable<any, string>,
	installations?: ValueTypes["installations_bool_exp"] | undefined | null | Variable<any, string>,
	installations_aggregate?: ValueTypes["installations_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	isAnonymous?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	lastSeen?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	locale?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb_comparison_exp"] | undefined | null | Variable<any, string>,
	newEmail?: ValueTypes["citext_comparison_exp"] | undefined | null | Variable<any, string>,
	otpHash?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	otpHashExpiresAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	otpMethodLastUsed?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	passwordHash?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phoneNumber?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	phoneNumberVerified?: ValueTypes["Boolean_comparison_exp"] | undefined | null | Variable<any, string>,
	refreshTokens?: ValueTypes["authRefreshTokens_bool_exp"] | undefined | null | Variable<any, string>,
	refreshTokens_aggregate?: ValueTypes["authRefreshTokens_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	roles?: ValueTypes["authUserRoles_bool_exp"] | undefined | null | Variable<any, string>,
	roles_aggregate?: ValueTypes["authUserRoles_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	securityKeys?: ValueTypes["authUserSecurityKeys_bool_exp"] | undefined | null | Variable<any, string>,
	securityKeys_aggregate?: ValueTypes["authUserSecurityKeys_aggregate_bool_exp"] | undefined | null | Variable<any, string>,
	ticket?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	ticketExpiresAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	totpSecret?: ValueTypes["String_comparison_exp"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz_comparison_exp"] | undefined | null | Variable<any, string>,
	userProviders?: ValueTypes["authUserProviders_bool_exp"] | undefined | null | Variable<any, string>,
	userProviders_aggregate?: ValueTypes["authUserProviders_aggregate_bool_exp"] | undefined | null | Variable<any, string>
};
	/** unique or primary key constraints on table "auth.users" */
["users_constraint"]:users_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["users_delete_at_path_input"]: {
	metadata?: Array<string> | undefined | null | Variable<any, string>
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["users_delete_elem_input"]: {
	metadata?: number | undefined | null | Variable<any, string>
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["users_delete_key_input"]: {
	metadata?: string | undefined | null | Variable<any, string>
};
	/** input type for inserting data into table "auth.users" */
["users_insert_input"]: {
	activeMfaType?: string | undefined | null | Variable<any, string>,
	avatarUrl?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	currentChallenge?: string | undefined | null | Variable<any, string>,
	defaultRole?: string | undefined | null | Variable<any, string>,
	defaultRoleByRole?: ValueTypes["authRoles_obj_rel_insert_input"] | undefined | null | Variable<any, string>,
	disabled?: boolean | undefined | null | Variable<any, string>,
	displayName?: string | undefined | null | Variable<any, string>,
	email?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	emailVerified?: boolean | undefined | null | Variable<any, string>,
	events?: ValueTypes["events_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	installations?: ValueTypes["installations_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	isAnonymous?: boolean | undefined | null | Variable<any, string>,
	lastSeen?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	locale?: string | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	newEmail?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	otpHash?: string | undefined | null | Variable<any, string>,
	otpHashExpiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	otpMethodLastUsed?: string | undefined | null | Variable<any, string>,
	passwordHash?: string | undefined | null | Variable<any, string>,
	phoneNumber?: string | undefined | null | Variable<any, string>,
	phoneNumberVerified?: boolean | undefined | null | Variable<any, string>,
	refreshTokens?: ValueTypes["authRefreshTokens_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	roles?: ValueTypes["authUserRoles_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	securityKeys?: ValueTypes["authUserSecurityKeys_arr_rel_insert_input"] | undefined | null | Variable<any, string>,
	ticket?: string | undefined | null | Variable<any, string>,
	ticketExpiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	totpSecret?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	userProviders?: ValueTypes["authUserProviders_arr_rel_insert_input"] | undefined | null | Variable<any, string>
};
	/** aggregate max on columns */
["users_max_fields"]: AliasType<{
	activeMfaType?:boolean | `@${string}`,
	avatarUrl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	currentChallenge?:boolean | `@${string}`,
	defaultRole?:boolean | `@${string}`,
	displayName?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	lastSeen?:boolean | `@${string}`,
	locale?:boolean | `@${string}`,
	newEmail?:boolean | `@${string}`,
	otpHash?:boolean | `@${string}`,
	otpHashExpiresAt?:boolean | `@${string}`,
	otpMethodLastUsed?:boolean | `@${string}`,
	passwordHash?:boolean | `@${string}`,
	phoneNumber?:boolean | `@${string}`,
	ticket?:boolean | `@${string}`,
	ticketExpiresAt?:boolean | `@${string}`,
	totpSecret?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.users" */
["users_max_order_by"]: {
	activeMfaType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	avatarUrl?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	currentChallenge?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	defaultRole?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	displayName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	lastSeen?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	locale?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	newEmail?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpHashExpiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpMethodLastUsed?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	passwordHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phoneNumber?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	ticket?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	ticketExpiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	totpSecret?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** aggregate min on columns */
["users_min_fields"]: AliasType<{
	activeMfaType?:boolean | `@${string}`,
	avatarUrl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	currentChallenge?:boolean | `@${string}`,
	defaultRole?:boolean | `@${string}`,
	displayName?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	lastSeen?:boolean | `@${string}`,
	locale?:boolean | `@${string}`,
	newEmail?:boolean | `@${string}`,
	otpHash?:boolean | `@${string}`,
	otpHashExpiresAt?:boolean | `@${string}`,
	otpMethodLastUsed?:boolean | `@${string}`,
	passwordHash?:boolean | `@${string}`,
	phoneNumber?:boolean | `@${string}`,
	ticket?:boolean | `@${string}`,
	ticketExpiresAt?:boolean | `@${string}`,
	totpSecret?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.users" */
["users_min_order_by"]: {
	activeMfaType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	avatarUrl?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	currentChallenge?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	defaultRole?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	displayName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	lastSeen?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	locale?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	newEmail?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpHashExpiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpMethodLastUsed?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	passwordHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phoneNumber?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	ticket?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	ticketExpiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	totpSecret?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>
};
	/** response of any mutation on the table "auth.users" */
["users_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ValueTypes["users"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "auth.users" */
["users_obj_rel_insert_input"]: {
	data: ValueTypes["users_insert_input"] | Variable<any, string>,
	/** upsert condition */
	on_conflict?: ValueTypes["users_on_conflict"] | undefined | null | Variable<any, string>
};
	/** on_conflict condition type for table "auth.users" */
["users_on_conflict"]: {
	constraint: ValueTypes["users_constraint"] | Variable<any, string>,
	update_columns: Array<ValueTypes["users_update_column"]> | Variable<any, string>,
	where?: ValueTypes["users_bool_exp"] | undefined | null | Variable<any, string>
};
	/** Ordering options when selecting data from "auth.users". */
["users_order_by"]: {
	activeMfaType?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	avatarUrl?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	currentChallenge?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	defaultRole?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	defaultRoleByRole?: ValueTypes["authRoles_order_by"] | undefined | null | Variable<any, string>,
	disabled?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	displayName?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	emailVerified?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	events_aggregate?: ValueTypes["events_aggregate_order_by"] | undefined | null | Variable<any, string>,
	id?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	installations_aggregate?: ValueTypes["installations_aggregate_order_by"] | undefined | null | Variable<any, string>,
	isAnonymous?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	lastSeen?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	locale?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	newEmail?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpHashExpiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	otpMethodLastUsed?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	passwordHash?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phoneNumber?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	phoneNumberVerified?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	refreshTokens_aggregate?: ValueTypes["authRefreshTokens_aggregate_order_by"] | undefined | null | Variable<any, string>,
	roles_aggregate?: ValueTypes["authUserRoles_aggregate_order_by"] | undefined | null | Variable<any, string>,
	securityKeys_aggregate?: ValueTypes["authUserSecurityKeys_aggregate_order_by"] | undefined | null | Variable<any, string>,
	ticket?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	ticketExpiresAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	totpSecret?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["order_by"] | undefined | null | Variable<any, string>,
	userProviders_aggregate?: ValueTypes["authUserProviders_aggregate_order_by"] | undefined | null | Variable<any, string>
};
	/** primary key columns input for table: auth.users */
["users_pk_columns_input"]: {
	id: ValueTypes["uuid"] | Variable<any, string>
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["users_prepend_input"]: {
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>
};
	/** select columns of table "auth.users" */
["users_select_column"]:users_select_column;
	/** select "users_aggregate_bool_exp_bool_and_arguments_columns" columns of table "auth.users" */
["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"]:users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "users_aggregate_bool_exp_bool_or_arguments_columns" columns of table "auth.users" */
["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"]:users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "auth.users" */
["users_set_input"]: {
	activeMfaType?: string | undefined | null | Variable<any, string>,
	avatarUrl?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	currentChallenge?: string | undefined | null | Variable<any, string>,
	defaultRole?: string | undefined | null | Variable<any, string>,
	disabled?: boolean | undefined | null | Variable<any, string>,
	displayName?: string | undefined | null | Variable<any, string>,
	email?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	emailVerified?: boolean | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isAnonymous?: boolean | undefined | null | Variable<any, string>,
	lastSeen?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	locale?: string | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	newEmail?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	otpHash?: string | undefined | null | Variable<any, string>,
	otpHashExpiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	otpMethodLastUsed?: string | undefined | null | Variable<any, string>,
	passwordHash?: string | undefined | null | Variable<any, string>,
	phoneNumber?: string | undefined | null | Variable<any, string>,
	phoneNumberVerified?: boolean | undefined | null | Variable<any, string>,
	ticket?: string | undefined | null | Variable<any, string>,
	ticketExpiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	totpSecret?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** Streaming cursor of the table "users" */
["users_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ValueTypes["users_stream_cursor_value_input"] | Variable<any, string>,
	/** cursor ordering */
	ordering?: ValueTypes["cursor_ordering"] | undefined | null | Variable<any, string>
};
	/** Initial value of the column from where the streaming should start */
["users_stream_cursor_value_input"]: {
	activeMfaType?: string | undefined | null | Variable<any, string>,
	avatarUrl?: string | undefined | null | Variable<any, string>,
	createdAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	currentChallenge?: string | undefined | null | Variable<any, string>,
	defaultRole?: string | undefined | null | Variable<any, string>,
	disabled?: boolean | undefined | null | Variable<any, string>,
	displayName?: string | undefined | null | Variable<any, string>,
	email?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	emailVerified?: boolean | undefined | null | Variable<any, string>,
	id?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	isAnonymous?: boolean | undefined | null | Variable<any, string>,
	lastSeen?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	locale?: string | undefined | null | Variable<any, string>,
	metadata?: ValueTypes["jsonb"] | undefined | null | Variable<any, string>,
	newEmail?: ValueTypes["citext"] | undefined | null | Variable<any, string>,
	otpHash?: string | undefined | null | Variable<any, string>,
	otpHashExpiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	otpMethodLastUsed?: string | undefined | null | Variable<any, string>,
	passwordHash?: string | undefined | null | Variable<any, string>,
	phoneNumber?: string | undefined | null | Variable<any, string>,
	phoneNumberVerified?: boolean | undefined | null | Variable<any, string>,
	ticket?: string | undefined | null | Variable<any, string>,
	ticketExpiresAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>,
	totpSecret?: string | undefined | null | Variable<any, string>,
	updatedAt?: ValueTypes["timestamptz"] | undefined | null | Variable<any, string>
};
	/** update columns of table "auth.users" */
["users_update_column"]:users_update_column;
	["users_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ValueTypes["users_append_input"] | undefined | null | Variable<any, string>,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ValueTypes["users_delete_at_path_input"] | undefined | null | Variable<any, string>,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ValueTypes["users_delete_elem_input"] | undefined | null | Variable<any, string>,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ValueTypes["users_delete_key_input"] | undefined | null | Variable<any, string>,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ValueTypes["users_prepend_input"] | undefined | null | Variable<any, string>,
	/** sets the columns of the filtered rows to the given values */
	_set?: ValueTypes["users_set_input"] | undefined | null | Variable<any, string>,
	/** filter the rows which have to be updated */
	where: ValueTypes["users_bool_exp"] | Variable<any, string>
};
	["uuid"]:unknown;
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
	_eq?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["uuid"]> | undefined | null | Variable<any, string>,
	_is_null?: boolean | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["uuid"] | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["uuid"]> | undefined | null | Variable<any, string>
}
  }

export type ResolverInputTypes = {
    ["schema"]: AliasType<{
	query?:ResolverInputTypes["query_root"],
	mutation?:ResolverInputTypes["mutation_root"],
	subscription?:ResolverInputTypes["subscription_root"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
	_eq?: boolean | undefined | null,
	_gt?: boolean | undefined | null,
	_gte?: boolean | undefined | null,
	_in?: Array<boolean> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: boolean | undefined | null,
	_lte?: boolean | undefined | null,
	_neq?: boolean | undefined | null,
	_nin?: Array<boolean> | undefined | null
};
	/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
	_eq?: number | undefined | null,
	_gt?: number | undefined | null,
	_gte?: number | undefined | null,
	_in?: Array<number> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: number | undefined | null,
	_lte?: number | undefined | null,
	_neq?: number | undefined | null,
	_nin?: Array<number> | undefined | null
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
	_eq?: string | undefined | null,
	_gt?: string | undefined | null,
	_gte?: string | undefined | null,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined | null,
	_in?: Array<string> | undefined | null,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined | null,
	_is_null?: boolean | undefined | null,
	/** does the column match the given pattern */
	_like?: string | undefined | null,
	_lt?: string | undefined | null,
	_lte?: string | undefined | null,
	_neq?: string | undefined | null,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined | null,
	_nin?: Array<string> | undefined | null,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined | null,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined | null,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined | null,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined | null,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined | null,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined | null
};
	/** Oauth requests, inserted before redirecting to the provider's site. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviderRequests"]: AliasType<{
	id?:boolean | `@${string}`,
options?: [{	/** JSON select path */
	path?: string | undefined | null},boolean | `@${string}`],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.provider_requests" */
["authProviderRequests_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authProviderRequests_aggregate_fields"],
	nodes?:ResolverInputTypes["authProviderRequests"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.provider_requests" */
["authProviderRequests_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["authProviderRequests_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authProviderRequests_max_fields"],
	min?:ResolverInputTypes["authProviderRequests_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** append existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_append_input"]: {
	options?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** Boolean expression to filter rows from the table "auth.provider_requests". All fields are combined with a logical 'AND'. */
["authProviderRequests_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authProviderRequests_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authProviderRequests_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authProviderRequests_bool_exp"]> | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	options?: ResolverInputTypes["jsonb_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.provider_requests" */
["authProviderRequests_constraint"]:authProviderRequests_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authProviderRequests_delete_at_path_input"]: {
	options?: Array<string> | undefined | null
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authProviderRequests_delete_elem_input"]: {
	options?: number | undefined | null
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authProviderRequests_delete_key_input"]: {
	options?: string | undefined | null
};
	/** input type for inserting data into table "auth.provider_requests" */
["authProviderRequests_insert_input"]: {
	id?: ResolverInputTypes["uuid"] | undefined | null,
	options?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** aggregate max on columns */
["authProviderRequests_max_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authProviderRequests_min_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.provider_requests" */
["authProviderRequests_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authProviderRequests"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.provider_requests" */
["authProviderRequests_on_conflict"]: {
	constraint: ResolverInputTypes["authProviderRequests_constraint"],
	update_columns: Array<ResolverInputTypes["authProviderRequests_update_column"]>,
	where?: ResolverInputTypes["authProviderRequests_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.provider_requests". */
["authProviderRequests_order_by"]: {
	id?: ResolverInputTypes["order_by"] | undefined | null,
	options?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: auth.provider_requests */
["authProviderRequests_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_prepend_input"]: {
	options?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** select columns of table "auth.provider_requests" */
["authProviderRequests_select_column"]:authProviderRequests_select_column;
	/** input type for updating data in table "auth.provider_requests" */
["authProviderRequests_set_input"]: {
	id?: ResolverInputTypes["uuid"] | undefined | null,
	options?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** Streaming cursor of the table "authProviderRequests" */
["authProviderRequests_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authProviderRequests_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authProviderRequests_stream_cursor_value_input"]: {
	id?: ResolverInputTypes["uuid"] | undefined | null,
	options?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** update columns of table "auth.provider_requests" */
["authProviderRequests_update_column"]:authProviderRequests_update_column;
	["authProviderRequests_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["authProviderRequests_append_input"] | undefined | null,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["authProviderRequests_delete_at_path_input"] | undefined | null,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["authProviderRequests_delete_elem_input"] | undefined | null,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["authProviderRequests_delete_key_input"] | undefined | null,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["authProviderRequests_prepend_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authProviderRequests_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authProviderRequests_bool_exp"]
};
	/** List of available Oauth providers. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviders"]: AliasType<{
	id?:boolean | `@${string}`,
userProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders"]],
userProviders_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.providers" */
["authProviders_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authProviders_aggregate_fields"],
	nodes?:ResolverInputTypes["authProviders"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.providers" */
["authProviders_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["authProviders_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authProviders_max_fields"],
	min?:ResolverInputTypes["authProviders_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "auth.providers". All fields are combined with a logical 'AND'. */
["authProviders_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authProviders_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authProviders_bool_exp"]> | undefined | null,
	id?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	userProviders?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null,
	userProviders_aggregate?: ResolverInputTypes["authUserProviders_aggregate_bool_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.providers" */
["authProviders_constraint"]:authProviders_constraint;
	/** input type for inserting data into table "auth.providers" */
["authProviders_insert_input"]: {
	id?: string | undefined | null,
	userProviders?: ResolverInputTypes["authUserProviders_arr_rel_insert_input"] | undefined | null
};
	/** aggregate max on columns */
["authProviders_max_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authProviders_min_fields"]: AliasType<{
	id?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.providers" */
["authProviders_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authProviders"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "auth.providers" */
["authProviders_obj_rel_insert_input"]: {
	data: ResolverInputTypes["authProviders_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["authProviders_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "auth.providers" */
["authProviders_on_conflict"]: {
	constraint: ResolverInputTypes["authProviders_constraint"],
	update_columns: Array<ResolverInputTypes["authProviders_update_column"]>,
	where?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.providers". */
["authProviders_order_by"]: {
	id?: ResolverInputTypes["order_by"] | undefined | null,
	userProviders_aggregate?: ResolverInputTypes["authUserProviders_aggregate_order_by"] | undefined | null
};
	/** primary key columns input for table: auth.providers */
["authProviders_pk_columns_input"]: {
	id: string
};
	/** select columns of table "auth.providers" */
["authProviders_select_column"]:authProviders_select_column;
	/** input type for updating data in table "auth.providers" */
["authProviders_set_input"]: {
	id?: string | undefined | null
};
	/** Streaming cursor of the table "authProviders" */
["authProviders_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authProviders_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authProviders_stream_cursor_value_input"]: {
	id?: string | undefined | null
};
	/** update columns of table "auth.providers" */
["authProviders_update_column"]:authProviders_update_column;
	["authProviders_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authProviders_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authProviders_bool_exp"]
};
	/** columns and relationships of "auth.refresh_token_types" */
["authRefreshTokenTypes"]: AliasType<{
	comment?:boolean | `@${string}`,
refreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens"]],
refreshTokens_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens_aggregate"]],
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authRefreshTokenTypes_aggregate_fields"],
	nodes?:ResolverInputTypes["authRefreshTokenTypes"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["authRefreshTokenTypes_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authRefreshTokenTypes_max_fields"],
	min?:ResolverInputTypes["authRefreshTokenTypes_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "auth.refresh_token_types". All fields are combined with a logical 'AND'. */
["authRefreshTokenTypes_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authRefreshTokenTypes_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authRefreshTokenTypes_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authRefreshTokenTypes_bool_exp"]> | undefined | null,
	comment?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	refreshTokens?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null,
	refreshTokens_aggregate?: ResolverInputTypes["authRefreshTokens_aggregate_bool_exp"] | undefined | null,
	value?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.refresh_token_types" */
["authRefreshTokenTypes_constraint"]:authRefreshTokenTypes_constraint;
	["authRefreshTokenTypes_enum"]:authRefreshTokenTypes_enum;
	/** Boolean expression to compare columns of type "authRefreshTokenTypes_enum". All fields are combined with logical 'AND'. */
["authRefreshTokenTypes_enum_comparison_exp"]: {
	_eq?: ResolverInputTypes["authRefreshTokenTypes_enum"] | undefined | null,
	_in?: Array<ResolverInputTypes["authRefreshTokenTypes_enum"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_neq?: ResolverInputTypes["authRefreshTokenTypes_enum"] | undefined | null,
	_nin?: Array<ResolverInputTypes["authRefreshTokenTypes_enum"]> | undefined | null
};
	/** input type for inserting data into table "auth.refresh_token_types" */
["authRefreshTokenTypes_insert_input"]: {
	comment?: string | undefined | null,
	refreshTokens?: ResolverInputTypes["authRefreshTokens_arr_rel_insert_input"] | undefined | null,
	value?: string | undefined | null
};
	/** aggregate max on columns */
["authRefreshTokenTypes_max_fields"]: AliasType<{
	comment?:boolean | `@${string}`,
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authRefreshTokenTypes_min_fields"]: AliasType<{
	comment?:boolean | `@${string}`,
	value?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.refresh_token_types" */
["authRefreshTokenTypes_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authRefreshTokenTypes"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.refresh_token_types" */
["authRefreshTokenTypes_on_conflict"]: {
	constraint: ResolverInputTypes["authRefreshTokenTypes_constraint"],
	update_columns: Array<ResolverInputTypes["authRefreshTokenTypes_update_column"]>,
	where?: ResolverInputTypes["authRefreshTokenTypes_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.refresh_token_types". */
["authRefreshTokenTypes_order_by"]: {
	comment?: ResolverInputTypes["order_by"] | undefined | null,
	refreshTokens_aggregate?: ResolverInputTypes["authRefreshTokens_aggregate_order_by"] | undefined | null,
	value?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: auth.refresh_token_types */
["authRefreshTokenTypes_pk_columns_input"]: {
	value: string
};
	/** select columns of table "auth.refresh_token_types" */
["authRefreshTokenTypes_select_column"]:authRefreshTokenTypes_select_column;
	/** input type for updating data in table "auth.refresh_token_types" */
["authRefreshTokenTypes_set_input"]: {
	comment?: string | undefined | null,
	value?: string | undefined | null
};
	/** Streaming cursor of the table "authRefreshTokenTypes" */
["authRefreshTokenTypes_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authRefreshTokenTypes_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokenTypes_stream_cursor_value_input"]: {
	comment?: string | undefined | null,
	value?: string | undefined | null
};
	/** update columns of table "auth.refresh_token_types" */
["authRefreshTokenTypes_update_column"]:authRefreshTokenTypes_update_column;
	["authRefreshTokenTypes_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRefreshTokenTypes_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authRefreshTokenTypes_bool_exp"]
};
	/** User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRefreshTokens"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	expiresAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
metadata?: [{	/** JSON select path */
	path?: string | undefined | null},boolean | `@${string}`],
	refreshTokenHash?:boolean | `@${string}`,
	type?:boolean | `@${string}`,
	/** An object relationship */
	user?:ResolverInputTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.refresh_tokens" */
["authRefreshTokens_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authRefreshTokens_aggregate_fields"],
	nodes?:ResolverInputTypes["authRefreshTokens"],
		__typename?: boolean | `@${string}`
}>;
	["authRefreshTokens_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["authRefreshTokens_aggregate_bool_exp_count"] | undefined | null
};
	["authRefreshTokens_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.refresh_tokens" */
["authRefreshTokens_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authRefreshTokens_max_fields"],
	min?:ResolverInputTypes["authRefreshTokens_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.refresh_tokens" */
["authRefreshTokens_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["authRefreshTokens_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["authRefreshTokens_min_order_by"] | undefined | null
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_append_input"]: {
	metadata?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** input type for inserting array relation for remote table "auth.refresh_tokens" */
["authRefreshTokens_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["authRefreshTokens_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRefreshTokens_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "auth.refresh_tokens". All fields are combined with a logical 'AND'. */
["authRefreshTokens_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authRefreshTokens_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authRefreshTokens_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	expiresAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	metadata?: ResolverInputTypes["jsonb_comparison_exp"] | undefined | null,
	refreshTokenHash?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	type?: ResolverInputTypes["authRefreshTokenTypes_enum_comparison_exp"] | undefined | null,
	user?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.refresh_tokens" */
["authRefreshTokens_constraint"]:authRefreshTokens_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authRefreshTokens_delete_at_path_input"]: {
	metadata?: Array<string> | undefined | null
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authRefreshTokens_delete_elem_input"]: {
	metadata?: number | undefined | null
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authRefreshTokens_delete_key_input"]: {
	metadata?: string | undefined | null
};
	/** input type for inserting data into table "auth.refresh_tokens" */
["authRefreshTokens_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	expiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	metadata?: ResolverInputTypes["jsonb"] | undefined | null,
	refreshTokenHash?: string | undefined | null,
	type?: ResolverInputTypes["authRefreshTokenTypes_enum"] | undefined | null,
	user?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["authRefreshTokens_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	expiresAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	refreshTokenHash?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_max_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	expiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	refreshTokenHash?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["authRefreshTokens_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	expiresAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	refreshTokenHash?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_min_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	expiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	refreshTokenHash?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "auth.refresh_tokens" */
["authRefreshTokens_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authRefreshTokens"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.refresh_tokens" */
["authRefreshTokens_on_conflict"]: {
	constraint: ResolverInputTypes["authRefreshTokens_constraint"],
	update_columns: Array<ResolverInputTypes["authRefreshTokens_update_column"]>,
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.refresh_tokens". */
["authRefreshTokens_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	expiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	metadata?: ResolverInputTypes["order_by"] | undefined | null,
	refreshTokenHash?: ResolverInputTypes["order_by"] | undefined | null,
	type?: ResolverInputTypes["order_by"] | undefined | null,
	user?: ResolverInputTypes["users_order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: auth.refresh_tokens */
["authRefreshTokens_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_prepend_input"]: {
	metadata?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** select columns of table "auth.refresh_tokens" */
["authRefreshTokens_select_column"]:authRefreshTokens_select_column;
	/** input type for updating data in table "auth.refresh_tokens" */
["authRefreshTokens_set_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	expiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	metadata?: ResolverInputTypes["jsonb"] | undefined | null,
	refreshTokenHash?: string | undefined | null,
	type?: ResolverInputTypes["authRefreshTokenTypes_enum"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** Streaming cursor of the table "authRefreshTokens" */
["authRefreshTokens_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authRefreshTokens_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokens_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	expiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	metadata?: ResolverInputTypes["jsonb"] | undefined | null,
	refreshTokenHash?: string | undefined | null,
	type?: ResolverInputTypes["authRefreshTokenTypes_enum"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** update columns of table "auth.refresh_tokens" */
["authRefreshTokens_update_column"]:authRefreshTokens_update_column;
	["authRefreshTokens_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["authRefreshTokens_append_input"] | undefined | null,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["authRefreshTokens_delete_at_path_input"] | undefined | null,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["authRefreshTokens_delete_elem_input"] | undefined | null,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["authRefreshTokens_delete_key_input"] | undefined | null,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["authRefreshTokens_prepend_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRefreshTokens_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authRefreshTokens_bool_exp"]
};
	/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRoles"]: AliasType<{
	role?:boolean | `@${string}`,
userRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles"]],
userRoles_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles_aggregate"]],
usersByDefaultRole?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["users_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null},ResolverInputTypes["users"]],
usersByDefaultRole_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["users_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null},ResolverInputTypes["users_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.roles" */
["authRoles_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authRoles_aggregate_fields"],
	nodes?:ResolverInputTypes["authRoles"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "auth.roles" */
["authRoles_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["authRoles_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authRoles_max_fields"],
	min?:ResolverInputTypes["authRoles_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "auth.roles". All fields are combined with a logical 'AND'. */
["authRoles_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authRoles_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authRoles_bool_exp"]> | undefined | null,
	role?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	userRoles?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null,
	userRoles_aggregate?: ResolverInputTypes["authUserRoles_aggregate_bool_exp"] | undefined | null,
	usersByDefaultRole?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	usersByDefaultRole_aggregate?: ResolverInputTypes["users_aggregate_bool_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.roles" */
["authRoles_constraint"]:authRoles_constraint;
	/** input type for inserting data into table "auth.roles" */
["authRoles_insert_input"]: {
	role?: string | undefined | null,
	userRoles?: ResolverInputTypes["authUserRoles_arr_rel_insert_input"] | undefined | null,
	usersByDefaultRole?: ResolverInputTypes["users_arr_rel_insert_input"] | undefined | null
};
	/** aggregate max on columns */
["authRoles_max_fields"]: AliasType<{
	role?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["authRoles_min_fields"]: AliasType<{
	role?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "auth.roles" */
["authRoles_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authRoles"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "auth.roles" */
["authRoles_obj_rel_insert_input"]: {
	data: ResolverInputTypes["authRoles_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRoles_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "auth.roles" */
["authRoles_on_conflict"]: {
	constraint: ResolverInputTypes["authRoles_constraint"],
	update_columns: Array<ResolverInputTypes["authRoles_update_column"]>,
	where?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.roles". */
["authRoles_order_by"]: {
	role?: ResolverInputTypes["order_by"] | undefined | null,
	userRoles_aggregate?: ResolverInputTypes["authUserRoles_aggregate_order_by"] | undefined | null,
	usersByDefaultRole_aggregate?: ResolverInputTypes["users_aggregate_order_by"] | undefined | null
};
	/** primary key columns input for table: auth.roles */
["authRoles_pk_columns_input"]: {
	role: string
};
	/** select columns of table "auth.roles" */
["authRoles_select_column"]:authRoles_select_column;
	/** input type for updating data in table "auth.roles" */
["authRoles_set_input"]: {
	role?: string | undefined | null
};
	/** Streaming cursor of the table "authRoles" */
["authRoles_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authRoles_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authRoles_stream_cursor_value_input"]: {
	role?: string | undefined | null
};
	/** update columns of table "auth.roles" */
["authRoles_update_column"]:authRoles_update_column;
	["authRoles_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRoles_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authRoles_bool_exp"]
};
	/** Active providers for a given user. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserProviders"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	/** An object relationship */
	provider?:ResolverInputTypes["authProviders"],
	providerId?:boolean | `@${string}`,
	providerUserId?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ResolverInputTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.user_providers" */
["authUserProviders_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authUserProviders_aggregate_fields"],
	nodes?:ResolverInputTypes["authUserProviders"],
		__typename?: boolean | `@${string}`
}>;
	["authUserProviders_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["authUserProviders_aggregate_bool_exp_count"] | undefined | null
};
	["authUserProviders_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_providers" */
["authUserProviders_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authUserProviders_max_fields"],
	min?:ResolverInputTypes["authUserProviders_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.user_providers" */
["authUserProviders_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["authUserProviders_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["authUserProviders_min_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "auth.user_providers" */
["authUserProviders_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["authUserProviders_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserProviders_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "auth.user_providers". All fields are combined with a logical 'AND'. */
["authUserProviders_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authUserProviders_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authUserProviders_bool_exp"]> | undefined | null,
	accessToken?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	provider?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null,
	providerId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	providerUserId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	refreshToken?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	user?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.user_providers" */
["authUserProviders_constraint"]:authUserProviders_constraint;
	/** input type for inserting data into table "auth.user_providers" */
["authUserProviders_insert_input"]: {
	accessToken?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	provider?: ResolverInputTypes["authProviders_obj_rel_insert_input"] | undefined | null,
	providerId?: string | undefined | null,
	providerUserId?: string | undefined | null,
	refreshToken?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	user?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["authUserProviders_max_fields"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	providerId?:boolean | `@${string}`,
	providerUserId?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.user_providers" */
["authUserProviders_max_order_by"]: {
	accessToken?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	providerId?: ResolverInputTypes["order_by"] | undefined | null,
	providerUserId?: ResolverInputTypes["order_by"] | undefined | null,
	refreshToken?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["authUserProviders_min_fields"]: AliasType<{
	accessToken?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	providerId?:boolean | `@${string}`,
	providerUserId?:boolean | `@${string}`,
	refreshToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.user_providers" */
["authUserProviders_min_order_by"]: {
	accessToken?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	providerId?: ResolverInputTypes["order_by"] | undefined | null,
	providerUserId?: ResolverInputTypes["order_by"] | undefined | null,
	refreshToken?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "auth.user_providers" */
["authUserProviders_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authUserProviders"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.user_providers" */
["authUserProviders_on_conflict"]: {
	constraint: ResolverInputTypes["authUserProviders_constraint"],
	update_columns: Array<ResolverInputTypes["authUserProviders_update_column"]>,
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.user_providers". */
["authUserProviders_order_by"]: {
	accessToken?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	provider?: ResolverInputTypes["authProviders_order_by"] | undefined | null,
	providerId?: ResolverInputTypes["order_by"] | undefined | null,
	providerUserId?: ResolverInputTypes["order_by"] | undefined | null,
	refreshToken?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	user?: ResolverInputTypes["users_order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: auth.user_providers */
["authUserProviders_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "auth.user_providers" */
["authUserProviders_select_column"]:authUserProviders_select_column;
	/** input type for updating data in table "auth.user_providers" */
["authUserProviders_set_input"]: {
	accessToken?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	providerId?: string | undefined | null,
	providerUserId?: string | undefined | null,
	refreshToken?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** Streaming cursor of the table "authUserProviders" */
["authUserProviders_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authUserProviders_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authUserProviders_stream_cursor_value_input"]: {
	accessToken?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	providerId?: string | undefined | null,
	providerUserId?: string | undefined | null,
	refreshToken?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** update columns of table "auth.user_providers" */
["authUserProviders_update_column"]:authUserProviders_update_column;
	["authUserProviders_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserProviders_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authUserProviders_bool_exp"]
};
	/** Roles of users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserRoles"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	/** An object relationship */
	roleByRole?:ResolverInputTypes["authRoles"],
	/** An object relationship */
	user?:ResolverInputTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.user_roles" */
["authUserRoles_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authUserRoles_aggregate_fields"],
	nodes?:ResolverInputTypes["authUserRoles"],
		__typename?: boolean | `@${string}`
}>;
	["authUserRoles_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["authUserRoles_aggregate_bool_exp_count"] | undefined | null
};
	["authUserRoles_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_roles" */
["authUserRoles_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authUserRoles_max_fields"],
	min?:ResolverInputTypes["authUserRoles_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.user_roles" */
["authUserRoles_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["authUserRoles_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["authUserRoles_min_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "auth.user_roles" */
["authUserRoles_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["authUserRoles_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserRoles_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "auth.user_roles". All fields are combined with a logical 'AND'. */
["authUserRoles_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authUserRoles_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authUserRoles_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	role?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	roleByRole?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null,
	user?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.user_roles" */
["authUserRoles_constraint"]:authUserRoles_constraint;
	/** input type for inserting data into table "auth.user_roles" */
["authUserRoles_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	role?: string | undefined | null,
	roleByRole?: ResolverInputTypes["authRoles_obj_rel_insert_input"] | undefined | null,
	user?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["authUserRoles_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.user_roles" */
["authUserRoles_max_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["authUserRoles_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.user_roles" */
["authUserRoles_min_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "auth.user_roles" */
["authUserRoles_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authUserRoles"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.user_roles" */
["authUserRoles_on_conflict"]: {
	constraint: ResolverInputTypes["authUserRoles_constraint"],
	update_columns: Array<ResolverInputTypes["authUserRoles_update_column"]>,
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.user_roles". */
["authUserRoles_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	roleByRole?: ResolverInputTypes["authRoles_order_by"] | undefined | null,
	user?: ResolverInputTypes["users_order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: auth.user_roles */
["authUserRoles_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "auth.user_roles" */
["authUserRoles_select_column"]:authUserRoles_select_column;
	/** input type for updating data in table "auth.user_roles" */
["authUserRoles_set_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	role?: string | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** Streaming cursor of the table "authUserRoles" */
["authUserRoles_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authUserRoles_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authUserRoles_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	role?: string | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** update columns of table "auth.user_roles" */
["authUserRoles_update_column"]:authUserRoles_update_column;
	["authUserRoles_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserRoles_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authUserRoles_bool_exp"]
};
	/** User webauthn security keys. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserSecurityKeys"]: AliasType<{
	counter?:boolean | `@${string}`,
	credentialId?:boolean | `@${string}`,
	credentialPublicKey?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	nickname?:boolean | `@${string}`,
	transports?:boolean | `@${string}`,
	/** An object relationship */
	user?:ResolverInputTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["authUserSecurityKeys_aggregate_fields"],
	nodes?:ResolverInputTypes["authUserSecurityKeys"],
		__typename?: boolean | `@${string}`
}>;
	["authUserSecurityKeys_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["authUserSecurityKeys_aggregate_bool_exp_count"] | undefined | null
};
	["authUserSecurityKeys_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["authUserSecurityKeys_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["authUserSecurityKeys_max_fields"],
	min?:ResolverInputTypes["authUserSecurityKeys_min_fields"],
	stddev?:ResolverInputTypes["authUserSecurityKeys_stddev_fields"],
	stddev_pop?:ResolverInputTypes["authUserSecurityKeys_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["authUserSecurityKeys_stddev_samp_fields"],
	sum?:ResolverInputTypes["authUserSecurityKeys_sum_fields"],
	var_pop?:ResolverInputTypes["authUserSecurityKeys_var_pop_fields"],
	var_samp?:ResolverInputTypes["authUserSecurityKeys_var_samp_fields"],
	variance?:ResolverInputTypes["authUserSecurityKeys_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_order_by"]: {
	avg?: ResolverInputTypes["authUserSecurityKeys_avg_order_by"] | undefined | null,
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["authUserSecurityKeys_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["authUserSecurityKeys_min_order_by"] | undefined | null,
	stddev?: ResolverInputTypes["authUserSecurityKeys_stddev_order_by"] | undefined | null,
	stddev_pop?: ResolverInputTypes["authUserSecurityKeys_stddev_pop_order_by"] | undefined | null,
	stddev_samp?: ResolverInputTypes["authUserSecurityKeys_stddev_samp_order_by"] | undefined | null,
	sum?: ResolverInputTypes["authUserSecurityKeys_sum_order_by"] | undefined | null,
	var_pop?: ResolverInputTypes["authUserSecurityKeys_var_pop_order_by"] | undefined | null,
	var_samp?: ResolverInputTypes["authUserSecurityKeys_var_samp_order_by"] | undefined | null,
	variance?: ResolverInputTypes["authUserSecurityKeys_variance_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "auth.user_security_keys" */
["authUserSecurityKeys_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["authUserSecurityKeys_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserSecurityKeys_on_conflict"] | undefined | null
};
	/** aggregate avg on columns */
["authUserSecurityKeys_avg_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_avg_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Boolean expression to filter rows from the table "auth.user_security_keys". All fields are combined with a logical 'AND'. */
["authUserSecurityKeys_bool_exp"]: {
	_and?: Array<ResolverInputTypes["authUserSecurityKeys_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["authUserSecurityKeys_bool_exp"]> | undefined | null,
	counter?: ResolverInputTypes["bigint_comparison_exp"] | undefined | null,
	credentialId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	credentialPublicKey?: ResolverInputTypes["bytea_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	nickname?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	transports?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	user?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.user_security_keys" */
["authUserSecurityKeys_constraint"]:authUserSecurityKeys_constraint;
	/** input type for incrementing numeric columns in table "auth.user_security_keys" */
["authUserSecurityKeys_inc_input"]: {
	counter?: ResolverInputTypes["bigint"] | undefined | null
};
	/** input type for inserting data into table "auth.user_security_keys" */
["authUserSecurityKeys_insert_input"]: {
	counter?: ResolverInputTypes["bigint"] | undefined | null,
	credentialId?: string | undefined | null,
	credentialPublicKey?: ResolverInputTypes["bytea"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	nickname?: string | undefined | null,
	transports?: string | undefined | null,
	user?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["authUserSecurityKeys_max_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
	credentialId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	nickname?:boolean | `@${string}`,
	transports?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_max_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null,
	credentialId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	nickname?: ResolverInputTypes["order_by"] | undefined | null,
	transports?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["authUserSecurityKeys_min_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
	credentialId?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	nickname?:boolean | `@${string}`,
	transports?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_min_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null,
	credentialId?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	nickname?: ResolverInputTypes["order_by"] | undefined | null,
	transports?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "auth.user_security_keys" */
["authUserSecurityKeys_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["authUserSecurityKeys"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "auth.user_security_keys" */
["authUserSecurityKeys_on_conflict"]: {
	constraint: ResolverInputTypes["authUserSecurityKeys_constraint"],
	update_columns: Array<ResolverInputTypes["authUserSecurityKeys_update_column"]>,
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.user_security_keys". */
["authUserSecurityKeys_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null,
	credentialId?: ResolverInputTypes["order_by"] | undefined | null,
	credentialPublicKey?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	nickname?: ResolverInputTypes["order_by"] | undefined | null,
	transports?: ResolverInputTypes["order_by"] | undefined | null,
	user?: ResolverInputTypes["users_order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: auth.user_security_keys */
["authUserSecurityKeys_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "auth.user_security_keys" */
["authUserSecurityKeys_select_column"]:authUserSecurityKeys_select_column;
	/** input type for updating data in table "auth.user_security_keys" */
["authUserSecurityKeys_set_input"]: {
	counter?: ResolverInputTypes["bigint"] | undefined | null,
	credentialId?: string | undefined | null,
	credentialPublicKey?: ResolverInputTypes["bytea"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	nickname?: string | undefined | null,
	transports?: string | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["authUserSecurityKeys_stddev_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_pop on columns */
["authUserSecurityKeys_stddev_pop_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_pop_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_samp on columns */
["authUserSecurityKeys_stddev_samp_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_samp_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Streaming cursor of the table "authUserSecurityKeys" */
["authUserSecurityKeys_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["authUserSecurityKeys_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["authUserSecurityKeys_stream_cursor_value_input"]: {
	counter?: ResolverInputTypes["bigint"] | undefined | null,
	credentialId?: string | undefined | null,
	credentialPublicKey?: ResolverInputTypes["bytea"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	nickname?: string | undefined | null,
	transports?: string | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["authUserSecurityKeys_sum_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_sum_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	/** update columns of table "auth.user_security_keys" */
["authUserSecurityKeys_update_column"]:authUserSecurityKeys_update_column;
	["authUserSecurityKeys_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["authUserSecurityKeys_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserSecurityKeys_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authUserSecurityKeys_bool_exp"]
};
	/** aggregate var_pop on columns */
["authUserSecurityKeys_var_pop_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_pop_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate var_samp on columns */
["authUserSecurityKeys_var_samp_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_samp_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate variance on columns */
["authUserSecurityKeys_variance_fields"]: AliasType<{
	counter?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_variance_order_by"]: {
	counter?: ResolverInputTypes["order_by"] | undefined | null
};
	["bigint"]:unknown;
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
	_eq?: ResolverInputTypes["bigint"] | undefined | null,
	_gt?: ResolverInputTypes["bigint"] | undefined | null,
	_gte?: ResolverInputTypes["bigint"] | undefined | null,
	_in?: Array<ResolverInputTypes["bigint"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["bigint"] | undefined | null,
	_lte?: ResolverInputTypes["bigint"] | undefined | null,
	_neq?: ResolverInputTypes["bigint"] | undefined | null,
	_nin?: Array<ResolverInputTypes["bigint"]> | undefined | null
};
	/** columns and relationships of "storage.buckets" */
["buckets"]: AliasType<{
	cacheControl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	downloadExpiration?:boolean | `@${string}`,
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null},ResolverInputTypes["files"]],
files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null},ResolverInputTypes["files_aggregate"]],
	id?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
	presignedUrlsEnabled?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "storage.buckets" */
["buckets_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["buckets_aggregate_fields"],
	nodes?:ResolverInputTypes["buckets"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "storage.buckets" */
["buckets_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["buckets_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["buckets_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["buckets_max_fields"],
	min?:ResolverInputTypes["buckets_min_fields"],
	stddev?:ResolverInputTypes["buckets_stddev_fields"],
	stddev_pop?:ResolverInputTypes["buckets_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["buckets_stddev_samp_fields"],
	sum?:ResolverInputTypes["buckets_sum_fields"],
	var_pop?:ResolverInputTypes["buckets_var_pop_fields"],
	var_samp?:ResolverInputTypes["buckets_var_samp_fields"],
	variance?:ResolverInputTypes["buckets_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate avg on columns */
["buckets_avg_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "storage.buckets". All fields are combined with a logical 'AND'. */
["buckets_bool_exp"]: {
	_and?: Array<ResolverInputTypes["buckets_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["buckets_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["buckets_bool_exp"]> | undefined | null,
	cacheControl?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	downloadExpiration?: ResolverInputTypes["Int_comparison_exp"] | undefined | null,
	files?: ResolverInputTypes["files_bool_exp"] | undefined | null,
	files_aggregate?: ResolverInputTypes["files_aggregate_bool_exp"] | undefined | null,
	id?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	maxUploadFileSize?: ResolverInputTypes["Int_comparison_exp"] | undefined | null,
	minUploadFileSize?: ResolverInputTypes["Int_comparison_exp"] | undefined | null,
	presignedUrlsEnabled?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "storage.buckets" */
["buckets_constraint"]:buckets_constraint;
	/** input type for incrementing numeric columns in table "storage.buckets" */
["buckets_inc_input"]: {
	downloadExpiration?: number | undefined | null,
	maxUploadFileSize?: number | undefined | null,
	minUploadFileSize?: number | undefined | null
};
	/** input type for inserting data into table "storage.buckets" */
["buckets_insert_input"]: {
	cacheControl?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	downloadExpiration?: number | undefined | null,
	files?: ResolverInputTypes["files_arr_rel_insert_input"] | undefined | null,
	id?: string | undefined | null,
	maxUploadFileSize?: number | undefined | null,
	minUploadFileSize?: number | undefined | null,
	presignedUrlsEnabled?: boolean | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** aggregate max on columns */
["buckets_max_fields"]: AliasType<{
	cacheControl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	downloadExpiration?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["buckets_min_fields"]: AliasType<{
	cacheControl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	downloadExpiration?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "storage.buckets" */
["buckets_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["buckets"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "storage.buckets" */
["buckets_obj_rel_insert_input"]: {
	data: ResolverInputTypes["buckets_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["buckets_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "storage.buckets" */
["buckets_on_conflict"]: {
	constraint: ResolverInputTypes["buckets_constraint"],
	update_columns: Array<ResolverInputTypes["buckets_update_column"]>,
	where?: ResolverInputTypes["buckets_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "storage.buckets". */
["buckets_order_by"]: {
	cacheControl?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	downloadExpiration?: ResolverInputTypes["order_by"] | undefined | null,
	files_aggregate?: ResolverInputTypes["files_aggregate_order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	maxUploadFileSize?: ResolverInputTypes["order_by"] | undefined | null,
	minUploadFileSize?: ResolverInputTypes["order_by"] | undefined | null,
	presignedUrlsEnabled?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: storage.buckets */
["buckets_pk_columns_input"]: {
	id: string
};
	/** select columns of table "storage.buckets" */
["buckets_select_column"]:buckets_select_column;
	/** input type for updating data in table "storage.buckets" */
["buckets_set_input"]: {
	cacheControl?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	downloadExpiration?: number | undefined | null,
	id?: string | undefined | null,
	maxUploadFileSize?: number | undefined | null,
	minUploadFileSize?: number | undefined | null,
	presignedUrlsEnabled?: boolean | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** aggregate stddev on columns */
["buckets_stddev_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_pop on columns */
["buckets_stddev_pop_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate stddev_samp on columns */
["buckets_stddev_samp_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** Streaming cursor of the table "buckets" */
["buckets_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["buckets_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["buckets_stream_cursor_value_input"]: {
	cacheControl?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	downloadExpiration?: number | undefined | null,
	id?: string | undefined | null,
	maxUploadFileSize?: number | undefined | null,
	minUploadFileSize?: number | undefined | null,
	presignedUrlsEnabled?: boolean | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** aggregate sum on columns */
["buckets_sum_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** update columns of table "storage.buckets" */
["buckets_update_column"]:buckets_update_column;
	["buckets_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["buckets_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["buckets_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["buckets_bool_exp"]
};
	/** aggregate var_pop on columns */
["buckets_var_pop_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate var_samp on columns */
["buckets_var_samp_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate variance on columns */
["buckets_variance_fields"]: AliasType<{
	downloadExpiration?:boolean | `@${string}`,
	maxUploadFileSize?:boolean | `@${string}`,
	minUploadFileSize?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["bytea"]:unknown;
	/** Boolean expression to compare columns of type "bytea". All fields are combined with logical 'AND'. */
["bytea_comparison_exp"]: {
	_eq?: ResolverInputTypes["bytea"] | undefined | null,
	_gt?: ResolverInputTypes["bytea"] | undefined | null,
	_gte?: ResolverInputTypes["bytea"] | undefined | null,
	_in?: Array<ResolverInputTypes["bytea"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["bytea"] | undefined | null,
	_lte?: ResolverInputTypes["bytea"] | undefined | null,
	_neq?: ResolverInputTypes["bytea"] | undefined | null,
	_nin?: Array<ResolverInputTypes["bytea"]> | undefined | null
};
	["citext"]:unknown;
	/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
["citext_comparison_exp"]: {
	_eq?: ResolverInputTypes["citext"] | undefined | null,
	_gt?: ResolverInputTypes["citext"] | undefined | null,
	_gte?: ResolverInputTypes["citext"] | undefined | null,
	/** does the column match the given case-insensitive pattern */
	_ilike?: ResolverInputTypes["citext"] | undefined | null,
	_in?: Array<ResolverInputTypes["citext"]> | undefined | null,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: ResolverInputTypes["citext"] | undefined | null,
	_is_null?: boolean | undefined | null,
	/** does the column match the given pattern */
	_like?: ResolverInputTypes["citext"] | undefined | null,
	_lt?: ResolverInputTypes["citext"] | undefined | null,
	_lte?: ResolverInputTypes["citext"] | undefined | null,
	_neq?: ResolverInputTypes["citext"] | undefined | null,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: ResolverInputTypes["citext"] | undefined | null,
	_nin?: Array<ResolverInputTypes["citext"]> | undefined | null,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: ResolverInputTypes["citext"] | undefined | null,
	/** does the column NOT match the given pattern */
	_nlike?: ResolverInputTypes["citext"] | undefined | null,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: ResolverInputTypes["citext"] | undefined | null,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: ResolverInputTypes["citext"] | undefined | null,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: ResolverInputTypes["citext"] | undefined | null,
	/** does the column match the given SQL regular expression */
	_similar?: ResolverInputTypes["citext"] | undefined | null
};
	/** ordering argument of a cursor */
["cursor_ordering"]:cursor_ordering;
	/** columns and relationships of "event_files" */
["event_files"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	/** An object relationship */
	event?:ResolverInputTypes["events"],
	eventId?:boolean | `@${string}`,
	/** An object relationship */
	file?:ResolverInputTypes["files"],
	fileId?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ResolverInputTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "event_files" */
["event_files_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["event_files_aggregate_fields"],
	nodes?:ResolverInputTypes["event_files"],
		__typename?: boolean | `@${string}`
}>;
	["event_files_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["event_files_aggregate_bool_exp_count"] | undefined | null
};
	["event_files_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["event_files_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "event_files" */
["event_files_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["event_files_max_fields"],
	min?:ResolverInputTypes["event_files_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "event_files" */
["event_files_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["event_files_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["event_files_min_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "event_files" */
["event_files_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["event_files_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["event_files_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "event_files". All fields are combined with a logical 'AND'. */
["event_files_bool_exp"]: {
	_and?: Array<ResolverInputTypes["event_files_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["event_files_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["event_files_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	event?: ResolverInputTypes["events_bool_exp"] | undefined | null,
	eventId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	file?: ResolverInputTypes["files_bool_exp"] | undefined | null,
	fileId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	user?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "event_files" */
["event_files_constraint"]:event_files_constraint;
	/** input type for inserting data into table "event_files" */
["event_files_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	event?: ResolverInputTypes["events_obj_rel_insert_input"] | undefined | null,
	eventId?: ResolverInputTypes["uuid"] | undefined | null,
	file?: ResolverInputTypes["files_obj_rel_insert_input"] | undefined | null,
	fileId?: ResolverInputTypes["uuid"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	user?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["event_files_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	fileId?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "event_files" */
["event_files_max_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	eventId?: ResolverInputTypes["order_by"] | undefined | null,
	fileId?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["event_files_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	fileId?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "event_files" */
["event_files_min_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	eventId?: ResolverInputTypes["order_by"] | undefined | null,
	fileId?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "event_files" */
["event_files_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["event_files"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "event_files" */
["event_files_on_conflict"]: {
	constraint: ResolverInputTypes["event_files_constraint"],
	update_columns: Array<ResolverInputTypes["event_files_update_column"]>,
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "event_files". */
["event_files_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	event?: ResolverInputTypes["events_order_by"] | undefined | null,
	eventId?: ResolverInputTypes["order_by"] | undefined | null,
	file?: ResolverInputTypes["files_order_by"] | undefined | null,
	fileId?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	user?: ResolverInputTypes["users_order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: event_files */
["event_files_pk_columns_input"]: {
	eventId: ResolverInputTypes["uuid"],
	fileId: ResolverInputTypes["uuid"]
};
	/** select columns of table "event_files" */
["event_files_select_column"]:event_files_select_column;
	/** input type for updating data in table "event_files" */
["event_files_set_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	eventId?: ResolverInputTypes["uuid"] | undefined | null,
	fileId?: ResolverInputTypes["uuid"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** Streaming cursor of the table "event_files" */
["event_files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["event_files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["event_files_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	eventId?: ResolverInputTypes["uuid"] | undefined | null,
	fileId?: ResolverInputTypes["uuid"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** update columns of table "event_files" */
["event_files_update_column"]:event_files_update_column;
	["event_files_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["event_files_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["event_files_bool_exp"]
};
	/** columns and relationships of "event_participants" */
["event_participants"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	/** An object relationship */
	event?:ResolverInputTypes["events"],
	eventId?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ResolverInputTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "event_participants" */
["event_participants_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["event_participants_aggregate_fields"],
	nodes?:ResolverInputTypes["event_participants"],
		__typename?: boolean | `@${string}`
}>;
	["event_participants_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["event_participants_aggregate_bool_exp_count"] | undefined | null
};
	["event_participants_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "event_participants" */
["event_participants_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["event_participants_max_fields"],
	min?:ResolverInputTypes["event_participants_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "event_participants" */
["event_participants_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["event_participants_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["event_participants_min_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "event_participants" */
["event_participants_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["event_participants_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["event_participants_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "event_participants". All fields are combined with a logical 'AND'. */
["event_participants_bool_exp"]: {
	_and?: Array<ResolverInputTypes["event_participants_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["event_participants_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	event?: ResolverInputTypes["events_bool_exp"] | undefined | null,
	eventId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	role?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	user?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "event_participants" */
["event_participants_constraint"]:event_participants_constraint;
	/** input type for inserting data into table "event_participants" */
["event_participants_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	event?: ResolverInputTypes["events_obj_rel_insert_input"] | undefined | null,
	eventId?: ResolverInputTypes["uuid"] | undefined | null,
	role?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	user?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["event_participants_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "event_participants" */
["event_participants_max_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	eventId?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["event_participants_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	eventId?:boolean | `@${string}`,
	role?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "event_participants" */
["event_participants_min_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	eventId?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "event_participants" */
["event_participants_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["event_participants"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "event_participants" */
["event_participants_on_conflict"]: {
	constraint: ResolverInputTypes["event_participants_constraint"],
	update_columns: Array<ResolverInputTypes["event_participants_update_column"]>,
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "event_participants". */
["event_participants_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	event?: ResolverInputTypes["events_order_by"] | undefined | null,
	eventId?: ResolverInputTypes["order_by"] | undefined | null,
	role?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	user?: ResolverInputTypes["users_order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: event_participants */
["event_participants_pk_columns_input"]: {
	eventId: ResolverInputTypes["uuid"],
	userId: ResolverInputTypes["uuid"]
};
	/** select columns of table "event_participants" */
["event_participants_select_column"]:event_participants_select_column;
	/** input type for updating data in table "event_participants" */
["event_participants_set_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	eventId?: ResolverInputTypes["uuid"] | undefined | null,
	role?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** Streaming cursor of the table "event_participants" */
["event_participants_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["event_participants_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["event_participants_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	eventId?: ResolverInputTypes["uuid"] | undefined | null,
	role?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** update columns of table "event_participants" */
["event_participants_update_column"]:event_participants_update_column;
	["event_participants_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["event_participants_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["event_participants_bool_exp"]
};
	/** columns and relationships of "events" */
["events"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	/** An object relationship */
	creator?:ResolverInputTypes["users"],
	creatorId?:boolean | `@${string}`,
	endAt?:boolean | `@${string}`,
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null},ResolverInputTypes["event_files"]],
files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null},ResolverInputTypes["event_files_aggregate"]],
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
params?: [{	/** JSON select path */
	path?: string | undefined | null},boolean | `@${string}`],
participants?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_participants_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null},ResolverInputTypes["event_participants"]],
participants_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_participants_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null},ResolverInputTypes["event_participants_aggregate"]],
	slug?:boolean | `@${string}`,
	startAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "events" */
["events_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["events_aggregate_fields"],
	nodes?:ResolverInputTypes["events"],
		__typename?: boolean | `@${string}`
}>;
	["events_aggregate_bool_exp"]: {
	count?: ResolverInputTypes["events_aggregate_bool_exp_count"] | undefined | null
};
	["events_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["events_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "events" */
["events_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["events_max_fields"],
	min?:ResolverInputTypes["events_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "events" */
["events_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["events_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["events_min_order_by"] | undefined | null
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["events_append_input"]: {
	params?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** input type for inserting array relation for remote table "events" */
["events_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["events_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["events_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "events". All fields are combined with a logical 'AND'. */
["events_bool_exp"]: {
	_and?: Array<ResolverInputTypes["events_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["events_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["events_bool_exp"]> | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	creator?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	creatorId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	endAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	files?: ResolverInputTypes["event_files_bool_exp"] | undefined | null,
	files_aggregate?: ResolverInputTypes["event_files_aggregate_bool_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	params?: ResolverInputTypes["jsonb_comparison_exp"] | undefined | null,
	participants?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null,
	participants_aggregate?: ResolverInputTypes["event_participants_aggregate_bool_exp"] | undefined | null,
	slug?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	startAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "events" */
["events_constraint"]:events_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["events_delete_at_path_input"]: {
	params?: Array<string> | undefined | null
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["events_delete_elem_input"]: {
	params?: number | undefined | null
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["events_delete_key_input"]: {
	params?: string | undefined | null
};
	/** input type for inserting data into table "events" */
["events_insert_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	creator?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	creatorId?: ResolverInputTypes["uuid"] | undefined | null,
	endAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	files?: ResolverInputTypes["event_files_arr_rel_insert_input"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	params?: ResolverInputTypes["jsonb"] | undefined | null,
	participants?: ResolverInputTypes["event_participants_arr_rel_insert_input"] | undefined | null,
	slug?: string | undefined | null,
	startAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** aggregate max on columns */
["events_max_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	creatorId?:boolean | `@${string}`,
	endAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	slug?:boolean | `@${string}`,
	startAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "events" */
["events_max_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	creatorId?: ResolverInputTypes["order_by"] | undefined | null,
	endAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	slug?: ResolverInputTypes["order_by"] | undefined | null,
	startAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["events_min_fields"]: AliasType<{
	createdAt?:boolean | `@${string}`,
	creatorId?:boolean | `@${string}`,
	endAt?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	slug?:boolean | `@${string}`,
	startAt?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "events" */
["events_min_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	creatorId?: ResolverInputTypes["order_by"] | undefined | null,
	endAt?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	slug?: ResolverInputTypes["order_by"] | undefined | null,
	startAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "events" */
["events_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["events"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "events" */
["events_obj_rel_insert_input"]: {
	data: ResolverInputTypes["events_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["events_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "events" */
["events_on_conflict"]: {
	constraint: ResolverInputTypes["events_constraint"],
	update_columns: Array<ResolverInputTypes["events_update_column"]>,
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "events". */
["events_order_by"]: {
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	creator?: ResolverInputTypes["users_order_by"] | undefined | null,
	creatorId?: ResolverInputTypes["order_by"] | undefined | null,
	endAt?: ResolverInputTypes["order_by"] | undefined | null,
	files_aggregate?: ResolverInputTypes["event_files_aggregate_order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	params?: ResolverInputTypes["order_by"] | undefined | null,
	participants_aggregate?: ResolverInputTypes["event_participants_aggregate_order_by"] | undefined | null,
	slug?: ResolverInputTypes["order_by"] | undefined | null,
	startAt?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: events */
["events_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["events_prepend_input"]: {
	params?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** select columns of table "events" */
["events_select_column"]:events_select_column;
	/** input type for updating data in table "events" */
["events_set_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	creatorId?: ResolverInputTypes["uuid"] | undefined | null,
	endAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	params?: ResolverInputTypes["jsonb"] | undefined | null,
	slug?: string | undefined | null,
	startAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** Streaming cursor of the table "events" */
["events_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["events_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["events_stream_cursor_value_input"]: {
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	creatorId?: ResolverInputTypes["uuid"] | undefined | null,
	endAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	name?: string | undefined | null,
	params?: ResolverInputTypes["jsonb"] | undefined | null,
	slug?: string | undefined | null,
	startAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** update columns of table "events" */
["events_update_column"]:events_update_column;
	["events_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["events_append_input"] | undefined | null,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["events_delete_at_path_input"] | undefined | null,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["events_delete_elem_input"] | undefined | null,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["events_delete_key_input"] | undefined | null,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["events_prepend_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["events_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["events_bool_exp"]
};
	/** columns and relationships of "storage.files" */
["files"]: AliasType<{
	/** An object relationship */
	bucket?:ResolverInputTypes["buckets"],
	bucketId?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	etag?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isUploaded?:boolean | `@${string}`,
	mimeType?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	uploadedByUserId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "storage.files" */
["files_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["files_aggregate_fields"],
	nodes?:ResolverInputTypes["files"],
		__typename?: boolean | `@${string}`
}>;
	["files_aggregate_bool_exp"]: {
	bool_and?: ResolverInputTypes["files_aggregate_bool_exp_bool_and"] | undefined | null,
	bool_or?: ResolverInputTypes["files_aggregate_bool_exp_bool_or"] | undefined | null,
	count?: ResolverInputTypes["files_aggregate_bool_exp_count"] | undefined | null
};
	["files_aggregate_bool_exp_bool_and"]: {
	arguments: ResolverInputTypes["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["files_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Boolean_comparison_exp"]
};
	["files_aggregate_bool_exp_bool_or"]: {
	arguments: ResolverInputTypes["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["files_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Boolean_comparison_exp"]
};
	["files_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["files_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "storage.files" */
["files_aggregate_fields"]: AliasType<{
	avg?:ResolverInputTypes["files_avg_fields"],
count?: [{	columns?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["files_max_fields"],
	min?:ResolverInputTypes["files_min_fields"],
	stddev?:ResolverInputTypes["files_stddev_fields"],
	stddev_pop?:ResolverInputTypes["files_stddev_pop_fields"],
	stddev_samp?:ResolverInputTypes["files_stddev_samp_fields"],
	sum?:ResolverInputTypes["files_sum_fields"],
	var_pop?:ResolverInputTypes["files_var_pop_fields"],
	var_samp?:ResolverInputTypes["files_var_samp_fields"],
	variance?:ResolverInputTypes["files_variance_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "storage.files" */
["files_aggregate_order_by"]: {
	avg?: ResolverInputTypes["files_avg_order_by"] | undefined | null,
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["files_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["files_min_order_by"] | undefined | null,
	stddev?: ResolverInputTypes["files_stddev_order_by"] | undefined | null,
	stddev_pop?: ResolverInputTypes["files_stddev_pop_order_by"] | undefined | null,
	stddev_samp?: ResolverInputTypes["files_stddev_samp_order_by"] | undefined | null,
	sum?: ResolverInputTypes["files_sum_order_by"] | undefined | null,
	var_pop?: ResolverInputTypes["files_var_pop_order_by"] | undefined | null,
	var_samp?: ResolverInputTypes["files_var_samp_order_by"] | undefined | null,
	variance?: ResolverInputTypes["files_variance_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "storage.files" */
["files_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["files_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["files_on_conflict"] | undefined | null
};
	/** aggregate avg on columns */
["files_avg_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by avg() on columns of table "storage.files" */
["files_avg_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Boolean expression to filter rows from the table "storage.files". All fields are combined with a logical 'AND'. */
["files_bool_exp"]: {
	_and?: Array<ResolverInputTypes["files_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["files_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["files_bool_exp"]> | undefined | null,
	bucket?: ResolverInputTypes["buckets_bool_exp"] | undefined | null,
	bucketId?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	etag?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	isUploaded?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	mimeType?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	name?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	size?: ResolverInputTypes["Int_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	uploadedByUserId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "storage.files" */
["files_constraint"]:files_constraint;
	/** input type for incrementing numeric columns in table "storage.files" */
["files_inc_input"]: {
	size?: number | undefined | null
};
	/** input type for inserting data into table "storage.files" */
["files_insert_input"]: {
	bucket?: ResolverInputTypes["buckets_obj_rel_insert_input"] | undefined | null,
	bucketId?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	etag?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isUploaded?: boolean | undefined | null,
	mimeType?: string | undefined | null,
	name?: string | undefined | null,
	size?: number | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	uploadedByUserId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["files_max_fields"]: AliasType<{
	bucketId?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	etag?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	mimeType?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	uploadedByUserId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "storage.files" */
["files_max_order_by"]: {
	bucketId?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	etag?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	mimeType?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	size?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	uploadedByUserId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["files_min_fields"]: AliasType<{
	bucketId?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	etag?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	mimeType?:boolean | `@${string}`,
	name?:boolean | `@${string}`,
	size?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	uploadedByUserId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "storage.files" */
["files_min_order_by"]: {
	bucketId?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	etag?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	mimeType?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	size?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	uploadedByUserId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "storage.files" */
["files_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["files"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "storage.files" */
["files_obj_rel_insert_input"]: {
	data: ResolverInputTypes["files_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["files_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "storage.files" */
["files_on_conflict"]: {
	constraint: ResolverInputTypes["files_constraint"],
	update_columns: Array<ResolverInputTypes["files_update_column"]>,
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "storage.files". */
["files_order_by"]: {
	bucket?: ResolverInputTypes["buckets_order_by"] | undefined | null,
	bucketId?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	etag?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	isUploaded?: ResolverInputTypes["order_by"] | undefined | null,
	mimeType?: ResolverInputTypes["order_by"] | undefined | null,
	name?: ResolverInputTypes["order_by"] | undefined | null,
	size?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	uploadedByUserId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: storage.files */
["files_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** select columns of table "storage.files" */
["files_select_column"]:files_select_column;
	/** select "files_aggregate_bool_exp_bool_and_arguments_columns" columns of table "storage.files" */
["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"]:files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "files_aggregate_bool_exp_bool_or_arguments_columns" columns of table "storage.files" */
["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"]:files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "storage.files" */
["files_set_input"]: {
	bucketId?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	etag?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isUploaded?: boolean | undefined | null,
	mimeType?: string | undefined | null,
	name?: string | undefined | null,
	size?: number | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	uploadedByUserId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate stddev on columns */
["files_stddev_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev() on columns of table "storage.files" */
["files_stddev_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_pop on columns */
["files_stddev_pop_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_pop() on columns of table "storage.files" */
["files_stddev_pop_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate stddev_samp on columns */
["files_stddev_samp_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by stddev_samp() on columns of table "storage.files" */
["files_stddev_samp_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** Streaming cursor of the table "files" */
["files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["files_stream_cursor_value_input"]: {
	bucketId?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	etag?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isUploaded?: boolean | undefined | null,
	mimeType?: string | undefined | null,
	name?: string | undefined | null,
	size?: number | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	uploadedByUserId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate sum on columns */
["files_sum_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by sum() on columns of table "storage.files" */
["files_sum_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** update columns of table "storage.files" */
["files_update_column"]:files_update_column;
	["files_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["files_inc_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["files_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["files_bool_exp"]
};
	/** aggregate var_pop on columns */
["files_var_pop_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_pop() on columns of table "storage.files" */
["files_var_pop_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate var_samp on columns */
["files_var_samp_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by var_samp() on columns of table "storage.files" */
["files_var_samp_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate variance on columns */
["files_variance_fields"]: AliasType<{
	size?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by variance() on columns of table "storage.files" */
["files_variance_order_by"]: {
	size?: ResolverInputTypes["order_by"] | undefined | null
};
	/** columns and relationships of "installations" */
["installations"]: AliasType<{
	appIdentifier?:boolean | `@${string}`,
	appVersion?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	deviceLocale?:boolean | `@${string}`,
	deviceName?:boolean | `@${string}`,
	deviceType?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	isActive?:boolean | `@${string}`,
	osName?:boolean | `@${string}`,
	osVersion?:boolean | `@${string}`,
	pushToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	/** An object relationship */
	user?:ResolverInputTypes["users"],
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "installations" */
["installations_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["installations_aggregate_fields"],
	nodes?:ResolverInputTypes["installations"],
		__typename?: boolean | `@${string}`
}>;
	["installations_aggregate_bool_exp"]: {
	bool_and?: ResolverInputTypes["installations_aggregate_bool_exp_bool_and"] | undefined | null,
	bool_or?: ResolverInputTypes["installations_aggregate_bool_exp_bool_or"] | undefined | null,
	count?: ResolverInputTypes["installations_aggregate_bool_exp_count"] | undefined | null
};
	["installations_aggregate_bool_exp_bool_and"]: {
	arguments: ResolverInputTypes["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["installations_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Boolean_comparison_exp"]
};
	["installations_aggregate_bool_exp_bool_or"]: {
	arguments: ResolverInputTypes["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["installations_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Boolean_comparison_exp"]
};
	["installations_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["installations_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "installations" */
["installations_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["installations_max_fields"],
	min?:ResolverInputTypes["installations_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "installations" */
["installations_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["installations_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["installations_min_order_by"] | undefined | null
};
	/** input type for inserting array relation for remote table "installations" */
["installations_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["installations_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["installations_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "installations". All fields are combined with a logical 'AND'. */
["installations_bool_exp"]: {
	_and?: Array<ResolverInputTypes["installations_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["installations_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["installations_bool_exp"]> | undefined | null,
	appIdentifier?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	appVersion?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	deviceLocale?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	deviceName?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	deviceType?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	isActive?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	osName?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	osVersion?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	pushToken?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	user?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "installations" */
["installations_constraint"]:installations_constraint;
	/** input type for inserting data into table "installations" */
["installations_insert_input"]: {
	appIdentifier?: string | undefined | null,
	appVersion?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	deviceLocale?: string | undefined | null,
	deviceName?: string | undefined | null,
	deviceType?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isActive?: boolean | undefined | null,
	osName?: string | undefined | null,
	osVersion?: string | undefined | null,
	pushToken?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	user?: ResolverInputTypes["users_obj_rel_insert_input"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["installations_max_fields"]: AliasType<{
	appIdentifier?:boolean | `@${string}`,
	appVersion?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	deviceLocale?:boolean | `@${string}`,
	deviceName?:boolean | `@${string}`,
	deviceType?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	osName?:boolean | `@${string}`,
	osVersion?:boolean | `@${string}`,
	pushToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "installations" */
["installations_max_order_by"]: {
	appIdentifier?: ResolverInputTypes["order_by"] | undefined | null,
	appVersion?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	deviceLocale?: ResolverInputTypes["order_by"] | undefined | null,
	deviceName?: ResolverInputTypes["order_by"] | undefined | null,
	deviceType?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	osName?: ResolverInputTypes["order_by"] | undefined | null,
	osVersion?: ResolverInputTypes["order_by"] | undefined | null,
	pushToken?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["installations_min_fields"]: AliasType<{
	appIdentifier?:boolean | `@${string}`,
	appVersion?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	deviceLocale?:boolean | `@${string}`,
	deviceName?:boolean | `@${string}`,
	deviceType?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	osName?:boolean | `@${string}`,
	osVersion?:boolean | `@${string}`,
	pushToken?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "installations" */
["installations_min_order_by"]: {
	appIdentifier?: ResolverInputTypes["order_by"] | undefined | null,
	appVersion?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	deviceLocale?: ResolverInputTypes["order_by"] | undefined | null,
	deviceName?: ResolverInputTypes["order_by"] | undefined | null,
	deviceType?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	osName?: ResolverInputTypes["order_by"] | undefined | null,
	osVersion?: ResolverInputTypes["order_by"] | undefined | null,
	pushToken?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "installations" */
["installations_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["installations"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "installations" */
["installations_on_conflict"]: {
	constraint: ResolverInputTypes["installations_constraint"],
	update_columns: Array<ResolverInputTypes["installations_update_column"]>,
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "installations". */
["installations_order_by"]: {
	appIdentifier?: ResolverInputTypes["order_by"] | undefined | null,
	appVersion?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	deviceLocale?: ResolverInputTypes["order_by"] | undefined | null,
	deviceName?: ResolverInputTypes["order_by"] | undefined | null,
	deviceType?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	isActive?: ResolverInputTypes["order_by"] | undefined | null,
	osName?: ResolverInputTypes["order_by"] | undefined | null,
	osVersion?: ResolverInputTypes["order_by"] | undefined | null,
	pushToken?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	user?: ResolverInputTypes["users_order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: installations */
["installations_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"],
	userId: ResolverInputTypes["uuid"]
};
	/** select columns of table "installations" */
["installations_select_column"]:installations_select_column;
	/** select "installations_aggregate_bool_exp_bool_and_arguments_columns" columns of table "installations" */
["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"]:installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "installations_aggregate_bool_exp_bool_or_arguments_columns" columns of table "installations" */
["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"]:installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "installations" */
["installations_set_input"]: {
	appIdentifier?: string | undefined | null,
	appVersion?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	deviceLocale?: string | undefined | null,
	deviceName?: string | undefined | null,
	deviceType?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isActive?: boolean | undefined | null,
	osName?: string | undefined | null,
	osVersion?: string | undefined | null,
	pushToken?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** Streaming cursor of the table "installations" */
["installations_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["installations_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["installations_stream_cursor_value_input"]: {
	appIdentifier?: string | undefined | null,
	appVersion?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	deviceLocale?: string | undefined | null,
	deviceName?: string | undefined | null,
	deviceType?: string | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isActive?: boolean | undefined | null,
	osName?: string | undefined | null,
	osVersion?: string | undefined | null,
	pushToken?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** update columns of table "installations" */
["installations_update_column"]:installations_update_column;
	["installations_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["installations_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["installations_bool_exp"]
};
	["jsonb"]:unknown;
	["jsonb_cast_exp"]: {
	String?: ResolverInputTypes["String_comparison_exp"] | undefined | null
};
	/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
["jsonb_comparison_exp"]: {
	_cast?: ResolverInputTypes["jsonb_cast_exp"] | undefined | null,
	/** is the column contained in the given json value */
	_contained_in?: ResolverInputTypes["jsonb"] | undefined | null,
	/** does the column contain the given json value at the top level */
	_contains?: ResolverInputTypes["jsonb"] | undefined | null,
	_eq?: ResolverInputTypes["jsonb"] | undefined | null,
	_gt?: ResolverInputTypes["jsonb"] | undefined | null,
	_gte?: ResolverInputTypes["jsonb"] | undefined | null,
	/** does the string exist as a top-level key in the column */
	_has_key?: string | undefined | null,
	/** do all of these strings exist as top-level keys in the column */
	_has_keys_all?: Array<string> | undefined | null,
	/** do any of these strings exist as top-level keys in the column */
	_has_keys_any?: Array<string> | undefined | null,
	_in?: Array<ResolverInputTypes["jsonb"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["jsonb"] | undefined | null,
	_lte?: ResolverInputTypes["jsonb"] | undefined | null,
	_neq?: ResolverInputTypes["jsonb"] | undefined | null,
	_nin?: Array<ResolverInputTypes["jsonb"]> | undefined | null
};
	/** mutation root */
["mutation_root"]: AliasType<{
deleteAuthProvider?: [{	id: string},ResolverInputTypes["authProviders"]],
deleteAuthProviderRequest?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authProviderRequests"]],
deleteAuthProviderRequests?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authProviderRequests_bool_exp"]},ResolverInputTypes["authProviderRequests_mutation_response"]],
deleteAuthProviders?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authProviders_bool_exp"]},ResolverInputTypes["authProviders_mutation_response"]],
deleteAuthRefreshToken?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authRefreshTokens"]],
deleteAuthRefreshTokenType?: [{	value: string},ResolverInputTypes["authRefreshTokenTypes"]],
deleteAuthRefreshTokenTypes?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authRefreshTokenTypes_bool_exp"]},ResolverInputTypes["authRefreshTokenTypes_mutation_response"]],
deleteAuthRefreshTokens?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authRefreshTokens_bool_exp"]},ResolverInputTypes["authRefreshTokens_mutation_response"]],
deleteAuthRole?: [{	role: string},ResolverInputTypes["authRoles"]],
deleteAuthRoles?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authRoles_bool_exp"]},ResolverInputTypes["authRoles_mutation_response"]],
deleteAuthUserProvider?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserProviders"]],
deleteAuthUserProviders?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authUserProviders_bool_exp"]},ResolverInputTypes["authUserProviders_mutation_response"]],
deleteAuthUserRole?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserRoles"]],
deleteAuthUserRoles?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authUserRoles_bool_exp"]},ResolverInputTypes["authUserRoles_mutation_response"]],
deleteAuthUserSecurityKey?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserSecurityKeys"]],
deleteAuthUserSecurityKeys?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["authUserSecurityKeys_bool_exp"]},ResolverInputTypes["authUserSecurityKeys_mutation_response"]],
deleteBucket?: [{	id: string},ResolverInputTypes["buckets"]],
deleteBuckets?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["buckets_bool_exp"]},ResolverInputTypes["buckets_mutation_response"]],
deleteFile?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["files"]],
deleteFiles?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["files_bool_exp"]},ResolverInputTypes["files_mutation_response"]],
deleteUser?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["users"]],
deleteUsers?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["users_bool_exp"]},ResolverInputTypes["users_mutation_response"]],
delete_event_files?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["event_files_bool_exp"]},ResolverInputTypes["event_files_mutation_response"]],
delete_event_files_by_pk?: [{	eventId: ResolverInputTypes["uuid"],	fileId: ResolverInputTypes["uuid"]},ResolverInputTypes["event_files"]],
delete_event_participants?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["event_participants_bool_exp"]},ResolverInputTypes["event_participants_mutation_response"]],
delete_event_participants_by_pk?: [{	eventId: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["event_participants"]],
delete_events?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["events_bool_exp"]},ResolverInputTypes["events_mutation_response"]],
delete_events_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["events"]],
delete_installations?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["installations_bool_exp"]},ResolverInputTypes["installations_mutation_response"]],
delete_installations_by_pk?: [{	id: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["installations"]],
delete_user_files?: [{	/** filter the rows which have to be deleted */
	where: ResolverInputTypes["user_files_bool_exp"]},ResolverInputTypes["user_files_mutation_response"]],
delete_user_files_by_pk?: [{	fileId: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["user_files"]],
insertAuthProvider?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authProviders_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authProviders_on_conflict"] | undefined | null},ResolverInputTypes["authProviders"]],
insertAuthProviderRequest?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authProviderRequests_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authProviderRequests_on_conflict"] | undefined | null},ResolverInputTypes["authProviderRequests"]],
insertAuthProviderRequests?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authProviderRequests_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authProviderRequests_on_conflict"] | undefined | null},ResolverInputTypes["authProviderRequests_mutation_response"]],
insertAuthProviders?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authProviders_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authProviders_on_conflict"] | undefined | null},ResolverInputTypes["authProviders_mutation_response"]],
insertAuthRefreshToken?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authRefreshTokens_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRefreshTokens_on_conflict"] | undefined | null},ResolverInputTypes["authRefreshTokens"]],
insertAuthRefreshTokenType?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authRefreshTokenTypes_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRefreshTokenTypes_on_conflict"] | undefined | null},ResolverInputTypes["authRefreshTokenTypes"]],
insertAuthRefreshTokenTypes?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authRefreshTokenTypes_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRefreshTokenTypes_on_conflict"] | undefined | null},ResolverInputTypes["authRefreshTokenTypes_mutation_response"]],
insertAuthRefreshTokens?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authRefreshTokens_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRefreshTokens_on_conflict"] | undefined | null},ResolverInputTypes["authRefreshTokens_mutation_response"]],
insertAuthRole?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authRoles_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRoles_on_conflict"] | undefined | null},ResolverInputTypes["authRoles"]],
insertAuthRoles?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authRoles_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authRoles_on_conflict"] | undefined | null},ResolverInputTypes["authRoles_mutation_response"]],
insertAuthUserProvider?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authUserProviders_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserProviders_on_conflict"] | undefined | null},ResolverInputTypes["authUserProviders"]],
insertAuthUserProviders?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authUserProviders_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserProviders_on_conflict"] | undefined | null},ResolverInputTypes["authUserProviders_mutation_response"]],
insertAuthUserRole?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authUserRoles_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserRoles_on_conflict"] | undefined | null},ResolverInputTypes["authUserRoles"]],
insertAuthUserRoles?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authUserRoles_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserRoles_on_conflict"] | undefined | null},ResolverInputTypes["authUserRoles_mutation_response"]],
insertAuthUserSecurityKey?: [{	/** the row to be inserted */
	object: ResolverInputTypes["authUserSecurityKeys_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserSecurityKeys_on_conflict"] | undefined | null},ResolverInputTypes["authUserSecurityKeys"]],
insertAuthUserSecurityKeys?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["authUserSecurityKeys_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["authUserSecurityKeys_on_conflict"] | undefined | null},ResolverInputTypes["authUserSecurityKeys_mutation_response"]],
insertBucket?: [{	/** the row to be inserted */
	object: ResolverInputTypes["buckets_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["buckets_on_conflict"] | undefined | null},ResolverInputTypes["buckets"]],
insertBuckets?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["buckets_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["buckets_on_conflict"] | undefined | null},ResolverInputTypes["buckets_mutation_response"]],
insertFile?: [{	/** the row to be inserted */
	object: ResolverInputTypes["files_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["files_on_conflict"] | undefined | null},ResolverInputTypes["files"]],
insertFiles?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["files_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["files_on_conflict"] | undefined | null},ResolverInputTypes["files_mutation_response"]],
insertUser?: [{	/** the row to be inserted */
	object: ResolverInputTypes["users_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["users_on_conflict"] | undefined | null},ResolverInputTypes["users"]],
insertUsers?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["users_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["users_on_conflict"] | undefined | null},ResolverInputTypes["users_mutation_response"]],
insert_event_files?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["event_files_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["event_files_on_conflict"] | undefined | null},ResolverInputTypes["event_files_mutation_response"]],
insert_event_files_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["event_files_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["event_files_on_conflict"] | undefined | null},ResolverInputTypes["event_files"]],
insert_event_participants?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["event_participants_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["event_participants_on_conflict"] | undefined | null},ResolverInputTypes["event_participants_mutation_response"]],
insert_event_participants_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["event_participants_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["event_participants_on_conflict"] | undefined | null},ResolverInputTypes["event_participants"]],
insert_events?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["events_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["events_on_conflict"] | undefined | null},ResolverInputTypes["events_mutation_response"]],
insert_events_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["events_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["events_on_conflict"] | undefined | null},ResolverInputTypes["events"]],
insert_installations?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["installations_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["installations_on_conflict"] | undefined | null},ResolverInputTypes["installations_mutation_response"]],
insert_installations_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["installations_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["installations_on_conflict"] | undefined | null},ResolverInputTypes["installations"]],
insert_user_files?: [{	/** the rows to be inserted */
	objects: Array<ResolverInputTypes["user_files_insert_input"]>,	/** upsert condition */
	on_conflict?: ResolverInputTypes["user_files_on_conflict"] | undefined | null},ResolverInputTypes["user_files_mutation_response"]],
insert_user_files_one?: [{	/** the row to be inserted */
	object: ResolverInputTypes["user_files_insert_input"],	/** upsert condition */
	on_conflict?: ResolverInputTypes["user_files_on_conflict"] | undefined | null},ResolverInputTypes["user_files"]],
updateAuthProvider?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authProviders_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authProviders_pk_columns_input"]},ResolverInputTypes["authProviders"]],
updateAuthProviderRequest?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["authProviderRequests_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["authProviderRequests_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["authProviderRequests_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["authProviderRequests_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["authProviderRequests_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authProviderRequests_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authProviderRequests_pk_columns_input"]},ResolverInputTypes["authProviderRequests"]],
updateAuthProviderRequests?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["authProviderRequests_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["authProviderRequests_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["authProviderRequests_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["authProviderRequests_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["authProviderRequests_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authProviderRequests_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authProviderRequests_bool_exp"]},ResolverInputTypes["authProviderRequests_mutation_response"]],
updateAuthProviders?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authProviders_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authProviders_bool_exp"]},ResolverInputTypes["authProviders_mutation_response"]],
updateAuthRefreshToken?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["authRefreshTokens_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["authRefreshTokens_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["authRefreshTokens_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["authRefreshTokens_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["authRefreshTokens_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRefreshTokens_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authRefreshTokens_pk_columns_input"]},ResolverInputTypes["authRefreshTokens"]],
updateAuthRefreshTokenType?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRefreshTokenTypes_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authRefreshTokenTypes_pk_columns_input"]},ResolverInputTypes["authRefreshTokenTypes"]],
updateAuthRefreshTokenTypes?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRefreshTokenTypes_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authRefreshTokenTypes_bool_exp"]},ResolverInputTypes["authRefreshTokenTypes_mutation_response"]],
updateAuthRefreshTokens?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["authRefreshTokens_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["authRefreshTokens_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["authRefreshTokens_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["authRefreshTokens_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["authRefreshTokens_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRefreshTokens_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authRefreshTokens_bool_exp"]},ResolverInputTypes["authRefreshTokens_mutation_response"]],
updateAuthRole?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRoles_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authRoles_pk_columns_input"]},ResolverInputTypes["authRoles"]],
updateAuthRoles?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authRoles_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authRoles_bool_exp"]},ResolverInputTypes["authRoles_mutation_response"]],
updateAuthUserProvider?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserProviders_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authUserProviders_pk_columns_input"]},ResolverInputTypes["authUserProviders"]],
updateAuthUserProviders?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserProviders_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authUserProviders_bool_exp"]},ResolverInputTypes["authUserProviders_mutation_response"]],
updateAuthUserRole?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserRoles_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authUserRoles_pk_columns_input"]},ResolverInputTypes["authUserRoles"]],
updateAuthUserRoles?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserRoles_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authUserRoles_bool_exp"]},ResolverInputTypes["authUserRoles_mutation_response"]],
updateAuthUserSecurityKey?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["authUserSecurityKeys_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserSecurityKeys_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["authUserSecurityKeys_pk_columns_input"]},ResolverInputTypes["authUserSecurityKeys"]],
updateAuthUserSecurityKeys?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["authUserSecurityKeys_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["authUserSecurityKeys_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["authUserSecurityKeys_bool_exp"]},ResolverInputTypes["authUserSecurityKeys_mutation_response"]],
updateBucket?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["buckets_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["buckets_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["buckets_pk_columns_input"]},ResolverInputTypes["buckets"]],
updateBuckets?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["buckets_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["buckets_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["buckets_bool_exp"]},ResolverInputTypes["buckets_mutation_response"]],
updateFile?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["files_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["files_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["files_pk_columns_input"]},ResolverInputTypes["files"]],
updateFiles?: [{	/** increments the numeric columns with given value of the filtered values */
	_inc?: ResolverInputTypes["files_inc_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["files_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["files_bool_exp"]},ResolverInputTypes["files_mutation_response"]],
updateUser?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["users_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["users_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["users_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["users_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["users_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["users_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["users_pk_columns_input"]},ResolverInputTypes["users"]],
updateUsers?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["users_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["users_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["users_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["users_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["users_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["users_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["users_bool_exp"]},ResolverInputTypes["users_mutation_response"]],
update_authProviderRequests_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authProviderRequests_updates"]>},ResolverInputTypes["authProviderRequests_mutation_response"]],
update_authProviders_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authProviders_updates"]>},ResolverInputTypes["authProviders_mutation_response"]],
update_authRefreshTokenTypes_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authRefreshTokenTypes_updates"]>},ResolverInputTypes["authRefreshTokenTypes_mutation_response"]],
update_authRefreshTokens_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authRefreshTokens_updates"]>},ResolverInputTypes["authRefreshTokens_mutation_response"]],
update_authRoles_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authRoles_updates"]>},ResolverInputTypes["authRoles_mutation_response"]],
update_authUserProviders_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authUserProviders_updates"]>},ResolverInputTypes["authUserProviders_mutation_response"]],
update_authUserRoles_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authUserRoles_updates"]>},ResolverInputTypes["authUserRoles_mutation_response"]],
update_authUserSecurityKeys_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["authUserSecurityKeys_updates"]>},ResolverInputTypes["authUserSecurityKeys_mutation_response"]],
update_buckets_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["buckets_updates"]>},ResolverInputTypes["buckets_mutation_response"]],
update_event_files?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["event_files_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["event_files_bool_exp"]},ResolverInputTypes["event_files_mutation_response"]],
update_event_files_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["event_files_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["event_files_pk_columns_input"]},ResolverInputTypes["event_files"]],
update_event_files_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["event_files_updates"]>},ResolverInputTypes["event_files_mutation_response"]],
update_event_participants?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["event_participants_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["event_participants_bool_exp"]},ResolverInputTypes["event_participants_mutation_response"]],
update_event_participants_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["event_participants_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["event_participants_pk_columns_input"]},ResolverInputTypes["event_participants"]],
update_event_participants_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["event_participants_updates"]>},ResolverInputTypes["event_participants_mutation_response"]],
update_events?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["events_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["events_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["events_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["events_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["events_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["events_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["events_bool_exp"]},ResolverInputTypes["events_mutation_response"]],
update_events_by_pk?: [{	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["events_append_input"] | undefined | null,	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["events_delete_at_path_input"] | undefined | null,	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["events_delete_elem_input"] | undefined | null,	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["events_delete_key_input"] | undefined | null,	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["events_prepend_input"] | undefined | null,	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["events_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["events_pk_columns_input"]},ResolverInputTypes["events"]],
update_events_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["events_updates"]>},ResolverInputTypes["events_mutation_response"]],
update_files_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["files_updates"]>},ResolverInputTypes["files_mutation_response"]],
update_installations?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["installations_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["installations_bool_exp"]},ResolverInputTypes["installations_mutation_response"]],
update_installations_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["installations_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["installations_pk_columns_input"]},ResolverInputTypes["installations"]],
update_installations_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["installations_updates"]>},ResolverInputTypes["installations_mutation_response"]],
update_user_files?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["user_files_set_input"] | undefined | null,	/** filter the rows which have to be updated */
	where: ResolverInputTypes["user_files_bool_exp"]},ResolverInputTypes["user_files_mutation_response"]],
update_user_files_by_pk?: [{	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["user_files_set_input"] | undefined | null,	pk_columns: ResolverInputTypes["user_files_pk_columns_input"]},ResolverInputTypes["user_files"]],
update_user_files_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["user_files_updates"]>},ResolverInputTypes["user_files_mutation_response"]],
update_users_many?: [{	/** updates to execute, in order */
	updates: Array<ResolverInputTypes["users_updates"]>},ResolverInputTypes["users_mutation_response"]],
		__typename?: boolean | `@${string}`
}>;
	/** column ordering options */
["order_by"]:order_by;
	["query_root"]: AliasType<{
authProvider?: [{	id: string},ResolverInputTypes["authProviders"]],
authProviderRequest?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authProviderRequests"]],
authProviderRequests?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviderRequests_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviderRequests_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviderRequests_bool_exp"] | undefined | null},ResolverInputTypes["authProviderRequests"]],
authProviderRequestsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviderRequests_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviderRequests_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviderRequests_bool_exp"] | undefined | null},ResolverInputTypes["authProviderRequests_aggregate"]],
authProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null},ResolverInputTypes["authProviders"]],
authProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null},ResolverInputTypes["authProviders_aggregate"]],
authRefreshToken?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authRefreshTokens"]],
authRefreshTokenType?: [{	value: string},ResolverInputTypes["authRefreshTokenTypes"]],
authRefreshTokenTypes?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokenTypes_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokenTypes_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokenTypes_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokenTypes"]],
authRefreshTokenTypesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokenTypes_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokenTypes_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokenTypes_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokenTypes_aggregate"]],
authRefreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens"]],
authRefreshTokensAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens_aggregate"]],
authRole?: [{	role: string},ResolverInputTypes["authRoles"]],
authRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null},ResolverInputTypes["authRoles"]],
authRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null},ResolverInputTypes["authRoles_aggregate"]],
authUserProvider?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserProviders"]],
authUserProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders"]],
authUserProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders_aggregate"]],
authUserRole?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserRoles"]],
authUserRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles"]],
authUserRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles_aggregate"]],
authUserSecurityKey?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserSecurityKeys"]],
authUserSecurityKeys?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserSecurityKeys_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null},ResolverInputTypes["authUserSecurityKeys"]],
authUserSecurityKeysAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserSecurityKeys_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null},ResolverInputTypes["authUserSecurityKeys_aggregate"]],
bucket?: [{	id: string},ResolverInputTypes["buckets"]],
buckets?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["buckets_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["buckets_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["buckets_bool_exp"] | undefined | null},ResolverInputTypes["buckets"]],
bucketsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["buckets_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["buckets_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["buckets_bool_exp"] | undefined | null},ResolverInputTypes["buckets_aggregate"]],
event_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null},ResolverInputTypes["event_files"]],
event_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null},ResolverInputTypes["event_files_aggregate"]],
event_files_by_pk?: [{	eventId: ResolverInputTypes["uuid"],	fileId: ResolverInputTypes["uuid"]},ResolverInputTypes["event_files"]],
event_participants?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_participants_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null},ResolverInputTypes["event_participants"]],
event_participants_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_participants_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null},ResolverInputTypes["event_participants_aggregate"]],
event_participants_by_pk?: [{	eventId: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["event_participants"]],
events?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["events_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null},ResolverInputTypes["events"]],
events_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["events_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null},ResolverInputTypes["events_aggregate"]],
events_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["events"]],
file?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["files"]],
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null},ResolverInputTypes["files"]],
filesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null},ResolverInputTypes["files_aggregate"]],
installations?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["installations_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null},ResolverInputTypes["installations"]],
installations_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["installations_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null},ResolverInputTypes["installations_aggregate"]],
installations_by_pk?: [{	id: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["installations"]],
user?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["users"]],
user_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["user_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["user_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["user_files_bool_exp"] | undefined | null},ResolverInputTypes["user_files"]],
user_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["user_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["user_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["user_files_bool_exp"] | undefined | null},ResolverInputTypes["user_files_aggregate"]],
user_files_by_pk?: [{	fileId: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["user_files"]],
users?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["users_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null},ResolverInputTypes["users"]],
usersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["users_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null},ResolverInputTypes["users_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	["subscription_root"]: AliasType<{
authProvider?: [{	id: string},ResolverInputTypes["authProviders"]],
authProviderRequest?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authProviderRequests"]],
authProviderRequests?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviderRequests_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviderRequests_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviderRequests_bool_exp"] | undefined | null},ResolverInputTypes["authProviderRequests"]],
authProviderRequestsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviderRequests_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviderRequests_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviderRequests_bool_exp"] | undefined | null},ResolverInputTypes["authProviderRequests_aggregate"]],
authProviderRequests_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authProviderRequests_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviderRequests_bool_exp"] | undefined | null},ResolverInputTypes["authProviderRequests"]],
authProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null},ResolverInputTypes["authProviders"]],
authProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null},ResolverInputTypes["authProviders_aggregate"]],
authProviders_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authProviders_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authProviders_bool_exp"] | undefined | null},ResolverInputTypes["authProviders"]],
authRefreshToken?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authRefreshTokens"]],
authRefreshTokenType?: [{	value: string},ResolverInputTypes["authRefreshTokenTypes"]],
authRefreshTokenTypes?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokenTypes_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokenTypes_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokenTypes_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokenTypes"]],
authRefreshTokenTypesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokenTypes_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokenTypes_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokenTypes_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokenTypes_aggregate"]],
authRefreshTokenTypes_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authRefreshTokenTypes_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokenTypes_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokenTypes"]],
authRefreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens"]],
authRefreshTokensAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens_aggregate"]],
authRefreshTokens_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authRefreshTokens_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens"]],
authRole?: [{	role: string},ResolverInputTypes["authRoles"]],
authRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null},ResolverInputTypes["authRoles"]],
authRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null},ResolverInputTypes["authRoles_aggregate"]],
authRoles_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authRoles_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null},ResolverInputTypes["authRoles"]],
authUserProvider?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserProviders"]],
authUserProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders"]],
authUserProvidersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders_aggregate"]],
authUserProviders_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authUserProviders_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders"]],
authUserRole?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserRoles"]],
authUserRoles?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles"]],
authUserRolesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles_aggregate"]],
authUserRoles_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authUserRoles_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles"]],
authUserSecurityKey?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["authUserSecurityKeys"]],
authUserSecurityKeys?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserSecurityKeys_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null},ResolverInputTypes["authUserSecurityKeys"]],
authUserSecurityKeysAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserSecurityKeys_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null},ResolverInputTypes["authUserSecurityKeys_aggregate"]],
authUserSecurityKeys_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["authUserSecurityKeys_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null},ResolverInputTypes["authUserSecurityKeys"]],
bucket?: [{	id: string},ResolverInputTypes["buckets"]],
buckets?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["buckets_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["buckets_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["buckets_bool_exp"] | undefined | null},ResolverInputTypes["buckets"]],
bucketsAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["buckets_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["buckets_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["buckets_bool_exp"] | undefined | null},ResolverInputTypes["buckets_aggregate"]],
buckets_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["buckets_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["buckets_bool_exp"] | undefined | null},ResolverInputTypes["buckets"]],
event_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null},ResolverInputTypes["event_files"]],
event_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null},ResolverInputTypes["event_files_aggregate"]],
event_files_by_pk?: [{	eventId: ResolverInputTypes["uuid"],	fileId: ResolverInputTypes["uuid"]},ResolverInputTypes["event_files"]],
event_files_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["event_files_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["event_files_bool_exp"] | undefined | null},ResolverInputTypes["event_files"]],
event_participants?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_participants_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null},ResolverInputTypes["event_participants"]],
event_participants_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["event_participants_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["event_participants_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null},ResolverInputTypes["event_participants_aggregate"]],
event_participants_by_pk?: [{	eventId: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["event_participants"]],
event_participants_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["event_participants_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["event_participants_bool_exp"] | undefined | null},ResolverInputTypes["event_participants"]],
events?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["events_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null},ResolverInputTypes["events"]],
events_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["events_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null},ResolverInputTypes["events_aggregate"]],
events_by_pk?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["events"]],
events_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["events_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null},ResolverInputTypes["events"]],
file?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["files"]],
files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null},ResolverInputTypes["files"]],
filesAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null},ResolverInputTypes["files_aggregate"]],
files_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["files_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["files_bool_exp"] | undefined | null},ResolverInputTypes["files"]],
installations?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["installations_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null},ResolverInputTypes["installations"]],
installations_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["installations_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null},ResolverInputTypes["installations_aggregate"]],
installations_by_pk?: [{	id: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["installations"]],
installations_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["installations_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null},ResolverInputTypes["installations"]],
user?: [{	id: ResolverInputTypes["uuid"]},ResolverInputTypes["users"]],
user_files?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["user_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["user_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["user_files_bool_exp"] | undefined | null},ResolverInputTypes["user_files"]],
user_files_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["user_files_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["user_files_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["user_files_bool_exp"] | undefined | null},ResolverInputTypes["user_files_aggregate"]],
user_files_by_pk?: [{	fileId: ResolverInputTypes["uuid"],	userId: ResolverInputTypes["uuid"]},ResolverInputTypes["user_files"]],
user_files_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["user_files_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["user_files_bool_exp"] | undefined | null},ResolverInputTypes["user_files"]],
users?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["users_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null},ResolverInputTypes["users"]],
usersAggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["users_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null},ResolverInputTypes["users_aggregate"]],
users_stream?: [{	/** maximum number of rows returned in a single batch */
	batch_size: number,	/** cursor to stream the results returned by the query */
	cursor: Array<ResolverInputTypes["users_stream_cursor_input"] | undefined | null>,	/** filter the rows returned */
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null},ResolverInputTypes["users"]],
		__typename?: boolean | `@${string}`
}>;
	["timestamptz"]:unknown;
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
	_eq?: ResolverInputTypes["timestamptz"] | undefined | null,
	_gt?: ResolverInputTypes["timestamptz"] | undefined | null,
	_gte?: ResolverInputTypes["timestamptz"] | undefined | null,
	_in?: Array<ResolverInputTypes["timestamptz"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["timestamptz"] | undefined | null,
	_lte?: ResolverInputTypes["timestamptz"] | undefined | null,
	_neq?: ResolverInputTypes["timestamptz"] | undefined | null,
	_nin?: Array<ResolverInputTypes["timestamptz"]> | undefined | null
};
	/** columns and relationships of "user_files" */
["user_files"]: AliasType<{
	fileId?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "user_files" */
["user_files_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["user_files_aggregate_fields"],
	nodes?:ResolverInputTypes["user_files"],
		__typename?: boolean | `@${string}`
}>;
	/** aggregate fields of "user_files" */
["user_files_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["user_files_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["user_files_max_fields"],
	min?:ResolverInputTypes["user_files_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** Boolean expression to filter rows from the table "user_files". All fields are combined with a logical 'AND'. */
["user_files_bool_exp"]: {
	_and?: Array<ResolverInputTypes["user_files_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["user_files_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["user_files_bool_exp"]> | undefined | null,
	fileId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	userId?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null
};
	/** unique or primary key constraints on table "user_files" */
["user_files_constraint"]:user_files_constraint;
	/** input type for inserting data into table "user_files" */
["user_files_insert_input"]: {
	fileId?: ResolverInputTypes["uuid"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** aggregate max on columns */
["user_files_max_fields"]: AliasType<{
	fileId?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** aggregate min on columns */
["user_files_min_fields"]: AliasType<{
	fileId?:boolean | `@${string}`,
	userId?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** response of any mutation on the table "user_files" */
["user_files_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["user_files"],
		__typename?: boolean | `@${string}`
}>;
	/** on_conflict condition type for table "user_files" */
["user_files_on_conflict"]: {
	constraint: ResolverInputTypes["user_files_constraint"],
	update_columns: Array<ResolverInputTypes["user_files_update_column"]>,
	where?: ResolverInputTypes["user_files_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "user_files". */
["user_files_order_by"]: {
	fileId?: ResolverInputTypes["order_by"] | undefined | null,
	userId?: ResolverInputTypes["order_by"] | undefined | null
};
	/** primary key columns input for table: user_files */
["user_files_pk_columns_input"]: {
	fileId: ResolverInputTypes["uuid"],
	userId: ResolverInputTypes["uuid"]
};
	/** select columns of table "user_files" */
["user_files_select_column"]:user_files_select_column;
	/** input type for updating data in table "user_files" */
["user_files_set_input"]: {
	fileId?: ResolverInputTypes["uuid"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** Streaming cursor of the table "user_files" */
["user_files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["user_files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["user_files_stream_cursor_value_input"]: {
	fileId?: ResolverInputTypes["uuid"] | undefined | null,
	userId?: ResolverInputTypes["uuid"] | undefined | null
};
	/** update columns of table "user_files" */
["user_files_update_column"]:user_files_update_column;
	["user_files_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["user_files_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["user_files_bool_exp"]
};
	/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
["users"]: AliasType<{
	activeMfaType?:boolean | `@${string}`,
	avatarUrl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	currentChallenge?:boolean | `@${string}`,
	defaultRole?:boolean | `@${string}`,
	/** An object relationship */
	defaultRoleByRole?:ResolverInputTypes["authRoles"],
	disabled?:boolean | `@${string}`,
	displayName?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	emailVerified?:boolean | `@${string}`,
events?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["events_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null},ResolverInputTypes["events"]],
events_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["events_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["events_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["events_bool_exp"] | undefined | null},ResolverInputTypes["events_aggregate"]],
	id?:boolean | `@${string}`,
installations?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["installations_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null},ResolverInputTypes["installations"]],
installations_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["installations_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["installations_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["installations_bool_exp"] | undefined | null},ResolverInputTypes["installations_aggregate"]],
	isAnonymous?:boolean | `@${string}`,
	lastSeen?:boolean | `@${string}`,
	locale?:boolean | `@${string}`,
metadata?: [{	/** JSON select path */
	path?: string | undefined | null},boolean | `@${string}`],
	newEmail?:boolean | `@${string}`,
	otpHash?:boolean | `@${string}`,
	otpHashExpiresAt?:boolean | `@${string}`,
	otpMethodLastUsed?:boolean | `@${string}`,
	passwordHash?:boolean | `@${string}`,
	phoneNumber?:boolean | `@${string}`,
	phoneNumberVerified?:boolean | `@${string}`,
refreshTokens?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens"]],
refreshTokens_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authRefreshTokens_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authRefreshTokens_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null},ResolverInputTypes["authRefreshTokens_aggregate"]],
roles?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles"]],
roles_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserRoles_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserRoles_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null},ResolverInputTypes["authUserRoles_aggregate"]],
securityKeys?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserSecurityKeys_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null},ResolverInputTypes["authUserSecurityKeys"]],
securityKeys_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserSecurityKeys_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserSecurityKeys_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null},ResolverInputTypes["authUserSecurityKeys_aggregate"]],
	ticket?:boolean | `@${string}`,
	ticketExpiresAt?:boolean | `@${string}`,
	totpSecret?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
userProviders?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders"]],
userProviders_aggregate?: [{	/** distinct select on columns */
	distinct_on?: Array<ResolverInputTypes["authUserProviders_select_column"]> | undefined | null,	/** limit the number of rows returned */
	limit?: number | undefined | null,	/** skip the first n rows. Use only with order_by */
	offset?: number | undefined | null,	/** sort the rows by one or more columns */
	order_by?: Array<ResolverInputTypes["authUserProviders_order_by"]> | undefined | null,	/** filter the rows returned */
	where?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null},ResolverInputTypes["authUserProviders_aggregate"]],
		__typename?: boolean | `@${string}`
}>;
	/** aggregated selection of "auth.users" */
["users_aggregate"]: AliasType<{
	aggregate?:ResolverInputTypes["users_aggregate_fields"],
	nodes?:ResolverInputTypes["users"],
		__typename?: boolean | `@${string}`
}>;
	["users_aggregate_bool_exp"]: {
	bool_and?: ResolverInputTypes["users_aggregate_bool_exp_bool_and"] | undefined | null,
	bool_or?: ResolverInputTypes["users_aggregate_bool_exp_bool_or"] | undefined | null,
	count?: ResolverInputTypes["users_aggregate_bool_exp_count"] | undefined | null
};
	["users_aggregate_bool_exp_bool_and"]: {
	arguments: ResolverInputTypes["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Boolean_comparison_exp"]
};
	["users_aggregate_bool_exp_bool_or"]: {
	arguments: ResolverInputTypes["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Boolean_comparison_exp"]
};
	["users_aggregate_bool_exp_count"]: {
	arguments?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,
	distinct?: boolean | undefined | null,
	filter?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	predicate: ResolverInputTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.users" */
["users_aggregate_fields"]: AliasType<{
count?: [{	columns?: Array<ResolverInputTypes["users_select_column"]> | undefined | null,	distinct?: boolean | undefined | null},boolean | `@${string}`],
	max?:ResolverInputTypes["users_max_fields"],
	min?:ResolverInputTypes["users_min_fields"],
		__typename?: boolean | `@${string}`
}>;
	/** order by aggregate values of table "auth.users" */
["users_aggregate_order_by"]: {
	count?: ResolverInputTypes["order_by"] | undefined | null,
	max?: ResolverInputTypes["users_max_order_by"] | undefined | null,
	min?: ResolverInputTypes["users_min_order_by"] | undefined | null
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["users_append_input"]: {
	metadata?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** input type for inserting array relation for remote table "auth.users" */
["users_arr_rel_insert_input"]: {
	data: Array<ResolverInputTypes["users_insert_input"]>,
	/** upsert condition */
	on_conflict?: ResolverInputTypes["users_on_conflict"] | undefined | null
};
	/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
["users_bool_exp"]: {
	_and?: Array<ResolverInputTypes["users_bool_exp"]> | undefined | null,
	_not?: ResolverInputTypes["users_bool_exp"] | undefined | null,
	_or?: Array<ResolverInputTypes["users_bool_exp"]> | undefined | null,
	activeMfaType?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	avatarUrl?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	currentChallenge?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	defaultRole?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	defaultRoleByRole?: ResolverInputTypes["authRoles_bool_exp"] | undefined | null,
	disabled?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	displayName?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	email?: ResolverInputTypes["citext_comparison_exp"] | undefined | null,
	emailVerified?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	events?: ResolverInputTypes["events_bool_exp"] | undefined | null,
	events_aggregate?: ResolverInputTypes["events_aggregate_bool_exp"] | undefined | null,
	id?: ResolverInputTypes["uuid_comparison_exp"] | undefined | null,
	installations?: ResolverInputTypes["installations_bool_exp"] | undefined | null,
	installations_aggregate?: ResolverInputTypes["installations_aggregate_bool_exp"] | undefined | null,
	isAnonymous?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	lastSeen?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	locale?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	metadata?: ResolverInputTypes["jsonb_comparison_exp"] | undefined | null,
	newEmail?: ResolverInputTypes["citext_comparison_exp"] | undefined | null,
	otpHash?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	otpHashExpiresAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	otpMethodLastUsed?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	passwordHash?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phoneNumber?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	phoneNumberVerified?: ResolverInputTypes["Boolean_comparison_exp"] | undefined | null,
	refreshTokens?: ResolverInputTypes["authRefreshTokens_bool_exp"] | undefined | null,
	refreshTokens_aggregate?: ResolverInputTypes["authRefreshTokens_aggregate_bool_exp"] | undefined | null,
	roles?: ResolverInputTypes["authUserRoles_bool_exp"] | undefined | null,
	roles_aggregate?: ResolverInputTypes["authUserRoles_aggregate_bool_exp"] | undefined | null,
	securityKeys?: ResolverInputTypes["authUserSecurityKeys_bool_exp"] | undefined | null,
	securityKeys_aggregate?: ResolverInputTypes["authUserSecurityKeys_aggregate_bool_exp"] | undefined | null,
	ticket?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	ticketExpiresAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	totpSecret?: ResolverInputTypes["String_comparison_exp"] | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz_comparison_exp"] | undefined | null,
	userProviders?: ResolverInputTypes["authUserProviders_bool_exp"] | undefined | null,
	userProviders_aggregate?: ResolverInputTypes["authUserProviders_aggregate_bool_exp"] | undefined | null
};
	/** unique or primary key constraints on table "auth.users" */
["users_constraint"]:users_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["users_delete_at_path_input"]: {
	metadata?: Array<string> | undefined | null
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["users_delete_elem_input"]: {
	metadata?: number | undefined | null
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["users_delete_key_input"]: {
	metadata?: string | undefined | null
};
	/** input type for inserting data into table "auth.users" */
["users_insert_input"]: {
	activeMfaType?: string | undefined | null,
	avatarUrl?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	currentChallenge?: string | undefined | null,
	defaultRole?: string | undefined | null,
	defaultRoleByRole?: ResolverInputTypes["authRoles_obj_rel_insert_input"] | undefined | null,
	disabled?: boolean | undefined | null,
	displayName?: string | undefined | null,
	email?: ResolverInputTypes["citext"] | undefined | null,
	emailVerified?: boolean | undefined | null,
	events?: ResolverInputTypes["events_arr_rel_insert_input"] | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	installations?: ResolverInputTypes["installations_arr_rel_insert_input"] | undefined | null,
	isAnonymous?: boolean | undefined | null,
	lastSeen?: ResolverInputTypes["timestamptz"] | undefined | null,
	locale?: string | undefined | null,
	metadata?: ResolverInputTypes["jsonb"] | undefined | null,
	newEmail?: ResolverInputTypes["citext"] | undefined | null,
	otpHash?: string | undefined | null,
	otpHashExpiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	otpMethodLastUsed?: string | undefined | null,
	passwordHash?: string | undefined | null,
	phoneNumber?: string | undefined | null,
	phoneNumberVerified?: boolean | undefined | null,
	refreshTokens?: ResolverInputTypes["authRefreshTokens_arr_rel_insert_input"] | undefined | null,
	roles?: ResolverInputTypes["authUserRoles_arr_rel_insert_input"] | undefined | null,
	securityKeys?: ResolverInputTypes["authUserSecurityKeys_arr_rel_insert_input"] | undefined | null,
	ticket?: string | undefined | null,
	ticketExpiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	totpSecret?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	userProviders?: ResolverInputTypes["authUserProviders_arr_rel_insert_input"] | undefined | null
};
	/** aggregate max on columns */
["users_max_fields"]: AliasType<{
	activeMfaType?:boolean | `@${string}`,
	avatarUrl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	currentChallenge?:boolean | `@${string}`,
	defaultRole?:boolean | `@${string}`,
	displayName?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	lastSeen?:boolean | `@${string}`,
	locale?:boolean | `@${string}`,
	newEmail?:boolean | `@${string}`,
	otpHash?:boolean | `@${string}`,
	otpHashExpiresAt?:boolean | `@${string}`,
	otpMethodLastUsed?:boolean | `@${string}`,
	passwordHash?:boolean | `@${string}`,
	phoneNumber?:boolean | `@${string}`,
	ticket?:boolean | `@${string}`,
	ticketExpiresAt?:boolean | `@${string}`,
	totpSecret?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by max() on columns of table "auth.users" */
["users_max_order_by"]: {
	activeMfaType?: ResolverInputTypes["order_by"] | undefined | null,
	avatarUrl?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	currentChallenge?: ResolverInputTypes["order_by"] | undefined | null,
	defaultRole?: ResolverInputTypes["order_by"] | undefined | null,
	displayName?: ResolverInputTypes["order_by"] | undefined | null,
	email?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	lastSeen?: ResolverInputTypes["order_by"] | undefined | null,
	locale?: ResolverInputTypes["order_by"] | undefined | null,
	newEmail?: ResolverInputTypes["order_by"] | undefined | null,
	otpHash?: ResolverInputTypes["order_by"] | undefined | null,
	otpHashExpiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	otpMethodLastUsed?: ResolverInputTypes["order_by"] | undefined | null,
	passwordHash?: ResolverInputTypes["order_by"] | undefined | null,
	phoneNumber?: ResolverInputTypes["order_by"] | undefined | null,
	ticket?: ResolverInputTypes["order_by"] | undefined | null,
	ticketExpiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	totpSecret?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null
};
	/** aggregate min on columns */
["users_min_fields"]: AliasType<{
	activeMfaType?:boolean | `@${string}`,
	avatarUrl?:boolean | `@${string}`,
	createdAt?:boolean | `@${string}`,
	currentChallenge?:boolean | `@${string}`,
	defaultRole?:boolean | `@${string}`,
	displayName?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	id?:boolean | `@${string}`,
	lastSeen?:boolean | `@${string}`,
	locale?:boolean | `@${string}`,
	newEmail?:boolean | `@${string}`,
	otpHash?:boolean | `@${string}`,
	otpHashExpiresAt?:boolean | `@${string}`,
	otpMethodLastUsed?:boolean | `@${string}`,
	passwordHash?:boolean | `@${string}`,
	phoneNumber?:boolean | `@${string}`,
	ticket?:boolean | `@${string}`,
	ticketExpiresAt?:boolean | `@${string}`,
	totpSecret?:boolean | `@${string}`,
	updatedAt?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** order by min() on columns of table "auth.users" */
["users_min_order_by"]: {
	activeMfaType?: ResolverInputTypes["order_by"] | undefined | null,
	avatarUrl?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	currentChallenge?: ResolverInputTypes["order_by"] | undefined | null,
	defaultRole?: ResolverInputTypes["order_by"] | undefined | null,
	displayName?: ResolverInputTypes["order_by"] | undefined | null,
	email?: ResolverInputTypes["order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	lastSeen?: ResolverInputTypes["order_by"] | undefined | null,
	locale?: ResolverInputTypes["order_by"] | undefined | null,
	newEmail?: ResolverInputTypes["order_by"] | undefined | null,
	otpHash?: ResolverInputTypes["order_by"] | undefined | null,
	otpHashExpiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	otpMethodLastUsed?: ResolverInputTypes["order_by"] | undefined | null,
	passwordHash?: ResolverInputTypes["order_by"] | undefined | null,
	phoneNumber?: ResolverInputTypes["order_by"] | undefined | null,
	ticket?: ResolverInputTypes["order_by"] | undefined | null,
	ticketExpiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	totpSecret?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null
};
	/** response of any mutation on the table "auth.users" */
["users_mutation_response"]: AliasType<{
	/** number of rows affected by the mutation */
	affected_rows?:boolean | `@${string}`,
	/** data from the rows affected by the mutation */
	returning?:ResolverInputTypes["users"],
		__typename?: boolean | `@${string}`
}>;
	/** input type for inserting object relation for remote table "auth.users" */
["users_obj_rel_insert_input"]: {
	data: ResolverInputTypes["users_insert_input"],
	/** upsert condition */
	on_conflict?: ResolverInputTypes["users_on_conflict"] | undefined | null
};
	/** on_conflict condition type for table "auth.users" */
["users_on_conflict"]: {
	constraint: ResolverInputTypes["users_constraint"],
	update_columns: Array<ResolverInputTypes["users_update_column"]>,
	where?: ResolverInputTypes["users_bool_exp"] | undefined | null
};
	/** Ordering options when selecting data from "auth.users". */
["users_order_by"]: {
	activeMfaType?: ResolverInputTypes["order_by"] | undefined | null,
	avatarUrl?: ResolverInputTypes["order_by"] | undefined | null,
	createdAt?: ResolverInputTypes["order_by"] | undefined | null,
	currentChallenge?: ResolverInputTypes["order_by"] | undefined | null,
	defaultRole?: ResolverInputTypes["order_by"] | undefined | null,
	defaultRoleByRole?: ResolverInputTypes["authRoles_order_by"] | undefined | null,
	disabled?: ResolverInputTypes["order_by"] | undefined | null,
	displayName?: ResolverInputTypes["order_by"] | undefined | null,
	email?: ResolverInputTypes["order_by"] | undefined | null,
	emailVerified?: ResolverInputTypes["order_by"] | undefined | null,
	events_aggregate?: ResolverInputTypes["events_aggregate_order_by"] | undefined | null,
	id?: ResolverInputTypes["order_by"] | undefined | null,
	installations_aggregate?: ResolverInputTypes["installations_aggregate_order_by"] | undefined | null,
	isAnonymous?: ResolverInputTypes["order_by"] | undefined | null,
	lastSeen?: ResolverInputTypes["order_by"] | undefined | null,
	locale?: ResolverInputTypes["order_by"] | undefined | null,
	metadata?: ResolverInputTypes["order_by"] | undefined | null,
	newEmail?: ResolverInputTypes["order_by"] | undefined | null,
	otpHash?: ResolverInputTypes["order_by"] | undefined | null,
	otpHashExpiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	otpMethodLastUsed?: ResolverInputTypes["order_by"] | undefined | null,
	passwordHash?: ResolverInputTypes["order_by"] | undefined | null,
	phoneNumber?: ResolverInputTypes["order_by"] | undefined | null,
	phoneNumberVerified?: ResolverInputTypes["order_by"] | undefined | null,
	refreshTokens_aggregate?: ResolverInputTypes["authRefreshTokens_aggregate_order_by"] | undefined | null,
	roles_aggregate?: ResolverInputTypes["authUserRoles_aggregate_order_by"] | undefined | null,
	securityKeys_aggregate?: ResolverInputTypes["authUserSecurityKeys_aggregate_order_by"] | undefined | null,
	ticket?: ResolverInputTypes["order_by"] | undefined | null,
	ticketExpiresAt?: ResolverInputTypes["order_by"] | undefined | null,
	totpSecret?: ResolverInputTypes["order_by"] | undefined | null,
	updatedAt?: ResolverInputTypes["order_by"] | undefined | null,
	userProviders_aggregate?: ResolverInputTypes["authUserProviders_aggregate_order_by"] | undefined | null
};
	/** primary key columns input for table: auth.users */
["users_pk_columns_input"]: {
	id: ResolverInputTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["users_prepend_input"]: {
	metadata?: ResolverInputTypes["jsonb"] | undefined | null
};
	/** select columns of table "auth.users" */
["users_select_column"]:users_select_column;
	/** select "users_aggregate_bool_exp_bool_and_arguments_columns" columns of table "auth.users" */
["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"]:users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "users_aggregate_bool_exp_bool_or_arguments_columns" columns of table "auth.users" */
["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"]:users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "auth.users" */
["users_set_input"]: {
	activeMfaType?: string | undefined | null,
	avatarUrl?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	currentChallenge?: string | undefined | null,
	defaultRole?: string | undefined | null,
	disabled?: boolean | undefined | null,
	displayName?: string | undefined | null,
	email?: ResolverInputTypes["citext"] | undefined | null,
	emailVerified?: boolean | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isAnonymous?: boolean | undefined | null,
	lastSeen?: ResolverInputTypes["timestamptz"] | undefined | null,
	locale?: string | undefined | null,
	metadata?: ResolverInputTypes["jsonb"] | undefined | null,
	newEmail?: ResolverInputTypes["citext"] | undefined | null,
	otpHash?: string | undefined | null,
	otpHashExpiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	otpMethodLastUsed?: string | undefined | null,
	passwordHash?: string | undefined | null,
	phoneNumber?: string | undefined | null,
	phoneNumberVerified?: boolean | undefined | null,
	ticket?: string | undefined | null,
	ticketExpiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	totpSecret?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** Streaming cursor of the table "users" */
["users_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ResolverInputTypes["users_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ResolverInputTypes["cursor_ordering"] | undefined | null
};
	/** Initial value of the column from where the streaming should start */
["users_stream_cursor_value_input"]: {
	activeMfaType?: string | undefined | null,
	avatarUrl?: string | undefined | null,
	createdAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	currentChallenge?: string | undefined | null,
	defaultRole?: string | undefined | null,
	disabled?: boolean | undefined | null,
	displayName?: string | undefined | null,
	email?: ResolverInputTypes["citext"] | undefined | null,
	emailVerified?: boolean | undefined | null,
	id?: ResolverInputTypes["uuid"] | undefined | null,
	isAnonymous?: boolean | undefined | null,
	lastSeen?: ResolverInputTypes["timestamptz"] | undefined | null,
	locale?: string | undefined | null,
	metadata?: ResolverInputTypes["jsonb"] | undefined | null,
	newEmail?: ResolverInputTypes["citext"] | undefined | null,
	otpHash?: string | undefined | null,
	otpHashExpiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	otpMethodLastUsed?: string | undefined | null,
	passwordHash?: string | undefined | null,
	phoneNumber?: string | undefined | null,
	phoneNumberVerified?: boolean | undefined | null,
	ticket?: string | undefined | null,
	ticketExpiresAt?: ResolverInputTypes["timestamptz"] | undefined | null,
	totpSecret?: string | undefined | null,
	updatedAt?: ResolverInputTypes["timestamptz"] | undefined | null
};
	/** update columns of table "auth.users" */
["users_update_column"]:users_update_column;
	["users_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ResolverInputTypes["users_append_input"] | undefined | null,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ResolverInputTypes["users_delete_at_path_input"] | undefined | null,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ResolverInputTypes["users_delete_elem_input"] | undefined | null,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ResolverInputTypes["users_delete_key_input"] | undefined | null,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ResolverInputTypes["users_prepend_input"] | undefined | null,
	/** sets the columns of the filtered rows to the given values */
	_set?: ResolverInputTypes["users_set_input"] | undefined | null,
	/** filter the rows which have to be updated */
	where: ResolverInputTypes["users_bool_exp"]
};
	["uuid"]:unknown;
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
	_eq?: ResolverInputTypes["uuid"] | undefined | null,
	_gt?: ResolverInputTypes["uuid"] | undefined | null,
	_gte?: ResolverInputTypes["uuid"] | undefined | null,
	_in?: Array<ResolverInputTypes["uuid"]> | undefined | null,
	_is_null?: boolean | undefined | null,
	_lt?: ResolverInputTypes["uuid"] | undefined | null,
	_lte?: ResolverInputTypes["uuid"] | undefined | null,
	_neq?: ResolverInputTypes["uuid"] | undefined | null,
	_nin?: Array<ResolverInputTypes["uuid"]> | undefined | null
}
  }

export type ModelTypes = {
    ["schema"]: {
	query?: ModelTypes["query_root"] | undefined,
	mutation?: ModelTypes["mutation_root"] | undefined,
	subscription?: ModelTypes["subscription_root"] | undefined
};
	/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
	_eq?: boolean | undefined,
	_gt?: boolean | undefined,
	_gte?: boolean | undefined,
	_in?: Array<boolean> | undefined,
	_is_null?: boolean | undefined,
	_lt?: boolean | undefined,
	_lte?: boolean | undefined,
	_neq?: boolean | undefined,
	_nin?: Array<boolean> | undefined
};
	/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
	_eq?: number | undefined,
	_gt?: number | undefined,
	_gte?: number | undefined,
	_in?: Array<number> | undefined,
	_is_null?: boolean | undefined,
	_lt?: number | undefined,
	_lte?: number | undefined,
	_neq?: number | undefined,
	_nin?: Array<number> | undefined
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
	_eq?: string | undefined,
	_gt?: string | undefined,
	_gte?: string | undefined,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined,
	_in?: Array<string> | undefined,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined,
	_is_null?: boolean | undefined,
	/** does the column match the given pattern */
	_like?: string | undefined,
	_lt?: string | undefined,
	_lte?: string | undefined,
	_neq?: string | undefined,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined,
	_nin?: Array<string> | undefined,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined
};
	/** Oauth requests, inserted before redirecting to the provider's site. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviderRequests"]: {
		id: ModelTypes["uuid"],
	options?: ModelTypes["jsonb"] | undefined
};
	/** aggregated selection of "auth.provider_requests" */
["authProviderRequests_aggregate"]: {
		aggregate?: ModelTypes["authProviderRequests_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authProviderRequests"]>
};
	/** aggregate fields of "auth.provider_requests" */
["authProviderRequests_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["authProviderRequests_max_fields"] | undefined,
	min?: ModelTypes["authProviderRequests_min_fields"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_append_input"]: {
	options?: ModelTypes["jsonb"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.provider_requests". All fields are combined with a logical 'AND'. */
["authProviderRequests_bool_exp"]: {
	_and?: Array<ModelTypes["authProviderRequests_bool_exp"]> | undefined,
	_not?: ModelTypes["authProviderRequests_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authProviderRequests_bool_exp"]> | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	options?: ModelTypes["jsonb_comparison_exp"] | undefined
};
	["authProviderRequests_constraint"]:authProviderRequests_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authProviderRequests_delete_at_path_input"]: {
	options?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authProviderRequests_delete_elem_input"]: {
	options?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authProviderRequests_delete_key_input"]: {
	options?: string | undefined
};
	/** input type for inserting data into table "auth.provider_requests" */
["authProviderRequests_insert_input"]: {
	id?: ModelTypes["uuid"] | undefined,
	options?: ModelTypes["jsonb"] | undefined
};
	/** aggregate max on columns */
["authProviderRequests_max_fields"]: {
		id?: ModelTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["authProviderRequests_min_fields"]: {
		id?: ModelTypes["uuid"] | undefined
};
	/** response of any mutation on the table "auth.provider_requests" */
["authProviderRequests_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authProviderRequests"]>
};
	/** on_conflict condition type for table "auth.provider_requests" */
["authProviderRequests_on_conflict"]: {
	constraint: ModelTypes["authProviderRequests_constraint"],
	update_columns: Array<ModelTypes["authProviderRequests_update_column"]>,
	where?: ModelTypes["authProviderRequests_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.provider_requests". */
["authProviderRequests_order_by"]: {
	id?: ModelTypes["order_by"] | undefined,
	options?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.provider_requests */
["authProviderRequests_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_prepend_input"]: {
	options?: ModelTypes["jsonb"] | undefined
};
	["authProviderRequests_select_column"]:authProviderRequests_select_column;
	/** input type for updating data in table "auth.provider_requests" */
["authProviderRequests_set_input"]: {
	id?: ModelTypes["uuid"] | undefined,
	options?: ModelTypes["jsonb"] | undefined
};
	/** Streaming cursor of the table "authProviderRequests" */
["authProviderRequests_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authProviderRequests_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authProviderRequests_stream_cursor_value_input"]: {
	id?: ModelTypes["uuid"] | undefined,
	options?: ModelTypes["jsonb"] | undefined
};
	["authProviderRequests_update_column"]:authProviderRequests_update_column;
	["authProviderRequests_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ModelTypes["authProviderRequests_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ModelTypes["authProviderRequests_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ModelTypes["authProviderRequests_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ModelTypes["authProviderRequests_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ModelTypes["authProviderRequests_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authProviderRequests_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authProviderRequests_bool_exp"]
};
	/** List of available Oauth providers. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviders"]: {
		id: string,
	/** An array relationship */
	userProviders: Array<ModelTypes["authUserProviders"]>,
	/** An aggregate relationship */
	userProviders_aggregate: ModelTypes["authUserProviders_aggregate"]
};
	/** aggregated selection of "auth.providers" */
["authProviders_aggregate"]: {
		aggregate?: ModelTypes["authProviders_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authProviders"]>
};
	/** aggregate fields of "auth.providers" */
["authProviders_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["authProviders_max_fields"] | undefined,
	min?: ModelTypes["authProviders_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.providers". All fields are combined with a logical 'AND'. */
["authProviders_bool_exp"]: {
	_and?: Array<ModelTypes["authProviders_bool_exp"]> | undefined,
	_not?: ModelTypes["authProviders_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authProviders_bool_exp"]> | undefined,
	id?: ModelTypes["String_comparison_exp"] | undefined,
	userProviders?: ModelTypes["authUserProviders_bool_exp"] | undefined,
	userProviders_aggregate?: ModelTypes["authUserProviders_aggregate_bool_exp"] | undefined
};
	["authProviders_constraint"]:authProviders_constraint;
	/** input type for inserting data into table "auth.providers" */
["authProviders_insert_input"]: {
	id?: string | undefined,
	userProviders?: ModelTypes["authUserProviders_arr_rel_insert_input"] | undefined
};
	/** aggregate max on columns */
["authProviders_max_fields"]: {
		id?: string | undefined
};
	/** aggregate min on columns */
["authProviders_min_fields"]: {
		id?: string | undefined
};
	/** response of any mutation on the table "auth.providers" */
["authProviders_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authProviders"]>
};
	/** input type for inserting object relation for remote table "auth.providers" */
["authProviders_obj_rel_insert_input"]: {
	data: ModelTypes["authProviders_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["authProviders_on_conflict"] | undefined
};
	/** on_conflict condition type for table "auth.providers" */
["authProviders_on_conflict"]: {
	constraint: ModelTypes["authProviders_constraint"],
	update_columns: Array<ModelTypes["authProviders_update_column"]>,
	where?: ModelTypes["authProviders_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.providers". */
["authProviders_order_by"]: {
	id?: ModelTypes["order_by"] | undefined,
	userProviders_aggregate?: ModelTypes["authUserProviders_aggregate_order_by"] | undefined
};
	/** primary key columns input for table: auth.providers */
["authProviders_pk_columns_input"]: {
	id: string
};
	["authProviders_select_column"]:authProviders_select_column;
	/** input type for updating data in table "auth.providers" */
["authProviders_set_input"]: {
	id?: string | undefined
};
	/** Streaming cursor of the table "authProviders" */
["authProviders_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authProviders_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authProviders_stream_cursor_value_input"]: {
	id?: string | undefined
};
	["authProviders_update_column"]:authProviders_update_column;
	["authProviders_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authProviders_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authProviders_bool_exp"]
};
	/** columns and relationships of "auth.refresh_token_types" */
["authRefreshTokenTypes"]: {
		comment?: string | undefined,
	/** An array relationship */
	refreshTokens: Array<ModelTypes["authRefreshTokens"]>,
	/** An aggregate relationship */
	refreshTokens_aggregate: ModelTypes["authRefreshTokens_aggregate"],
	value: string
};
	/** aggregated selection of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate"]: {
		aggregate?: ModelTypes["authRefreshTokenTypes_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authRefreshTokenTypes"]>
};
	/** aggregate fields of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["authRefreshTokenTypes_max_fields"] | undefined,
	min?: ModelTypes["authRefreshTokenTypes_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.refresh_token_types". All fields are combined with a logical 'AND'. */
["authRefreshTokenTypes_bool_exp"]: {
	_and?: Array<ModelTypes["authRefreshTokenTypes_bool_exp"]> | undefined,
	_not?: ModelTypes["authRefreshTokenTypes_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authRefreshTokenTypes_bool_exp"]> | undefined,
	comment?: ModelTypes["String_comparison_exp"] | undefined,
	refreshTokens?: ModelTypes["authRefreshTokens_bool_exp"] | undefined,
	refreshTokens_aggregate?: ModelTypes["authRefreshTokens_aggregate_bool_exp"] | undefined,
	value?: ModelTypes["String_comparison_exp"] | undefined
};
	["authRefreshTokenTypes_constraint"]:authRefreshTokenTypes_constraint;
	["authRefreshTokenTypes_enum"]:authRefreshTokenTypes_enum;
	/** Boolean expression to compare columns of type "authRefreshTokenTypes_enum". All fields are combined with logical 'AND'. */
["authRefreshTokenTypes_enum_comparison_exp"]: {
	_eq?: ModelTypes["authRefreshTokenTypes_enum"] | undefined,
	_in?: Array<ModelTypes["authRefreshTokenTypes_enum"]> | undefined,
	_is_null?: boolean | undefined,
	_neq?: ModelTypes["authRefreshTokenTypes_enum"] | undefined,
	_nin?: Array<ModelTypes["authRefreshTokenTypes_enum"]> | undefined
};
	/** input type for inserting data into table "auth.refresh_token_types" */
["authRefreshTokenTypes_insert_input"]: {
	comment?: string | undefined,
	refreshTokens?: ModelTypes["authRefreshTokens_arr_rel_insert_input"] | undefined,
	value?: string | undefined
};
	/** aggregate max on columns */
["authRefreshTokenTypes_max_fields"]: {
		comment?: string | undefined,
	value?: string | undefined
};
	/** aggregate min on columns */
["authRefreshTokenTypes_min_fields"]: {
		comment?: string | undefined,
	value?: string | undefined
};
	/** response of any mutation on the table "auth.refresh_token_types" */
["authRefreshTokenTypes_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authRefreshTokenTypes"]>
};
	/** on_conflict condition type for table "auth.refresh_token_types" */
["authRefreshTokenTypes_on_conflict"]: {
	constraint: ModelTypes["authRefreshTokenTypes_constraint"],
	update_columns: Array<ModelTypes["authRefreshTokenTypes_update_column"]>,
	where?: ModelTypes["authRefreshTokenTypes_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.refresh_token_types". */
["authRefreshTokenTypes_order_by"]: {
	comment?: ModelTypes["order_by"] | undefined,
	refreshTokens_aggregate?: ModelTypes["authRefreshTokens_aggregate_order_by"] | undefined,
	value?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.refresh_token_types */
["authRefreshTokenTypes_pk_columns_input"]: {
	value: string
};
	["authRefreshTokenTypes_select_column"]:authRefreshTokenTypes_select_column;
	/** input type for updating data in table "auth.refresh_token_types" */
["authRefreshTokenTypes_set_input"]: {
	comment?: string | undefined,
	value?: string | undefined
};
	/** Streaming cursor of the table "authRefreshTokenTypes" */
["authRefreshTokenTypes_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authRefreshTokenTypes_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokenTypes_stream_cursor_value_input"]: {
	comment?: string | undefined,
	value?: string | undefined
};
	["authRefreshTokenTypes_update_column"]:authRefreshTokenTypes_update_column;
	["authRefreshTokenTypes_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authRefreshTokenTypes_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authRefreshTokenTypes_bool_exp"]
};
	/** User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRefreshTokens"]: {
		createdAt: ModelTypes["timestamptz"],
	expiresAt: ModelTypes["timestamptz"],
	id: ModelTypes["uuid"],
	metadata?: ModelTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type: ModelTypes["authRefreshTokenTypes_enum"],
	/** An object relationship */
	user: ModelTypes["users"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "auth.refresh_tokens" */
["authRefreshTokens_aggregate"]: {
		aggregate?: ModelTypes["authRefreshTokens_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authRefreshTokens"]>
};
	["authRefreshTokens_aggregate_bool_exp"]: {
	count?: ModelTypes["authRefreshTokens_aggregate_bool_exp_count"] | undefined
};
	["authRefreshTokens_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["authRefreshTokens_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["authRefreshTokens_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.refresh_tokens" */
["authRefreshTokens_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["authRefreshTokens_max_fields"] | undefined,
	min?: ModelTypes["authRefreshTokens_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.refresh_tokens" */
["authRefreshTokens_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["authRefreshTokens_max_order_by"] | undefined,
	min?: ModelTypes["authRefreshTokens_min_order_by"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_append_input"]: {
	metadata?: ModelTypes["jsonb"] | undefined
};
	/** input type for inserting array relation for remote table "auth.refresh_tokens" */
["authRefreshTokens_arr_rel_insert_input"]: {
	data: Array<ModelTypes["authRefreshTokens_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["authRefreshTokens_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.refresh_tokens". All fields are combined with a logical 'AND'. */
["authRefreshTokens_bool_exp"]: {
	_and?: Array<ModelTypes["authRefreshTokens_bool_exp"]> | undefined,
	_not?: ModelTypes["authRefreshTokens_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authRefreshTokens_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	expiresAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	metadata?: ModelTypes["jsonb_comparison_exp"] | undefined,
	refreshTokenHash?: ModelTypes["String_comparison_exp"] | undefined,
	type?: ModelTypes["authRefreshTokenTypes_enum_comparison_exp"] | undefined,
	user?: ModelTypes["users_bool_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["authRefreshTokens_constraint"]:authRefreshTokens_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authRefreshTokens_delete_at_path_input"]: {
	metadata?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authRefreshTokens_delete_elem_input"]: {
	metadata?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authRefreshTokens_delete_key_input"]: {
	metadata?: string | undefined
};
	/** input type for inserting data into table "auth.refresh_tokens" */
["authRefreshTokens_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	expiresAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	metadata?: ModelTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type?: ModelTypes["authRefreshTokenTypes_enum"] | undefined,
	user?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authRefreshTokens_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	expiresAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	refreshTokenHash?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_max_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	expiresAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	refreshTokenHash?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authRefreshTokens_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	expiresAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	refreshTokenHash?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_min_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	expiresAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	refreshTokenHash?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.refresh_tokens" */
["authRefreshTokens_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authRefreshTokens"]>
};
	/** on_conflict condition type for table "auth.refresh_tokens" */
["authRefreshTokens_on_conflict"]: {
	constraint: ModelTypes["authRefreshTokens_constraint"],
	update_columns: Array<ModelTypes["authRefreshTokens_update_column"]>,
	where?: ModelTypes["authRefreshTokens_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.refresh_tokens". */
["authRefreshTokens_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	expiresAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	metadata?: ModelTypes["order_by"] | undefined,
	refreshTokenHash?: ModelTypes["order_by"] | undefined,
	type?: ModelTypes["order_by"] | undefined,
	user?: ModelTypes["users_order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.refresh_tokens */
["authRefreshTokens_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_prepend_input"]: {
	metadata?: ModelTypes["jsonb"] | undefined
};
	["authRefreshTokens_select_column"]:authRefreshTokens_select_column;
	/** input type for updating data in table "auth.refresh_tokens" */
["authRefreshTokens_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	expiresAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	metadata?: ModelTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type?: ModelTypes["authRefreshTokenTypes_enum"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "authRefreshTokens" */
["authRefreshTokens_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authRefreshTokens_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokens_stream_cursor_value_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	expiresAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	metadata?: ModelTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type?: ModelTypes["authRefreshTokenTypes_enum"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	["authRefreshTokens_update_column"]:authRefreshTokens_update_column;
	["authRefreshTokens_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ModelTypes["authRefreshTokens_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ModelTypes["authRefreshTokens_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ModelTypes["authRefreshTokens_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ModelTypes["authRefreshTokens_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ModelTypes["authRefreshTokens_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authRefreshTokens_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authRefreshTokens_bool_exp"]
};
	/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRoles"]: {
		role: string,
	/** An array relationship */
	userRoles: Array<ModelTypes["authUserRoles"]>,
	/** An aggregate relationship */
	userRoles_aggregate: ModelTypes["authUserRoles_aggregate"],
	/** An array relationship */
	usersByDefaultRole: Array<ModelTypes["users"]>,
	/** An aggregate relationship */
	usersByDefaultRole_aggregate: ModelTypes["users_aggregate"]
};
	/** aggregated selection of "auth.roles" */
["authRoles_aggregate"]: {
		aggregate?: ModelTypes["authRoles_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authRoles"]>
};
	/** aggregate fields of "auth.roles" */
["authRoles_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["authRoles_max_fields"] | undefined,
	min?: ModelTypes["authRoles_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.roles". All fields are combined with a logical 'AND'. */
["authRoles_bool_exp"]: {
	_and?: Array<ModelTypes["authRoles_bool_exp"]> | undefined,
	_not?: ModelTypes["authRoles_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authRoles_bool_exp"]> | undefined,
	role?: ModelTypes["String_comparison_exp"] | undefined,
	userRoles?: ModelTypes["authUserRoles_bool_exp"] | undefined,
	userRoles_aggregate?: ModelTypes["authUserRoles_aggregate_bool_exp"] | undefined,
	usersByDefaultRole?: ModelTypes["users_bool_exp"] | undefined,
	usersByDefaultRole_aggregate?: ModelTypes["users_aggregate_bool_exp"] | undefined
};
	["authRoles_constraint"]:authRoles_constraint;
	/** input type for inserting data into table "auth.roles" */
["authRoles_insert_input"]: {
	role?: string | undefined,
	userRoles?: ModelTypes["authUserRoles_arr_rel_insert_input"] | undefined,
	usersByDefaultRole?: ModelTypes["users_arr_rel_insert_input"] | undefined
};
	/** aggregate max on columns */
["authRoles_max_fields"]: {
		role?: string | undefined
};
	/** aggregate min on columns */
["authRoles_min_fields"]: {
		role?: string | undefined
};
	/** response of any mutation on the table "auth.roles" */
["authRoles_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authRoles"]>
};
	/** input type for inserting object relation for remote table "auth.roles" */
["authRoles_obj_rel_insert_input"]: {
	data: ModelTypes["authRoles_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["authRoles_on_conflict"] | undefined
};
	/** on_conflict condition type for table "auth.roles" */
["authRoles_on_conflict"]: {
	constraint: ModelTypes["authRoles_constraint"],
	update_columns: Array<ModelTypes["authRoles_update_column"]>,
	where?: ModelTypes["authRoles_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.roles". */
["authRoles_order_by"]: {
	role?: ModelTypes["order_by"] | undefined,
	userRoles_aggregate?: ModelTypes["authUserRoles_aggregate_order_by"] | undefined,
	usersByDefaultRole_aggregate?: ModelTypes["users_aggregate_order_by"] | undefined
};
	/** primary key columns input for table: auth.roles */
["authRoles_pk_columns_input"]: {
	role: string
};
	["authRoles_select_column"]:authRoles_select_column;
	/** input type for updating data in table "auth.roles" */
["authRoles_set_input"]: {
	role?: string | undefined
};
	/** Streaming cursor of the table "authRoles" */
["authRoles_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authRoles_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authRoles_stream_cursor_value_input"]: {
	role?: string | undefined
};
	["authRoles_update_column"]:authRoles_update_column;
	["authRoles_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authRoles_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authRoles_bool_exp"]
};
	/** Active providers for a given user. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserProviders"]: {
		accessToken: string,
	createdAt: ModelTypes["timestamptz"],
	id: ModelTypes["uuid"],
	/** An object relationship */
	provider: ModelTypes["authProviders"],
	providerId: string,
	providerUserId: string,
	refreshToken?: string | undefined,
	updatedAt: ModelTypes["timestamptz"],
	/** An object relationship */
	user: ModelTypes["users"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "auth.user_providers" */
["authUserProviders_aggregate"]: {
		aggregate?: ModelTypes["authUserProviders_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authUserProviders"]>
};
	["authUserProviders_aggregate_bool_exp"]: {
	count?: ModelTypes["authUserProviders_aggregate_bool_exp_count"] | undefined
};
	["authUserProviders_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["authUserProviders_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["authUserProviders_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_providers" */
["authUserProviders_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["authUserProviders_max_fields"] | undefined,
	min?: ModelTypes["authUserProviders_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.user_providers" */
["authUserProviders_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["authUserProviders_max_order_by"] | undefined,
	min?: ModelTypes["authUserProviders_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "auth.user_providers" */
["authUserProviders_arr_rel_insert_input"]: {
	data: Array<ModelTypes["authUserProviders_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["authUserProviders_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.user_providers". All fields are combined with a logical 'AND'. */
["authUserProviders_bool_exp"]: {
	_and?: Array<ModelTypes["authUserProviders_bool_exp"]> | undefined,
	_not?: ModelTypes["authUserProviders_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authUserProviders_bool_exp"]> | undefined,
	accessToken?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	provider?: ModelTypes["authProviders_bool_exp"] | undefined,
	providerId?: ModelTypes["String_comparison_exp"] | undefined,
	providerUserId?: ModelTypes["String_comparison_exp"] | undefined,
	refreshToken?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	user?: ModelTypes["users_bool_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["authUserProviders_constraint"]:authUserProviders_constraint;
	/** input type for inserting data into table "auth.user_providers" */
["authUserProviders_insert_input"]: {
	accessToken?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	provider?: ModelTypes["authProviders_obj_rel_insert_input"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	user?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authUserProviders_max_fields"]: {
		accessToken?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.user_providers" */
["authUserProviders_max_order_by"]: {
	accessToken?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	providerId?: ModelTypes["order_by"] | undefined,
	providerUserId?: ModelTypes["order_by"] | undefined,
	refreshToken?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authUserProviders_min_fields"]: {
		accessToken?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.user_providers" */
["authUserProviders_min_order_by"]: {
	accessToken?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	providerId?: ModelTypes["order_by"] | undefined,
	providerUserId?: ModelTypes["order_by"] | undefined,
	refreshToken?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.user_providers" */
["authUserProviders_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authUserProviders"]>
};
	/** on_conflict condition type for table "auth.user_providers" */
["authUserProviders_on_conflict"]: {
	constraint: ModelTypes["authUserProviders_constraint"],
	update_columns: Array<ModelTypes["authUserProviders_update_column"]>,
	where?: ModelTypes["authUserProviders_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.user_providers". */
["authUserProviders_order_by"]: {
	accessToken?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	provider?: ModelTypes["authProviders_order_by"] | undefined,
	providerId?: ModelTypes["order_by"] | undefined,
	providerUserId?: ModelTypes["order_by"] | undefined,
	refreshToken?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	user?: ModelTypes["users_order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.user_providers */
["authUserProviders_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["authUserProviders_select_column"]:authUserProviders_select_column;
	/** input type for updating data in table "auth.user_providers" */
["authUserProviders_set_input"]: {
	accessToken?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "authUserProviders" */
["authUserProviders_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authUserProviders_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authUserProviders_stream_cursor_value_input"]: {
	accessToken?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	["authUserProviders_update_column"]:authUserProviders_update_column;
	["authUserProviders_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authUserProviders_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authUserProviders_bool_exp"]
};
	/** Roles of users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserRoles"]: {
		createdAt: ModelTypes["timestamptz"],
	id: ModelTypes["uuid"],
	role: string,
	/** An object relationship */
	roleByRole: ModelTypes["authRoles"],
	/** An object relationship */
	user: ModelTypes["users"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "auth.user_roles" */
["authUserRoles_aggregate"]: {
		aggregate?: ModelTypes["authUserRoles_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authUserRoles"]>
};
	["authUserRoles_aggregate_bool_exp"]: {
	count?: ModelTypes["authUserRoles_aggregate_bool_exp_count"] | undefined
};
	["authUserRoles_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["authUserRoles_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["authUserRoles_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_roles" */
["authUserRoles_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["authUserRoles_max_fields"] | undefined,
	min?: ModelTypes["authUserRoles_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.user_roles" */
["authUserRoles_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["authUserRoles_max_order_by"] | undefined,
	min?: ModelTypes["authUserRoles_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "auth.user_roles" */
["authUserRoles_arr_rel_insert_input"]: {
	data: Array<ModelTypes["authUserRoles_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["authUserRoles_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.user_roles". All fields are combined with a logical 'AND'. */
["authUserRoles_bool_exp"]: {
	_and?: Array<ModelTypes["authUserRoles_bool_exp"]> | undefined,
	_not?: ModelTypes["authUserRoles_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authUserRoles_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	role?: ModelTypes["String_comparison_exp"] | undefined,
	roleByRole?: ModelTypes["authRoles_bool_exp"] | undefined,
	user?: ModelTypes["users_bool_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["authUserRoles_constraint"]:authUserRoles_constraint;
	/** input type for inserting data into table "auth.user_roles" */
["authUserRoles_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	roleByRole?: ModelTypes["authRoles_obj_rel_insert_input"] | undefined,
	user?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authUserRoles_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.user_roles" */
["authUserRoles_max_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authUserRoles_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.user_roles" */
["authUserRoles_min_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.user_roles" */
["authUserRoles_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authUserRoles"]>
};
	/** on_conflict condition type for table "auth.user_roles" */
["authUserRoles_on_conflict"]: {
	constraint: ModelTypes["authUserRoles_constraint"],
	update_columns: Array<ModelTypes["authUserRoles_update_column"]>,
	where?: ModelTypes["authUserRoles_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.user_roles". */
["authUserRoles_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	roleByRole?: ModelTypes["authRoles_order_by"] | undefined,
	user?: ModelTypes["users_order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.user_roles */
["authUserRoles_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["authUserRoles_select_column"]:authUserRoles_select_column;
	/** input type for updating data in table "auth.user_roles" */
["authUserRoles_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "authUserRoles" */
["authUserRoles_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authUserRoles_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authUserRoles_stream_cursor_value_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	["authUserRoles_update_column"]:authUserRoles_update_column;
	["authUserRoles_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authUserRoles_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authUserRoles_bool_exp"]
};
	/** User webauthn security keys. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserSecurityKeys"]: {
		counter: ModelTypes["bigint"],
	credentialId: string,
	credentialPublicKey?: ModelTypes["bytea"] | undefined,
	id: ModelTypes["uuid"],
	nickname?: string | undefined,
	transports: string,
	/** An object relationship */
	user: ModelTypes["users"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate"]: {
		aggregate?: ModelTypes["authUserSecurityKeys_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["authUserSecurityKeys"]>
};
	["authUserSecurityKeys_aggregate_bool_exp"]: {
	count?: ModelTypes["authUserSecurityKeys_aggregate_bool_exp_count"] | undefined
};
	["authUserSecurityKeys_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["authUserSecurityKeys_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["authUserSecurityKeys_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_fields"]: {
		avg?: ModelTypes["authUserSecurityKeys_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["authUserSecurityKeys_max_fields"] | undefined,
	min?: ModelTypes["authUserSecurityKeys_min_fields"] | undefined,
	stddev?: ModelTypes["authUserSecurityKeys_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["authUserSecurityKeys_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["authUserSecurityKeys_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["authUserSecurityKeys_sum_fields"] | undefined,
	var_pop?: ModelTypes["authUserSecurityKeys_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["authUserSecurityKeys_var_samp_fields"] | undefined,
	variance?: ModelTypes["authUserSecurityKeys_variance_fields"] | undefined
};
	/** order by aggregate values of table "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_order_by"]: {
	avg?: ModelTypes["authUserSecurityKeys_avg_order_by"] | undefined,
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["authUserSecurityKeys_max_order_by"] | undefined,
	min?: ModelTypes["authUserSecurityKeys_min_order_by"] | undefined,
	stddev?: ModelTypes["authUserSecurityKeys_stddev_order_by"] | undefined,
	stddev_pop?: ModelTypes["authUserSecurityKeys_stddev_pop_order_by"] | undefined,
	stddev_samp?: ModelTypes["authUserSecurityKeys_stddev_samp_order_by"] | undefined,
	sum?: ModelTypes["authUserSecurityKeys_sum_order_by"] | undefined,
	var_pop?: ModelTypes["authUserSecurityKeys_var_pop_order_by"] | undefined,
	var_samp?: ModelTypes["authUserSecurityKeys_var_samp_order_by"] | undefined,
	variance?: ModelTypes["authUserSecurityKeys_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "auth.user_security_keys" */
["authUserSecurityKeys_arr_rel_insert_input"]: {
	data: Array<ModelTypes["authUserSecurityKeys_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["authUserSecurityKeys_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["authUserSecurityKeys_avg_fields"]: {
		counter?: number | undefined
};
	/** order by avg() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_avg_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.user_security_keys". All fields are combined with a logical 'AND'. */
["authUserSecurityKeys_bool_exp"]: {
	_and?: Array<ModelTypes["authUserSecurityKeys_bool_exp"]> | undefined,
	_not?: ModelTypes["authUserSecurityKeys_bool_exp"] | undefined,
	_or?: Array<ModelTypes["authUserSecurityKeys_bool_exp"]> | undefined,
	counter?: ModelTypes["bigint_comparison_exp"] | undefined,
	credentialId?: ModelTypes["String_comparison_exp"] | undefined,
	credentialPublicKey?: ModelTypes["bytea_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	nickname?: ModelTypes["String_comparison_exp"] | undefined,
	transports?: ModelTypes["String_comparison_exp"] | undefined,
	user?: ModelTypes["users_bool_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["authUserSecurityKeys_constraint"]:authUserSecurityKeys_constraint;
	/** input type for incrementing numeric columns in table "auth.user_security_keys" */
["authUserSecurityKeys_inc_input"]: {
	counter?: ModelTypes["bigint"] | undefined
};
	/** input type for inserting data into table "auth.user_security_keys" */
["authUserSecurityKeys_insert_input"]: {
	counter?: ModelTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	credentialPublicKey?: ModelTypes["bytea"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	user?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authUserSecurityKeys_max_fields"]: {
		counter?: ModelTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_max_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined,
	credentialId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	nickname?: ModelTypes["order_by"] | undefined,
	transports?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authUserSecurityKeys_min_fields"]: {
		counter?: ModelTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_min_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined,
	credentialId?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	nickname?: ModelTypes["order_by"] | undefined,
	transports?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.user_security_keys" */
["authUserSecurityKeys_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["authUserSecurityKeys"]>
};
	/** on_conflict condition type for table "auth.user_security_keys" */
["authUserSecurityKeys_on_conflict"]: {
	constraint: ModelTypes["authUserSecurityKeys_constraint"],
	update_columns: Array<ModelTypes["authUserSecurityKeys_update_column"]>,
	where?: ModelTypes["authUserSecurityKeys_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.user_security_keys". */
["authUserSecurityKeys_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined,
	credentialId?: ModelTypes["order_by"] | undefined,
	credentialPublicKey?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	nickname?: ModelTypes["order_by"] | undefined,
	transports?: ModelTypes["order_by"] | undefined,
	user?: ModelTypes["users_order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.user_security_keys */
["authUserSecurityKeys_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["authUserSecurityKeys_select_column"]:authUserSecurityKeys_select_column;
	/** input type for updating data in table "auth.user_security_keys" */
["authUserSecurityKeys_set_input"]: {
	counter?: ModelTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	credentialPublicKey?: ModelTypes["bytea"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["authUserSecurityKeys_stddev_fields"]: {
		counter?: number | undefined
};
	/** order by stddev() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["authUserSecurityKeys_stddev_pop_fields"]: {
		counter?: number | undefined
};
	/** order by stddev_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_pop_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["authUserSecurityKeys_stddev_samp_fields"]: {
		counter?: number | undefined
};
	/** order by stddev_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_samp_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "authUserSecurityKeys" */
["authUserSecurityKeys_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["authUserSecurityKeys_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authUserSecurityKeys_stream_cursor_value_input"]: {
	counter?: ModelTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	credentialPublicKey?: ModelTypes["bytea"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["authUserSecurityKeys_sum_fields"]: {
		counter?: ModelTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_sum_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	["authUserSecurityKeys_update_column"]:authUserSecurityKeys_update_column;
	["authUserSecurityKeys_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["authUserSecurityKeys_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["authUserSecurityKeys_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["authUserSecurityKeys_bool_exp"]
};
	/** aggregate var_pop on columns */
["authUserSecurityKeys_var_pop_fields"]: {
		counter?: number | undefined
};
	/** order by var_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_pop_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["authUserSecurityKeys_var_samp_fields"]: {
		counter?: number | undefined
};
	/** order by var_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_samp_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["authUserSecurityKeys_variance_fields"]: {
		counter?: number | undefined
};
	/** order by variance() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_variance_order_by"]: {
	counter?: ModelTypes["order_by"] | undefined
};
	["bigint"]:any;
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
	_eq?: ModelTypes["bigint"] | undefined,
	_gt?: ModelTypes["bigint"] | undefined,
	_gte?: ModelTypes["bigint"] | undefined,
	_in?: Array<ModelTypes["bigint"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["bigint"] | undefined,
	_lte?: ModelTypes["bigint"] | undefined,
	_neq?: ModelTypes["bigint"] | undefined,
	_nin?: Array<ModelTypes["bigint"]> | undefined
};
	/** columns and relationships of "storage.buckets" */
["buckets"]: {
		cacheControl?: string | undefined,
	createdAt: ModelTypes["timestamptz"],
	downloadExpiration: number,
	/** An array relationship */
	files: Array<ModelTypes["files"]>,
	/** An aggregate relationship */
	files_aggregate: ModelTypes["files_aggregate"],
	id: string,
	maxUploadFileSize: number,
	minUploadFileSize: number,
	presignedUrlsEnabled: boolean,
	updatedAt: ModelTypes["timestamptz"]
};
	/** aggregated selection of "storage.buckets" */
["buckets_aggregate"]: {
		aggregate?: ModelTypes["buckets_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["buckets"]>
};
	/** aggregate fields of "storage.buckets" */
["buckets_aggregate_fields"]: {
		avg?: ModelTypes["buckets_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["buckets_max_fields"] | undefined,
	min?: ModelTypes["buckets_min_fields"] | undefined,
	stddev?: ModelTypes["buckets_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["buckets_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["buckets_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["buckets_sum_fields"] | undefined,
	var_pop?: ModelTypes["buckets_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["buckets_var_samp_fields"] | undefined,
	variance?: ModelTypes["buckets_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["buckets_avg_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** Boolean expression to filter rows from the table "storage.buckets". All fields are combined with a logical 'AND'. */
["buckets_bool_exp"]: {
	_and?: Array<ModelTypes["buckets_bool_exp"]> | undefined,
	_not?: ModelTypes["buckets_bool_exp"] | undefined,
	_or?: Array<ModelTypes["buckets_bool_exp"]> | undefined,
	cacheControl?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	downloadExpiration?: ModelTypes["Int_comparison_exp"] | undefined,
	files?: ModelTypes["files_bool_exp"] | undefined,
	files_aggregate?: ModelTypes["files_aggregate_bool_exp"] | undefined,
	id?: ModelTypes["String_comparison_exp"] | undefined,
	maxUploadFileSize?: ModelTypes["Int_comparison_exp"] | undefined,
	minUploadFileSize?: ModelTypes["Int_comparison_exp"] | undefined,
	presignedUrlsEnabled?: ModelTypes["Boolean_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined
};
	["buckets_constraint"]:buckets_constraint;
	/** input type for incrementing numeric columns in table "storage.buckets" */
["buckets_inc_input"]: {
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** input type for inserting data into table "storage.buckets" */
["buckets_insert_input"]: {
	cacheControl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	files?: ModelTypes["files_arr_rel_insert_input"] | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	presignedUrlsEnabled?: boolean | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["buckets_max_fields"]: {
		cacheControl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["buckets_min_fields"]: {
		cacheControl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "storage.buckets" */
["buckets_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["buckets"]>
};
	/** input type for inserting object relation for remote table "storage.buckets" */
["buckets_obj_rel_insert_input"]: {
	data: ModelTypes["buckets_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["buckets_on_conflict"] | undefined
};
	/** on_conflict condition type for table "storage.buckets" */
["buckets_on_conflict"]: {
	constraint: ModelTypes["buckets_constraint"],
	update_columns: Array<ModelTypes["buckets_update_column"]>,
	where?: ModelTypes["buckets_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "storage.buckets". */
["buckets_order_by"]: {
	cacheControl?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	downloadExpiration?: ModelTypes["order_by"] | undefined,
	files_aggregate?: ModelTypes["files_aggregate_order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	maxUploadFileSize?: ModelTypes["order_by"] | undefined,
	minUploadFileSize?: ModelTypes["order_by"] | undefined,
	presignedUrlsEnabled?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: storage.buckets */
["buckets_pk_columns_input"]: {
	id: string
};
	["buckets_select_column"]:buckets_select_column;
	/** input type for updating data in table "storage.buckets" */
["buckets_set_input"]: {
	cacheControl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	presignedUrlsEnabled?: boolean | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate stddev on columns */
["buckets_stddev_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate stddev_pop on columns */
["buckets_stddev_pop_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate stddev_samp on columns */
["buckets_stddev_samp_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** Streaming cursor of the table "buckets" */
["buckets_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["buckets_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["buckets_stream_cursor_value_input"]: {
	cacheControl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	presignedUrlsEnabled?: boolean | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate sum on columns */
["buckets_sum_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	["buckets_update_column"]:buckets_update_column;
	["buckets_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["buckets_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["buckets_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["buckets_bool_exp"]
};
	/** aggregate var_pop on columns */
["buckets_var_pop_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate var_samp on columns */
["buckets_var_samp_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate variance on columns */
["buckets_variance_fields"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	["bytea"]:any;
	/** Boolean expression to compare columns of type "bytea". All fields are combined with logical 'AND'. */
["bytea_comparison_exp"]: {
	_eq?: ModelTypes["bytea"] | undefined,
	_gt?: ModelTypes["bytea"] | undefined,
	_gte?: ModelTypes["bytea"] | undefined,
	_in?: Array<ModelTypes["bytea"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["bytea"] | undefined,
	_lte?: ModelTypes["bytea"] | undefined,
	_neq?: ModelTypes["bytea"] | undefined,
	_nin?: Array<ModelTypes["bytea"]> | undefined
};
	["citext"]:any;
	/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
["citext_comparison_exp"]: {
	_eq?: ModelTypes["citext"] | undefined,
	_gt?: ModelTypes["citext"] | undefined,
	_gte?: ModelTypes["citext"] | undefined,
	/** does the column match the given case-insensitive pattern */
	_ilike?: ModelTypes["citext"] | undefined,
	_in?: Array<ModelTypes["citext"]> | undefined,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: ModelTypes["citext"] | undefined,
	_is_null?: boolean | undefined,
	/** does the column match the given pattern */
	_like?: ModelTypes["citext"] | undefined,
	_lt?: ModelTypes["citext"] | undefined,
	_lte?: ModelTypes["citext"] | undefined,
	_neq?: ModelTypes["citext"] | undefined,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: ModelTypes["citext"] | undefined,
	_nin?: Array<ModelTypes["citext"]> | undefined,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: ModelTypes["citext"] | undefined,
	/** does the column NOT match the given pattern */
	_nlike?: ModelTypes["citext"] | undefined,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: ModelTypes["citext"] | undefined,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: ModelTypes["citext"] | undefined,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: ModelTypes["citext"] | undefined,
	/** does the column match the given SQL regular expression */
	_similar?: ModelTypes["citext"] | undefined
};
	["cursor_ordering"]:cursor_ordering;
	/** columns and relationships of "event_files" */
["event_files"]: {
		createdAt: ModelTypes["timestamptz"],
	/** An object relationship */
	event: ModelTypes["events"],
	eventId: ModelTypes["uuid"],
	/** An object relationship */
	file: ModelTypes["files"],
	fileId: ModelTypes["uuid"],
	updatedAt: ModelTypes["timestamptz"],
	/** An object relationship */
	user: ModelTypes["users"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "event_files" */
["event_files_aggregate"]: {
		aggregate?: ModelTypes["event_files_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["event_files"]>
};
	["event_files_aggregate_bool_exp"]: {
	count?: ModelTypes["event_files_aggregate_bool_exp_count"] | undefined
};
	["event_files_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["event_files_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["event_files_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "event_files" */
["event_files_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["event_files_max_fields"] | undefined,
	min?: ModelTypes["event_files_min_fields"] | undefined
};
	/** order by aggregate values of table "event_files" */
["event_files_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["event_files_max_order_by"] | undefined,
	min?: ModelTypes["event_files_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "event_files" */
["event_files_arr_rel_insert_input"]: {
	data: Array<ModelTypes["event_files_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["event_files_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "event_files". All fields are combined with a logical 'AND'. */
["event_files_bool_exp"]: {
	_and?: Array<ModelTypes["event_files_bool_exp"]> | undefined,
	_not?: ModelTypes["event_files_bool_exp"] | undefined,
	_or?: Array<ModelTypes["event_files_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	event?: ModelTypes["events_bool_exp"] | undefined,
	eventId?: ModelTypes["uuid_comparison_exp"] | undefined,
	file?: ModelTypes["files_bool_exp"] | undefined,
	fileId?: ModelTypes["uuid_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	user?: ModelTypes["users_bool_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["event_files_constraint"]:event_files_constraint;
	/** input type for inserting data into table "event_files" */
["event_files_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	event?: ModelTypes["events_obj_rel_insert_input"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	file?: ModelTypes["files_obj_rel_insert_input"] | undefined,
	fileId?: ModelTypes["uuid"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	user?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["event_files_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	fileId?: ModelTypes["uuid"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "event_files" */
["event_files_max_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	eventId?: ModelTypes["order_by"] | undefined,
	fileId?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["event_files_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	fileId?: ModelTypes["uuid"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "event_files" */
["event_files_min_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	eventId?: ModelTypes["order_by"] | undefined,
	fileId?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "event_files" */
["event_files_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["event_files"]>
};
	/** on_conflict condition type for table "event_files" */
["event_files_on_conflict"]: {
	constraint: ModelTypes["event_files_constraint"],
	update_columns: Array<ModelTypes["event_files_update_column"]>,
	where?: ModelTypes["event_files_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "event_files". */
["event_files_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	event?: ModelTypes["events_order_by"] | undefined,
	eventId?: ModelTypes["order_by"] | undefined,
	file?: ModelTypes["files_order_by"] | undefined,
	fileId?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	user?: ModelTypes["users_order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: event_files */
["event_files_pk_columns_input"]: {
	eventId: ModelTypes["uuid"],
	fileId: ModelTypes["uuid"]
};
	["event_files_select_column"]:event_files_select_column;
	/** input type for updating data in table "event_files" */
["event_files_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	fileId?: ModelTypes["uuid"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "event_files" */
["event_files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["event_files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["event_files_stream_cursor_value_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	fileId?: ModelTypes["uuid"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	["event_files_update_column"]:event_files_update_column;
	["event_files_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["event_files_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["event_files_bool_exp"]
};
	/** columns and relationships of "event_participants" */
["event_participants"]: {
		createdAt: ModelTypes["timestamptz"],
	/** An object relationship */
	event: ModelTypes["events"],
	eventId: ModelTypes["uuid"],
	role: string,
	updatedAt: ModelTypes["timestamptz"],
	/** An object relationship */
	user: ModelTypes["users"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "event_participants" */
["event_participants_aggregate"]: {
		aggregate?: ModelTypes["event_participants_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["event_participants"]>
};
	["event_participants_aggregate_bool_exp"]: {
	count?: ModelTypes["event_participants_aggregate_bool_exp_count"] | undefined
};
	["event_participants_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["event_participants_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["event_participants_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "event_participants" */
["event_participants_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["event_participants_max_fields"] | undefined,
	min?: ModelTypes["event_participants_min_fields"] | undefined
};
	/** order by aggregate values of table "event_participants" */
["event_participants_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["event_participants_max_order_by"] | undefined,
	min?: ModelTypes["event_participants_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "event_participants" */
["event_participants_arr_rel_insert_input"]: {
	data: Array<ModelTypes["event_participants_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["event_participants_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "event_participants". All fields are combined with a logical 'AND'. */
["event_participants_bool_exp"]: {
	_and?: Array<ModelTypes["event_participants_bool_exp"]> | undefined,
	_not?: ModelTypes["event_participants_bool_exp"] | undefined,
	_or?: Array<ModelTypes["event_participants_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	event?: ModelTypes["events_bool_exp"] | undefined,
	eventId?: ModelTypes["uuid_comparison_exp"] | undefined,
	role?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	user?: ModelTypes["users_bool_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["event_participants_constraint"]:event_participants_constraint;
	/** input type for inserting data into table "event_participants" */
["event_participants_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	event?: ModelTypes["events_obj_rel_insert_input"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	user?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["event_participants_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "event_participants" */
["event_participants_max_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	eventId?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["event_participants_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "event_participants" */
["event_participants_min_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	eventId?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "event_participants" */
["event_participants_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["event_participants"]>
};
	/** on_conflict condition type for table "event_participants" */
["event_participants_on_conflict"]: {
	constraint: ModelTypes["event_participants_constraint"],
	update_columns: Array<ModelTypes["event_participants_update_column"]>,
	where?: ModelTypes["event_participants_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "event_participants". */
["event_participants_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	event?: ModelTypes["events_order_by"] | undefined,
	eventId?: ModelTypes["order_by"] | undefined,
	role?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	user?: ModelTypes["users_order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: event_participants */
["event_participants_pk_columns_input"]: {
	eventId: ModelTypes["uuid"],
	userId: ModelTypes["uuid"]
};
	["event_participants_select_column"]:event_participants_select_column;
	/** input type for updating data in table "event_participants" */
["event_participants_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "event_participants" */
["event_participants_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["event_participants_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["event_participants_stream_cursor_value_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	eventId?: ModelTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	["event_participants_update_column"]:event_participants_update_column;
	["event_participants_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["event_participants_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["event_participants_bool_exp"]
};
	/** columns and relationships of "events" */
["events"]: {
		createdAt: ModelTypes["timestamptz"],
	/** An object relationship */
	creator: ModelTypes["users"],
	creatorId: ModelTypes["uuid"],
	endAt: ModelTypes["timestamptz"],
	/** An array relationship */
	files: Array<ModelTypes["event_files"]>,
	/** An aggregate relationship */
	files_aggregate: ModelTypes["event_files_aggregate"],
	id: ModelTypes["uuid"],
	name: string,
	params: ModelTypes["jsonb"],
	/** An array relationship */
	participants: Array<ModelTypes["event_participants"]>,
	/** An aggregate relationship */
	participants_aggregate: ModelTypes["event_participants_aggregate"],
	slug: string,
	startAt: ModelTypes["timestamptz"],
	updatedAt: ModelTypes["timestamptz"]
};
	/** aggregated selection of "events" */
["events_aggregate"]: {
		aggregate?: ModelTypes["events_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["events"]>
};
	["events_aggregate_bool_exp"]: {
	count?: ModelTypes["events_aggregate_bool_exp_count"] | undefined
};
	["events_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["events_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["events_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "events" */
["events_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["events_max_fields"] | undefined,
	min?: ModelTypes["events_min_fields"] | undefined
};
	/** order by aggregate values of table "events" */
["events_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["events_max_order_by"] | undefined,
	min?: ModelTypes["events_min_order_by"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["events_append_input"]: {
	params?: ModelTypes["jsonb"] | undefined
};
	/** input type for inserting array relation for remote table "events" */
["events_arr_rel_insert_input"]: {
	data: Array<ModelTypes["events_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["events_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "events". All fields are combined with a logical 'AND'. */
["events_bool_exp"]: {
	_and?: Array<ModelTypes["events_bool_exp"]> | undefined,
	_not?: ModelTypes["events_bool_exp"] | undefined,
	_or?: Array<ModelTypes["events_bool_exp"]> | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	creator?: ModelTypes["users_bool_exp"] | undefined,
	creatorId?: ModelTypes["uuid_comparison_exp"] | undefined,
	endAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	files?: ModelTypes["event_files_bool_exp"] | undefined,
	files_aggregate?: ModelTypes["event_files_aggregate_bool_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	params?: ModelTypes["jsonb_comparison_exp"] | undefined,
	participants?: ModelTypes["event_participants_bool_exp"] | undefined,
	participants_aggregate?: ModelTypes["event_participants_aggregate_bool_exp"] | undefined,
	slug?: ModelTypes["String_comparison_exp"] | undefined,
	startAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined
};
	["events_constraint"]:events_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["events_delete_at_path_input"]: {
	params?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["events_delete_elem_input"]: {
	params?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["events_delete_key_input"]: {
	params?: string | undefined
};
	/** input type for inserting data into table "events" */
["events_insert_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	creator?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	creatorId?: ModelTypes["uuid"] | undefined,
	endAt?: ModelTypes["timestamptz"] | undefined,
	files?: ModelTypes["event_files_arr_rel_insert_input"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	params?: ModelTypes["jsonb"] | undefined,
	participants?: ModelTypes["event_participants_arr_rel_insert_input"] | undefined,
	slug?: string | undefined,
	startAt?: ModelTypes["timestamptz"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["events_max_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	creatorId?: ModelTypes["uuid"] | undefined,
	endAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	slug?: string | undefined,
	startAt?: ModelTypes["timestamptz"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** order by max() on columns of table "events" */
["events_max_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	creatorId?: ModelTypes["order_by"] | undefined,
	endAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	slug?: ModelTypes["order_by"] | undefined,
	startAt?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["events_min_fields"]: {
		createdAt?: ModelTypes["timestamptz"] | undefined,
	creatorId?: ModelTypes["uuid"] | undefined,
	endAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	slug?: string | undefined,
	startAt?: ModelTypes["timestamptz"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** order by min() on columns of table "events" */
["events_min_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	creatorId?: ModelTypes["order_by"] | undefined,
	endAt?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	slug?: ModelTypes["order_by"] | undefined,
	startAt?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "events" */
["events_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["events"]>
};
	/** input type for inserting object relation for remote table "events" */
["events_obj_rel_insert_input"]: {
	data: ModelTypes["events_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["events_on_conflict"] | undefined
};
	/** on_conflict condition type for table "events" */
["events_on_conflict"]: {
	constraint: ModelTypes["events_constraint"],
	update_columns: Array<ModelTypes["events_update_column"]>,
	where?: ModelTypes["events_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "events". */
["events_order_by"]: {
	createdAt?: ModelTypes["order_by"] | undefined,
	creator?: ModelTypes["users_order_by"] | undefined,
	creatorId?: ModelTypes["order_by"] | undefined,
	endAt?: ModelTypes["order_by"] | undefined,
	files_aggregate?: ModelTypes["event_files_aggregate_order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	params?: ModelTypes["order_by"] | undefined,
	participants_aggregate?: ModelTypes["event_participants_aggregate_order_by"] | undefined,
	slug?: ModelTypes["order_by"] | undefined,
	startAt?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: events */
["events_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["events_prepend_input"]: {
	params?: ModelTypes["jsonb"] | undefined
};
	["events_select_column"]:events_select_column;
	/** input type for updating data in table "events" */
["events_set_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	creatorId?: ModelTypes["uuid"] | undefined,
	endAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	params?: ModelTypes["jsonb"] | undefined,
	slug?: string | undefined,
	startAt?: ModelTypes["timestamptz"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "events" */
["events_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["events_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["events_stream_cursor_value_input"]: {
	createdAt?: ModelTypes["timestamptz"] | undefined,
	creatorId?: ModelTypes["uuid"] | undefined,
	endAt?: ModelTypes["timestamptz"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	name?: string | undefined,
	params?: ModelTypes["jsonb"] | undefined,
	slug?: string | undefined,
	startAt?: ModelTypes["timestamptz"] | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	["events_update_column"]:events_update_column;
	["events_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ModelTypes["events_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ModelTypes["events_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ModelTypes["events_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ModelTypes["events_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ModelTypes["events_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["events_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["events_bool_exp"]
};
	/** columns and relationships of "storage.files" */
["files"]: {
		/** An object relationship */
	bucket: ModelTypes["buckets"],
	bucketId: string,
	createdAt: ModelTypes["timestamptz"],
	etag?: string | undefined,
	id: ModelTypes["uuid"],
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt: ModelTypes["timestamptz"],
	uploadedByUserId?: ModelTypes["uuid"] | undefined
};
	/** aggregated selection of "storage.files" */
["files_aggregate"]: {
		aggregate?: ModelTypes["files_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["files"]>
};
	["files_aggregate_bool_exp"]: {
	bool_and?: ModelTypes["files_aggregate_bool_exp_bool_and"] | undefined,
	bool_or?: ModelTypes["files_aggregate_bool_exp_bool_or"] | undefined,
	count?: ModelTypes["files_aggregate_bool_exp_count"] | undefined
};
	["files_aggregate_bool_exp_bool_and"]: {
	arguments: ModelTypes["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: ModelTypes["files_bool_exp"] | undefined,
	predicate: ModelTypes["Boolean_comparison_exp"]
};
	["files_aggregate_bool_exp_bool_or"]: {
	arguments: ModelTypes["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: ModelTypes["files_bool_exp"] | undefined,
	predicate: ModelTypes["Boolean_comparison_exp"]
};
	["files_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["files_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["files_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "storage.files" */
["files_aggregate_fields"]: {
		avg?: ModelTypes["files_avg_fields"] | undefined,
	count: number,
	max?: ModelTypes["files_max_fields"] | undefined,
	min?: ModelTypes["files_min_fields"] | undefined,
	stddev?: ModelTypes["files_stddev_fields"] | undefined,
	stddev_pop?: ModelTypes["files_stddev_pop_fields"] | undefined,
	stddev_samp?: ModelTypes["files_stddev_samp_fields"] | undefined,
	sum?: ModelTypes["files_sum_fields"] | undefined,
	var_pop?: ModelTypes["files_var_pop_fields"] | undefined,
	var_samp?: ModelTypes["files_var_samp_fields"] | undefined,
	variance?: ModelTypes["files_variance_fields"] | undefined
};
	/** order by aggregate values of table "storage.files" */
["files_aggregate_order_by"]: {
	avg?: ModelTypes["files_avg_order_by"] | undefined,
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["files_max_order_by"] | undefined,
	min?: ModelTypes["files_min_order_by"] | undefined,
	stddev?: ModelTypes["files_stddev_order_by"] | undefined,
	stddev_pop?: ModelTypes["files_stddev_pop_order_by"] | undefined,
	stddev_samp?: ModelTypes["files_stddev_samp_order_by"] | undefined,
	sum?: ModelTypes["files_sum_order_by"] | undefined,
	var_pop?: ModelTypes["files_var_pop_order_by"] | undefined,
	var_samp?: ModelTypes["files_var_samp_order_by"] | undefined,
	variance?: ModelTypes["files_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "storage.files" */
["files_arr_rel_insert_input"]: {
	data: Array<ModelTypes["files_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["files_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["files_avg_fields"]: {
		size?: number | undefined
};
	/** order by avg() on columns of table "storage.files" */
["files_avg_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "storage.files". All fields are combined with a logical 'AND'. */
["files_bool_exp"]: {
	_and?: Array<ModelTypes["files_bool_exp"]> | undefined,
	_not?: ModelTypes["files_bool_exp"] | undefined,
	_or?: Array<ModelTypes["files_bool_exp"]> | undefined,
	bucket?: ModelTypes["buckets_bool_exp"] | undefined,
	bucketId?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	etag?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	isUploaded?: ModelTypes["Boolean_comparison_exp"] | undefined,
	mimeType?: ModelTypes["String_comparison_exp"] | undefined,
	name?: ModelTypes["String_comparison_exp"] | undefined,
	size?: ModelTypes["Int_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	uploadedByUserId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["files_constraint"]:files_constraint;
	/** input type for incrementing numeric columns in table "storage.files" */
["files_inc_input"]: {
	size?: number | undefined
};
	/** input type for inserting data into table "storage.files" */
["files_insert_input"]: {
	bucket?: ModelTypes["buckets_obj_rel_insert_input"] | undefined,
	bucketId?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	uploadedByUserId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["files_max_fields"]: {
		bucketId?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	uploadedByUserId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "storage.files" */
["files_max_order_by"]: {
	bucketId?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	etag?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	mimeType?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	size?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	uploadedByUserId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["files_min_fields"]: {
		bucketId?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	uploadedByUserId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "storage.files" */
["files_min_order_by"]: {
	bucketId?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	etag?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	mimeType?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	size?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	uploadedByUserId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "storage.files" */
["files_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["files"]>
};
	/** input type for inserting object relation for remote table "storage.files" */
["files_obj_rel_insert_input"]: {
	data: ModelTypes["files_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["files_on_conflict"] | undefined
};
	/** on_conflict condition type for table "storage.files" */
["files_on_conflict"]: {
	constraint: ModelTypes["files_constraint"],
	update_columns: Array<ModelTypes["files_update_column"]>,
	where?: ModelTypes["files_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "storage.files". */
["files_order_by"]: {
	bucket?: ModelTypes["buckets_order_by"] | undefined,
	bucketId?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	etag?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	isUploaded?: ModelTypes["order_by"] | undefined,
	mimeType?: ModelTypes["order_by"] | undefined,
	name?: ModelTypes["order_by"] | undefined,
	size?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	uploadedByUserId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: storage.files */
["files_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	["files_select_column"]:files_select_column;
	["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"]:files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns;
	["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"]:files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "storage.files" */
["files_set_input"]: {
	bucketId?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	uploadedByUserId?: ModelTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["files_stddev_fields"]: {
		size?: number | undefined
};
	/** order by stddev() on columns of table "storage.files" */
["files_stddev_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["files_stddev_pop_fields"]: {
		size?: number | undefined
};
	/** order by stddev_pop() on columns of table "storage.files" */
["files_stddev_pop_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["files_stddev_samp_fields"]: {
		size?: number | undefined
};
	/** order by stddev_samp() on columns of table "storage.files" */
["files_stddev_samp_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "files" */
["files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["files_stream_cursor_value_input"]: {
	bucketId?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	uploadedByUserId?: ModelTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["files_sum_fields"]: {
		size?: number | undefined
};
	/** order by sum() on columns of table "storage.files" */
["files_sum_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	["files_update_column"]:files_update_column;
	["files_updates"]: {
	/** increments the numeric columns with given value of the filtered values */
	_inc?: ModelTypes["files_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["files_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["files_bool_exp"]
};
	/** aggregate var_pop on columns */
["files_var_pop_fields"]: {
		size?: number | undefined
};
	/** order by var_pop() on columns of table "storage.files" */
["files_var_pop_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["files_var_samp_fields"]: {
		size?: number | undefined
};
	/** order by var_samp() on columns of table "storage.files" */
["files_var_samp_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["files_variance_fields"]: {
		size?: number | undefined
};
	/** order by variance() on columns of table "storage.files" */
["files_variance_order_by"]: {
	size?: ModelTypes["order_by"] | undefined
};
	/** columns and relationships of "installations" */
["installations"]: {
		appIdentifier: string,
	appVersion: string,
	createdAt: ModelTypes["timestamptz"],
	deviceLocale: string,
	deviceName?: string | undefined,
	deviceType: string,
	id: ModelTypes["uuid"],
	isActive: boolean,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken: string,
	updatedAt: ModelTypes["timestamptz"],
	/** An object relationship */
	user: ModelTypes["users"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "installations" */
["installations_aggregate"]: {
		aggregate?: ModelTypes["installations_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["installations"]>
};
	["installations_aggregate_bool_exp"]: {
	bool_and?: ModelTypes["installations_aggregate_bool_exp_bool_and"] | undefined,
	bool_or?: ModelTypes["installations_aggregate_bool_exp_bool_or"] | undefined,
	count?: ModelTypes["installations_aggregate_bool_exp_count"] | undefined
};
	["installations_aggregate_bool_exp_bool_and"]: {
	arguments: ModelTypes["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: ModelTypes["installations_bool_exp"] | undefined,
	predicate: ModelTypes["Boolean_comparison_exp"]
};
	["installations_aggregate_bool_exp_bool_or"]: {
	arguments: ModelTypes["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: ModelTypes["installations_bool_exp"] | undefined,
	predicate: ModelTypes["Boolean_comparison_exp"]
};
	["installations_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["installations_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["installations_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "installations" */
["installations_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["installations_max_fields"] | undefined,
	min?: ModelTypes["installations_min_fields"] | undefined
};
	/** order by aggregate values of table "installations" */
["installations_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["installations_max_order_by"] | undefined,
	min?: ModelTypes["installations_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "installations" */
["installations_arr_rel_insert_input"]: {
	data: Array<ModelTypes["installations_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["installations_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "installations". All fields are combined with a logical 'AND'. */
["installations_bool_exp"]: {
	_and?: Array<ModelTypes["installations_bool_exp"]> | undefined,
	_not?: ModelTypes["installations_bool_exp"] | undefined,
	_or?: Array<ModelTypes["installations_bool_exp"]> | undefined,
	appIdentifier?: ModelTypes["String_comparison_exp"] | undefined,
	appVersion?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	deviceLocale?: ModelTypes["String_comparison_exp"] | undefined,
	deviceName?: ModelTypes["String_comparison_exp"] | undefined,
	deviceType?: ModelTypes["String_comparison_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	isActive?: ModelTypes["Boolean_comparison_exp"] | undefined,
	osName?: ModelTypes["String_comparison_exp"] | undefined,
	osVersion?: ModelTypes["String_comparison_exp"] | undefined,
	pushToken?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	user?: ModelTypes["users_bool_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["installations_constraint"]:installations_constraint;
	/** input type for inserting data into table "installations" */
["installations_insert_input"]: {
	appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isActive?: boolean | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	user?: ModelTypes["users_obj_rel_insert_input"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["installations_max_fields"]: {
		appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by max() on columns of table "installations" */
["installations_max_order_by"]: {
	appIdentifier?: ModelTypes["order_by"] | undefined,
	appVersion?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	deviceLocale?: ModelTypes["order_by"] | undefined,
	deviceName?: ModelTypes["order_by"] | undefined,
	deviceType?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	osName?: ModelTypes["order_by"] | undefined,
	osVersion?: ModelTypes["order_by"] | undefined,
	pushToken?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["installations_min_fields"]: {
		appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** order by min() on columns of table "installations" */
["installations_min_order_by"]: {
	appIdentifier?: ModelTypes["order_by"] | undefined,
	appVersion?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	deviceLocale?: ModelTypes["order_by"] | undefined,
	deviceName?: ModelTypes["order_by"] | undefined,
	deviceType?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	osName?: ModelTypes["order_by"] | undefined,
	osVersion?: ModelTypes["order_by"] | undefined,
	pushToken?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "installations" */
["installations_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["installations"]>
};
	/** on_conflict condition type for table "installations" */
["installations_on_conflict"]: {
	constraint: ModelTypes["installations_constraint"],
	update_columns: Array<ModelTypes["installations_update_column"]>,
	where?: ModelTypes["installations_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "installations". */
["installations_order_by"]: {
	appIdentifier?: ModelTypes["order_by"] | undefined,
	appVersion?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	deviceLocale?: ModelTypes["order_by"] | undefined,
	deviceName?: ModelTypes["order_by"] | undefined,
	deviceType?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	isActive?: ModelTypes["order_by"] | undefined,
	osName?: ModelTypes["order_by"] | undefined,
	osVersion?: ModelTypes["order_by"] | undefined,
	pushToken?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	user?: ModelTypes["users_order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: installations */
["installations_pk_columns_input"]: {
	id: ModelTypes["uuid"],
	userId: ModelTypes["uuid"]
};
	["installations_select_column"]:installations_select_column;
	["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"]:installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns;
	["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"]:installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "installations" */
["installations_set_input"]: {
	appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isActive?: boolean | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "installations" */
["installations_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["installations_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["installations_stream_cursor_value_input"]: {
	appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isActive?: boolean | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	["installations_update_column"]:installations_update_column;
	["installations_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["installations_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["installations_bool_exp"]
};
	["jsonb"]:any;
	["jsonb_cast_exp"]: {
	String?: ModelTypes["String_comparison_exp"] | undefined
};
	/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
["jsonb_comparison_exp"]: {
	_cast?: ModelTypes["jsonb_cast_exp"] | undefined,
	/** is the column contained in the given json value */
	_contained_in?: ModelTypes["jsonb"] | undefined,
	/** does the column contain the given json value at the top level */
	_contains?: ModelTypes["jsonb"] | undefined,
	_eq?: ModelTypes["jsonb"] | undefined,
	_gt?: ModelTypes["jsonb"] | undefined,
	_gte?: ModelTypes["jsonb"] | undefined,
	/** does the string exist as a top-level key in the column */
	_has_key?: string | undefined,
	/** do all of these strings exist as top-level keys in the column */
	_has_keys_all?: Array<string> | undefined,
	/** do any of these strings exist as top-level keys in the column */
	_has_keys_any?: Array<string> | undefined,
	_in?: Array<ModelTypes["jsonb"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["jsonb"] | undefined,
	_lte?: ModelTypes["jsonb"] | undefined,
	_neq?: ModelTypes["jsonb"] | undefined,
	_nin?: Array<ModelTypes["jsonb"]> | undefined
};
	/** mutation root */
["mutation_root"]: {
		/** delete single row from the table: "auth.providers" */
	deleteAuthProvider?: ModelTypes["authProviders"] | undefined,
	/** delete single row from the table: "auth.provider_requests" */
	deleteAuthProviderRequest?: ModelTypes["authProviderRequests"] | undefined,
	/** delete data from the table: "auth.provider_requests" */
	deleteAuthProviderRequests?: ModelTypes["authProviderRequests_mutation_response"] | undefined,
	/** delete data from the table: "auth.providers" */
	deleteAuthProviders?: ModelTypes["authProviders_mutation_response"] | undefined,
	/** delete single row from the table: "auth.refresh_tokens" */
	deleteAuthRefreshToken?: ModelTypes["authRefreshTokens"] | undefined,
	/** delete single row from the table: "auth.refresh_token_types" */
	deleteAuthRefreshTokenType?: ModelTypes["authRefreshTokenTypes"] | undefined,
	/** delete data from the table: "auth.refresh_token_types" */
	deleteAuthRefreshTokenTypes?: ModelTypes["authRefreshTokenTypes_mutation_response"] | undefined,
	/** delete data from the table: "auth.refresh_tokens" */
	deleteAuthRefreshTokens?: ModelTypes["authRefreshTokens_mutation_response"] | undefined,
	/** delete single row from the table: "auth.roles" */
	deleteAuthRole?: ModelTypes["authRoles"] | undefined,
	/** delete data from the table: "auth.roles" */
	deleteAuthRoles?: ModelTypes["authRoles_mutation_response"] | undefined,
	/** delete single row from the table: "auth.user_providers" */
	deleteAuthUserProvider?: ModelTypes["authUserProviders"] | undefined,
	/** delete data from the table: "auth.user_providers" */
	deleteAuthUserProviders?: ModelTypes["authUserProviders_mutation_response"] | undefined,
	/** delete single row from the table: "auth.user_roles" */
	deleteAuthUserRole?: ModelTypes["authUserRoles"] | undefined,
	/** delete data from the table: "auth.user_roles" */
	deleteAuthUserRoles?: ModelTypes["authUserRoles_mutation_response"] | undefined,
	/** delete single row from the table: "auth.user_security_keys" */
	deleteAuthUserSecurityKey?: ModelTypes["authUserSecurityKeys"] | undefined,
	/** delete data from the table: "auth.user_security_keys" */
	deleteAuthUserSecurityKeys?: ModelTypes["authUserSecurityKeys_mutation_response"] | undefined,
	/** delete single row from the table: "storage.buckets" */
	deleteBucket?: ModelTypes["buckets"] | undefined,
	/** delete data from the table: "storage.buckets" */
	deleteBuckets?: ModelTypes["buckets_mutation_response"] | undefined,
	/** delete single row from the table: "storage.files" */
	deleteFile?: ModelTypes["files"] | undefined,
	/** delete data from the table: "storage.files" */
	deleteFiles?: ModelTypes["files_mutation_response"] | undefined,
	/** delete single row from the table: "auth.users" */
	deleteUser?: ModelTypes["users"] | undefined,
	/** delete data from the table: "auth.users" */
	deleteUsers?: ModelTypes["users_mutation_response"] | undefined,
	/** delete data from the table: "event_files" */
	delete_event_files?: ModelTypes["event_files_mutation_response"] | undefined,
	/** delete single row from the table: "event_files" */
	delete_event_files_by_pk?: ModelTypes["event_files"] | undefined,
	/** delete data from the table: "event_participants" */
	delete_event_participants?: ModelTypes["event_participants_mutation_response"] | undefined,
	/** delete single row from the table: "event_participants" */
	delete_event_participants_by_pk?: ModelTypes["event_participants"] | undefined,
	/** delete data from the table: "events" */
	delete_events?: ModelTypes["events_mutation_response"] | undefined,
	/** delete single row from the table: "events" */
	delete_events_by_pk?: ModelTypes["events"] | undefined,
	/** delete data from the table: "installations" */
	delete_installations?: ModelTypes["installations_mutation_response"] | undefined,
	/** delete single row from the table: "installations" */
	delete_installations_by_pk?: ModelTypes["installations"] | undefined,
	/** delete data from the table: "user_files" */
	delete_user_files?: ModelTypes["user_files_mutation_response"] | undefined,
	/** delete single row from the table: "user_files" */
	delete_user_files_by_pk?: ModelTypes["user_files"] | undefined,
	/** insert a single row into the table: "auth.providers" */
	insertAuthProvider?: ModelTypes["authProviders"] | undefined,
	/** insert a single row into the table: "auth.provider_requests" */
	insertAuthProviderRequest?: ModelTypes["authProviderRequests"] | undefined,
	/** insert data into the table: "auth.provider_requests" */
	insertAuthProviderRequests?: ModelTypes["authProviderRequests_mutation_response"] | undefined,
	/** insert data into the table: "auth.providers" */
	insertAuthProviders?: ModelTypes["authProviders_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.refresh_tokens" */
	insertAuthRefreshToken?: ModelTypes["authRefreshTokens"] | undefined,
	/** insert a single row into the table: "auth.refresh_token_types" */
	insertAuthRefreshTokenType?: ModelTypes["authRefreshTokenTypes"] | undefined,
	/** insert data into the table: "auth.refresh_token_types" */
	insertAuthRefreshTokenTypes?: ModelTypes["authRefreshTokenTypes_mutation_response"] | undefined,
	/** insert data into the table: "auth.refresh_tokens" */
	insertAuthRefreshTokens?: ModelTypes["authRefreshTokens_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.roles" */
	insertAuthRole?: ModelTypes["authRoles"] | undefined,
	/** insert data into the table: "auth.roles" */
	insertAuthRoles?: ModelTypes["authRoles_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.user_providers" */
	insertAuthUserProvider?: ModelTypes["authUserProviders"] | undefined,
	/** insert data into the table: "auth.user_providers" */
	insertAuthUserProviders?: ModelTypes["authUserProviders_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.user_roles" */
	insertAuthUserRole?: ModelTypes["authUserRoles"] | undefined,
	/** insert data into the table: "auth.user_roles" */
	insertAuthUserRoles?: ModelTypes["authUserRoles_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.user_security_keys" */
	insertAuthUserSecurityKey?: ModelTypes["authUserSecurityKeys"] | undefined,
	/** insert data into the table: "auth.user_security_keys" */
	insertAuthUserSecurityKeys?: ModelTypes["authUserSecurityKeys_mutation_response"] | undefined,
	/** insert a single row into the table: "storage.buckets" */
	insertBucket?: ModelTypes["buckets"] | undefined,
	/** insert data into the table: "storage.buckets" */
	insertBuckets?: ModelTypes["buckets_mutation_response"] | undefined,
	/** insert a single row into the table: "storage.files" */
	insertFile?: ModelTypes["files"] | undefined,
	/** insert data into the table: "storage.files" */
	insertFiles?: ModelTypes["files_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.users" */
	insertUser?: ModelTypes["users"] | undefined,
	/** insert data into the table: "auth.users" */
	insertUsers?: ModelTypes["users_mutation_response"] | undefined,
	/** insert data into the table: "event_files" */
	insert_event_files?: ModelTypes["event_files_mutation_response"] | undefined,
	/** insert a single row into the table: "event_files" */
	insert_event_files_one?: ModelTypes["event_files"] | undefined,
	/** insert data into the table: "event_participants" */
	insert_event_participants?: ModelTypes["event_participants_mutation_response"] | undefined,
	/** insert a single row into the table: "event_participants" */
	insert_event_participants_one?: ModelTypes["event_participants"] | undefined,
	/** insert data into the table: "events" */
	insert_events?: ModelTypes["events_mutation_response"] | undefined,
	/** insert a single row into the table: "events" */
	insert_events_one?: ModelTypes["events"] | undefined,
	/** insert data into the table: "installations" */
	insert_installations?: ModelTypes["installations_mutation_response"] | undefined,
	/** insert a single row into the table: "installations" */
	insert_installations_one?: ModelTypes["installations"] | undefined,
	/** insert data into the table: "user_files" */
	insert_user_files?: ModelTypes["user_files_mutation_response"] | undefined,
	/** insert a single row into the table: "user_files" */
	insert_user_files_one?: ModelTypes["user_files"] | undefined,
	/** update single row of the table: "auth.providers" */
	updateAuthProvider?: ModelTypes["authProviders"] | undefined,
	/** update single row of the table: "auth.provider_requests" */
	updateAuthProviderRequest?: ModelTypes["authProviderRequests"] | undefined,
	/** update data of the table: "auth.provider_requests" */
	updateAuthProviderRequests?: ModelTypes["authProviderRequests_mutation_response"] | undefined,
	/** update data of the table: "auth.providers" */
	updateAuthProviders?: ModelTypes["authProviders_mutation_response"] | undefined,
	/** update single row of the table: "auth.refresh_tokens" */
	updateAuthRefreshToken?: ModelTypes["authRefreshTokens"] | undefined,
	/** update single row of the table: "auth.refresh_token_types" */
	updateAuthRefreshTokenType?: ModelTypes["authRefreshTokenTypes"] | undefined,
	/** update data of the table: "auth.refresh_token_types" */
	updateAuthRefreshTokenTypes?: ModelTypes["authRefreshTokenTypes_mutation_response"] | undefined,
	/** update data of the table: "auth.refresh_tokens" */
	updateAuthRefreshTokens?: ModelTypes["authRefreshTokens_mutation_response"] | undefined,
	/** update single row of the table: "auth.roles" */
	updateAuthRole?: ModelTypes["authRoles"] | undefined,
	/** update data of the table: "auth.roles" */
	updateAuthRoles?: ModelTypes["authRoles_mutation_response"] | undefined,
	/** update single row of the table: "auth.user_providers" */
	updateAuthUserProvider?: ModelTypes["authUserProviders"] | undefined,
	/** update data of the table: "auth.user_providers" */
	updateAuthUserProviders?: ModelTypes["authUserProviders_mutation_response"] | undefined,
	/** update single row of the table: "auth.user_roles" */
	updateAuthUserRole?: ModelTypes["authUserRoles"] | undefined,
	/** update data of the table: "auth.user_roles" */
	updateAuthUserRoles?: ModelTypes["authUserRoles_mutation_response"] | undefined,
	/** update single row of the table: "auth.user_security_keys" */
	updateAuthUserSecurityKey?: ModelTypes["authUserSecurityKeys"] | undefined,
	/** update data of the table: "auth.user_security_keys" */
	updateAuthUserSecurityKeys?: ModelTypes["authUserSecurityKeys_mutation_response"] | undefined,
	/** update single row of the table: "storage.buckets" */
	updateBucket?: ModelTypes["buckets"] | undefined,
	/** update data of the table: "storage.buckets" */
	updateBuckets?: ModelTypes["buckets_mutation_response"] | undefined,
	/** update single row of the table: "storage.files" */
	updateFile?: ModelTypes["files"] | undefined,
	/** update data of the table: "storage.files" */
	updateFiles?: ModelTypes["files_mutation_response"] | undefined,
	/** update single row of the table: "auth.users" */
	updateUser?: ModelTypes["users"] | undefined,
	/** update data of the table: "auth.users" */
	updateUsers?: ModelTypes["users_mutation_response"] | undefined,
	/** update multiples rows of table: "auth.provider_requests" */
	update_authProviderRequests_many?: Array<ModelTypes["authProviderRequests_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.providers" */
	update_authProviders_many?: Array<ModelTypes["authProviders_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.refresh_token_types" */
	update_authRefreshTokenTypes_many?: Array<ModelTypes["authRefreshTokenTypes_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.refresh_tokens" */
	update_authRefreshTokens_many?: Array<ModelTypes["authRefreshTokens_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.roles" */
	update_authRoles_many?: Array<ModelTypes["authRoles_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.user_providers" */
	update_authUserProviders_many?: Array<ModelTypes["authUserProviders_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.user_roles" */
	update_authUserRoles_many?: Array<ModelTypes["authUserRoles_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.user_security_keys" */
	update_authUserSecurityKeys_many?: Array<ModelTypes["authUserSecurityKeys_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "storage.buckets" */
	update_buckets_many?: Array<ModelTypes["buckets_mutation_response"] | undefined> | undefined,
	/** update data of the table: "event_files" */
	update_event_files?: ModelTypes["event_files_mutation_response"] | undefined,
	/** update single row of the table: "event_files" */
	update_event_files_by_pk?: ModelTypes["event_files"] | undefined,
	/** update multiples rows of table: "event_files" */
	update_event_files_many?: Array<ModelTypes["event_files_mutation_response"] | undefined> | undefined,
	/** update data of the table: "event_participants" */
	update_event_participants?: ModelTypes["event_participants_mutation_response"] | undefined,
	/** update single row of the table: "event_participants" */
	update_event_participants_by_pk?: ModelTypes["event_participants"] | undefined,
	/** update multiples rows of table: "event_participants" */
	update_event_participants_many?: Array<ModelTypes["event_participants_mutation_response"] | undefined> | undefined,
	/** update data of the table: "events" */
	update_events?: ModelTypes["events_mutation_response"] | undefined,
	/** update single row of the table: "events" */
	update_events_by_pk?: ModelTypes["events"] | undefined,
	/** update multiples rows of table: "events" */
	update_events_many?: Array<ModelTypes["events_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "storage.files" */
	update_files_many?: Array<ModelTypes["files_mutation_response"] | undefined> | undefined,
	/** update data of the table: "installations" */
	update_installations?: ModelTypes["installations_mutation_response"] | undefined,
	/** update single row of the table: "installations" */
	update_installations_by_pk?: ModelTypes["installations"] | undefined,
	/** update multiples rows of table: "installations" */
	update_installations_many?: Array<ModelTypes["installations_mutation_response"] | undefined> | undefined,
	/** update data of the table: "user_files" */
	update_user_files?: ModelTypes["user_files_mutation_response"] | undefined,
	/** update single row of the table: "user_files" */
	update_user_files_by_pk?: ModelTypes["user_files"] | undefined,
	/** update multiples rows of table: "user_files" */
	update_user_files_many?: Array<ModelTypes["user_files_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.users" */
	update_users_many?: Array<ModelTypes["users_mutation_response"] | undefined> | undefined
};
	["order_by"]:order_by;
	["query_root"]: {
		/** fetch data from the table: "auth.providers" using primary key columns */
	authProvider?: ModelTypes["authProviders"] | undefined,
	/** fetch data from the table: "auth.provider_requests" using primary key columns */
	authProviderRequest?: ModelTypes["authProviderRequests"] | undefined,
	/** fetch data from the table: "auth.provider_requests" */
	authProviderRequests: Array<ModelTypes["authProviderRequests"]>,
	/** fetch aggregated fields from the table: "auth.provider_requests" */
	authProviderRequestsAggregate: ModelTypes["authProviderRequests_aggregate"],
	/** fetch data from the table: "auth.providers" */
	authProviders: Array<ModelTypes["authProviders"]>,
	/** fetch aggregated fields from the table: "auth.providers" */
	authProvidersAggregate: ModelTypes["authProviders_aggregate"],
	/** fetch data from the table: "auth.refresh_tokens" using primary key columns */
	authRefreshToken?: ModelTypes["authRefreshTokens"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" using primary key columns */
	authRefreshTokenType?: ModelTypes["authRefreshTokenTypes"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" */
	authRefreshTokenTypes: Array<ModelTypes["authRefreshTokenTypes"]>,
	/** fetch aggregated fields from the table: "auth.refresh_token_types" */
	authRefreshTokenTypesAggregate: ModelTypes["authRefreshTokenTypes_aggregate"],
	/** fetch data from the table: "auth.refresh_tokens" */
	authRefreshTokens: Array<ModelTypes["authRefreshTokens"]>,
	/** fetch aggregated fields from the table: "auth.refresh_tokens" */
	authRefreshTokensAggregate: ModelTypes["authRefreshTokens_aggregate"],
	/** fetch data from the table: "auth.roles" using primary key columns */
	authRole?: ModelTypes["authRoles"] | undefined,
	/** fetch data from the table: "auth.roles" */
	authRoles: Array<ModelTypes["authRoles"]>,
	/** fetch aggregated fields from the table: "auth.roles" */
	authRolesAggregate: ModelTypes["authRoles_aggregate"],
	/** fetch data from the table: "auth.user_providers" using primary key columns */
	authUserProvider?: ModelTypes["authUserProviders"] | undefined,
	/** fetch data from the table: "auth.user_providers" */
	authUserProviders: Array<ModelTypes["authUserProviders"]>,
	/** fetch aggregated fields from the table: "auth.user_providers" */
	authUserProvidersAggregate: ModelTypes["authUserProviders_aggregate"],
	/** fetch data from the table: "auth.user_roles" using primary key columns */
	authUserRole?: ModelTypes["authUserRoles"] | undefined,
	/** fetch data from the table: "auth.user_roles" */
	authUserRoles: Array<ModelTypes["authUserRoles"]>,
	/** fetch aggregated fields from the table: "auth.user_roles" */
	authUserRolesAggregate: ModelTypes["authUserRoles_aggregate"],
	/** fetch data from the table: "auth.user_security_keys" using primary key columns */
	authUserSecurityKey?: ModelTypes["authUserSecurityKeys"] | undefined,
	/** fetch data from the table: "auth.user_security_keys" */
	authUserSecurityKeys: Array<ModelTypes["authUserSecurityKeys"]>,
	/** fetch aggregated fields from the table: "auth.user_security_keys" */
	authUserSecurityKeysAggregate: ModelTypes["authUserSecurityKeys_aggregate"],
	/** fetch data from the table: "storage.buckets" using primary key columns */
	bucket?: ModelTypes["buckets"] | undefined,
	/** fetch data from the table: "storage.buckets" */
	buckets: Array<ModelTypes["buckets"]>,
	/** fetch aggregated fields from the table: "storage.buckets" */
	bucketsAggregate: ModelTypes["buckets_aggregate"],
	/** fetch data from the table: "event_files" */
	event_files: Array<ModelTypes["event_files"]>,
	/** fetch aggregated fields from the table: "event_files" */
	event_files_aggregate: ModelTypes["event_files_aggregate"],
	/** fetch data from the table: "event_files" using primary key columns */
	event_files_by_pk?: ModelTypes["event_files"] | undefined,
	/** fetch data from the table: "event_participants" */
	event_participants: Array<ModelTypes["event_participants"]>,
	/** fetch aggregated fields from the table: "event_participants" */
	event_participants_aggregate: ModelTypes["event_participants_aggregate"],
	/** fetch data from the table: "event_participants" using primary key columns */
	event_participants_by_pk?: ModelTypes["event_participants"] | undefined,
	/** An array relationship */
	events: Array<ModelTypes["events"]>,
	/** An aggregate relationship */
	events_aggregate: ModelTypes["events_aggregate"],
	/** fetch data from the table: "events" using primary key columns */
	events_by_pk?: ModelTypes["events"] | undefined,
	/** fetch data from the table: "storage.files" using primary key columns */
	file?: ModelTypes["files"] | undefined,
	/** An array relationship */
	files: Array<ModelTypes["files"]>,
	/** fetch aggregated fields from the table: "storage.files" */
	filesAggregate: ModelTypes["files_aggregate"],
	/** An array relationship */
	installations: Array<ModelTypes["installations"]>,
	/** An aggregate relationship */
	installations_aggregate: ModelTypes["installations_aggregate"],
	/** fetch data from the table: "installations" using primary key columns */
	installations_by_pk?: ModelTypes["installations"] | undefined,
	/** fetch data from the table: "auth.users" using primary key columns */
	user?: ModelTypes["users"] | undefined,
	/** fetch data from the table: "user_files" */
	user_files: Array<ModelTypes["user_files"]>,
	/** fetch aggregated fields from the table: "user_files" */
	user_files_aggregate: ModelTypes["user_files_aggregate"],
	/** fetch data from the table: "user_files" using primary key columns */
	user_files_by_pk?: ModelTypes["user_files"] | undefined,
	/** fetch data from the table: "auth.users" */
	users: Array<ModelTypes["users"]>,
	/** fetch aggregated fields from the table: "auth.users" */
	usersAggregate: ModelTypes["users_aggregate"]
};
	["subscription_root"]: {
		/** fetch data from the table: "auth.providers" using primary key columns */
	authProvider?: ModelTypes["authProviders"] | undefined,
	/** fetch data from the table: "auth.provider_requests" using primary key columns */
	authProviderRequest?: ModelTypes["authProviderRequests"] | undefined,
	/** fetch data from the table: "auth.provider_requests" */
	authProviderRequests: Array<ModelTypes["authProviderRequests"]>,
	/** fetch aggregated fields from the table: "auth.provider_requests" */
	authProviderRequestsAggregate: ModelTypes["authProviderRequests_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.provider_requests" */
	authProviderRequests_stream: Array<ModelTypes["authProviderRequests"]>,
	/** fetch data from the table: "auth.providers" */
	authProviders: Array<ModelTypes["authProviders"]>,
	/** fetch aggregated fields from the table: "auth.providers" */
	authProvidersAggregate: ModelTypes["authProviders_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.providers" */
	authProviders_stream: Array<ModelTypes["authProviders"]>,
	/** fetch data from the table: "auth.refresh_tokens" using primary key columns */
	authRefreshToken?: ModelTypes["authRefreshTokens"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" using primary key columns */
	authRefreshTokenType?: ModelTypes["authRefreshTokenTypes"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" */
	authRefreshTokenTypes: Array<ModelTypes["authRefreshTokenTypes"]>,
	/** fetch aggregated fields from the table: "auth.refresh_token_types" */
	authRefreshTokenTypesAggregate: ModelTypes["authRefreshTokenTypes_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.refresh_token_types" */
	authRefreshTokenTypes_stream: Array<ModelTypes["authRefreshTokenTypes"]>,
	/** fetch data from the table: "auth.refresh_tokens" */
	authRefreshTokens: Array<ModelTypes["authRefreshTokens"]>,
	/** fetch aggregated fields from the table: "auth.refresh_tokens" */
	authRefreshTokensAggregate: ModelTypes["authRefreshTokens_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.refresh_tokens" */
	authRefreshTokens_stream: Array<ModelTypes["authRefreshTokens"]>,
	/** fetch data from the table: "auth.roles" using primary key columns */
	authRole?: ModelTypes["authRoles"] | undefined,
	/** fetch data from the table: "auth.roles" */
	authRoles: Array<ModelTypes["authRoles"]>,
	/** fetch aggregated fields from the table: "auth.roles" */
	authRolesAggregate: ModelTypes["authRoles_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.roles" */
	authRoles_stream: Array<ModelTypes["authRoles"]>,
	/** fetch data from the table: "auth.user_providers" using primary key columns */
	authUserProvider?: ModelTypes["authUserProviders"] | undefined,
	/** fetch data from the table: "auth.user_providers" */
	authUserProviders: Array<ModelTypes["authUserProviders"]>,
	/** fetch aggregated fields from the table: "auth.user_providers" */
	authUserProvidersAggregate: ModelTypes["authUserProviders_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.user_providers" */
	authUserProviders_stream: Array<ModelTypes["authUserProviders"]>,
	/** fetch data from the table: "auth.user_roles" using primary key columns */
	authUserRole?: ModelTypes["authUserRoles"] | undefined,
	/** fetch data from the table: "auth.user_roles" */
	authUserRoles: Array<ModelTypes["authUserRoles"]>,
	/** fetch aggregated fields from the table: "auth.user_roles" */
	authUserRolesAggregate: ModelTypes["authUserRoles_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.user_roles" */
	authUserRoles_stream: Array<ModelTypes["authUserRoles"]>,
	/** fetch data from the table: "auth.user_security_keys" using primary key columns */
	authUserSecurityKey?: ModelTypes["authUserSecurityKeys"] | undefined,
	/** fetch data from the table: "auth.user_security_keys" */
	authUserSecurityKeys: Array<ModelTypes["authUserSecurityKeys"]>,
	/** fetch aggregated fields from the table: "auth.user_security_keys" */
	authUserSecurityKeysAggregate: ModelTypes["authUserSecurityKeys_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.user_security_keys" */
	authUserSecurityKeys_stream: Array<ModelTypes["authUserSecurityKeys"]>,
	/** fetch data from the table: "storage.buckets" using primary key columns */
	bucket?: ModelTypes["buckets"] | undefined,
	/** fetch data from the table: "storage.buckets" */
	buckets: Array<ModelTypes["buckets"]>,
	/** fetch aggregated fields from the table: "storage.buckets" */
	bucketsAggregate: ModelTypes["buckets_aggregate"],
	/** fetch data from the table in a streaming manner: "storage.buckets" */
	buckets_stream: Array<ModelTypes["buckets"]>,
	/** fetch data from the table: "event_files" */
	event_files: Array<ModelTypes["event_files"]>,
	/** fetch aggregated fields from the table: "event_files" */
	event_files_aggregate: ModelTypes["event_files_aggregate"],
	/** fetch data from the table: "event_files" using primary key columns */
	event_files_by_pk?: ModelTypes["event_files"] | undefined,
	/** fetch data from the table in a streaming manner: "event_files" */
	event_files_stream: Array<ModelTypes["event_files"]>,
	/** fetch data from the table: "event_participants" */
	event_participants: Array<ModelTypes["event_participants"]>,
	/** fetch aggregated fields from the table: "event_participants" */
	event_participants_aggregate: ModelTypes["event_participants_aggregate"],
	/** fetch data from the table: "event_participants" using primary key columns */
	event_participants_by_pk?: ModelTypes["event_participants"] | undefined,
	/** fetch data from the table in a streaming manner: "event_participants" */
	event_participants_stream: Array<ModelTypes["event_participants"]>,
	/** An array relationship */
	events: Array<ModelTypes["events"]>,
	/** An aggregate relationship */
	events_aggregate: ModelTypes["events_aggregate"],
	/** fetch data from the table: "events" using primary key columns */
	events_by_pk?: ModelTypes["events"] | undefined,
	/** fetch data from the table in a streaming manner: "events" */
	events_stream: Array<ModelTypes["events"]>,
	/** fetch data from the table: "storage.files" using primary key columns */
	file?: ModelTypes["files"] | undefined,
	/** An array relationship */
	files: Array<ModelTypes["files"]>,
	/** fetch aggregated fields from the table: "storage.files" */
	filesAggregate: ModelTypes["files_aggregate"],
	/** fetch data from the table in a streaming manner: "storage.files" */
	files_stream: Array<ModelTypes["files"]>,
	/** An array relationship */
	installations: Array<ModelTypes["installations"]>,
	/** An aggregate relationship */
	installations_aggregate: ModelTypes["installations_aggregate"],
	/** fetch data from the table: "installations" using primary key columns */
	installations_by_pk?: ModelTypes["installations"] | undefined,
	/** fetch data from the table in a streaming manner: "installations" */
	installations_stream: Array<ModelTypes["installations"]>,
	/** fetch data from the table: "auth.users" using primary key columns */
	user?: ModelTypes["users"] | undefined,
	/** fetch data from the table: "user_files" */
	user_files: Array<ModelTypes["user_files"]>,
	/** fetch aggregated fields from the table: "user_files" */
	user_files_aggregate: ModelTypes["user_files_aggregate"],
	/** fetch data from the table: "user_files" using primary key columns */
	user_files_by_pk?: ModelTypes["user_files"] | undefined,
	/** fetch data from the table in a streaming manner: "user_files" */
	user_files_stream: Array<ModelTypes["user_files"]>,
	/** fetch data from the table: "auth.users" */
	users: Array<ModelTypes["users"]>,
	/** fetch aggregated fields from the table: "auth.users" */
	usersAggregate: ModelTypes["users_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.users" */
	users_stream: Array<ModelTypes["users"]>
};
	["timestamptz"]:any;
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
	_eq?: ModelTypes["timestamptz"] | undefined,
	_gt?: ModelTypes["timestamptz"] | undefined,
	_gte?: ModelTypes["timestamptz"] | undefined,
	_in?: Array<ModelTypes["timestamptz"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["timestamptz"] | undefined,
	_lte?: ModelTypes["timestamptz"] | undefined,
	_neq?: ModelTypes["timestamptz"] | undefined,
	_nin?: Array<ModelTypes["timestamptz"]> | undefined
};
	/** columns and relationships of "user_files" */
["user_files"]: {
		fileId: ModelTypes["uuid"],
	userId: ModelTypes["uuid"]
};
	/** aggregated selection of "user_files" */
["user_files_aggregate"]: {
		aggregate?: ModelTypes["user_files_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["user_files"]>
};
	/** aggregate fields of "user_files" */
["user_files_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["user_files_max_fields"] | undefined,
	min?: ModelTypes["user_files_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "user_files". All fields are combined with a logical 'AND'. */
["user_files_bool_exp"]: {
	_and?: Array<ModelTypes["user_files_bool_exp"]> | undefined,
	_not?: ModelTypes["user_files_bool_exp"] | undefined,
	_or?: Array<ModelTypes["user_files_bool_exp"]> | undefined,
	fileId?: ModelTypes["uuid_comparison_exp"] | undefined,
	userId?: ModelTypes["uuid_comparison_exp"] | undefined
};
	["user_files_constraint"]:user_files_constraint;
	/** input type for inserting data into table "user_files" */
["user_files_insert_input"]: {
	fileId?: ModelTypes["uuid"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["user_files_max_fields"]: {
		fileId?: ModelTypes["uuid"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["user_files_min_fields"]: {
		fileId?: ModelTypes["uuid"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** response of any mutation on the table "user_files" */
["user_files_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["user_files"]>
};
	/** on_conflict condition type for table "user_files" */
["user_files_on_conflict"]: {
	constraint: ModelTypes["user_files_constraint"],
	update_columns: Array<ModelTypes["user_files_update_column"]>,
	where?: ModelTypes["user_files_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "user_files". */
["user_files_order_by"]: {
	fileId?: ModelTypes["order_by"] | undefined,
	userId?: ModelTypes["order_by"] | undefined
};
	/** primary key columns input for table: user_files */
["user_files_pk_columns_input"]: {
	fileId: ModelTypes["uuid"],
	userId: ModelTypes["uuid"]
};
	["user_files_select_column"]:user_files_select_column;
	/** input type for updating data in table "user_files" */
["user_files_set_input"]: {
	fileId?: ModelTypes["uuid"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "user_files" */
["user_files_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["user_files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["user_files_stream_cursor_value_input"]: {
	fileId?: ModelTypes["uuid"] | undefined,
	userId?: ModelTypes["uuid"] | undefined
};
	["user_files_update_column"]:user_files_update_column;
	["user_files_updates"]: {
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["user_files_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["user_files_bool_exp"]
};
	/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
["users"]: {
		activeMfaType?: string | undefined,
	avatarUrl: string,
	createdAt: ModelTypes["timestamptz"],
	currentChallenge?: string | undefined,
	defaultRole: string,
	/** An object relationship */
	defaultRoleByRole: ModelTypes["authRoles"],
	disabled: boolean,
	displayName: string,
	email?: ModelTypes["citext"] | undefined,
	emailVerified: boolean,
	/** An array relationship */
	events: Array<ModelTypes["events"]>,
	/** An aggregate relationship */
	events_aggregate: ModelTypes["events_aggregate"],
	id: ModelTypes["uuid"],
	/** An array relationship */
	installations: Array<ModelTypes["installations"]>,
	/** An aggregate relationship */
	installations_aggregate: ModelTypes["installations_aggregate"],
	isAnonymous: boolean,
	lastSeen?: ModelTypes["timestamptz"] | undefined,
	locale: string,
	metadata?: ModelTypes["jsonb"] | undefined,
	newEmail?: ModelTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt: ModelTypes["timestamptz"],
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified: boolean,
	/** An array relationship */
	refreshTokens: Array<ModelTypes["authRefreshTokens"]>,
	/** An aggregate relationship */
	refreshTokens_aggregate: ModelTypes["authRefreshTokens_aggregate"],
	/** An array relationship */
	roles: Array<ModelTypes["authUserRoles"]>,
	/** An aggregate relationship */
	roles_aggregate: ModelTypes["authUserRoles_aggregate"],
	/** An array relationship */
	securityKeys: Array<ModelTypes["authUserSecurityKeys"]>,
	/** An aggregate relationship */
	securityKeys_aggregate: ModelTypes["authUserSecurityKeys_aggregate"],
	ticket?: string | undefined,
	ticketExpiresAt: ModelTypes["timestamptz"],
	totpSecret?: string | undefined,
	updatedAt: ModelTypes["timestamptz"],
	/** An array relationship */
	userProviders: Array<ModelTypes["authUserProviders"]>,
	/** An aggregate relationship */
	userProviders_aggregate: ModelTypes["authUserProviders_aggregate"]
};
	/** aggregated selection of "auth.users" */
["users_aggregate"]: {
		aggregate?: ModelTypes["users_aggregate_fields"] | undefined,
	nodes: Array<ModelTypes["users"]>
};
	["users_aggregate_bool_exp"]: {
	bool_and?: ModelTypes["users_aggregate_bool_exp_bool_and"] | undefined,
	bool_or?: ModelTypes["users_aggregate_bool_exp_bool_or"] | undefined,
	count?: ModelTypes["users_aggregate_bool_exp_count"] | undefined
};
	["users_aggregate_bool_exp_bool_and"]: {
	arguments: ModelTypes["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: ModelTypes["users_bool_exp"] | undefined,
	predicate: ModelTypes["Boolean_comparison_exp"]
};
	["users_aggregate_bool_exp_bool_or"]: {
	arguments: ModelTypes["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: ModelTypes["users_bool_exp"] | undefined,
	predicate: ModelTypes["Boolean_comparison_exp"]
};
	["users_aggregate_bool_exp_count"]: {
	arguments?: Array<ModelTypes["users_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: ModelTypes["users_bool_exp"] | undefined,
	predicate: ModelTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.users" */
["users_aggregate_fields"]: {
		count: number,
	max?: ModelTypes["users_max_fields"] | undefined,
	min?: ModelTypes["users_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.users" */
["users_aggregate_order_by"]: {
	count?: ModelTypes["order_by"] | undefined,
	max?: ModelTypes["users_max_order_by"] | undefined,
	min?: ModelTypes["users_min_order_by"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["users_append_input"]: {
	metadata?: ModelTypes["jsonb"] | undefined
};
	/** input type for inserting array relation for remote table "auth.users" */
["users_arr_rel_insert_input"]: {
	data: Array<ModelTypes["users_insert_input"]>,
	/** upsert condition */
	on_conflict?: ModelTypes["users_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
["users_bool_exp"]: {
	_and?: Array<ModelTypes["users_bool_exp"]> | undefined,
	_not?: ModelTypes["users_bool_exp"] | undefined,
	_or?: Array<ModelTypes["users_bool_exp"]> | undefined,
	activeMfaType?: ModelTypes["String_comparison_exp"] | undefined,
	avatarUrl?: ModelTypes["String_comparison_exp"] | undefined,
	createdAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	currentChallenge?: ModelTypes["String_comparison_exp"] | undefined,
	defaultRole?: ModelTypes["String_comparison_exp"] | undefined,
	defaultRoleByRole?: ModelTypes["authRoles_bool_exp"] | undefined,
	disabled?: ModelTypes["Boolean_comparison_exp"] | undefined,
	displayName?: ModelTypes["String_comparison_exp"] | undefined,
	email?: ModelTypes["citext_comparison_exp"] | undefined,
	emailVerified?: ModelTypes["Boolean_comparison_exp"] | undefined,
	events?: ModelTypes["events_bool_exp"] | undefined,
	events_aggregate?: ModelTypes["events_aggregate_bool_exp"] | undefined,
	id?: ModelTypes["uuid_comparison_exp"] | undefined,
	installations?: ModelTypes["installations_bool_exp"] | undefined,
	installations_aggregate?: ModelTypes["installations_aggregate_bool_exp"] | undefined,
	isAnonymous?: ModelTypes["Boolean_comparison_exp"] | undefined,
	lastSeen?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	locale?: ModelTypes["String_comparison_exp"] | undefined,
	metadata?: ModelTypes["jsonb_comparison_exp"] | undefined,
	newEmail?: ModelTypes["citext_comparison_exp"] | undefined,
	otpHash?: ModelTypes["String_comparison_exp"] | undefined,
	otpHashExpiresAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	otpMethodLastUsed?: ModelTypes["String_comparison_exp"] | undefined,
	passwordHash?: ModelTypes["String_comparison_exp"] | undefined,
	phoneNumber?: ModelTypes["String_comparison_exp"] | undefined,
	phoneNumberVerified?: ModelTypes["Boolean_comparison_exp"] | undefined,
	refreshTokens?: ModelTypes["authRefreshTokens_bool_exp"] | undefined,
	refreshTokens_aggregate?: ModelTypes["authRefreshTokens_aggregate_bool_exp"] | undefined,
	roles?: ModelTypes["authUserRoles_bool_exp"] | undefined,
	roles_aggregate?: ModelTypes["authUserRoles_aggregate_bool_exp"] | undefined,
	securityKeys?: ModelTypes["authUserSecurityKeys_bool_exp"] | undefined,
	securityKeys_aggregate?: ModelTypes["authUserSecurityKeys_aggregate_bool_exp"] | undefined,
	ticket?: ModelTypes["String_comparison_exp"] | undefined,
	ticketExpiresAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	totpSecret?: ModelTypes["String_comparison_exp"] | undefined,
	updatedAt?: ModelTypes["timestamptz_comparison_exp"] | undefined,
	userProviders?: ModelTypes["authUserProviders_bool_exp"] | undefined,
	userProviders_aggregate?: ModelTypes["authUserProviders_aggregate_bool_exp"] | undefined
};
	["users_constraint"]:users_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["users_delete_at_path_input"]: {
	metadata?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["users_delete_elem_input"]: {
	metadata?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["users_delete_key_input"]: {
	metadata?: string | undefined
};
	/** input type for inserting data into table "auth.users" */
["users_insert_input"]: {
	activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	defaultRoleByRole?: ModelTypes["authRoles_obj_rel_insert_input"] | undefined,
	disabled?: boolean | undefined,
	displayName?: string | undefined,
	email?: ModelTypes["citext"] | undefined,
	emailVerified?: boolean | undefined,
	events?: ModelTypes["events_arr_rel_insert_input"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	installations?: ModelTypes["installations_arr_rel_insert_input"] | undefined,
	isAnonymous?: boolean | undefined,
	lastSeen?: ModelTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	metadata?: ModelTypes["jsonb"] | undefined,
	newEmail?: ModelTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: ModelTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified?: boolean | undefined,
	refreshTokens?: ModelTypes["authRefreshTokens_arr_rel_insert_input"] | undefined,
	roles?: ModelTypes["authUserRoles_arr_rel_insert_input"] | undefined,
	securityKeys?: ModelTypes["authUserSecurityKeys_arr_rel_insert_input"] | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: ModelTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined,
	userProviders?: ModelTypes["authUserProviders_arr_rel_insert_input"] | undefined
};
	/** aggregate max on columns */
["users_max_fields"]: {
		activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	displayName?: string | undefined,
	email?: ModelTypes["citext"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	lastSeen?: ModelTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	newEmail?: ModelTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: ModelTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: ModelTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** order by max() on columns of table "auth.users" */
["users_max_order_by"]: {
	activeMfaType?: ModelTypes["order_by"] | undefined,
	avatarUrl?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	currentChallenge?: ModelTypes["order_by"] | undefined,
	defaultRole?: ModelTypes["order_by"] | undefined,
	displayName?: ModelTypes["order_by"] | undefined,
	email?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	lastSeen?: ModelTypes["order_by"] | undefined,
	locale?: ModelTypes["order_by"] | undefined,
	newEmail?: ModelTypes["order_by"] | undefined,
	otpHash?: ModelTypes["order_by"] | undefined,
	otpHashExpiresAt?: ModelTypes["order_by"] | undefined,
	otpMethodLastUsed?: ModelTypes["order_by"] | undefined,
	passwordHash?: ModelTypes["order_by"] | undefined,
	phoneNumber?: ModelTypes["order_by"] | undefined,
	ticket?: ModelTypes["order_by"] | undefined,
	ticketExpiresAt?: ModelTypes["order_by"] | undefined,
	totpSecret?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["users_min_fields"]: {
		activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	displayName?: string | undefined,
	email?: ModelTypes["citext"] | undefined,
	id?: ModelTypes["uuid"] | undefined,
	lastSeen?: ModelTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	newEmail?: ModelTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: ModelTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: ModelTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** order by min() on columns of table "auth.users" */
["users_min_order_by"]: {
	activeMfaType?: ModelTypes["order_by"] | undefined,
	avatarUrl?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	currentChallenge?: ModelTypes["order_by"] | undefined,
	defaultRole?: ModelTypes["order_by"] | undefined,
	displayName?: ModelTypes["order_by"] | undefined,
	email?: ModelTypes["order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	lastSeen?: ModelTypes["order_by"] | undefined,
	locale?: ModelTypes["order_by"] | undefined,
	newEmail?: ModelTypes["order_by"] | undefined,
	otpHash?: ModelTypes["order_by"] | undefined,
	otpHashExpiresAt?: ModelTypes["order_by"] | undefined,
	otpMethodLastUsed?: ModelTypes["order_by"] | undefined,
	passwordHash?: ModelTypes["order_by"] | undefined,
	phoneNumber?: ModelTypes["order_by"] | undefined,
	ticket?: ModelTypes["order_by"] | undefined,
	ticketExpiresAt?: ModelTypes["order_by"] | undefined,
	totpSecret?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.users" */
["users_mutation_response"]: {
		/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<ModelTypes["users"]>
};
	/** input type for inserting object relation for remote table "auth.users" */
["users_obj_rel_insert_input"]: {
	data: ModelTypes["users_insert_input"],
	/** upsert condition */
	on_conflict?: ModelTypes["users_on_conflict"] | undefined
};
	/** on_conflict condition type for table "auth.users" */
["users_on_conflict"]: {
	constraint: ModelTypes["users_constraint"],
	update_columns: Array<ModelTypes["users_update_column"]>,
	where?: ModelTypes["users_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.users". */
["users_order_by"]: {
	activeMfaType?: ModelTypes["order_by"] | undefined,
	avatarUrl?: ModelTypes["order_by"] | undefined,
	createdAt?: ModelTypes["order_by"] | undefined,
	currentChallenge?: ModelTypes["order_by"] | undefined,
	defaultRole?: ModelTypes["order_by"] | undefined,
	defaultRoleByRole?: ModelTypes["authRoles_order_by"] | undefined,
	disabled?: ModelTypes["order_by"] | undefined,
	displayName?: ModelTypes["order_by"] | undefined,
	email?: ModelTypes["order_by"] | undefined,
	emailVerified?: ModelTypes["order_by"] | undefined,
	events_aggregate?: ModelTypes["events_aggregate_order_by"] | undefined,
	id?: ModelTypes["order_by"] | undefined,
	installations_aggregate?: ModelTypes["installations_aggregate_order_by"] | undefined,
	isAnonymous?: ModelTypes["order_by"] | undefined,
	lastSeen?: ModelTypes["order_by"] | undefined,
	locale?: ModelTypes["order_by"] | undefined,
	metadata?: ModelTypes["order_by"] | undefined,
	newEmail?: ModelTypes["order_by"] | undefined,
	otpHash?: ModelTypes["order_by"] | undefined,
	otpHashExpiresAt?: ModelTypes["order_by"] | undefined,
	otpMethodLastUsed?: ModelTypes["order_by"] | undefined,
	passwordHash?: ModelTypes["order_by"] | undefined,
	phoneNumber?: ModelTypes["order_by"] | undefined,
	phoneNumberVerified?: ModelTypes["order_by"] | undefined,
	refreshTokens_aggregate?: ModelTypes["authRefreshTokens_aggregate_order_by"] | undefined,
	roles_aggregate?: ModelTypes["authUserRoles_aggregate_order_by"] | undefined,
	securityKeys_aggregate?: ModelTypes["authUserSecurityKeys_aggregate_order_by"] | undefined,
	ticket?: ModelTypes["order_by"] | undefined,
	ticketExpiresAt?: ModelTypes["order_by"] | undefined,
	totpSecret?: ModelTypes["order_by"] | undefined,
	updatedAt?: ModelTypes["order_by"] | undefined,
	userProviders_aggregate?: ModelTypes["authUserProviders_aggregate_order_by"] | undefined
};
	/** primary key columns input for table: auth.users */
["users_pk_columns_input"]: {
	id: ModelTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["users_prepend_input"]: {
	metadata?: ModelTypes["jsonb"] | undefined
};
	["users_select_column"]:users_select_column;
	["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"]:users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns;
	["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"]:users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "auth.users" */
["users_set_input"]: {
	activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	disabled?: boolean | undefined,
	displayName?: string | undefined,
	email?: ModelTypes["citext"] | undefined,
	emailVerified?: boolean | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isAnonymous?: boolean | undefined,
	lastSeen?: ModelTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	metadata?: ModelTypes["jsonb"] | undefined,
	newEmail?: ModelTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: ModelTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified?: boolean | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: ModelTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "users" */
["users_stream_cursor_input"]: {
	/** Stream column input with initial value */
	initial_value: ModelTypes["users_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: ModelTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["users_stream_cursor_value_input"]: {
	activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: ModelTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	disabled?: boolean | undefined,
	displayName?: string | undefined,
	email?: ModelTypes["citext"] | undefined,
	emailVerified?: boolean | undefined,
	id?: ModelTypes["uuid"] | undefined,
	isAnonymous?: boolean | undefined,
	lastSeen?: ModelTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	metadata?: ModelTypes["jsonb"] | undefined,
	newEmail?: ModelTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: ModelTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified?: boolean | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: ModelTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: ModelTypes["timestamptz"] | undefined
};
	["users_update_column"]:users_update_column;
	["users_updates"]: {
	/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: ModelTypes["users_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: ModelTypes["users_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: ModelTypes["users_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: ModelTypes["users_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: ModelTypes["users_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: ModelTypes["users_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: ModelTypes["users_bool_exp"]
};
	["uuid"]:any;
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
	_eq?: ModelTypes["uuid"] | undefined,
	_gt?: ModelTypes["uuid"] | undefined,
	_gte?: ModelTypes["uuid"] | undefined,
	_in?: Array<ModelTypes["uuid"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: ModelTypes["uuid"] | undefined,
	_lte?: ModelTypes["uuid"] | undefined,
	_neq?: ModelTypes["uuid"] | undefined,
	_nin?: Array<ModelTypes["uuid"]> | undefined
}
    }

export type GraphQLTypes = {
    /** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
["Boolean_comparison_exp"]: {
		_eq?: boolean | undefined,
	_gt?: boolean | undefined,
	_gte?: boolean | undefined,
	_in?: Array<boolean> | undefined,
	_is_null?: boolean | undefined,
	_lt?: boolean | undefined,
	_lte?: boolean | undefined,
	_neq?: boolean | undefined,
	_nin?: Array<boolean> | undefined
};
	/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
["Int_comparison_exp"]: {
		_eq?: number | undefined,
	_gt?: number | undefined,
	_gte?: number | undefined,
	_in?: Array<number> | undefined,
	_is_null?: boolean | undefined,
	_lt?: number | undefined,
	_lte?: number | undefined,
	_neq?: number | undefined,
	_nin?: Array<number> | undefined
};
	/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
["String_comparison_exp"]: {
		_eq?: string | undefined,
	_gt?: string | undefined,
	_gte?: string | undefined,
	/** does the column match the given case-insensitive pattern */
	_ilike?: string | undefined,
	_in?: Array<string> | undefined,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: string | undefined,
	_is_null?: boolean | undefined,
	/** does the column match the given pattern */
	_like?: string | undefined,
	_lt?: string | undefined,
	_lte?: string | undefined,
	_neq?: string | undefined,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: string | undefined,
	_nin?: Array<string> | undefined,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: string | undefined,
	/** does the column NOT match the given pattern */
	_nlike?: string | undefined,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: string | undefined,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: string | undefined,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: string | undefined,
	/** does the column match the given SQL regular expression */
	_similar?: string | undefined
};
	/** Oauth requests, inserted before redirecting to the provider's site. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviderRequests"]: {
	__typename: "authProviderRequests",
	id: GraphQLTypes["uuid"],
	options?: GraphQLTypes["jsonb"] | undefined
};
	/** aggregated selection of "auth.provider_requests" */
["authProviderRequests_aggregate"]: {
	__typename: "authProviderRequests_aggregate",
	aggregate?: GraphQLTypes["authProviderRequests_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authProviderRequests"]>
};
	/** aggregate fields of "auth.provider_requests" */
["authProviderRequests_aggregate_fields"]: {
	__typename: "authProviderRequests_aggregate_fields",
	count: number,
	max?: GraphQLTypes["authProviderRequests_max_fields"] | undefined,
	min?: GraphQLTypes["authProviderRequests_min_fields"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_append_input"]: {
		options?: GraphQLTypes["jsonb"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.provider_requests". All fields are combined with a logical 'AND'. */
["authProviderRequests_bool_exp"]: {
		_and?: Array<GraphQLTypes["authProviderRequests_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authProviderRequests_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authProviderRequests_bool_exp"]> | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	options?: GraphQLTypes["jsonb_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.provider_requests" */
["authProviderRequests_constraint"]: authProviderRequests_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authProviderRequests_delete_at_path_input"]: {
		options?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authProviderRequests_delete_elem_input"]: {
		options?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authProviderRequests_delete_key_input"]: {
		options?: string | undefined
};
	/** input type for inserting data into table "auth.provider_requests" */
["authProviderRequests_insert_input"]: {
		id?: GraphQLTypes["uuid"] | undefined,
	options?: GraphQLTypes["jsonb"] | undefined
};
	/** aggregate max on columns */
["authProviderRequests_max_fields"]: {
	__typename: "authProviderRequests_max_fields",
	id?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["authProviderRequests_min_fields"]: {
	__typename: "authProviderRequests_min_fields",
	id?: GraphQLTypes["uuid"] | undefined
};
	/** response of any mutation on the table "auth.provider_requests" */
["authProviderRequests_mutation_response"]: {
	__typename: "authProviderRequests_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authProviderRequests"]>
};
	/** on_conflict condition type for table "auth.provider_requests" */
["authProviderRequests_on_conflict"]: {
		constraint: GraphQLTypes["authProviderRequests_constraint"],
	update_columns: Array<GraphQLTypes["authProviderRequests_update_column"]>,
	where?: GraphQLTypes["authProviderRequests_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.provider_requests". */
["authProviderRequests_order_by"]: {
		id?: GraphQLTypes["order_by"] | undefined,
	options?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.provider_requests */
["authProviderRequests_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authProviderRequests_prepend_input"]: {
		options?: GraphQLTypes["jsonb"] | undefined
};
	/** select columns of table "auth.provider_requests" */
["authProviderRequests_select_column"]: authProviderRequests_select_column;
	/** input type for updating data in table "auth.provider_requests" */
["authProviderRequests_set_input"]: {
		id?: GraphQLTypes["uuid"] | undefined,
	options?: GraphQLTypes["jsonb"] | undefined
};
	/** Streaming cursor of the table "authProviderRequests" */
["authProviderRequests_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authProviderRequests_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authProviderRequests_stream_cursor_value_input"]: {
		id?: GraphQLTypes["uuid"] | undefined,
	options?: GraphQLTypes["jsonb"] | undefined
};
	/** update columns of table "auth.provider_requests" */
["authProviderRequests_update_column"]: authProviderRequests_update_column;
	["authProviderRequests_updates"]: {
		/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: GraphQLTypes["authProviderRequests_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: GraphQLTypes["authProviderRequests_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: GraphQLTypes["authProviderRequests_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: GraphQLTypes["authProviderRequests_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: GraphQLTypes["authProviderRequests_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authProviderRequests_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authProviderRequests_bool_exp"]
};
	/** List of available Oauth providers. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authProviders"]: {
	__typename: "authProviders",
	id: string,
	/** An array relationship */
	userProviders: Array<GraphQLTypes["authUserProviders"]>,
	/** An aggregate relationship */
	userProviders_aggregate: GraphQLTypes["authUserProviders_aggregate"]
};
	/** aggregated selection of "auth.providers" */
["authProviders_aggregate"]: {
	__typename: "authProviders_aggregate",
	aggregate?: GraphQLTypes["authProviders_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authProviders"]>
};
	/** aggregate fields of "auth.providers" */
["authProviders_aggregate_fields"]: {
	__typename: "authProviders_aggregate_fields",
	count: number,
	max?: GraphQLTypes["authProviders_max_fields"] | undefined,
	min?: GraphQLTypes["authProviders_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.providers". All fields are combined with a logical 'AND'. */
["authProviders_bool_exp"]: {
		_and?: Array<GraphQLTypes["authProviders_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authProviders_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authProviders_bool_exp"]> | undefined,
	id?: GraphQLTypes["String_comparison_exp"] | undefined,
	userProviders?: GraphQLTypes["authUserProviders_bool_exp"] | undefined,
	userProviders_aggregate?: GraphQLTypes["authUserProviders_aggregate_bool_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.providers" */
["authProviders_constraint"]: authProviders_constraint;
	/** input type for inserting data into table "auth.providers" */
["authProviders_insert_input"]: {
		id?: string | undefined,
	userProviders?: GraphQLTypes["authUserProviders_arr_rel_insert_input"] | undefined
};
	/** aggregate max on columns */
["authProviders_max_fields"]: {
	__typename: "authProviders_max_fields",
	id?: string | undefined
};
	/** aggregate min on columns */
["authProviders_min_fields"]: {
	__typename: "authProviders_min_fields",
	id?: string | undefined
};
	/** response of any mutation on the table "auth.providers" */
["authProviders_mutation_response"]: {
	__typename: "authProviders_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authProviders"]>
};
	/** input type for inserting object relation for remote table "auth.providers" */
["authProviders_obj_rel_insert_input"]: {
		data: GraphQLTypes["authProviders_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["authProviders_on_conflict"] | undefined
};
	/** on_conflict condition type for table "auth.providers" */
["authProviders_on_conflict"]: {
		constraint: GraphQLTypes["authProviders_constraint"],
	update_columns: Array<GraphQLTypes["authProviders_update_column"]>,
	where?: GraphQLTypes["authProviders_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.providers". */
["authProviders_order_by"]: {
		id?: GraphQLTypes["order_by"] | undefined,
	userProviders_aggregate?: GraphQLTypes["authUserProviders_aggregate_order_by"] | undefined
};
	/** primary key columns input for table: auth.providers */
["authProviders_pk_columns_input"]: {
		id: string
};
	/** select columns of table "auth.providers" */
["authProviders_select_column"]: authProviders_select_column;
	/** input type for updating data in table "auth.providers" */
["authProviders_set_input"]: {
		id?: string | undefined
};
	/** Streaming cursor of the table "authProviders" */
["authProviders_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authProviders_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authProviders_stream_cursor_value_input"]: {
		id?: string | undefined
};
	/** update columns of table "auth.providers" */
["authProviders_update_column"]: authProviders_update_column;
	["authProviders_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authProviders_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authProviders_bool_exp"]
};
	/** columns and relationships of "auth.refresh_token_types" */
["authRefreshTokenTypes"]: {
	__typename: "authRefreshTokenTypes",
	comment?: string | undefined,
	/** An array relationship */
	refreshTokens: Array<GraphQLTypes["authRefreshTokens"]>,
	/** An aggregate relationship */
	refreshTokens_aggregate: GraphQLTypes["authRefreshTokens_aggregate"],
	value: string
};
	/** aggregated selection of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate"]: {
	__typename: "authRefreshTokenTypes_aggregate",
	aggregate?: GraphQLTypes["authRefreshTokenTypes_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authRefreshTokenTypes"]>
};
	/** aggregate fields of "auth.refresh_token_types" */
["authRefreshTokenTypes_aggregate_fields"]: {
	__typename: "authRefreshTokenTypes_aggregate_fields",
	count: number,
	max?: GraphQLTypes["authRefreshTokenTypes_max_fields"] | undefined,
	min?: GraphQLTypes["authRefreshTokenTypes_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.refresh_token_types". All fields are combined with a logical 'AND'. */
["authRefreshTokenTypes_bool_exp"]: {
		_and?: Array<GraphQLTypes["authRefreshTokenTypes_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authRefreshTokenTypes_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authRefreshTokenTypes_bool_exp"]> | undefined,
	comment?: GraphQLTypes["String_comparison_exp"] | undefined,
	refreshTokens?: GraphQLTypes["authRefreshTokens_bool_exp"] | undefined,
	refreshTokens_aggregate?: GraphQLTypes["authRefreshTokens_aggregate_bool_exp"] | undefined,
	value?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.refresh_token_types" */
["authRefreshTokenTypes_constraint"]: authRefreshTokenTypes_constraint;
	["authRefreshTokenTypes_enum"]: authRefreshTokenTypes_enum;
	/** Boolean expression to compare columns of type "authRefreshTokenTypes_enum". All fields are combined with logical 'AND'. */
["authRefreshTokenTypes_enum_comparison_exp"]: {
		_eq?: GraphQLTypes["authRefreshTokenTypes_enum"] | undefined,
	_in?: Array<GraphQLTypes["authRefreshTokenTypes_enum"]> | undefined,
	_is_null?: boolean | undefined,
	_neq?: GraphQLTypes["authRefreshTokenTypes_enum"] | undefined,
	_nin?: Array<GraphQLTypes["authRefreshTokenTypes_enum"]> | undefined
};
	/** input type for inserting data into table "auth.refresh_token_types" */
["authRefreshTokenTypes_insert_input"]: {
		comment?: string | undefined,
	refreshTokens?: GraphQLTypes["authRefreshTokens_arr_rel_insert_input"] | undefined,
	value?: string | undefined
};
	/** aggregate max on columns */
["authRefreshTokenTypes_max_fields"]: {
	__typename: "authRefreshTokenTypes_max_fields",
	comment?: string | undefined,
	value?: string | undefined
};
	/** aggregate min on columns */
["authRefreshTokenTypes_min_fields"]: {
	__typename: "authRefreshTokenTypes_min_fields",
	comment?: string | undefined,
	value?: string | undefined
};
	/** response of any mutation on the table "auth.refresh_token_types" */
["authRefreshTokenTypes_mutation_response"]: {
	__typename: "authRefreshTokenTypes_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authRefreshTokenTypes"]>
};
	/** on_conflict condition type for table "auth.refresh_token_types" */
["authRefreshTokenTypes_on_conflict"]: {
		constraint: GraphQLTypes["authRefreshTokenTypes_constraint"],
	update_columns: Array<GraphQLTypes["authRefreshTokenTypes_update_column"]>,
	where?: GraphQLTypes["authRefreshTokenTypes_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.refresh_token_types". */
["authRefreshTokenTypes_order_by"]: {
		comment?: GraphQLTypes["order_by"] | undefined,
	refreshTokens_aggregate?: GraphQLTypes["authRefreshTokens_aggregate_order_by"] | undefined,
	value?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.refresh_token_types */
["authRefreshTokenTypes_pk_columns_input"]: {
		value: string
};
	/** select columns of table "auth.refresh_token_types" */
["authRefreshTokenTypes_select_column"]: authRefreshTokenTypes_select_column;
	/** input type for updating data in table "auth.refresh_token_types" */
["authRefreshTokenTypes_set_input"]: {
		comment?: string | undefined,
	value?: string | undefined
};
	/** Streaming cursor of the table "authRefreshTokenTypes" */
["authRefreshTokenTypes_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authRefreshTokenTypes_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokenTypes_stream_cursor_value_input"]: {
		comment?: string | undefined,
	value?: string | undefined
};
	/** update columns of table "auth.refresh_token_types" */
["authRefreshTokenTypes_update_column"]: authRefreshTokenTypes_update_column;
	["authRefreshTokenTypes_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authRefreshTokenTypes_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authRefreshTokenTypes_bool_exp"]
};
	/** User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRefreshTokens"]: {
	__typename: "authRefreshTokens",
	createdAt: GraphQLTypes["timestamptz"],
	expiresAt: GraphQLTypes["timestamptz"],
	id: GraphQLTypes["uuid"],
	metadata?: GraphQLTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type: GraphQLTypes["authRefreshTokenTypes_enum"],
	/** An object relationship */
	user: GraphQLTypes["users"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "auth.refresh_tokens" */
["authRefreshTokens_aggregate"]: {
	__typename: "authRefreshTokens_aggregate",
	aggregate?: GraphQLTypes["authRefreshTokens_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authRefreshTokens"]>
};
	["authRefreshTokens_aggregate_bool_exp"]: {
		count?: GraphQLTypes["authRefreshTokens_aggregate_bool_exp_count"] | undefined
};
	["authRefreshTokens_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["authRefreshTokens_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["authRefreshTokens_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.refresh_tokens" */
["authRefreshTokens_aggregate_fields"]: {
	__typename: "authRefreshTokens_aggregate_fields",
	count: number,
	max?: GraphQLTypes["authRefreshTokens_max_fields"] | undefined,
	min?: GraphQLTypes["authRefreshTokens_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.refresh_tokens" */
["authRefreshTokens_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["authRefreshTokens_max_order_by"] | undefined,
	min?: GraphQLTypes["authRefreshTokens_min_order_by"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_append_input"]: {
		metadata?: GraphQLTypes["jsonb"] | undefined
};
	/** input type for inserting array relation for remote table "auth.refresh_tokens" */
["authRefreshTokens_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["authRefreshTokens_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["authRefreshTokens_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.refresh_tokens". All fields are combined with a logical 'AND'. */
["authRefreshTokens_bool_exp"]: {
		_and?: Array<GraphQLTypes["authRefreshTokens_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authRefreshTokens_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authRefreshTokens_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	expiresAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	metadata?: GraphQLTypes["jsonb_comparison_exp"] | undefined,
	refreshTokenHash?: GraphQLTypes["String_comparison_exp"] | undefined,
	type?: GraphQLTypes["authRefreshTokenTypes_enum_comparison_exp"] | undefined,
	user?: GraphQLTypes["users_bool_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.refresh_tokens" */
["authRefreshTokens_constraint"]: authRefreshTokens_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["authRefreshTokens_delete_at_path_input"]: {
		metadata?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["authRefreshTokens_delete_elem_input"]: {
		metadata?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["authRefreshTokens_delete_key_input"]: {
		metadata?: string | undefined
};
	/** input type for inserting data into table "auth.refresh_tokens" */
["authRefreshTokens_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	expiresAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	metadata?: GraphQLTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type?: GraphQLTypes["authRefreshTokenTypes_enum"] | undefined,
	user?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authRefreshTokens_max_fields"]: {
	__typename: "authRefreshTokens_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	expiresAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	refreshTokenHash?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_max_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	expiresAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	refreshTokenHash?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authRefreshTokens_min_fields"]: {
	__typename: "authRefreshTokens_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	expiresAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	refreshTokenHash?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.refresh_tokens" */
["authRefreshTokens_min_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	expiresAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	refreshTokenHash?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.refresh_tokens" */
["authRefreshTokens_mutation_response"]: {
	__typename: "authRefreshTokens_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authRefreshTokens"]>
};
	/** on_conflict condition type for table "auth.refresh_tokens" */
["authRefreshTokens_on_conflict"]: {
		constraint: GraphQLTypes["authRefreshTokens_constraint"],
	update_columns: Array<GraphQLTypes["authRefreshTokens_update_column"]>,
	where?: GraphQLTypes["authRefreshTokens_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.refresh_tokens". */
["authRefreshTokens_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	expiresAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	metadata?: GraphQLTypes["order_by"] | undefined,
	refreshTokenHash?: GraphQLTypes["order_by"] | undefined,
	type?: GraphQLTypes["order_by"] | undefined,
	user?: GraphQLTypes["users_order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.refresh_tokens */
["authRefreshTokens_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["authRefreshTokens_prepend_input"]: {
		metadata?: GraphQLTypes["jsonb"] | undefined
};
	/** select columns of table "auth.refresh_tokens" */
["authRefreshTokens_select_column"]: authRefreshTokens_select_column;
	/** input type for updating data in table "auth.refresh_tokens" */
["authRefreshTokens_set_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	expiresAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	metadata?: GraphQLTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type?: GraphQLTypes["authRefreshTokenTypes_enum"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "authRefreshTokens" */
["authRefreshTokens_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authRefreshTokens_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authRefreshTokens_stream_cursor_value_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	expiresAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	metadata?: GraphQLTypes["jsonb"] | undefined,
	refreshTokenHash?: string | undefined,
	type?: GraphQLTypes["authRefreshTokenTypes_enum"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** update columns of table "auth.refresh_tokens" */
["authRefreshTokens_update_column"]: authRefreshTokens_update_column;
	["authRefreshTokens_updates"]: {
		/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: GraphQLTypes["authRefreshTokens_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: GraphQLTypes["authRefreshTokens_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: GraphQLTypes["authRefreshTokens_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: GraphQLTypes["authRefreshTokens_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: GraphQLTypes["authRefreshTokens_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authRefreshTokens_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authRefreshTokens_bool_exp"]
};
	/** Persistent Hasura roles for users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authRoles"]: {
	__typename: "authRoles",
	role: string,
	/** An array relationship */
	userRoles: Array<GraphQLTypes["authUserRoles"]>,
	/** An aggregate relationship */
	userRoles_aggregate: GraphQLTypes["authUserRoles_aggregate"],
	/** An array relationship */
	usersByDefaultRole: Array<GraphQLTypes["users"]>,
	/** An aggregate relationship */
	usersByDefaultRole_aggregate: GraphQLTypes["users_aggregate"]
};
	/** aggregated selection of "auth.roles" */
["authRoles_aggregate"]: {
	__typename: "authRoles_aggregate",
	aggregate?: GraphQLTypes["authRoles_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authRoles"]>
};
	/** aggregate fields of "auth.roles" */
["authRoles_aggregate_fields"]: {
	__typename: "authRoles_aggregate_fields",
	count: number,
	max?: GraphQLTypes["authRoles_max_fields"] | undefined,
	min?: GraphQLTypes["authRoles_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.roles". All fields are combined with a logical 'AND'. */
["authRoles_bool_exp"]: {
		_and?: Array<GraphQLTypes["authRoles_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authRoles_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authRoles_bool_exp"]> | undefined,
	role?: GraphQLTypes["String_comparison_exp"] | undefined,
	userRoles?: GraphQLTypes["authUserRoles_bool_exp"] | undefined,
	userRoles_aggregate?: GraphQLTypes["authUserRoles_aggregate_bool_exp"] | undefined,
	usersByDefaultRole?: GraphQLTypes["users_bool_exp"] | undefined,
	usersByDefaultRole_aggregate?: GraphQLTypes["users_aggregate_bool_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.roles" */
["authRoles_constraint"]: authRoles_constraint;
	/** input type for inserting data into table "auth.roles" */
["authRoles_insert_input"]: {
		role?: string | undefined,
	userRoles?: GraphQLTypes["authUserRoles_arr_rel_insert_input"] | undefined,
	usersByDefaultRole?: GraphQLTypes["users_arr_rel_insert_input"] | undefined
};
	/** aggregate max on columns */
["authRoles_max_fields"]: {
	__typename: "authRoles_max_fields",
	role?: string | undefined
};
	/** aggregate min on columns */
["authRoles_min_fields"]: {
	__typename: "authRoles_min_fields",
	role?: string | undefined
};
	/** response of any mutation on the table "auth.roles" */
["authRoles_mutation_response"]: {
	__typename: "authRoles_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authRoles"]>
};
	/** input type for inserting object relation for remote table "auth.roles" */
["authRoles_obj_rel_insert_input"]: {
		data: GraphQLTypes["authRoles_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["authRoles_on_conflict"] | undefined
};
	/** on_conflict condition type for table "auth.roles" */
["authRoles_on_conflict"]: {
		constraint: GraphQLTypes["authRoles_constraint"],
	update_columns: Array<GraphQLTypes["authRoles_update_column"]>,
	where?: GraphQLTypes["authRoles_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.roles". */
["authRoles_order_by"]: {
		role?: GraphQLTypes["order_by"] | undefined,
	userRoles_aggregate?: GraphQLTypes["authUserRoles_aggregate_order_by"] | undefined,
	usersByDefaultRole_aggregate?: GraphQLTypes["users_aggregate_order_by"] | undefined
};
	/** primary key columns input for table: auth.roles */
["authRoles_pk_columns_input"]: {
		role: string
};
	/** select columns of table "auth.roles" */
["authRoles_select_column"]: authRoles_select_column;
	/** input type for updating data in table "auth.roles" */
["authRoles_set_input"]: {
		role?: string | undefined
};
	/** Streaming cursor of the table "authRoles" */
["authRoles_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authRoles_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authRoles_stream_cursor_value_input"]: {
		role?: string | undefined
};
	/** update columns of table "auth.roles" */
["authRoles_update_column"]: authRoles_update_column;
	["authRoles_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authRoles_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authRoles_bool_exp"]
};
	/** Active providers for a given user. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserProviders"]: {
	__typename: "authUserProviders",
	accessToken: string,
	createdAt: GraphQLTypes["timestamptz"],
	id: GraphQLTypes["uuid"],
	/** An object relationship */
	provider: GraphQLTypes["authProviders"],
	providerId: string,
	providerUserId: string,
	refreshToken?: string | undefined,
	updatedAt: GraphQLTypes["timestamptz"],
	/** An object relationship */
	user: GraphQLTypes["users"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "auth.user_providers" */
["authUserProviders_aggregate"]: {
	__typename: "authUserProviders_aggregate",
	aggregate?: GraphQLTypes["authUserProviders_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authUserProviders"]>
};
	["authUserProviders_aggregate_bool_exp"]: {
		count?: GraphQLTypes["authUserProviders_aggregate_bool_exp_count"] | undefined
};
	["authUserProviders_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["authUserProviders_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["authUserProviders_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_providers" */
["authUserProviders_aggregate_fields"]: {
	__typename: "authUserProviders_aggregate_fields",
	count: number,
	max?: GraphQLTypes["authUserProviders_max_fields"] | undefined,
	min?: GraphQLTypes["authUserProviders_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.user_providers" */
["authUserProviders_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["authUserProviders_max_order_by"] | undefined,
	min?: GraphQLTypes["authUserProviders_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "auth.user_providers" */
["authUserProviders_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["authUserProviders_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["authUserProviders_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.user_providers". All fields are combined with a logical 'AND'. */
["authUserProviders_bool_exp"]: {
		_and?: Array<GraphQLTypes["authUserProviders_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authUserProviders_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authUserProviders_bool_exp"]> | undefined,
	accessToken?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	provider?: GraphQLTypes["authProviders_bool_exp"] | undefined,
	providerId?: GraphQLTypes["String_comparison_exp"] | undefined,
	providerUserId?: GraphQLTypes["String_comparison_exp"] | undefined,
	refreshToken?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	user?: GraphQLTypes["users_bool_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.user_providers" */
["authUserProviders_constraint"]: authUserProviders_constraint;
	/** input type for inserting data into table "auth.user_providers" */
["authUserProviders_insert_input"]: {
		accessToken?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	provider?: GraphQLTypes["authProviders_obj_rel_insert_input"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	user?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authUserProviders_max_fields"]: {
	__typename: "authUserProviders_max_fields",
	accessToken?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.user_providers" */
["authUserProviders_max_order_by"]: {
		accessToken?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	providerId?: GraphQLTypes["order_by"] | undefined,
	providerUserId?: GraphQLTypes["order_by"] | undefined,
	refreshToken?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authUserProviders_min_fields"]: {
	__typename: "authUserProviders_min_fields",
	accessToken?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.user_providers" */
["authUserProviders_min_order_by"]: {
		accessToken?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	providerId?: GraphQLTypes["order_by"] | undefined,
	providerUserId?: GraphQLTypes["order_by"] | undefined,
	refreshToken?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.user_providers" */
["authUserProviders_mutation_response"]: {
	__typename: "authUserProviders_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authUserProviders"]>
};
	/** on_conflict condition type for table "auth.user_providers" */
["authUserProviders_on_conflict"]: {
		constraint: GraphQLTypes["authUserProviders_constraint"],
	update_columns: Array<GraphQLTypes["authUserProviders_update_column"]>,
	where?: GraphQLTypes["authUserProviders_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.user_providers". */
["authUserProviders_order_by"]: {
		accessToken?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	provider?: GraphQLTypes["authProviders_order_by"] | undefined,
	providerId?: GraphQLTypes["order_by"] | undefined,
	providerUserId?: GraphQLTypes["order_by"] | undefined,
	refreshToken?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	user?: GraphQLTypes["users_order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.user_providers */
["authUserProviders_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "auth.user_providers" */
["authUserProviders_select_column"]: authUserProviders_select_column;
	/** input type for updating data in table "auth.user_providers" */
["authUserProviders_set_input"]: {
		accessToken?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "authUserProviders" */
["authUserProviders_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authUserProviders_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authUserProviders_stream_cursor_value_input"]: {
		accessToken?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	providerId?: string | undefined,
	providerUserId?: string | undefined,
	refreshToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** update columns of table "auth.user_providers" */
["authUserProviders_update_column"]: authUserProviders_update_column;
	["authUserProviders_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authUserProviders_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authUserProviders_bool_exp"]
};
	/** Roles of users. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserRoles"]: {
	__typename: "authUserRoles",
	createdAt: GraphQLTypes["timestamptz"],
	id: GraphQLTypes["uuid"],
	role: string,
	/** An object relationship */
	roleByRole: GraphQLTypes["authRoles"],
	/** An object relationship */
	user: GraphQLTypes["users"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "auth.user_roles" */
["authUserRoles_aggregate"]: {
	__typename: "authUserRoles_aggregate",
	aggregate?: GraphQLTypes["authUserRoles_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authUserRoles"]>
};
	["authUserRoles_aggregate_bool_exp"]: {
		count?: GraphQLTypes["authUserRoles_aggregate_bool_exp_count"] | undefined
};
	["authUserRoles_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["authUserRoles_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["authUserRoles_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_roles" */
["authUserRoles_aggregate_fields"]: {
	__typename: "authUserRoles_aggregate_fields",
	count: number,
	max?: GraphQLTypes["authUserRoles_max_fields"] | undefined,
	min?: GraphQLTypes["authUserRoles_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.user_roles" */
["authUserRoles_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["authUserRoles_max_order_by"] | undefined,
	min?: GraphQLTypes["authUserRoles_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "auth.user_roles" */
["authUserRoles_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["authUserRoles_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["authUserRoles_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.user_roles". All fields are combined with a logical 'AND'. */
["authUserRoles_bool_exp"]: {
		_and?: Array<GraphQLTypes["authUserRoles_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authUserRoles_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authUserRoles_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	role?: GraphQLTypes["String_comparison_exp"] | undefined,
	roleByRole?: GraphQLTypes["authRoles_bool_exp"] | undefined,
	user?: GraphQLTypes["users_bool_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.user_roles" */
["authUserRoles_constraint"]: authUserRoles_constraint;
	/** input type for inserting data into table "auth.user_roles" */
["authUserRoles_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	roleByRole?: GraphQLTypes["authRoles_obj_rel_insert_input"] | undefined,
	user?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authUserRoles_max_fields"]: {
	__typename: "authUserRoles_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.user_roles" */
["authUserRoles_max_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authUserRoles_min_fields"]: {
	__typename: "authUserRoles_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.user_roles" */
["authUserRoles_min_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.user_roles" */
["authUserRoles_mutation_response"]: {
	__typename: "authUserRoles_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authUserRoles"]>
};
	/** on_conflict condition type for table "auth.user_roles" */
["authUserRoles_on_conflict"]: {
		constraint: GraphQLTypes["authUserRoles_constraint"],
	update_columns: Array<GraphQLTypes["authUserRoles_update_column"]>,
	where?: GraphQLTypes["authUserRoles_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.user_roles". */
["authUserRoles_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	roleByRole?: GraphQLTypes["authRoles_order_by"] | undefined,
	user?: GraphQLTypes["users_order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.user_roles */
["authUserRoles_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "auth.user_roles" */
["authUserRoles_select_column"]: authUserRoles_select_column;
	/** input type for updating data in table "auth.user_roles" */
["authUserRoles_set_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "authUserRoles" */
["authUserRoles_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authUserRoles_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authUserRoles_stream_cursor_value_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** update columns of table "auth.user_roles" */
["authUserRoles_update_column"]: authUserRoles_update_column;
	["authUserRoles_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authUserRoles_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authUserRoles_bool_exp"]
};
	/** User webauthn security keys. Don't modify its structure as Hasura Auth relies on it to function properly. */
["authUserSecurityKeys"]: {
	__typename: "authUserSecurityKeys",
	counter: GraphQLTypes["bigint"],
	credentialId: string,
	credentialPublicKey?: GraphQLTypes["bytea"] | undefined,
	id: GraphQLTypes["uuid"],
	nickname?: string | undefined,
	transports: string,
	/** An object relationship */
	user: GraphQLTypes["users"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate"]: {
	__typename: "authUserSecurityKeys_aggregate",
	aggregate?: GraphQLTypes["authUserSecurityKeys_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["authUserSecurityKeys"]>
};
	["authUserSecurityKeys_aggregate_bool_exp"]: {
		count?: GraphQLTypes["authUserSecurityKeys_aggregate_bool_exp_count"] | undefined
};
	["authUserSecurityKeys_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["authUserSecurityKeys_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["authUserSecurityKeys_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_fields"]: {
	__typename: "authUserSecurityKeys_aggregate_fields",
	avg?: GraphQLTypes["authUserSecurityKeys_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["authUserSecurityKeys_max_fields"] | undefined,
	min?: GraphQLTypes["authUserSecurityKeys_min_fields"] | undefined,
	stddev?: GraphQLTypes["authUserSecurityKeys_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["authUserSecurityKeys_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["authUserSecurityKeys_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["authUserSecurityKeys_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["authUserSecurityKeys_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["authUserSecurityKeys_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["authUserSecurityKeys_variance_fields"] | undefined
};
	/** order by aggregate values of table "auth.user_security_keys" */
["authUserSecurityKeys_aggregate_order_by"]: {
		avg?: GraphQLTypes["authUserSecurityKeys_avg_order_by"] | undefined,
	count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["authUserSecurityKeys_max_order_by"] | undefined,
	min?: GraphQLTypes["authUserSecurityKeys_min_order_by"] | undefined,
	stddev?: GraphQLTypes["authUserSecurityKeys_stddev_order_by"] | undefined,
	stddev_pop?: GraphQLTypes["authUserSecurityKeys_stddev_pop_order_by"] | undefined,
	stddev_samp?: GraphQLTypes["authUserSecurityKeys_stddev_samp_order_by"] | undefined,
	sum?: GraphQLTypes["authUserSecurityKeys_sum_order_by"] | undefined,
	var_pop?: GraphQLTypes["authUserSecurityKeys_var_pop_order_by"] | undefined,
	var_samp?: GraphQLTypes["authUserSecurityKeys_var_samp_order_by"] | undefined,
	variance?: GraphQLTypes["authUserSecurityKeys_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "auth.user_security_keys" */
["authUserSecurityKeys_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["authUserSecurityKeys_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["authUserSecurityKeys_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["authUserSecurityKeys_avg_fields"]: {
	__typename: "authUserSecurityKeys_avg_fields",
	counter?: number | undefined
};
	/** order by avg() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_avg_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.user_security_keys". All fields are combined with a logical 'AND'. */
["authUserSecurityKeys_bool_exp"]: {
		_and?: Array<GraphQLTypes["authUserSecurityKeys_bool_exp"]> | undefined,
	_not?: GraphQLTypes["authUserSecurityKeys_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["authUserSecurityKeys_bool_exp"]> | undefined,
	counter?: GraphQLTypes["bigint_comparison_exp"] | undefined,
	credentialId?: GraphQLTypes["String_comparison_exp"] | undefined,
	credentialPublicKey?: GraphQLTypes["bytea_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	nickname?: GraphQLTypes["String_comparison_exp"] | undefined,
	transports?: GraphQLTypes["String_comparison_exp"] | undefined,
	user?: GraphQLTypes["users_bool_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.user_security_keys" */
["authUserSecurityKeys_constraint"]: authUserSecurityKeys_constraint;
	/** input type for incrementing numeric columns in table "auth.user_security_keys" */
["authUserSecurityKeys_inc_input"]: {
		counter?: GraphQLTypes["bigint"] | undefined
};
	/** input type for inserting data into table "auth.user_security_keys" */
["authUserSecurityKeys_insert_input"]: {
		counter?: GraphQLTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	credentialPublicKey?: GraphQLTypes["bytea"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	user?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["authUserSecurityKeys_max_fields"]: {
	__typename: "authUserSecurityKeys_max_fields",
	counter?: GraphQLTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_max_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined,
	credentialId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	nickname?: GraphQLTypes["order_by"] | undefined,
	transports?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["authUserSecurityKeys_min_fields"]: {
	__typename: "authUserSecurityKeys_min_fields",
	counter?: GraphQLTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_min_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined,
	credentialId?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	nickname?: GraphQLTypes["order_by"] | undefined,
	transports?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.user_security_keys" */
["authUserSecurityKeys_mutation_response"]: {
	__typename: "authUserSecurityKeys_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["authUserSecurityKeys"]>
};
	/** on_conflict condition type for table "auth.user_security_keys" */
["authUserSecurityKeys_on_conflict"]: {
		constraint: GraphQLTypes["authUserSecurityKeys_constraint"],
	update_columns: Array<GraphQLTypes["authUserSecurityKeys_update_column"]>,
	where?: GraphQLTypes["authUserSecurityKeys_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.user_security_keys". */
["authUserSecurityKeys_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined,
	credentialId?: GraphQLTypes["order_by"] | undefined,
	credentialPublicKey?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	nickname?: GraphQLTypes["order_by"] | undefined,
	transports?: GraphQLTypes["order_by"] | undefined,
	user?: GraphQLTypes["users_order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: auth.user_security_keys */
["authUserSecurityKeys_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "auth.user_security_keys" */
["authUserSecurityKeys_select_column"]: authUserSecurityKeys_select_column;
	/** input type for updating data in table "auth.user_security_keys" */
["authUserSecurityKeys_set_input"]: {
		counter?: GraphQLTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	credentialPublicKey?: GraphQLTypes["bytea"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["authUserSecurityKeys_stddev_fields"]: {
	__typename: "authUserSecurityKeys_stddev_fields",
	counter?: number | undefined
};
	/** order by stddev() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["authUserSecurityKeys_stddev_pop_fields"]: {
	__typename: "authUserSecurityKeys_stddev_pop_fields",
	counter?: number | undefined
};
	/** order by stddev_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_pop_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["authUserSecurityKeys_stddev_samp_fields"]: {
	__typename: "authUserSecurityKeys_stddev_samp_fields",
	counter?: number | undefined
};
	/** order by stddev_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_stddev_samp_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "authUserSecurityKeys" */
["authUserSecurityKeys_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["authUserSecurityKeys_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["authUserSecurityKeys_stream_cursor_value_input"]: {
		counter?: GraphQLTypes["bigint"] | undefined,
	credentialId?: string | undefined,
	credentialPublicKey?: GraphQLTypes["bytea"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	nickname?: string | undefined,
	transports?: string | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["authUserSecurityKeys_sum_fields"]: {
	__typename: "authUserSecurityKeys_sum_fields",
	counter?: GraphQLTypes["bigint"] | undefined
};
	/** order by sum() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_sum_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	/** update columns of table "auth.user_security_keys" */
["authUserSecurityKeys_update_column"]: authUserSecurityKeys_update_column;
	["authUserSecurityKeys_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["authUserSecurityKeys_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["authUserSecurityKeys_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["authUserSecurityKeys_bool_exp"]
};
	/** aggregate var_pop on columns */
["authUserSecurityKeys_var_pop_fields"]: {
	__typename: "authUserSecurityKeys_var_pop_fields",
	counter?: number | undefined
};
	/** order by var_pop() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_pop_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["authUserSecurityKeys_var_samp_fields"]: {
	__typename: "authUserSecurityKeys_var_samp_fields",
	counter?: number | undefined
};
	/** order by var_samp() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_var_samp_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["authUserSecurityKeys_variance_fields"]: {
	__typename: "authUserSecurityKeys_variance_fields",
	counter?: number | undefined
};
	/** order by variance() on columns of table "auth.user_security_keys" */
["authUserSecurityKeys_variance_order_by"]: {
		counter?: GraphQLTypes["order_by"] | undefined
};
	["bigint"]: "scalar" & { name: "bigint" };
	/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
["bigint_comparison_exp"]: {
		_eq?: GraphQLTypes["bigint"] | undefined,
	_gt?: GraphQLTypes["bigint"] | undefined,
	_gte?: GraphQLTypes["bigint"] | undefined,
	_in?: Array<GraphQLTypes["bigint"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["bigint"] | undefined,
	_lte?: GraphQLTypes["bigint"] | undefined,
	_neq?: GraphQLTypes["bigint"] | undefined,
	_nin?: Array<GraphQLTypes["bigint"]> | undefined
};
	/** columns and relationships of "storage.buckets" */
["buckets"]: {
	__typename: "buckets",
	cacheControl?: string | undefined,
	createdAt: GraphQLTypes["timestamptz"],
	downloadExpiration: number,
	/** An array relationship */
	files: Array<GraphQLTypes["files"]>,
	/** An aggregate relationship */
	files_aggregate: GraphQLTypes["files_aggregate"],
	id: string,
	maxUploadFileSize: number,
	minUploadFileSize: number,
	presignedUrlsEnabled: boolean,
	updatedAt: GraphQLTypes["timestamptz"]
};
	/** aggregated selection of "storage.buckets" */
["buckets_aggregate"]: {
	__typename: "buckets_aggregate",
	aggregate?: GraphQLTypes["buckets_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["buckets"]>
};
	/** aggregate fields of "storage.buckets" */
["buckets_aggregate_fields"]: {
	__typename: "buckets_aggregate_fields",
	avg?: GraphQLTypes["buckets_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["buckets_max_fields"] | undefined,
	min?: GraphQLTypes["buckets_min_fields"] | undefined,
	stddev?: GraphQLTypes["buckets_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["buckets_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["buckets_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["buckets_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["buckets_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["buckets_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["buckets_variance_fields"] | undefined
};
	/** aggregate avg on columns */
["buckets_avg_fields"]: {
	__typename: "buckets_avg_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** Boolean expression to filter rows from the table "storage.buckets". All fields are combined with a logical 'AND'. */
["buckets_bool_exp"]: {
		_and?: Array<GraphQLTypes["buckets_bool_exp"]> | undefined,
	_not?: GraphQLTypes["buckets_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["buckets_bool_exp"]> | undefined,
	cacheControl?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	downloadExpiration?: GraphQLTypes["Int_comparison_exp"] | undefined,
	files?: GraphQLTypes["files_bool_exp"] | undefined,
	files_aggregate?: GraphQLTypes["files_aggregate_bool_exp"] | undefined,
	id?: GraphQLTypes["String_comparison_exp"] | undefined,
	maxUploadFileSize?: GraphQLTypes["Int_comparison_exp"] | undefined,
	minUploadFileSize?: GraphQLTypes["Int_comparison_exp"] | undefined,
	presignedUrlsEnabled?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "storage.buckets" */
["buckets_constraint"]: buckets_constraint;
	/** input type for incrementing numeric columns in table "storage.buckets" */
["buckets_inc_input"]: {
		downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** input type for inserting data into table "storage.buckets" */
["buckets_insert_input"]: {
		cacheControl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	files?: GraphQLTypes["files_arr_rel_insert_input"] | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	presignedUrlsEnabled?: boolean | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["buckets_max_fields"]: {
	__typename: "buckets_max_fields",
	cacheControl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate min on columns */
["buckets_min_fields"]: {
	__typename: "buckets_min_fields",
	cacheControl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** response of any mutation on the table "storage.buckets" */
["buckets_mutation_response"]: {
	__typename: "buckets_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["buckets"]>
};
	/** input type for inserting object relation for remote table "storage.buckets" */
["buckets_obj_rel_insert_input"]: {
		data: GraphQLTypes["buckets_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["buckets_on_conflict"] | undefined
};
	/** on_conflict condition type for table "storage.buckets" */
["buckets_on_conflict"]: {
		constraint: GraphQLTypes["buckets_constraint"],
	update_columns: Array<GraphQLTypes["buckets_update_column"]>,
	where?: GraphQLTypes["buckets_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "storage.buckets". */
["buckets_order_by"]: {
		cacheControl?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	downloadExpiration?: GraphQLTypes["order_by"] | undefined,
	files_aggregate?: GraphQLTypes["files_aggregate_order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	maxUploadFileSize?: GraphQLTypes["order_by"] | undefined,
	minUploadFileSize?: GraphQLTypes["order_by"] | undefined,
	presignedUrlsEnabled?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: storage.buckets */
["buckets_pk_columns_input"]: {
		id: string
};
	/** select columns of table "storage.buckets" */
["buckets_select_column"]: buckets_select_column;
	/** input type for updating data in table "storage.buckets" */
["buckets_set_input"]: {
		cacheControl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	presignedUrlsEnabled?: boolean | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate stddev on columns */
["buckets_stddev_fields"]: {
	__typename: "buckets_stddev_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate stddev_pop on columns */
["buckets_stddev_pop_fields"]: {
	__typename: "buckets_stddev_pop_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate stddev_samp on columns */
["buckets_stddev_samp_fields"]: {
	__typename: "buckets_stddev_samp_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** Streaming cursor of the table "buckets" */
["buckets_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["buckets_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["buckets_stream_cursor_value_input"]: {
		cacheControl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	downloadExpiration?: number | undefined,
	id?: string | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined,
	presignedUrlsEnabled?: boolean | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate sum on columns */
["buckets_sum_fields"]: {
	__typename: "buckets_sum_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** update columns of table "storage.buckets" */
["buckets_update_column"]: buckets_update_column;
	["buckets_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["buckets_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["buckets_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["buckets_bool_exp"]
};
	/** aggregate var_pop on columns */
["buckets_var_pop_fields"]: {
	__typename: "buckets_var_pop_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate var_samp on columns */
["buckets_var_samp_fields"]: {
	__typename: "buckets_var_samp_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	/** aggregate variance on columns */
["buckets_variance_fields"]: {
	__typename: "buckets_variance_fields",
	downloadExpiration?: number | undefined,
	maxUploadFileSize?: number | undefined,
	minUploadFileSize?: number | undefined
};
	["bytea"]: "scalar" & { name: "bytea" };
	/** Boolean expression to compare columns of type "bytea". All fields are combined with logical 'AND'. */
["bytea_comparison_exp"]: {
		_eq?: GraphQLTypes["bytea"] | undefined,
	_gt?: GraphQLTypes["bytea"] | undefined,
	_gte?: GraphQLTypes["bytea"] | undefined,
	_in?: Array<GraphQLTypes["bytea"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["bytea"] | undefined,
	_lte?: GraphQLTypes["bytea"] | undefined,
	_neq?: GraphQLTypes["bytea"] | undefined,
	_nin?: Array<GraphQLTypes["bytea"]> | undefined
};
	["citext"]: "scalar" & { name: "citext" };
	/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
["citext_comparison_exp"]: {
		_eq?: GraphQLTypes["citext"] | undefined,
	_gt?: GraphQLTypes["citext"] | undefined,
	_gte?: GraphQLTypes["citext"] | undefined,
	/** does the column match the given case-insensitive pattern */
	_ilike?: GraphQLTypes["citext"] | undefined,
	_in?: Array<GraphQLTypes["citext"]> | undefined,
	/** does the column match the given POSIX regular expression, case insensitive */
	_iregex?: GraphQLTypes["citext"] | undefined,
	_is_null?: boolean | undefined,
	/** does the column match the given pattern */
	_like?: GraphQLTypes["citext"] | undefined,
	_lt?: GraphQLTypes["citext"] | undefined,
	_lte?: GraphQLTypes["citext"] | undefined,
	_neq?: GraphQLTypes["citext"] | undefined,
	/** does the column NOT match the given case-insensitive pattern */
	_nilike?: GraphQLTypes["citext"] | undefined,
	_nin?: Array<GraphQLTypes["citext"]> | undefined,
	/** does the column NOT match the given POSIX regular expression, case insensitive */
	_niregex?: GraphQLTypes["citext"] | undefined,
	/** does the column NOT match the given pattern */
	_nlike?: GraphQLTypes["citext"] | undefined,
	/** does the column NOT match the given POSIX regular expression, case sensitive */
	_nregex?: GraphQLTypes["citext"] | undefined,
	/** does the column NOT match the given SQL regular expression */
	_nsimilar?: GraphQLTypes["citext"] | undefined,
	/** does the column match the given POSIX regular expression, case sensitive */
	_regex?: GraphQLTypes["citext"] | undefined,
	/** does the column match the given SQL regular expression */
	_similar?: GraphQLTypes["citext"] | undefined
};
	/** ordering argument of a cursor */
["cursor_ordering"]: cursor_ordering;
	/** columns and relationships of "event_files" */
["event_files"]: {
	__typename: "event_files",
	createdAt: GraphQLTypes["timestamptz"],
	/** An object relationship */
	event: GraphQLTypes["events"],
	eventId: GraphQLTypes["uuid"],
	/** An object relationship */
	file: GraphQLTypes["files"],
	fileId: GraphQLTypes["uuid"],
	updatedAt: GraphQLTypes["timestamptz"],
	/** An object relationship */
	user: GraphQLTypes["users"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "event_files" */
["event_files_aggregate"]: {
	__typename: "event_files_aggregate",
	aggregate?: GraphQLTypes["event_files_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["event_files"]>
};
	["event_files_aggregate_bool_exp"]: {
		count?: GraphQLTypes["event_files_aggregate_bool_exp_count"] | undefined
};
	["event_files_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["event_files_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["event_files_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "event_files" */
["event_files_aggregate_fields"]: {
	__typename: "event_files_aggregate_fields",
	count: number,
	max?: GraphQLTypes["event_files_max_fields"] | undefined,
	min?: GraphQLTypes["event_files_min_fields"] | undefined
};
	/** order by aggregate values of table "event_files" */
["event_files_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["event_files_max_order_by"] | undefined,
	min?: GraphQLTypes["event_files_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "event_files" */
["event_files_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["event_files_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["event_files_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "event_files". All fields are combined with a logical 'AND'. */
["event_files_bool_exp"]: {
		_and?: Array<GraphQLTypes["event_files_bool_exp"]> | undefined,
	_not?: GraphQLTypes["event_files_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["event_files_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	event?: GraphQLTypes["events_bool_exp"] | undefined,
	eventId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	file?: GraphQLTypes["files_bool_exp"] | undefined,
	fileId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	user?: GraphQLTypes["users_bool_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "event_files" */
["event_files_constraint"]: event_files_constraint;
	/** input type for inserting data into table "event_files" */
["event_files_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	event?: GraphQLTypes["events_obj_rel_insert_input"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	file?: GraphQLTypes["files_obj_rel_insert_input"] | undefined,
	fileId?: GraphQLTypes["uuid"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	user?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["event_files_max_fields"]: {
	__typename: "event_files_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	fileId?: GraphQLTypes["uuid"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "event_files" */
["event_files_max_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	eventId?: GraphQLTypes["order_by"] | undefined,
	fileId?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["event_files_min_fields"]: {
	__typename: "event_files_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	fileId?: GraphQLTypes["uuid"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "event_files" */
["event_files_min_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	eventId?: GraphQLTypes["order_by"] | undefined,
	fileId?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "event_files" */
["event_files_mutation_response"]: {
	__typename: "event_files_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["event_files"]>
};
	/** on_conflict condition type for table "event_files" */
["event_files_on_conflict"]: {
		constraint: GraphQLTypes["event_files_constraint"],
	update_columns: Array<GraphQLTypes["event_files_update_column"]>,
	where?: GraphQLTypes["event_files_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "event_files". */
["event_files_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	event?: GraphQLTypes["events_order_by"] | undefined,
	eventId?: GraphQLTypes["order_by"] | undefined,
	file?: GraphQLTypes["files_order_by"] | undefined,
	fileId?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	user?: GraphQLTypes["users_order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: event_files */
["event_files_pk_columns_input"]: {
		eventId: GraphQLTypes["uuid"],
	fileId: GraphQLTypes["uuid"]
};
	/** select columns of table "event_files" */
["event_files_select_column"]: event_files_select_column;
	/** input type for updating data in table "event_files" */
["event_files_set_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	fileId?: GraphQLTypes["uuid"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "event_files" */
["event_files_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["event_files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["event_files_stream_cursor_value_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	fileId?: GraphQLTypes["uuid"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** update columns of table "event_files" */
["event_files_update_column"]: event_files_update_column;
	["event_files_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["event_files_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["event_files_bool_exp"]
};
	/** columns and relationships of "event_participants" */
["event_participants"]: {
	__typename: "event_participants",
	createdAt: GraphQLTypes["timestamptz"],
	/** An object relationship */
	event: GraphQLTypes["events"],
	eventId: GraphQLTypes["uuid"],
	role: string,
	updatedAt: GraphQLTypes["timestamptz"],
	/** An object relationship */
	user: GraphQLTypes["users"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "event_participants" */
["event_participants_aggregate"]: {
	__typename: "event_participants_aggregate",
	aggregate?: GraphQLTypes["event_participants_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["event_participants"]>
};
	["event_participants_aggregate_bool_exp"]: {
		count?: GraphQLTypes["event_participants_aggregate_bool_exp_count"] | undefined
};
	["event_participants_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["event_participants_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["event_participants_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "event_participants" */
["event_participants_aggregate_fields"]: {
	__typename: "event_participants_aggregate_fields",
	count: number,
	max?: GraphQLTypes["event_participants_max_fields"] | undefined,
	min?: GraphQLTypes["event_participants_min_fields"] | undefined
};
	/** order by aggregate values of table "event_participants" */
["event_participants_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["event_participants_max_order_by"] | undefined,
	min?: GraphQLTypes["event_participants_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "event_participants" */
["event_participants_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["event_participants_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["event_participants_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "event_participants". All fields are combined with a logical 'AND'. */
["event_participants_bool_exp"]: {
		_and?: Array<GraphQLTypes["event_participants_bool_exp"]> | undefined,
	_not?: GraphQLTypes["event_participants_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["event_participants_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	event?: GraphQLTypes["events_bool_exp"] | undefined,
	eventId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	role?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	user?: GraphQLTypes["users_bool_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "event_participants" */
["event_participants_constraint"]: event_participants_constraint;
	/** input type for inserting data into table "event_participants" */
["event_participants_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	event?: GraphQLTypes["events_obj_rel_insert_input"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	user?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["event_participants_max_fields"]: {
	__typename: "event_participants_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "event_participants" */
["event_participants_max_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	eventId?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["event_participants_min_fields"]: {
	__typename: "event_participants_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "event_participants" */
["event_participants_min_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	eventId?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "event_participants" */
["event_participants_mutation_response"]: {
	__typename: "event_participants_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["event_participants"]>
};
	/** on_conflict condition type for table "event_participants" */
["event_participants_on_conflict"]: {
		constraint: GraphQLTypes["event_participants_constraint"],
	update_columns: Array<GraphQLTypes["event_participants_update_column"]>,
	where?: GraphQLTypes["event_participants_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "event_participants". */
["event_participants_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	event?: GraphQLTypes["events_order_by"] | undefined,
	eventId?: GraphQLTypes["order_by"] | undefined,
	role?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	user?: GraphQLTypes["users_order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: event_participants */
["event_participants_pk_columns_input"]: {
		eventId: GraphQLTypes["uuid"],
	userId: GraphQLTypes["uuid"]
};
	/** select columns of table "event_participants" */
["event_participants_select_column"]: event_participants_select_column;
	/** input type for updating data in table "event_participants" */
["event_participants_set_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "event_participants" */
["event_participants_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["event_participants_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["event_participants_stream_cursor_value_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	eventId?: GraphQLTypes["uuid"] | undefined,
	role?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** update columns of table "event_participants" */
["event_participants_update_column"]: event_participants_update_column;
	["event_participants_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["event_participants_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["event_participants_bool_exp"]
};
	/** columns and relationships of "events" */
["events"]: {
	__typename: "events",
	createdAt: GraphQLTypes["timestamptz"],
	/** An object relationship */
	creator: GraphQLTypes["users"],
	creatorId: GraphQLTypes["uuid"],
	endAt: GraphQLTypes["timestamptz"],
	/** An array relationship */
	files: Array<GraphQLTypes["event_files"]>,
	/** An aggregate relationship */
	files_aggregate: GraphQLTypes["event_files_aggregate"],
	id: GraphQLTypes["uuid"],
	name: string,
	params: GraphQLTypes["jsonb"],
	/** An array relationship */
	participants: Array<GraphQLTypes["event_participants"]>,
	/** An aggregate relationship */
	participants_aggregate: GraphQLTypes["event_participants_aggregate"],
	slug: string,
	startAt: GraphQLTypes["timestamptz"],
	updatedAt: GraphQLTypes["timestamptz"]
};
	/** aggregated selection of "events" */
["events_aggregate"]: {
	__typename: "events_aggregate",
	aggregate?: GraphQLTypes["events_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["events"]>
};
	["events_aggregate_bool_exp"]: {
		count?: GraphQLTypes["events_aggregate_bool_exp_count"] | undefined
};
	["events_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["events_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["events_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "events" */
["events_aggregate_fields"]: {
	__typename: "events_aggregate_fields",
	count: number,
	max?: GraphQLTypes["events_max_fields"] | undefined,
	min?: GraphQLTypes["events_min_fields"] | undefined
};
	/** order by aggregate values of table "events" */
["events_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["events_max_order_by"] | undefined,
	min?: GraphQLTypes["events_min_order_by"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["events_append_input"]: {
		params?: GraphQLTypes["jsonb"] | undefined
};
	/** input type for inserting array relation for remote table "events" */
["events_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["events_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["events_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "events". All fields are combined with a logical 'AND'. */
["events_bool_exp"]: {
		_and?: Array<GraphQLTypes["events_bool_exp"]> | undefined,
	_not?: GraphQLTypes["events_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["events_bool_exp"]> | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	creator?: GraphQLTypes["users_bool_exp"] | undefined,
	creatorId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	endAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	files?: GraphQLTypes["event_files_bool_exp"] | undefined,
	files_aggregate?: GraphQLTypes["event_files_aggregate_bool_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	params?: GraphQLTypes["jsonb_comparison_exp"] | undefined,
	participants?: GraphQLTypes["event_participants_bool_exp"] | undefined,
	participants_aggregate?: GraphQLTypes["event_participants_aggregate_bool_exp"] | undefined,
	slug?: GraphQLTypes["String_comparison_exp"] | undefined,
	startAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "events" */
["events_constraint"]: events_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["events_delete_at_path_input"]: {
		params?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["events_delete_elem_input"]: {
		params?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["events_delete_key_input"]: {
		params?: string | undefined
};
	/** input type for inserting data into table "events" */
["events_insert_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	creator?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	creatorId?: GraphQLTypes["uuid"] | undefined,
	endAt?: GraphQLTypes["timestamptz"] | undefined,
	files?: GraphQLTypes["event_files_arr_rel_insert_input"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	params?: GraphQLTypes["jsonb"] | undefined,
	participants?: GraphQLTypes["event_participants_arr_rel_insert_input"] | undefined,
	slug?: string | undefined,
	startAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** aggregate max on columns */
["events_max_fields"]: {
	__typename: "events_max_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	creatorId?: GraphQLTypes["uuid"] | undefined,
	endAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	slug?: string | undefined,
	startAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** order by max() on columns of table "events" */
["events_max_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	creatorId?: GraphQLTypes["order_by"] | undefined,
	endAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	slug?: GraphQLTypes["order_by"] | undefined,
	startAt?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["events_min_fields"]: {
	__typename: "events_min_fields",
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	creatorId?: GraphQLTypes["uuid"] | undefined,
	endAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	slug?: string | undefined,
	startAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** order by min() on columns of table "events" */
["events_min_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	creatorId?: GraphQLTypes["order_by"] | undefined,
	endAt?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	slug?: GraphQLTypes["order_by"] | undefined,
	startAt?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "events" */
["events_mutation_response"]: {
	__typename: "events_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["events"]>
};
	/** input type for inserting object relation for remote table "events" */
["events_obj_rel_insert_input"]: {
		data: GraphQLTypes["events_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["events_on_conflict"] | undefined
};
	/** on_conflict condition type for table "events" */
["events_on_conflict"]: {
		constraint: GraphQLTypes["events_constraint"],
	update_columns: Array<GraphQLTypes["events_update_column"]>,
	where?: GraphQLTypes["events_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "events". */
["events_order_by"]: {
		createdAt?: GraphQLTypes["order_by"] | undefined,
	creator?: GraphQLTypes["users_order_by"] | undefined,
	creatorId?: GraphQLTypes["order_by"] | undefined,
	endAt?: GraphQLTypes["order_by"] | undefined,
	files_aggregate?: GraphQLTypes["event_files_aggregate_order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	params?: GraphQLTypes["order_by"] | undefined,
	participants_aggregate?: GraphQLTypes["event_participants_aggregate_order_by"] | undefined,
	slug?: GraphQLTypes["order_by"] | undefined,
	startAt?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: events */
["events_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["events_prepend_input"]: {
		params?: GraphQLTypes["jsonb"] | undefined
};
	/** select columns of table "events" */
["events_select_column"]: events_select_column;
	/** input type for updating data in table "events" */
["events_set_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	creatorId?: GraphQLTypes["uuid"] | undefined,
	endAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	params?: GraphQLTypes["jsonb"] | undefined,
	slug?: string | undefined,
	startAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "events" */
["events_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["events_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["events_stream_cursor_value_input"]: {
		createdAt?: GraphQLTypes["timestamptz"] | undefined,
	creatorId?: GraphQLTypes["uuid"] | undefined,
	endAt?: GraphQLTypes["timestamptz"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	name?: string | undefined,
	params?: GraphQLTypes["jsonb"] | undefined,
	slug?: string | undefined,
	startAt?: GraphQLTypes["timestamptz"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** update columns of table "events" */
["events_update_column"]: events_update_column;
	["events_updates"]: {
		/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: GraphQLTypes["events_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: GraphQLTypes["events_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: GraphQLTypes["events_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: GraphQLTypes["events_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: GraphQLTypes["events_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["events_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["events_bool_exp"]
};
	/** columns and relationships of "storage.files" */
["files"]: {
	__typename: "files",
	/** An object relationship */
	bucket: GraphQLTypes["buckets"],
	bucketId: string,
	createdAt: GraphQLTypes["timestamptz"],
	etag?: string | undefined,
	id: GraphQLTypes["uuid"],
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt: GraphQLTypes["timestamptz"],
	uploadedByUserId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregated selection of "storage.files" */
["files_aggregate"]: {
	__typename: "files_aggregate",
	aggregate?: GraphQLTypes["files_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["files"]>
};
	["files_aggregate_bool_exp"]: {
		bool_and?: GraphQLTypes["files_aggregate_bool_exp_bool_and"] | undefined,
	bool_or?: GraphQLTypes["files_aggregate_bool_exp_bool_or"] | undefined,
	count?: GraphQLTypes["files_aggregate_bool_exp_count"] | undefined
};
	["files_aggregate_bool_exp_bool_and"]: {
		arguments: GraphQLTypes["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["files_bool_exp"] | undefined,
	predicate: GraphQLTypes["Boolean_comparison_exp"]
};
	["files_aggregate_bool_exp_bool_or"]: {
		arguments: GraphQLTypes["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["files_bool_exp"] | undefined,
	predicate: GraphQLTypes["Boolean_comparison_exp"]
};
	["files_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["files_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["files_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "storage.files" */
["files_aggregate_fields"]: {
	__typename: "files_aggregate_fields",
	avg?: GraphQLTypes["files_avg_fields"] | undefined,
	count: number,
	max?: GraphQLTypes["files_max_fields"] | undefined,
	min?: GraphQLTypes["files_min_fields"] | undefined,
	stddev?: GraphQLTypes["files_stddev_fields"] | undefined,
	stddev_pop?: GraphQLTypes["files_stddev_pop_fields"] | undefined,
	stddev_samp?: GraphQLTypes["files_stddev_samp_fields"] | undefined,
	sum?: GraphQLTypes["files_sum_fields"] | undefined,
	var_pop?: GraphQLTypes["files_var_pop_fields"] | undefined,
	var_samp?: GraphQLTypes["files_var_samp_fields"] | undefined,
	variance?: GraphQLTypes["files_variance_fields"] | undefined
};
	/** order by aggregate values of table "storage.files" */
["files_aggregate_order_by"]: {
		avg?: GraphQLTypes["files_avg_order_by"] | undefined,
	count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["files_max_order_by"] | undefined,
	min?: GraphQLTypes["files_min_order_by"] | undefined,
	stddev?: GraphQLTypes["files_stddev_order_by"] | undefined,
	stddev_pop?: GraphQLTypes["files_stddev_pop_order_by"] | undefined,
	stddev_samp?: GraphQLTypes["files_stddev_samp_order_by"] | undefined,
	sum?: GraphQLTypes["files_sum_order_by"] | undefined,
	var_pop?: GraphQLTypes["files_var_pop_order_by"] | undefined,
	var_samp?: GraphQLTypes["files_var_samp_order_by"] | undefined,
	variance?: GraphQLTypes["files_variance_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "storage.files" */
["files_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["files_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["files_on_conflict"] | undefined
};
	/** aggregate avg on columns */
["files_avg_fields"]: {
	__typename: "files_avg_fields",
	size?: number | undefined
};
	/** order by avg() on columns of table "storage.files" */
["files_avg_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** Boolean expression to filter rows from the table "storage.files". All fields are combined with a logical 'AND'. */
["files_bool_exp"]: {
		_and?: Array<GraphQLTypes["files_bool_exp"]> | undefined,
	_not?: GraphQLTypes["files_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["files_bool_exp"]> | undefined,
	bucket?: GraphQLTypes["buckets_bool_exp"] | undefined,
	bucketId?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	etag?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	isUploaded?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	mimeType?: GraphQLTypes["String_comparison_exp"] | undefined,
	name?: GraphQLTypes["String_comparison_exp"] | undefined,
	size?: GraphQLTypes["Int_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	uploadedByUserId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "storage.files" */
["files_constraint"]: files_constraint;
	/** input type for incrementing numeric columns in table "storage.files" */
["files_inc_input"]: {
		size?: number | undefined
};
	/** input type for inserting data into table "storage.files" */
["files_insert_input"]: {
		bucket?: GraphQLTypes["buckets_obj_rel_insert_input"] | undefined,
	bucketId?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	uploadedByUserId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["files_max_fields"]: {
	__typename: "files_max_fields",
	bucketId?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	uploadedByUserId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "storage.files" */
["files_max_order_by"]: {
		bucketId?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	etag?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	mimeType?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	size?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	uploadedByUserId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["files_min_fields"]: {
	__typename: "files_min_fields",
	bucketId?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	uploadedByUserId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "storage.files" */
["files_min_order_by"]: {
		bucketId?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	etag?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	mimeType?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	size?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	uploadedByUserId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "storage.files" */
["files_mutation_response"]: {
	__typename: "files_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["files"]>
};
	/** input type for inserting object relation for remote table "storage.files" */
["files_obj_rel_insert_input"]: {
		data: GraphQLTypes["files_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["files_on_conflict"] | undefined
};
	/** on_conflict condition type for table "storage.files" */
["files_on_conflict"]: {
		constraint: GraphQLTypes["files_constraint"],
	update_columns: Array<GraphQLTypes["files_update_column"]>,
	where?: GraphQLTypes["files_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "storage.files". */
["files_order_by"]: {
		bucket?: GraphQLTypes["buckets_order_by"] | undefined,
	bucketId?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	etag?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	isUploaded?: GraphQLTypes["order_by"] | undefined,
	mimeType?: GraphQLTypes["order_by"] | undefined,
	name?: GraphQLTypes["order_by"] | undefined,
	size?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	uploadedByUserId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: storage.files */
["files_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** select columns of table "storage.files" */
["files_select_column"]: files_select_column;
	/** select "files_aggregate_bool_exp_bool_and_arguments_columns" columns of table "storage.files" */
["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"]: files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "files_aggregate_bool_exp_bool_or_arguments_columns" columns of table "storage.files" */
["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"]: files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "storage.files" */
["files_set_input"]: {
		bucketId?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	uploadedByUserId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate stddev on columns */
["files_stddev_fields"]: {
	__typename: "files_stddev_fields",
	size?: number | undefined
};
	/** order by stddev() on columns of table "storage.files" */
["files_stddev_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_pop on columns */
["files_stddev_pop_fields"]: {
	__typename: "files_stddev_pop_fields",
	size?: number | undefined
};
	/** order by stddev_pop() on columns of table "storage.files" */
["files_stddev_pop_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate stddev_samp on columns */
["files_stddev_samp_fields"]: {
	__typename: "files_stddev_samp_fields",
	size?: number | undefined
};
	/** order by stddev_samp() on columns of table "storage.files" */
["files_stddev_samp_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** Streaming cursor of the table "files" */
["files_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["files_stream_cursor_value_input"]: {
		bucketId?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	etag?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isUploaded?: boolean | undefined,
	mimeType?: string | undefined,
	name?: string | undefined,
	size?: number | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	uploadedByUserId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate sum on columns */
["files_sum_fields"]: {
	__typename: "files_sum_fields",
	size?: number | undefined
};
	/** order by sum() on columns of table "storage.files" */
["files_sum_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** update columns of table "storage.files" */
["files_update_column"]: files_update_column;
	["files_updates"]: {
		/** increments the numeric columns with given value of the filtered values */
	_inc?: GraphQLTypes["files_inc_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["files_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["files_bool_exp"]
};
	/** aggregate var_pop on columns */
["files_var_pop_fields"]: {
	__typename: "files_var_pop_fields",
	size?: number | undefined
};
	/** order by var_pop() on columns of table "storage.files" */
["files_var_pop_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate var_samp on columns */
["files_var_samp_fields"]: {
	__typename: "files_var_samp_fields",
	size?: number | undefined
};
	/** order by var_samp() on columns of table "storage.files" */
["files_var_samp_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate variance on columns */
["files_variance_fields"]: {
	__typename: "files_variance_fields",
	size?: number | undefined
};
	/** order by variance() on columns of table "storage.files" */
["files_variance_order_by"]: {
		size?: GraphQLTypes["order_by"] | undefined
};
	/** columns and relationships of "installations" */
["installations"]: {
	__typename: "installations",
	appIdentifier: string,
	appVersion: string,
	createdAt: GraphQLTypes["timestamptz"],
	deviceLocale: string,
	deviceName?: string | undefined,
	deviceType: string,
	id: GraphQLTypes["uuid"],
	isActive: boolean,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken: string,
	updatedAt: GraphQLTypes["timestamptz"],
	/** An object relationship */
	user: GraphQLTypes["users"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "installations" */
["installations_aggregate"]: {
	__typename: "installations_aggregate",
	aggregate?: GraphQLTypes["installations_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["installations"]>
};
	["installations_aggregate_bool_exp"]: {
		bool_and?: GraphQLTypes["installations_aggregate_bool_exp_bool_and"] | undefined,
	bool_or?: GraphQLTypes["installations_aggregate_bool_exp_bool_or"] | undefined,
	count?: GraphQLTypes["installations_aggregate_bool_exp_count"] | undefined
};
	["installations_aggregate_bool_exp_bool_and"]: {
		arguments: GraphQLTypes["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["installations_bool_exp"] | undefined,
	predicate: GraphQLTypes["Boolean_comparison_exp"]
};
	["installations_aggregate_bool_exp_bool_or"]: {
		arguments: GraphQLTypes["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["installations_bool_exp"] | undefined,
	predicate: GraphQLTypes["Boolean_comparison_exp"]
};
	["installations_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["installations_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["installations_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "installations" */
["installations_aggregate_fields"]: {
	__typename: "installations_aggregate_fields",
	count: number,
	max?: GraphQLTypes["installations_max_fields"] | undefined,
	min?: GraphQLTypes["installations_min_fields"] | undefined
};
	/** order by aggregate values of table "installations" */
["installations_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["installations_max_order_by"] | undefined,
	min?: GraphQLTypes["installations_min_order_by"] | undefined
};
	/** input type for inserting array relation for remote table "installations" */
["installations_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["installations_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["installations_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "installations". All fields are combined with a logical 'AND'. */
["installations_bool_exp"]: {
		_and?: Array<GraphQLTypes["installations_bool_exp"]> | undefined,
	_not?: GraphQLTypes["installations_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["installations_bool_exp"]> | undefined,
	appIdentifier?: GraphQLTypes["String_comparison_exp"] | undefined,
	appVersion?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	deviceLocale?: GraphQLTypes["String_comparison_exp"] | undefined,
	deviceName?: GraphQLTypes["String_comparison_exp"] | undefined,
	deviceType?: GraphQLTypes["String_comparison_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	isActive?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	osName?: GraphQLTypes["String_comparison_exp"] | undefined,
	osVersion?: GraphQLTypes["String_comparison_exp"] | undefined,
	pushToken?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	user?: GraphQLTypes["users_bool_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "installations" */
["installations_constraint"]: installations_constraint;
	/** input type for inserting data into table "installations" */
["installations_insert_input"]: {
		appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isActive?: boolean | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	user?: GraphQLTypes["users_obj_rel_insert_input"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["installations_max_fields"]: {
	__typename: "installations_max_fields",
	appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by max() on columns of table "installations" */
["installations_max_order_by"]: {
		appIdentifier?: GraphQLTypes["order_by"] | undefined,
	appVersion?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	deviceLocale?: GraphQLTypes["order_by"] | undefined,
	deviceName?: GraphQLTypes["order_by"] | undefined,
	deviceType?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	osName?: GraphQLTypes["order_by"] | undefined,
	osVersion?: GraphQLTypes["order_by"] | undefined,
	pushToken?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["installations_min_fields"]: {
	__typename: "installations_min_fields",
	appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** order by min() on columns of table "installations" */
["installations_min_order_by"]: {
		appIdentifier?: GraphQLTypes["order_by"] | undefined,
	appVersion?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	deviceLocale?: GraphQLTypes["order_by"] | undefined,
	deviceName?: GraphQLTypes["order_by"] | undefined,
	deviceType?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	osName?: GraphQLTypes["order_by"] | undefined,
	osVersion?: GraphQLTypes["order_by"] | undefined,
	pushToken?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "installations" */
["installations_mutation_response"]: {
	__typename: "installations_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["installations"]>
};
	/** on_conflict condition type for table "installations" */
["installations_on_conflict"]: {
		constraint: GraphQLTypes["installations_constraint"],
	update_columns: Array<GraphQLTypes["installations_update_column"]>,
	where?: GraphQLTypes["installations_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "installations". */
["installations_order_by"]: {
		appIdentifier?: GraphQLTypes["order_by"] | undefined,
	appVersion?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	deviceLocale?: GraphQLTypes["order_by"] | undefined,
	deviceName?: GraphQLTypes["order_by"] | undefined,
	deviceType?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	isActive?: GraphQLTypes["order_by"] | undefined,
	osName?: GraphQLTypes["order_by"] | undefined,
	osVersion?: GraphQLTypes["order_by"] | undefined,
	pushToken?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	user?: GraphQLTypes["users_order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: installations */
["installations_pk_columns_input"]: {
		id: GraphQLTypes["uuid"],
	userId: GraphQLTypes["uuid"]
};
	/** select columns of table "installations" */
["installations_select_column"]: installations_select_column;
	/** select "installations_aggregate_bool_exp_bool_and_arguments_columns" columns of table "installations" */
["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"]: installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "installations_aggregate_bool_exp_bool_or_arguments_columns" columns of table "installations" */
["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"]: installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "installations" */
["installations_set_input"]: {
		appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isActive?: boolean | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "installations" */
["installations_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["installations_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["installations_stream_cursor_value_input"]: {
		appIdentifier?: string | undefined,
	appVersion?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	deviceLocale?: string | undefined,
	deviceName?: string | undefined,
	deviceType?: string | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isActive?: boolean | undefined,
	osName?: string | undefined,
	osVersion?: string | undefined,
	pushToken?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** update columns of table "installations" */
["installations_update_column"]: installations_update_column;
	["installations_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["installations_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["installations_bool_exp"]
};
	["jsonb"]: "scalar" & { name: "jsonb" };
	["jsonb_cast_exp"]: {
		String?: GraphQLTypes["String_comparison_exp"] | undefined
};
	/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
["jsonb_comparison_exp"]: {
		_cast?: GraphQLTypes["jsonb_cast_exp"] | undefined,
	/** is the column contained in the given json value */
	_contained_in?: GraphQLTypes["jsonb"] | undefined,
	/** does the column contain the given json value at the top level */
	_contains?: GraphQLTypes["jsonb"] | undefined,
	_eq?: GraphQLTypes["jsonb"] | undefined,
	_gt?: GraphQLTypes["jsonb"] | undefined,
	_gte?: GraphQLTypes["jsonb"] | undefined,
	/** does the string exist as a top-level key in the column */
	_has_key?: string | undefined,
	/** do all of these strings exist as top-level keys in the column */
	_has_keys_all?: Array<string> | undefined,
	/** do any of these strings exist as top-level keys in the column */
	_has_keys_any?: Array<string> | undefined,
	_in?: Array<GraphQLTypes["jsonb"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["jsonb"] | undefined,
	_lte?: GraphQLTypes["jsonb"] | undefined,
	_neq?: GraphQLTypes["jsonb"] | undefined,
	_nin?: Array<GraphQLTypes["jsonb"]> | undefined
};
	/** mutation root */
["mutation_root"]: {
	__typename: "mutation_root",
	/** delete single row from the table: "auth.providers" */
	deleteAuthProvider?: GraphQLTypes["authProviders"] | undefined,
	/** delete single row from the table: "auth.provider_requests" */
	deleteAuthProviderRequest?: GraphQLTypes["authProviderRequests"] | undefined,
	/** delete data from the table: "auth.provider_requests" */
	deleteAuthProviderRequests?: GraphQLTypes["authProviderRequests_mutation_response"] | undefined,
	/** delete data from the table: "auth.providers" */
	deleteAuthProviders?: GraphQLTypes["authProviders_mutation_response"] | undefined,
	/** delete single row from the table: "auth.refresh_tokens" */
	deleteAuthRefreshToken?: GraphQLTypes["authRefreshTokens"] | undefined,
	/** delete single row from the table: "auth.refresh_token_types" */
	deleteAuthRefreshTokenType?: GraphQLTypes["authRefreshTokenTypes"] | undefined,
	/** delete data from the table: "auth.refresh_token_types" */
	deleteAuthRefreshTokenTypes?: GraphQLTypes["authRefreshTokenTypes_mutation_response"] | undefined,
	/** delete data from the table: "auth.refresh_tokens" */
	deleteAuthRefreshTokens?: GraphQLTypes["authRefreshTokens_mutation_response"] | undefined,
	/** delete single row from the table: "auth.roles" */
	deleteAuthRole?: GraphQLTypes["authRoles"] | undefined,
	/** delete data from the table: "auth.roles" */
	deleteAuthRoles?: GraphQLTypes["authRoles_mutation_response"] | undefined,
	/** delete single row from the table: "auth.user_providers" */
	deleteAuthUserProvider?: GraphQLTypes["authUserProviders"] | undefined,
	/** delete data from the table: "auth.user_providers" */
	deleteAuthUserProviders?: GraphQLTypes["authUserProviders_mutation_response"] | undefined,
	/** delete single row from the table: "auth.user_roles" */
	deleteAuthUserRole?: GraphQLTypes["authUserRoles"] | undefined,
	/** delete data from the table: "auth.user_roles" */
	deleteAuthUserRoles?: GraphQLTypes["authUserRoles_mutation_response"] | undefined,
	/** delete single row from the table: "auth.user_security_keys" */
	deleteAuthUserSecurityKey?: GraphQLTypes["authUserSecurityKeys"] | undefined,
	/** delete data from the table: "auth.user_security_keys" */
	deleteAuthUserSecurityKeys?: GraphQLTypes["authUserSecurityKeys_mutation_response"] | undefined,
	/** delete single row from the table: "storage.buckets" */
	deleteBucket?: GraphQLTypes["buckets"] | undefined,
	/** delete data from the table: "storage.buckets" */
	deleteBuckets?: GraphQLTypes["buckets_mutation_response"] | undefined,
	/** delete single row from the table: "storage.files" */
	deleteFile?: GraphQLTypes["files"] | undefined,
	/** delete data from the table: "storage.files" */
	deleteFiles?: GraphQLTypes["files_mutation_response"] | undefined,
	/** delete single row from the table: "auth.users" */
	deleteUser?: GraphQLTypes["users"] | undefined,
	/** delete data from the table: "auth.users" */
	deleteUsers?: GraphQLTypes["users_mutation_response"] | undefined,
	/** delete data from the table: "event_files" */
	delete_event_files?: GraphQLTypes["event_files_mutation_response"] | undefined,
	/** delete single row from the table: "event_files" */
	delete_event_files_by_pk?: GraphQLTypes["event_files"] | undefined,
	/** delete data from the table: "event_participants" */
	delete_event_participants?: GraphQLTypes["event_participants_mutation_response"] | undefined,
	/** delete single row from the table: "event_participants" */
	delete_event_participants_by_pk?: GraphQLTypes["event_participants"] | undefined,
	/** delete data from the table: "events" */
	delete_events?: GraphQLTypes["events_mutation_response"] | undefined,
	/** delete single row from the table: "events" */
	delete_events_by_pk?: GraphQLTypes["events"] | undefined,
	/** delete data from the table: "installations" */
	delete_installations?: GraphQLTypes["installations_mutation_response"] | undefined,
	/** delete single row from the table: "installations" */
	delete_installations_by_pk?: GraphQLTypes["installations"] | undefined,
	/** delete data from the table: "user_files" */
	delete_user_files?: GraphQLTypes["user_files_mutation_response"] | undefined,
	/** delete single row from the table: "user_files" */
	delete_user_files_by_pk?: GraphQLTypes["user_files"] | undefined,
	/** insert a single row into the table: "auth.providers" */
	insertAuthProvider?: GraphQLTypes["authProviders"] | undefined,
	/** insert a single row into the table: "auth.provider_requests" */
	insertAuthProviderRequest?: GraphQLTypes["authProviderRequests"] | undefined,
	/** insert data into the table: "auth.provider_requests" */
	insertAuthProviderRequests?: GraphQLTypes["authProviderRequests_mutation_response"] | undefined,
	/** insert data into the table: "auth.providers" */
	insertAuthProviders?: GraphQLTypes["authProviders_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.refresh_tokens" */
	insertAuthRefreshToken?: GraphQLTypes["authRefreshTokens"] | undefined,
	/** insert a single row into the table: "auth.refresh_token_types" */
	insertAuthRefreshTokenType?: GraphQLTypes["authRefreshTokenTypes"] | undefined,
	/** insert data into the table: "auth.refresh_token_types" */
	insertAuthRefreshTokenTypes?: GraphQLTypes["authRefreshTokenTypes_mutation_response"] | undefined,
	/** insert data into the table: "auth.refresh_tokens" */
	insertAuthRefreshTokens?: GraphQLTypes["authRefreshTokens_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.roles" */
	insertAuthRole?: GraphQLTypes["authRoles"] | undefined,
	/** insert data into the table: "auth.roles" */
	insertAuthRoles?: GraphQLTypes["authRoles_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.user_providers" */
	insertAuthUserProvider?: GraphQLTypes["authUserProviders"] | undefined,
	/** insert data into the table: "auth.user_providers" */
	insertAuthUserProviders?: GraphQLTypes["authUserProviders_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.user_roles" */
	insertAuthUserRole?: GraphQLTypes["authUserRoles"] | undefined,
	/** insert data into the table: "auth.user_roles" */
	insertAuthUserRoles?: GraphQLTypes["authUserRoles_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.user_security_keys" */
	insertAuthUserSecurityKey?: GraphQLTypes["authUserSecurityKeys"] | undefined,
	/** insert data into the table: "auth.user_security_keys" */
	insertAuthUserSecurityKeys?: GraphQLTypes["authUserSecurityKeys_mutation_response"] | undefined,
	/** insert a single row into the table: "storage.buckets" */
	insertBucket?: GraphQLTypes["buckets"] | undefined,
	/** insert data into the table: "storage.buckets" */
	insertBuckets?: GraphQLTypes["buckets_mutation_response"] | undefined,
	/** insert a single row into the table: "storage.files" */
	insertFile?: GraphQLTypes["files"] | undefined,
	/** insert data into the table: "storage.files" */
	insertFiles?: GraphQLTypes["files_mutation_response"] | undefined,
	/** insert a single row into the table: "auth.users" */
	insertUser?: GraphQLTypes["users"] | undefined,
	/** insert data into the table: "auth.users" */
	insertUsers?: GraphQLTypes["users_mutation_response"] | undefined,
	/** insert data into the table: "event_files" */
	insert_event_files?: GraphQLTypes["event_files_mutation_response"] | undefined,
	/** insert a single row into the table: "event_files" */
	insert_event_files_one?: GraphQLTypes["event_files"] | undefined,
	/** insert data into the table: "event_participants" */
	insert_event_participants?: GraphQLTypes["event_participants_mutation_response"] | undefined,
	/** insert a single row into the table: "event_participants" */
	insert_event_participants_one?: GraphQLTypes["event_participants"] | undefined,
	/** insert data into the table: "events" */
	insert_events?: GraphQLTypes["events_mutation_response"] | undefined,
	/** insert a single row into the table: "events" */
	insert_events_one?: GraphQLTypes["events"] | undefined,
	/** insert data into the table: "installations" */
	insert_installations?: GraphQLTypes["installations_mutation_response"] | undefined,
	/** insert a single row into the table: "installations" */
	insert_installations_one?: GraphQLTypes["installations"] | undefined,
	/** insert data into the table: "user_files" */
	insert_user_files?: GraphQLTypes["user_files_mutation_response"] | undefined,
	/** insert a single row into the table: "user_files" */
	insert_user_files_one?: GraphQLTypes["user_files"] | undefined,
	/** update single row of the table: "auth.providers" */
	updateAuthProvider?: GraphQLTypes["authProviders"] | undefined,
	/** update single row of the table: "auth.provider_requests" */
	updateAuthProviderRequest?: GraphQLTypes["authProviderRequests"] | undefined,
	/** update data of the table: "auth.provider_requests" */
	updateAuthProviderRequests?: GraphQLTypes["authProviderRequests_mutation_response"] | undefined,
	/** update data of the table: "auth.providers" */
	updateAuthProviders?: GraphQLTypes["authProviders_mutation_response"] | undefined,
	/** update single row of the table: "auth.refresh_tokens" */
	updateAuthRefreshToken?: GraphQLTypes["authRefreshTokens"] | undefined,
	/** update single row of the table: "auth.refresh_token_types" */
	updateAuthRefreshTokenType?: GraphQLTypes["authRefreshTokenTypes"] | undefined,
	/** update data of the table: "auth.refresh_token_types" */
	updateAuthRefreshTokenTypes?: GraphQLTypes["authRefreshTokenTypes_mutation_response"] | undefined,
	/** update data of the table: "auth.refresh_tokens" */
	updateAuthRefreshTokens?: GraphQLTypes["authRefreshTokens_mutation_response"] | undefined,
	/** update single row of the table: "auth.roles" */
	updateAuthRole?: GraphQLTypes["authRoles"] | undefined,
	/** update data of the table: "auth.roles" */
	updateAuthRoles?: GraphQLTypes["authRoles_mutation_response"] | undefined,
	/** update single row of the table: "auth.user_providers" */
	updateAuthUserProvider?: GraphQLTypes["authUserProviders"] | undefined,
	/** update data of the table: "auth.user_providers" */
	updateAuthUserProviders?: GraphQLTypes["authUserProviders_mutation_response"] | undefined,
	/** update single row of the table: "auth.user_roles" */
	updateAuthUserRole?: GraphQLTypes["authUserRoles"] | undefined,
	/** update data of the table: "auth.user_roles" */
	updateAuthUserRoles?: GraphQLTypes["authUserRoles_mutation_response"] | undefined,
	/** update single row of the table: "auth.user_security_keys" */
	updateAuthUserSecurityKey?: GraphQLTypes["authUserSecurityKeys"] | undefined,
	/** update data of the table: "auth.user_security_keys" */
	updateAuthUserSecurityKeys?: GraphQLTypes["authUserSecurityKeys_mutation_response"] | undefined,
	/** update single row of the table: "storage.buckets" */
	updateBucket?: GraphQLTypes["buckets"] | undefined,
	/** update data of the table: "storage.buckets" */
	updateBuckets?: GraphQLTypes["buckets_mutation_response"] | undefined,
	/** update single row of the table: "storage.files" */
	updateFile?: GraphQLTypes["files"] | undefined,
	/** update data of the table: "storage.files" */
	updateFiles?: GraphQLTypes["files_mutation_response"] | undefined,
	/** update single row of the table: "auth.users" */
	updateUser?: GraphQLTypes["users"] | undefined,
	/** update data of the table: "auth.users" */
	updateUsers?: GraphQLTypes["users_mutation_response"] | undefined,
	/** update multiples rows of table: "auth.provider_requests" */
	update_authProviderRequests_many?: Array<GraphQLTypes["authProviderRequests_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.providers" */
	update_authProviders_many?: Array<GraphQLTypes["authProviders_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.refresh_token_types" */
	update_authRefreshTokenTypes_many?: Array<GraphQLTypes["authRefreshTokenTypes_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.refresh_tokens" */
	update_authRefreshTokens_many?: Array<GraphQLTypes["authRefreshTokens_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.roles" */
	update_authRoles_many?: Array<GraphQLTypes["authRoles_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.user_providers" */
	update_authUserProviders_many?: Array<GraphQLTypes["authUserProviders_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.user_roles" */
	update_authUserRoles_many?: Array<GraphQLTypes["authUserRoles_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.user_security_keys" */
	update_authUserSecurityKeys_many?: Array<GraphQLTypes["authUserSecurityKeys_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "storage.buckets" */
	update_buckets_many?: Array<GraphQLTypes["buckets_mutation_response"] | undefined> | undefined,
	/** update data of the table: "event_files" */
	update_event_files?: GraphQLTypes["event_files_mutation_response"] | undefined,
	/** update single row of the table: "event_files" */
	update_event_files_by_pk?: GraphQLTypes["event_files"] | undefined,
	/** update multiples rows of table: "event_files" */
	update_event_files_many?: Array<GraphQLTypes["event_files_mutation_response"] | undefined> | undefined,
	/** update data of the table: "event_participants" */
	update_event_participants?: GraphQLTypes["event_participants_mutation_response"] | undefined,
	/** update single row of the table: "event_participants" */
	update_event_participants_by_pk?: GraphQLTypes["event_participants"] | undefined,
	/** update multiples rows of table: "event_participants" */
	update_event_participants_many?: Array<GraphQLTypes["event_participants_mutation_response"] | undefined> | undefined,
	/** update data of the table: "events" */
	update_events?: GraphQLTypes["events_mutation_response"] | undefined,
	/** update single row of the table: "events" */
	update_events_by_pk?: GraphQLTypes["events"] | undefined,
	/** update multiples rows of table: "events" */
	update_events_many?: Array<GraphQLTypes["events_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "storage.files" */
	update_files_many?: Array<GraphQLTypes["files_mutation_response"] | undefined> | undefined,
	/** update data of the table: "installations" */
	update_installations?: GraphQLTypes["installations_mutation_response"] | undefined,
	/** update single row of the table: "installations" */
	update_installations_by_pk?: GraphQLTypes["installations"] | undefined,
	/** update multiples rows of table: "installations" */
	update_installations_many?: Array<GraphQLTypes["installations_mutation_response"] | undefined> | undefined,
	/** update data of the table: "user_files" */
	update_user_files?: GraphQLTypes["user_files_mutation_response"] | undefined,
	/** update single row of the table: "user_files" */
	update_user_files_by_pk?: GraphQLTypes["user_files"] | undefined,
	/** update multiples rows of table: "user_files" */
	update_user_files_many?: Array<GraphQLTypes["user_files_mutation_response"] | undefined> | undefined,
	/** update multiples rows of table: "auth.users" */
	update_users_many?: Array<GraphQLTypes["users_mutation_response"] | undefined> | undefined
};
	/** column ordering options */
["order_by"]: order_by;
	["query_root"]: {
	__typename: "query_root",
	/** fetch data from the table: "auth.providers" using primary key columns */
	authProvider?: GraphQLTypes["authProviders"] | undefined,
	/** fetch data from the table: "auth.provider_requests" using primary key columns */
	authProviderRequest?: GraphQLTypes["authProviderRequests"] | undefined,
	/** fetch data from the table: "auth.provider_requests" */
	authProviderRequests: Array<GraphQLTypes["authProviderRequests"]>,
	/** fetch aggregated fields from the table: "auth.provider_requests" */
	authProviderRequestsAggregate: GraphQLTypes["authProviderRequests_aggregate"],
	/** fetch data from the table: "auth.providers" */
	authProviders: Array<GraphQLTypes["authProviders"]>,
	/** fetch aggregated fields from the table: "auth.providers" */
	authProvidersAggregate: GraphQLTypes["authProviders_aggregate"],
	/** fetch data from the table: "auth.refresh_tokens" using primary key columns */
	authRefreshToken?: GraphQLTypes["authRefreshTokens"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" using primary key columns */
	authRefreshTokenType?: GraphQLTypes["authRefreshTokenTypes"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" */
	authRefreshTokenTypes: Array<GraphQLTypes["authRefreshTokenTypes"]>,
	/** fetch aggregated fields from the table: "auth.refresh_token_types" */
	authRefreshTokenTypesAggregate: GraphQLTypes["authRefreshTokenTypes_aggregate"],
	/** fetch data from the table: "auth.refresh_tokens" */
	authRefreshTokens: Array<GraphQLTypes["authRefreshTokens"]>,
	/** fetch aggregated fields from the table: "auth.refresh_tokens" */
	authRefreshTokensAggregate: GraphQLTypes["authRefreshTokens_aggregate"],
	/** fetch data from the table: "auth.roles" using primary key columns */
	authRole?: GraphQLTypes["authRoles"] | undefined,
	/** fetch data from the table: "auth.roles" */
	authRoles: Array<GraphQLTypes["authRoles"]>,
	/** fetch aggregated fields from the table: "auth.roles" */
	authRolesAggregate: GraphQLTypes["authRoles_aggregate"],
	/** fetch data from the table: "auth.user_providers" using primary key columns */
	authUserProvider?: GraphQLTypes["authUserProviders"] | undefined,
	/** fetch data from the table: "auth.user_providers" */
	authUserProviders: Array<GraphQLTypes["authUserProviders"]>,
	/** fetch aggregated fields from the table: "auth.user_providers" */
	authUserProvidersAggregate: GraphQLTypes["authUserProviders_aggregate"],
	/** fetch data from the table: "auth.user_roles" using primary key columns */
	authUserRole?: GraphQLTypes["authUserRoles"] | undefined,
	/** fetch data from the table: "auth.user_roles" */
	authUserRoles: Array<GraphQLTypes["authUserRoles"]>,
	/** fetch aggregated fields from the table: "auth.user_roles" */
	authUserRolesAggregate: GraphQLTypes["authUserRoles_aggregate"],
	/** fetch data from the table: "auth.user_security_keys" using primary key columns */
	authUserSecurityKey?: GraphQLTypes["authUserSecurityKeys"] | undefined,
	/** fetch data from the table: "auth.user_security_keys" */
	authUserSecurityKeys: Array<GraphQLTypes["authUserSecurityKeys"]>,
	/** fetch aggregated fields from the table: "auth.user_security_keys" */
	authUserSecurityKeysAggregate: GraphQLTypes["authUserSecurityKeys_aggregate"],
	/** fetch data from the table: "storage.buckets" using primary key columns */
	bucket?: GraphQLTypes["buckets"] | undefined,
	/** fetch data from the table: "storage.buckets" */
	buckets: Array<GraphQLTypes["buckets"]>,
	/** fetch aggregated fields from the table: "storage.buckets" */
	bucketsAggregate: GraphQLTypes["buckets_aggregate"],
	/** fetch data from the table: "event_files" */
	event_files: Array<GraphQLTypes["event_files"]>,
	/** fetch aggregated fields from the table: "event_files" */
	event_files_aggregate: GraphQLTypes["event_files_aggregate"],
	/** fetch data from the table: "event_files" using primary key columns */
	event_files_by_pk?: GraphQLTypes["event_files"] | undefined,
	/** fetch data from the table: "event_participants" */
	event_participants: Array<GraphQLTypes["event_participants"]>,
	/** fetch aggregated fields from the table: "event_participants" */
	event_participants_aggregate: GraphQLTypes["event_participants_aggregate"],
	/** fetch data from the table: "event_participants" using primary key columns */
	event_participants_by_pk?: GraphQLTypes["event_participants"] | undefined,
	/** An array relationship */
	events: Array<GraphQLTypes["events"]>,
	/** An aggregate relationship */
	events_aggregate: GraphQLTypes["events_aggregate"],
	/** fetch data from the table: "events" using primary key columns */
	events_by_pk?: GraphQLTypes["events"] | undefined,
	/** fetch data from the table: "storage.files" using primary key columns */
	file?: GraphQLTypes["files"] | undefined,
	/** An array relationship */
	files: Array<GraphQLTypes["files"]>,
	/** fetch aggregated fields from the table: "storage.files" */
	filesAggregate: GraphQLTypes["files_aggregate"],
	/** An array relationship */
	installations: Array<GraphQLTypes["installations"]>,
	/** An aggregate relationship */
	installations_aggregate: GraphQLTypes["installations_aggregate"],
	/** fetch data from the table: "installations" using primary key columns */
	installations_by_pk?: GraphQLTypes["installations"] | undefined,
	/** fetch data from the table: "auth.users" using primary key columns */
	user?: GraphQLTypes["users"] | undefined,
	/** fetch data from the table: "user_files" */
	user_files: Array<GraphQLTypes["user_files"]>,
	/** fetch aggregated fields from the table: "user_files" */
	user_files_aggregate: GraphQLTypes["user_files_aggregate"],
	/** fetch data from the table: "user_files" using primary key columns */
	user_files_by_pk?: GraphQLTypes["user_files"] | undefined,
	/** fetch data from the table: "auth.users" */
	users: Array<GraphQLTypes["users"]>,
	/** fetch aggregated fields from the table: "auth.users" */
	usersAggregate: GraphQLTypes["users_aggregate"]
};
	["subscription_root"]: {
	__typename: "subscription_root",
	/** fetch data from the table: "auth.providers" using primary key columns */
	authProvider?: GraphQLTypes["authProviders"] | undefined,
	/** fetch data from the table: "auth.provider_requests" using primary key columns */
	authProviderRequest?: GraphQLTypes["authProviderRequests"] | undefined,
	/** fetch data from the table: "auth.provider_requests" */
	authProviderRequests: Array<GraphQLTypes["authProviderRequests"]>,
	/** fetch aggregated fields from the table: "auth.provider_requests" */
	authProviderRequestsAggregate: GraphQLTypes["authProviderRequests_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.provider_requests" */
	authProviderRequests_stream: Array<GraphQLTypes["authProviderRequests"]>,
	/** fetch data from the table: "auth.providers" */
	authProviders: Array<GraphQLTypes["authProviders"]>,
	/** fetch aggregated fields from the table: "auth.providers" */
	authProvidersAggregate: GraphQLTypes["authProviders_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.providers" */
	authProviders_stream: Array<GraphQLTypes["authProviders"]>,
	/** fetch data from the table: "auth.refresh_tokens" using primary key columns */
	authRefreshToken?: GraphQLTypes["authRefreshTokens"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" using primary key columns */
	authRefreshTokenType?: GraphQLTypes["authRefreshTokenTypes"] | undefined,
	/** fetch data from the table: "auth.refresh_token_types" */
	authRefreshTokenTypes: Array<GraphQLTypes["authRefreshTokenTypes"]>,
	/** fetch aggregated fields from the table: "auth.refresh_token_types" */
	authRefreshTokenTypesAggregate: GraphQLTypes["authRefreshTokenTypes_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.refresh_token_types" */
	authRefreshTokenTypes_stream: Array<GraphQLTypes["authRefreshTokenTypes"]>,
	/** fetch data from the table: "auth.refresh_tokens" */
	authRefreshTokens: Array<GraphQLTypes["authRefreshTokens"]>,
	/** fetch aggregated fields from the table: "auth.refresh_tokens" */
	authRefreshTokensAggregate: GraphQLTypes["authRefreshTokens_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.refresh_tokens" */
	authRefreshTokens_stream: Array<GraphQLTypes["authRefreshTokens"]>,
	/** fetch data from the table: "auth.roles" using primary key columns */
	authRole?: GraphQLTypes["authRoles"] | undefined,
	/** fetch data from the table: "auth.roles" */
	authRoles: Array<GraphQLTypes["authRoles"]>,
	/** fetch aggregated fields from the table: "auth.roles" */
	authRolesAggregate: GraphQLTypes["authRoles_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.roles" */
	authRoles_stream: Array<GraphQLTypes["authRoles"]>,
	/** fetch data from the table: "auth.user_providers" using primary key columns */
	authUserProvider?: GraphQLTypes["authUserProviders"] | undefined,
	/** fetch data from the table: "auth.user_providers" */
	authUserProviders: Array<GraphQLTypes["authUserProviders"]>,
	/** fetch aggregated fields from the table: "auth.user_providers" */
	authUserProvidersAggregate: GraphQLTypes["authUserProviders_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.user_providers" */
	authUserProviders_stream: Array<GraphQLTypes["authUserProviders"]>,
	/** fetch data from the table: "auth.user_roles" using primary key columns */
	authUserRole?: GraphQLTypes["authUserRoles"] | undefined,
	/** fetch data from the table: "auth.user_roles" */
	authUserRoles: Array<GraphQLTypes["authUserRoles"]>,
	/** fetch aggregated fields from the table: "auth.user_roles" */
	authUserRolesAggregate: GraphQLTypes["authUserRoles_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.user_roles" */
	authUserRoles_stream: Array<GraphQLTypes["authUserRoles"]>,
	/** fetch data from the table: "auth.user_security_keys" using primary key columns */
	authUserSecurityKey?: GraphQLTypes["authUserSecurityKeys"] | undefined,
	/** fetch data from the table: "auth.user_security_keys" */
	authUserSecurityKeys: Array<GraphQLTypes["authUserSecurityKeys"]>,
	/** fetch aggregated fields from the table: "auth.user_security_keys" */
	authUserSecurityKeysAggregate: GraphQLTypes["authUserSecurityKeys_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.user_security_keys" */
	authUserSecurityKeys_stream: Array<GraphQLTypes["authUserSecurityKeys"]>,
	/** fetch data from the table: "storage.buckets" using primary key columns */
	bucket?: GraphQLTypes["buckets"] | undefined,
	/** fetch data from the table: "storage.buckets" */
	buckets: Array<GraphQLTypes["buckets"]>,
	/** fetch aggregated fields from the table: "storage.buckets" */
	bucketsAggregate: GraphQLTypes["buckets_aggregate"],
	/** fetch data from the table in a streaming manner: "storage.buckets" */
	buckets_stream: Array<GraphQLTypes["buckets"]>,
	/** fetch data from the table: "event_files" */
	event_files: Array<GraphQLTypes["event_files"]>,
	/** fetch aggregated fields from the table: "event_files" */
	event_files_aggregate: GraphQLTypes["event_files_aggregate"],
	/** fetch data from the table: "event_files" using primary key columns */
	event_files_by_pk?: GraphQLTypes["event_files"] | undefined,
	/** fetch data from the table in a streaming manner: "event_files" */
	event_files_stream: Array<GraphQLTypes["event_files"]>,
	/** fetch data from the table: "event_participants" */
	event_participants: Array<GraphQLTypes["event_participants"]>,
	/** fetch aggregated fields from the table: "event_participants" */
	event_participants_aggregate: GraphQLTypes["event_participants_aggregate"],
	/** fetch data from the table: "event_participants" using primary key columns */
	event_participants_by_pk?: GraphQLTypes["event_participants"] | undefined,
	/** fetch data from the table in a streaming manner: "event_participants" */
	event_participants_stream: Array<GraphQLTypes["event_participants"]>,
	/** An array relationship */
	events: Array<GraphQLTypes["events"]>,
	/** An aggregate relationship */
	events_aggregate: GraphQLTypes["events_aggregate"],
	/** fetch data from the table: "events" using primary key columns */
	events_by_pk?: GraphQLTypes["events"] | undefined,
	/** fetch data from the table in a streaming manner: "events" */
	events_stream: Array<GraphQLTypes["events"]>,
	/** fetch data from the table: "storage.files" using primary key columns */
	file?: GraphQLTypes["files"] | undefined,
	/** An array relationship */
	files: Array<GraphQLTypes["files"]>,
	/** fetch aggregated fields from the table: "storage.files" */
	filesAggregate: GraphQLTypes["files_aggregate"],
	/** fetch data from the table in a streaming manner: "storage.files" */
	files_stream: Array<GraphQLTypes["files"]>,
	/** An array relationship */
	installations: Array<GraphQLTypes["installations"]>,
	/** An aggregate relationship */
	installations_aggregate: GraphQLTypes["installations_aggregate"],
	/** fetch data from the table: "installations" using primary key columns */
	installations_by_pk?: GraphQLTypes["installations"] | undefined,
	/** fetch data from the table in a streaming manner: "installations" */
	installations_stream: Array<GraphQLTypes["installations"]>,
	/** fetch data from the table: "auth.users" using primary key columns */
	user?: GraphQLTypes["users"] | undefined,
	/** fetch data from the table: "user_files" */
	user_files: Array<GraphQLTypes["user_files"]>,
	/** fetch aggregated fields from the table: "user_files" */
	user_files_aggregate: GraphQLTypes["user_files_aggregate"],
	/** fetch data from the table: "user_files" using primary key columns */
	user_files_by_pk?: GraphQLTypes["user_files"] | undefined,
	/** fetch data from the table in a streaming manner: "user_files" */
	user_files_stream: Array<GraphQLTypes["user_files"]>,
	/** fetch data from the table: "auth.users" */
	users: Array<GraphQLTypes["users"]>,
	/** fetch aggregated fields from the table: "auth.users" */
	usersAggregate: GraphQLTypes["users_aggregate"],
	/** fetch data from the table in a streaming manner: "auth.users" */
	users_stream: Array<GraphQLTypes["users"]>
};
	["timestamptz"]: "scalar" & { name: "timestamptz" };
	/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
["timestamptz_comparison_exp"]: {
		_eq?: GraphQLTypes["timestamptz"] | undefined,
	_gt?: GraphQLTypes["timestamptz"] | undefined,
	_gte?: GraphQLTypes["timestamptz"] | undefined,
	_in?: Array<GraphQLTypes["timestamptz"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["timestamptz"] | undefined,
	_lte?: GraphQLTypes["timestamptz"] | undefined,
	_neq?: GraphQLTypes["timestamptz"] | undefined,
	_nin?: Array<GraphQLTypes["timestamptz"]> | undefined
};
	/** columns and relationships of "user_files" */
["user_files"]: {
	__typename: "user_files",
	fileId: GraphQLTypes["uuid"],
	userId: GraphQLTypes["uuid"]
};
	/** aggregated selection of "user_files" */
["user_files_aggregate"]: {
	__typename: "user_files_aggregate",
	aggregate?: GraphQLTypes["user_files_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["user_files"]>
};
	/** aggregate fields of "user_files" */
["user_files_aggregate_fields"]: {
	__typename: "user_files_aggregate_fields",
	count: number,
	max?: GraphQLTypes["user_files_max_fields"] | undefined,
	min?: GraphQLTypes["user_files_min_fields"] | undefined
};
	/** Boolean expression to filter rows from the table "user_files". All fields are combined with a logical 'AND'. */
["user_files_bool_exp"]: {
		_and?: Array<GraphQLTypes["user_files_bool_exp"]> | undefined,
	_not?: GraphQLTypes["user_files_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["user_files_bool_exp"]> | undefined,
	fileId?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	userId?: GraphQLTypes["uuid_comparison_exp"] | undefined
};
	/** unique or primary key constraints on table "user_files" */
["user_files_constraint"]: user_files_constraint;
	/** input type for inserting data into table "user_files" */
["user_files_insert_input"]: {
		fileId?: GraphQLTypes["uuid"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate max on columns */
["user_files_max_fields"]: {
	__typename: "user_files_max_fields",
	fileId?: GraphQLTypes["uuid"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** aggregate min on columns */
["user_files_min_fields"]: {
	__typename: "user_files_min_fields",
	fileId?: GraphQLTypes["uuid"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** response of any mutation on the table "user_files" */
["user_files_mutation_response"]: {
	__typename: "user_files_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["user_files"]>
};
	/** on_conflict condition type for table "user_files" */
["user_files_on_conflict"]: {
		constraint: GraphQLTypes["user_files_constraint"],
	update_columns: Array<GraphQLTypes["user_files_update_column"]>,
	where?: GraphQLTypes["user_files_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "user_files". */
["user_files_order_by"]: {
		fileId?: GraphQLTypes["order_by"] | undefined,
	userId?: GraphQLTypes["order_by"] | undefined
};
	/** primary key columns input for table: user_files */
["user_files_pk_columns_input"]: {
		fileId: GraphQLTypes["uuid"],
	userId: GraphQLTypes["uuid"]
};
	/** select columns of table "user_files" */
["user_files_select_column"]: user_files_select_column;
	/** input type for updating data in table "user_files" */
["user_files_set_input"]: {
		fileId?: GraphQLTypes["uuid"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** Streaming cursor of the table "user_files" */
["user_files_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["user_files_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["user_files_stream_cursor_value_input"]: {
		fileId?: GraphQLTypes["uuid"] | undefined,
	userId?: GraphQLTypes["uuid"] | undefined
};
	/** update columns of table "user_files" */
["user_files_update_column"]: user_files_update_column;
	["user_files_updates"]: {
		/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["user_files_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["user_files_bool_exp"]
};
	/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
["users"]: {
	__typename: "users",
	activeMfaType?: string | undefined,
	avatarUrl: string,
	createdAt: GraphQLTypes["timestamptz"],
	currentChallenge?: string | undefined,
	defaultRole: string,
	/** An object relationship */
	defaultRoleByRole: GraphQLTypes["authRoles"],
	disabled: boolean,
	displayName: string,
	email?: GraphQLTypes["citext"] | undefined,
	emailVerified: boolean,
	/** An array relationship */
	events: Array<GraphQLTypes["events"]>,
	/** An aggregate relationship */
	events_aggregate: GraphQLTypes["events_aggregate"],
	id: GraphQLTypes["uuid"],
	/** An array relationship */
	installations: Array<GraphQLTypes["installations"]>,
	/** An aggregate relationship */
	installations_aggregate: GraphQLTypes["installations_aggregate"],
	isAnonymous: boolean,
	lastSeen?: GraphQLTypes["timestamptz"] | undefined,
	locale: string,
	metadata?: GraphQLTypes["jsonb"] | undefined,
	newEmail?: GraphQLTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt: GraphQLTypes["timestamptz"],
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified: boolean,
	/** An array relationship */
	refreshTokens: Array<GraphQLTypes["authRefreshTokens"]>,
	/** An aggregate relationship */
	refreshTokens_aggregate: GraphQLTypes["authRefreshTokens_aggregate"],
	/** An array relationship */
	roles: Array<GraphQLTypes["authUserRoles"]>,
	/** An aggregate relationship */
	roles_aggregate: GraphQLTypes["authUserRoles_aggregate"],
	/** An array relationship */
	securityKeys: Array<GraphQLTypes["authUserSecurityKeys"]>,
	/** An aggregate relationship */
	securityKeys_aggregate: GraphQLTypes["authUserSecurityKeys_aggregate"],
	ticket?: string | undefined,
	ticketExpiresAt: GraphQLTypes["timestamptz"],
	totpSecret?: string | undefined,
	updatedAt: GraphQLTypes["timestamptz"],
	/** An array relationship */
	userProviders: Array<GraphQLTypes["authUserProviders"]>,
	/** An aggregate relationship */
	userProviders_aggregate: GraphQLTypes["authUserProviders_aggregate"]
};
	/** aggregated selection of "auth.users" */
["users_aggregate"]: {
	__typename: "users_aggregate",
	aggregate?: GraphQLTypes["users_aggregate_fields"] | undefined,
	nodes: Array<GraphQLTypes["users"]>
};
	["users_aggregate_bool_exp"]: {
		bool_and?: GraphQLTypes["users_aggregate_bool_exp_bool_and"] | undefined,
	bool_or?: GraphQLTypes["users_aggregate_bool_exp_bool_or"] | undefined,
	count?: GraphQLTypes["users_aggregate_bool_exp_count"] | undefined
};
	["users_aggregate_bool_exp_bool_and"]: {
		arguments: GraphQLTypes["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["users_bool_exp"] | undefined,
	predicate: GraphQLTypes["Boolean_comparison_exp"]
};
	["users_aggregate_bool_exp_bool_or"]: {
		arguments: GraphQLTypes["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"],
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["users_bool_exp"] | undefined,
	predicate: GraphQLTypes["Boolean_comparison_exp"]
};
	["users_aggregate_bool_exp_count"]: {
		arguments?: Array<GraphQLTypes["users_select_column"]> | undefined,
	distinct?: boolean | undefined,
	filter?: GraphQLTypes["users_bool_exp"] | undefined,
	predicate: GraphQLTypes["Int_comparison_exp"]
};
	/** aggregate fields of "auth.users" */
["users_aggregate_fields"]: {
	__typename: "users_aggregate_fields",
	count: number,
	max?: GraphQLTypes["users_max_fields"] | undefined,
	min?: GraphQLTypes["users_min_fields"] | undefined
};
	/** order by aggregate values of table "auth.users" */
["users_aggregate_order_by"]: {
		count?: GraphQLTypes["order_by"] | undefined,
	max?: GraphQLTypes["users_max_order_by"] | undefined,
	min?: GraphQLTypes["users_min_order_by"] | undefined
};
	/** append existing jsonb value of filtered columns with new jsonb value */
["users_append_input"]: {
		metadata?: GraphQLTypes["jsonb"] | undefined
};
	/** input type for inserting array relation for remote table "auth.users" */
["users_arr_rel_insert_input"]: {
		data: Array<GraphQLTypes["users_insert_input"]>,
	/** upsert condition */
	on_conflict?: GraphQLTypes["users_on_conflict"] | undefined
};
	/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
["users_bool_exp"]: {
		_and?: Array<GraphQLTypes["users_bool_exp"]> | undefined,
	_not?: GraphQLTypes["users_bool_exp"] | undefined,
	_or?: Array<GraphQLTypes["users_bool_exp"]> | undefined,
	activeMfaType?: GraphQLTypes["String_comparison_exp"] | undefined,
	avatarUrl?: GraphQLTypes["String_comparison_exp"] | undefined,
	createdAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	currentChallenge?: GraphQLTypes["String_comparison_exp"] | undefined,
	defaultRole?: GraphQLTypes["String_comparison_exp"] | undefined,
	defaultRoleByRole?: GraphQLTypes["authRoles_bool_exp"] | undefined,
	disabled?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	displayName?: GraphQLTypes["String_comparison_exp"] | undefined,
	email?: GraphQLTypes["citext_comparison_exp"] | undefined,
	emailVerified?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	events?: GraphQLTypes["events_bool_exp"] | undefined,
	events_aggregate?: GraphQLTypes["events_aggregate_bool_exp"] | undefined,
	id?: GraphQLTypes["uuid_comparison_exp"] | undefined,
	installations?: GraphQLTypes["installations_bool_exp"] | undefined,
	installations_aggregate?: GraphQLTypes["installations_aggregate_bool_exp"] | undefined,
	isAnonymous?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	lastSeen?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	locale?: GraphQLTypes["String_comparison_exp"] | undefined,
	metadata?: GraphQLTypes["jsonb_comparison_exp"] | undefined,
	newEmail?: GraphQLTypes["citext_comparison_exp"] | undefined,
	otpHash?: GraphQLTypes["String_comparison_exp"] | undefined,
	otpHashExpiresAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	otpMethodLastUsed?: GraphQLTypes["String_comparison_exp"] | undefined,
	passwordHash?: GraphQLTypes["String_comparison_exp"] | undefined,
	phoneNumber?: GraphQLTypes["String_comparison_exp"] | undefined,
	phoneNumberVerified?: GraphQLTypes["Boolean_comparison_exp"] | undefined,
	refreshTokens?: GraphQLTypes["authRefreshTokens_bool_exp"] | undefined,
	refreshTokens_aggregate?: GraphQLTypes["authRefreshTokens_aggregate_bool_exp"] | undefined,
	roles?: GraphQLTypes["authUserRoles_bool_exp"] | undefined,
	roles_aggregate?: GraphQLTypes["authUserRoles_aggregate_bool_exp"] | undefined,
	securityKeys?: GraphQLTypes["authUserSecurityKeys_bool_exp"] | undefined,
	securityKeys_aggregate?: GraphQLTypes["authUserSecurityKeys_aggregate_bool_exp"] | undefined,
	ticket?: GraphQLTypes["String_comparison_exp"] | undefined,
	ticketExpiresAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	totpSecret?: GraphQLTypes["String_comparison_exp"] | undefined,
	updatedAt?: GraphQLTypes["timestamptz_comparison_exp"] | undefined,
	userProviders?: GraphQLTypes["authUserProviders_bool_exp"] | undefined,
	userProviders_aggregate?: GraphQLTypes["authUserProviders_aggregate_bool_exp"] | undefined
};
	/** unique or primary key constraints on table "auth.users" */
["users_constraint"]: users_constraint;
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
["users_delete_at_path_input"]: {
		metadata?: Array<string> | undefined
};
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
["users_delete_elem_input"]: {
		metadata?: number | undefined
};
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
["users_delete_key_input"]: {
		metadata?: string | undefined
};
	/** input type for inserting data into table "auth.users" */
["users_insert_input"]: {
		activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	defaultRoleByRole?: GraphQLTypes["authRoles_obj_rel_insert_input"] | undefined,
	disabled?: boolean | undefined,
	displayName?: string | undefined,
	email?: GraphQLTypes["citext"] | undefined,
	emailVerified?: boolean | undefined,
	events?: GraphQLTypes["events_arr_rel_insert_input"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	installations?: GraphQLTypes["installations_arr_rel_insert_input"] | undefined,
	isAnonymous?: boolean | undefined,
	lastSeen?: GraphQLTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	metadata?: GraphQLTypes["jsonb"] | undefined,
	newEmail?: GraphQLTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified?: boolean | undefined,
	refreshTokens?: GraphQLTypes["authRefreshTokens_arr_rel_insert_input"] | undefined,
	roles?: GraphQLTypes["authUserRoles_arr_rel_insert_input"] | undefined,
	securityKeys?: GraphQLTypes["authUserSecurityKeys_arr_rel_insert_input"] | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined,
	userProviders?: GraphQLTypes["authUserProviders_arr_rel_insert_input"] | undefined
};
	/** aggregate max on columns */
["users_max_fields"]: {
	__typename: "users_max_fields",
	activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	displayName?: string | undefined,
	email?: GraphQLTypes["citext"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	lastSeen?: GraphQLTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	newEmail?: GraphQLTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** order by max() on columns of table "auth.users" */
["users_max_order_by"]: {
		activeMfaType?: GraphQLTypes["order_by"] | undefined,
	avatarUrl?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	currentChallenge?: GraphQLTypes["order_by"] | undefined,
	defaultRole?: GraphQLTypes["order_by"] | undefined,
	displayName?: GraphQLTypes["order_by"] | undefined,
	email?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	lastSeen?: GraphQLTypes["order_by"] | undefined,
	locale?: GraphQLTypes["order_by"] | undefined,
	newEmail?: GraphQLTypes["order_by"] | undefined,
	otpHash?: GraphQLTypes["order_by"] | undefined,
	otpHashExpiresAt?: GraphQLTypes["order_by"] | undefined,
	otpMethodLastUsed?: GraphQLTypes["order_by"] | undefined,
	passwordHash?: GraphQLTypes["order_by"] | undefined,
	phoneNumber?: GraphQLTypes["order_by"] | undefined,
	ticket?: GraphQLTypes["order_by"] | undefined,
	ticketExpiresAt?: GraphQLTypes["order_by"] | undefined,
	totpSecret?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined
};
	/** aggregate min on columns */
["users_min_fields"]: {
	__typename: "users_min_fields",
	activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	displayName?: string | undefined,
	email?: GraphQLTypes["citext"] | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	lastSeen?: GraphQLTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	newEmail?: GraphQLTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** order by min() on columns of table "auth.users" */
["users_min_order_by"]: {
		activeMfaType?: GraphQLTypes["order_by"] | undefined,
	avatarUrl?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	currentChallenge?: GraphQLTypes["order_by"] | undefined,
	defaultRole?: GraphQLTypes["order_by"] | undefined,
	displayName?: GraphQLTypes["order_by"] | undefined,
	email?: GraphQLTypes["order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	lastSeen?: GraphQLTypes["order_by"] | undefined,
	locale?: GraphQLTypes["order_by"] | undefined,
	newEmail?: GraphQLTypes["order_by"] | undefined,
	otpHash?: GraphQLTypes["order_by"] | undefined,
	otpHashExpiresAt?: GraphQLTypes["order_by"] | undefined,
	otpMethodLastUsed?: GraphQLTypes["order_by"] | undefined,
	passwordHash?: GraphQLTypes["order_by"] | undefined,
	phoneNumber?: GraphQLTypes["order_by"] | undefined,
	ticket?: GraphQLTypes["order_by"] | undefined,
	ticketExpiresAt?: GraphQLTypes["order_by"] | undefined,
	totpSecret?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined
};
	/** response of any mutation on the table "auth.users" */
["users_mutation_response"]: {
	__typename: "users_mutation_response",
	/** number of rows affected by the mutation */
	affected_rows: number,
	/** data from the rows affected by the mutation */
	returning: Array<GraphQLTypes["users"]>
};
	/** input type for inserting object relation for remote table "auth.users" */
["users_obj_rel_insert_input"]: {
		data: GraphQLTypes["users_insert_input"],
	/** upsert condition */
	on_conflict?: GraphQLTypes["users_on_conflict"] | undefined
};
	/** on_conflict condition type for table "auth.users" */
["users_on_conflict"]: {
		constraint: GraphQLTypes["users_constraint"],
	update_columns: Array<GraphQLTypes["users_update_column"]>,
	where?: GraphQLTypes["users_bool_exp"] | undefined
};
	/** Ordering options when selecting data from "auth.users". */
["users_order_by"]: {
		activeMfaType?: GraphQLTypes["order_by"] | undefined,
	avatarUrl?: GraphQLTypes["order_by"] | undefined,
	createdAt?: GraphQLTypes["order_by"] | undefined,
	currentChallenge?: GraphQLTypes["order_by"] | undefined,
	defaultRole?: GraphQLTypes["order_by"] | undefined,
	defaultRoleByRole?: GraphQLTypes["authRoles_order_by"] | undefined,
	disabled?: GraphQLTypes["order_by"] | undefined,
	displayName?: GraphQLTypes["order_by"] | undefined,
	email?: GraphQLTypes["order_by"] | undefined,
	emailVerified?: GraphQLTypes["order_by"] | undefined,
	events_aggregate?: GraphQLTypes["events_aggregate_order_by"] | undefined,
	id?: GraphQLTypes["order_by"] | undefined,
	installations_aggregate?: GraphQLTypes["installations_aggregate_order_by"] | undefined,
	isAnonymous?: GraphQLTypes["order_by"] | undefined,
	lastSeen?: GraphQLTypes["order_by"] | undefined,
	locale?: GraphQLTypes["order_by"] | undefined,
	metadata?: GraphQLTypes["order_by"] | undefined,
	newEmail?: GraphQLTypes["order_by"] | undefined,
	otpHash?: GraphQLTypes["order_by"] | undefined,
	otpHashExpiresAt?: GraphQLTypes["order_by"] | undefined,
	otpMethodLastUsed?: GraphQLTypes["order_by"] | undefined,
	passwordHash?: GraphQLTypes["order_by"] | undefined,
	phoneNumber?: GraphQLTypes["order_by"] | undefined,
	phoneNumberVerified?: GraphQLTypes["order_by"] | undefined,
	refreshTokens_aggregate?: GraphQLTypes["authRefreshTokens_aggregate_order_by"] | undefined,
	roles_aggregate?: GraphQLTypes["authUserRoles_aggregate_order_by"] | undefined,
	securityKeys_aggregate?: GraphQLTypes["authUserSecurityKeys_aggregate_order_by"] | undefined,
	ticket?: GraphQLTypes["order_by"] | undefined,
	ticketExpiresAt?: GraphQLTypes["order_by"] | undefined,
	totpSecret?: GraphQLTypes["order_by"] | undefined,
	updatedAt?: GraphQLTypes["order_by"] | undefined,
	userProviders_aggregate?: GraphQLTypes["authUserProviders_aggregate_order_by"] | undefined
};
	/** primary key columns input for table: auth.users */
["users_pk_columns_input"]: {
		id: GraphQLTypes["uuid"]
};
	/** prepend existing jsonb value of filtered columns with new jsonb value */
["users_prepend_input"]: {
		metadata?: GraphQLTypes["jsonb"] | undefined
};
	/** select columns of table "auth.users" */
["users_select_column"]: users_select_column;
	/** select "users_aggregate_bool_exp_bool_and_arguments_columns" columns of table "auth.users" */
["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"]: users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns;
	/** select "users_aggregate_bool_exp_bool_or_arguments_columns" columns of table "auth.users" */
["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"]: users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns;
	/** input type for updating data in table "auth.users" */
["users_set_input"]: {
		activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	disabled?: boolean | undefined,
	displayName?: string | undefined,
	email?: GraphQLTypes["citext"] | undefined,
	emailVerified?: boolean | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isAnonymous?: boolean | undefined,
	lastSeen?: GraphQLTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	metadata?: GraphQLTypes["jsonb"] | undefined,
	newEmail?: GraphQLTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified?: boolean | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** Streaming cursor of the table "users" */
["users_stream_cursor_input"]: {
		/** Stream column input with initial value */
	initial_value: GraphQLTypes["users_stream_cursor_value_input"],
	/** cursor ordering */
	ordering?: GraphQLTypes["cursor_ordering"] | undefined
};
	/** Initial value of the column from where the streaming should start */
["users_stream_cursor_value_input"]: {
		activeMfaType?: string | undefined,
	avatarUrl?: string | undefined,
	createdAt?: GraphQLTypes["timestamptz"] | undefined,
	currentChallenge?: string | undefined,
	defaultRole?: string | undefined,
	disabled?: boolean | undefined,
	displayName?: string | undefined,
	email?: GraphQLTypes["citext"] | undefined,
	emailVerified?: boolean | undefined,
	id?: GraphQLTypes["uuid"] | undefined,
	isAnonymous?: boolean | undefined,
	lastSeen?: GraphQLTypes["timestamptz"] | undefined,
	locale?: string | undefined,
	metadata?: GraphQLTypes["jsonb"] | undefined,
	newEmail?: GraphQLTypes["citext"] | undefined,
	otpHash?: string | undefined,
	otpHashExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	otpMethodLastUsed?: string | undefined,
	passwordHash?: string | undefined,
	phoneNumber?: string | undefined,
	phoneNumberVerified?: boolean | undefined,
	ticket?: string | undefined,
	ticketExpiresAt?: GraphQLTypes["timestamptz"] | undefined,
	totpSecret?: string | undefined,
	updatedAt?: GraphQLTypes["timestamptz"] | undefined
};
	/** update columns of table "auth.users" */
["users_update_column"]: users_update_column;
	["users_updates"]: {
		/** append existing jsonb value of filtered columns with new jsonb value */
	_append?: GraphQLTypes["users_append_input"] | undefined,
	/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
	_delete_at_path?: GraphQLTypes["users_delete_at_path_input"] | undefined,
	/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
	_delete_elem?: GraphQLTypes["users_delete_elem_input"] | undefined,
	/** delete key/value pair or string element. key/value pairs are matched based on their key value */
	_delete_key?: GraphQLTypes["users_delete_key_input"] | undefined,
	/** prepend existing jsonb value of filtered columns with new jsonb value */
	_prepend?: GraphQLTypes["users_prepend_input"] | undefined,
	/** sets the columns of the filtered rows to the given values */
	_set?: GraphQLTypes["users_set_input"] | undefined,
	/** filter the rows which have to be updated */
	where: GraphQLTypes["users_bool_exp"]
};
	["uuid"]: "scalar" & { name: "uuid" };
	/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
["uuid_comparison_exp"]: {
		_eq?: GraphQLTypes["uuid"] | undefined,
	_gt?: GraphQLTypes["uuid"] | undefined,
	_gte?: GraphQLTypes["uuid"] | undefined,
	_in?: Array<GraphQLTypes["uuid"]> | undefined,
	_is_null?: boolean | undefined,
	_lt?: GraphQLTypes["uuid"] | undefined,
	_lte?: GraphQLTypes["uuid"] | undefined,
	_neq?: GraphQLTypes["uuid"] | undefined,
	_nin?: Array<GraphQLTypes["uuid"]> | undefined
}
    }
/** unique or primary key constraints on table "auth.provider_requests" */
export const enum authProviderRequests_constraint {
	provider_requests_pkey = "provider_requests_pkey"
}
/** select columns of table "auth.provider_requests" */
export const enum authProviderRequests_select_column {
	id = "id",
	options = "options"
}
/** update columns of table "auth.provider_requests" */
export const enum authProviderRequests_update_column {
	id = "id",
	options = "options"
}
/** unique or primary key constraints on table "auth.providers" */
export const enum authProviders_constraint {
	providers_pkey = "providers_pkey"
}
/** select columns of table "auth.providers" */
export const enum authProviders_select_column {
	id = "id"
}
/** update columns of table "auth.providers" */
export const enum authProviders_update_column {
	id = "id"
}
/** unique or primary key constraints on table "auth.refresh_token_types" */
export const enum authRefreshTokenTypes_constraint {
	refresh_token_types_pkey = "refresh_token_types_pkey"
}
export const enum authRefreshTokenTypes_enum {
	pat = "pat",
	regular = "regular"
}
/** select columns of table "auth.refresh_token_types" */
export const enum authRefreshTokenTypes_select_column {
	comment = "comment",
	value = "value"
}
/** update columns of table "auth.refresh_token_types" */
export const enum authRefreshTokenTypes_update_column {
	comment = "comment",
	value = "value"
}
/** unique or primary key constraints on table "auth.refresh_tokens" */
export const enum authRefreshTokens_constraint {
	refresh_tokens_pkey = "refresh_tokens_pkey"
}
/** select columns of table "auth.refresh_tokens" */
export const enum authRefreshTokens_select_column {
	createdAt = "createdAt",
	expiresAt = "expiresAt",
	id = "id",
	metadata = "metadata",
	refreshTokenHash = "refreshTokenHash",
	type = "type",
	userId = "userId"
}
/** update columns of table "auth.refresh_tokens" */
export const enum authRefreshTokens_update_column {
	createdAt = "createdAt",
	expiresAt = "expiresAt",
	id = "id",
	metadata = "metadata",
	refreshTokenHash = "refreshTokenHash",
	type = "type",
	userId = "userId"
}
/** unique or primary key constraints on table "auth.roles" */
export const enum authRoles_constraint {
	roles_pkey = "roles_pkey"
}
/** select columns of table "auth.roles" */
export const enum authRoles_select_column {
	role = "role"
}
/** update columns of table "auth.roles" */
export const enum authRoles_update_column {
	role = "role"
}
/** unique or primary key constraints on table "auth.user_providers" */
export const enum authUserProviders_constraint {
	user_providers_pkey = "user_providers_pkey",
	user_providers_provider_id_provider_user_id_key = "user_providers_provider_id_provider_user_id_key",
	user_providers_user_id_provider_id_key = "user_providers_user_id_provider_id_key"
}
/** select columns of table "auth.user_providers" */
export const enum authUserProviders_select_column {
	accessToken = "accessToken",
	createdAt = "createdAt",
	id = "id",
	providerId = "providerId",
	providerUserId = "providerUserId",
	refreshToken = "refreshToken",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** update columns of table "auth.user_providers" */
export const enum authUserProviders_update_column {
	accessToken = "accessToken",
	createdAt = "createdAt",
	id = "id",
	providerId = "providerId",
	providerUserId = "providerUserId",
	refreshToken = "refreshToken",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** unique or primary key constraints on table "auth.user_roles" */
export const enum authUserRoles_constraint {
	user_roles_pkey = "user_roles_pkey",
	user_roles_user_id_role_key = "user_roles_user_id_role_key"
}
/** select columns of table "auth.user_roles" */
export const enum authUserRoles_select_column {
	createdAt = "createdAt",
	id = "id",
	role = "role",
	userId = "userId"
}
/** update columns of table "auth.user_roles" */
export const enum authUserRoles_update_column {
	createdAt = "createdAt",
	id = "id",
	role = "role",
	userId = "userId"
}
/** unique or primary key constraints on table "auth.user_security_keys" */
export const enum authUserSecurityKeys_constraint {
	user_security_key_credential_id_key = "user_security_key_credential_id_key",
	user_security_keys_pkey = "user_security_keys_pkey"
}
/** select columns of table "auth.user_security_keys" */
export const enum authUserSecurityKeys_select_column {
	counter = "counter",
	credentialId = "credentialId",
	credentialPublicKey = "credentialPublicKey",
	id = "id",
	nickname = "nickname",
	transports = "transports",
	userId = "userId"
}
/** update columns of table "auth.user_security_keys" */
export const enum authUserSecurityKeys_update_column {
	counter = "counter",
	credentialId = "credentialId",
	credentialPublicKey = "credentialPublicKey",
	id = "id",
	nickname = "nickname",
	transports = "transports",
	userId = "userId"
}
/** unique or primary key constraints on table "storage.buckets" */
export const enum buckets_constraint {
	buckets_pkey = "buckets_pkey"
}
/** select columns of table "storage.buckets" */
export const enum buckets_select_column {
	cacheControl = "cacheControl",
	createdAt = "createdAt",
	downloadExpiration = "downloadExpiration",
	id = "id",
	maxUploadFileSize = "maxUploadFileSize",
	minUploadFileSize = "minUploadFileSize",
	presignedUrlsEnabled = "presignedUrlsEnabled",
	updatedAt = "updatedAt"
}
/** update columns of table "storage.buckets" */
export const enum buckets_update_column {
	cacheControl = "cacheControl",
	createdAt = "createdAt",
	downloadExpiration = "downloadExpiration",
	id = "id",
	maxUploadFileSize = "maxUploadFileSize",
	minUploadFileSize = "minUploadFileSize",
	presignedUrlsEnabled = "presignedUrlsEnabled",
	updatedAt = "updatedAt"
}
/** ordering argument of a cursor */
export const enum cursor_ordering {
	ASC = "ASC",
	DESC = "DESC"
}
/** unique or primary key constraints on table "event_files" */
export const enum event_files_constraint {
	event_files_pkey = "event_files_pkey"
}
/** select columns of table "event_files" */
export const enum event_files_select_column {
	createdAt = "createdAt",
	eventId = "eventId",
	fileId = "fileId",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** update columns of table "event_files" */
export const enum event_files_update_column {
	createdAt = "createdAt",
	eventId = "eventId",
	fileId = "fileId",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** unique or primary key constraints on table "event_participants" */
export const enum event_participants_constraint {
	event_participants_pkey = "event_participants_pkey"
}
/** select columns of table "event_participants" */
export const enum event_participants_select_column {
	createdAt = "createdAt",
	eventId = "eventId",
	role = "role",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** update columns of table "event_participants" */
export const enum event_participants_update_column {
	createdAt = "createdAt",
	eventId = "eventId",
	role = "role",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** unique or primary key constraints on table "events" */
export const enum events_constraint {
	events_pkey = "events_pkey"
}
/** select columns of table "events" */
export const enum events_select_column {
	createdAt = "createdAt",
	creatorId = "creatorId",
	endAt = "endAt",
	id = "id",
	name = "name",
	params = "params",
	slug = "slug",
	startAt = "startAt",
	updatedAt = "updatedAt"
}
/** update columns of table "events" */
export const enum events_update_column {
	createdAt = "createdAt",
	creatorId = "creatorId",
	endAt = "endAt",
	id = "id",
	name = "name",
	params = "params",
	slug = "slug",
	startAt = "startAt",
	updatedAt = "updatedAt"
}
/** unique or primary key constraints on table "storage.files" */
export const enum files_constraint {
	files_pkey = "files_pkey"
}
/** select columns of table "storage.files" */
export const enum files_select_column {
	bucketId = "bucketId",
	createdAt = "createdAt",
	etag = "etag",
	id = "id",
	isUploaded = "isUploaded",
	mimeType = "mimeType",
	name = "name",
	size = "size",
	updatedAt = "updatedAt",
	uploadedByUserId = "uploadedByUserId"
}
/** select "files_aggregate_bool_exp_bool_and_arguments_columns" columns of table "storage.files" */
export const enum files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns {
	isUploaded = "isUploaded"
}
/** select "files_aggregate_bool_exp_bool_or_arguments_columns" columns of table "storage.files" */
export const enum files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns {
	isUploaded = "isUploaded"
}
/** update columns of table "storage.files" */
export const enum files_update_column {
	bucketId = "bucketId",
	createdAt = "createdAt",
	etag = "etag",
	id = "id",
	isUploaded = "isUploaded",
	mimeType = "mimeType",
	name = "name",
	size = "size",
	updatedAt = "updatedAt",
	uploadedByUserId = "uploadedByUserId"
}
/** unique or primary key constraints on table "installations" */
export const enum installations_constraint {
	installations_pkey = "installations_pkey"
}
/** select columns of table "installations" */
export const enum installations_select_column {
	appIdentifier = "appIdentifier",
	appVersion = "appVersion",
	createdAt = "createdAt",
	deviceLocale = "deviceLocale",
	deviceName = "deviceName",
	deviceType = "deviceType",
	id = "id",
	isActive = "isActive",
	osName = "osName",
	osVersion = "osVersion",
	pushToken = "pushToken",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** select "installations_aggregate_bool_exp_bool_and_arguments_columns" columns of table "installations" */
export const enum installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns {
	isActive = "isActive"
}
/** select "installations_aggregate_bool_exp_bool_or_arguments_columns" columns of table "installations" */
export const enum installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns {
	isActive = "isActive"
}
/** update columns of table "installations" */
export const enum installations_update_column {
	appIdentifier = "appIdentifier",
	appVersion = "appVersion",
	createdAt = "createdAt",
	deviceLocale = "deviceLocale",
	deviceName = "deviceName",
	deviceType = "deviceType",
	id = "id",
	isActive = "isActive",
	osName = "osName",
	osVersion = "osVersion",
	pushToken = "pushToken",
	updatedAt = "updatedAt",
	userId = "userId"
}
/** column ordering options */
export const enum order_by {
	asc = "asc",
	asc_nulls_first = "asc_nulls_first",
	asc_nulls_last = "asc_nulls_last",
	desc = "desc",
	desc_nulls_first = "desc_nulls_first",
	desc_nulls_last = "desc_nulls_last"
}
/** unique or primary key constraints on table "user_files" */
export const enum user_files_constraint {
	user_files_pkey = "user_files_pkey"
}
/** select columns of table "user_files" */
export const enum user_files_select_column {
	fileId = "fileId",
	userId = "userId"
}
/** update columns of table "user_files" */
export const enum user_files_update_column {
	fileId = "fileId",
	userId = "userId"
}
/** unique or primary key constraints on table "auth.users" */
export const enum users_constraint {
	users_email_key = "users_email_key",
	users_phone_number_key = "users_phone_number_key",
	users_pkey = "users_pkey"
}
/** select columns of table "auth.users" */
export const enum users_select_column {
	activeMfaType = "activeMfaType",
	avatarUrl = "avatarUrl",
	createdAt = "createdAt",
	currentChallenge = "currentChallenge",
	defaultRole = "defaultRole",
	disabled = "disabled",
	displayName = "displayName",
	email = "email",
	emailVerified = "emailVerified",
	id = "id",
	isAnonymous = "isAnonymous",
	lastSeen = "lastSeen",
	locale = "locale",
	metadata = "metadata",
	newEmail = "newEmail",
	otpHash = "otpHash",
	otpHashExpiresAt = "otpHashExpiresAt",
	otpMethodLastUsed = "otpMethodLastUsed",
	passwordHash = "passwordHash",
	phoneNumber = "phoneNumber",
	phoneNumberVerified = "phoneNumberVerified",
	ticket = "ticket",
	ticketExpiresAt = "ticketExpiresAt",
	totpSecret = "totpSecret",
	updatedAt = "updatedAt"
}
/** select "users_aggregate_bool_exp_bool_and_arguments_columns" columns of table "auth.users" */
export const enum users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns {
	disabled = "disabled",
	emailVerified = "emailVerified",
	isAnonymous = "isAnonymous",
	phoneNumberVerified = "phoneNumberVerified"
}
/** select "users_aggregate_bool_exp_bool_or_arguments_columns" columns of table "auth.users" */
export const enum users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns {
	disabled = "disabled",
	emailVerified = "emailVerified",
	isAnonymous = "isAnonymous",
	phoneNumberVerified = "phoneNumberVerified"
}
/** update columns of table "auth.users" */
export const enum users_update_column {
	activeMfaType = "activeMfaType",
	avatarUrl = "avatarUrl",
	createdAt = "createdAt",
	currentChallenge = "currentChallenge",
	defaultRole = "defaultRole",
	disabled = "disabled",
	displayName = "displayName",
	email = "email",
	emailVerified = "emailVerified",
	id = "id",
	isAnonymous = "isAnonymous",
	lastSeen = "lastSeen",
	locale = "locale",
	metadata = "metadata",
	newEmail = "newEmail",
	otpHash = "otpHash",
	otpHashExpiresAt = "otpHashExpiresAt",
	otpMethodLastUsed = "otpMethodLastUsed",
	passwordHash = "passwordHash",
	phoneNumber = "phoneNumber",
	phoneNumberVerified = "phoneNumberVerified",
	ticket = "ticket",
	ticketExpiresAt = "ticketExpiresAt",
	totpSecret = "totpSecret",
	updatedAt = "updatedAt"
}

type ZEUS_VARIABLES = {
	["Boolean_comparison_exp"]: ValueTypes["Boolean_comparison_exp"];
	["Int_comparison_exp"]: ValueTypes["Int_comparison_exp"];
	["String_comparison_exp"]: ValueTypes["String_comparison_exp"];
	["authProviderRequests_append_input"]: ValueTypes["authProviderRequests_append_input"];
	["authProviderRequests_bool_exp"]: ValueTypes["authProviderRequests_bool_exp"];
	["authProviderRequests_constraint"]: ValueTypes["authProviderRequests_constraint"];
	["authProviderRequests_delete_at_path_input"]: ValueTypes["authProviderRequests_delete_at_path_input"];
	["authProviderRequests_delete_elem_input"]: ValueTypes["authProviderRequests_delete_elem_input"];
	["authProviderRequests_delete_key_input"]: ValueTypes["authProviderRequests_delete_key_input"];
	["authProviderRequests_insert_input"]: ValueTypes["authProviderRequests_insert_input"];
	["authProviderRequests_on_conflict"]: ValueTypes["authProviderRequests_on_conflict"];
	["authProviderRequests_order_by"]: ValueTypes["authProviderRequests_order_by"];
	["authProviderRequests_pk_columns_input"]: ValueTypes["authProviderRequests_pk_columns_input"];
	["authProviderRequests_prepend_input"]: ValueTypes["authProviderRequests_prepend_input"];
	["authProviderRequests_select_column"]: ValueTypes["authProviderRequests_select_column"];
	["authProviderRequests_set_input"]: ValueTypes["authProviderRequests_set_input"];
	["authProviderRequests_stream_cursor_input"]: ValueTypes["authProviderRequests_stream_cursor_input"];
	["authProviderRequests_stream_cursor_value_input"]: ValueTypes["authProviderRequests_stream_cursor_value_input"];
	["authProviderRequests_update_column"]: ValueTypes["authProviderRequests_update_column"];
	["authProviderRequests_updates"]: ValueTypes["authProviderRequests_updates"];
	["authProviders_bool_exp"]: ValueTypes["authProviders_bool_exp"];
	["authProviders_constraint"]: ValueTypes["authProviders_constraint"];
	["authProviders_insert_input"]: ValueTypes["authProviders_insert_input"];
	["authProviders_obj_rel_insert_input"]: ValueTypes["authProviders_obj_rel_insert_input"];
	["authProviders_on_conflict"]: ValueTypes["authProviders_on_conflict"];
	["authProviders_order_by"]: ValueTypes["authProviders_order_by"];
	["authProviders_pk_columns_input"]: ValueTypes["authProviders_pk_columns_input"];
	["authProviders_select_column"]: ValueTypes["authProviders_select_column"];
	["authProviders_set_input"]: ValueTypes["authProviders_set_input"];
	["authProviders_stream_cursor_input"]: ValueTypes["authProviders_stream_cursor_input"];
	["authProviders_stream_cursor_value_input"]: ValueTypes["authProviders_stream_cursor_value_input"];
	["authProviders_update_column"]: ValueTypes["authProviders_update_column"];
	["authProviders_updates"]: ValueTypes["authProviders_updates"];
	["authRefreshTokenTypes_bool_exp"]: ValueTypes["authRefreshTokenTypes_bool_exp"];
	["authRefreshTokenTypes_constraint"]: ValueTypes["authRefreshTokenTypes_constraint"];
	["authRefreshTokenTypes_enum"]: ValueTypes["authRefreshTokenTypes_enum"];
	["authRefreshTokenTypes_enum_comparison_exp"]: ValueTypes["authRefreshTokenTypes_enum_comparison_exp"];
	["authRefreshTokenTypes_insert_input"]: ValueTypes["authRefreshTokenTypes_insert_input"];
	["authRefreshTokenTypes_on_conflict"]: ValueTypes["authRefreshTokenTypes_on_conflict"];
	["authRefreshTokenTypes_order_by"]: ValueTypes["authRefreshTokenTypes_order_by"];
	["authRefreshTokenTypes_pk_columns_input"]: ValueTypes["authRefreshTokenTypes_pk_columns_input"];
	["authRefreshTokenTypes_select_column"]: ValueTypes["authRefreshTokenTypes_select_column"];
	["authRefreshTokenTypes_set_input"]: ValueTypes["authRefreshTokenTypes_set_input"];
	["authRefreshTokenTypes_stream_cursor_input"]: ValueTypes["authRefreshTokenTypes_stream_cursor_input"];
	["authRefreshTokenTypes_stream_cursor_value_input"]: ValueTypes["authRefreshTokenTypes_stream_cursor_value_input"];
	["authRefreshTokenTypes_update_column"]: ValueTypes["authRefreshTokenTypes_update_column"];
	["authRefreshTokenTypes_updates"]: ValueTypes["authRefreshTokenTypes_updates"];
	["authRefreshTokens_aggregate_bool_exp"]: ValueTypes["authRefreshTokens_aggregate_bool_exp"];
	["authRefreshTokens_aggregate_bool_exp_count"]: ValueTypes["authRefreshTokens_aggregate_bool_exp_count"];
	["authRefreshTokens_aggregate_order_by"]: ValueTypes["authRefreshTokens_aggregate_order_by"];
	["authRefreshTokens_append_input"]: ValueTypes["authRefreshTokens_append_input"];
	["authRefreshTokens_arr_rel_insert_input"]: ValueTypes["authRefreshTokens_arr_rel_insert_input"];
	["authRefreshTokens_bool_exp"]: ValueTypes["authRefreshTokens_bool_exp"];
	["authRefreshTokens_constraint"]: ValueTypes["authRefreshTokens_constraint"];
	["authRefreshTokens_delete_at_path_input"]: ValueTypes["authRefreshTokens_delete_at_path_input"];
	["authRefreshTokens_delete_elem_input"]: ValueTypes["authRefreshTokens_delete_elem_input"];
	["authRefreshTokens_delete_key_input"]: ValueTypes["authRefreshTokens_delete_key_input"];
	["authRefreshTokens_insert_input"]: ValueTypes["authRefreshTokens_insert_input"];
	["authRefreshTokens_max_order_by"]: ValueTypes["authRefreshTokens_max_order_by"];
	["authRefreshTokens_min_order_by"]: ValueTypes["authRefreshTokens_min_order_by"];
	["authRefreshTokens_on_conflict"]: ValueTypes["authRefreshTokens_on_conflict"];
	["authRefreshTokens_order_by"]: ValueTypes["authRefreshTokens_order_by"];
	["authRefreshTokens_pk_columns_input"]: ValueTypes["authRefreshTokens_pk_columns_input"];
	["authRefreshTokens_prepend_input"]: ValueTypes["authRefreshTokens_prepend_input"];
	["authRefreshTokens_select_column"]: ValueTypes["authRefreshTokens_select_column"];
	["authRefreshTokens_set_input"]: ValueTypes["authRefreshTokens_set_input"];
	["authRefreshTokens_stream_cursor_input"]: ValueTypes["authRefreshTokens_stream_cursor_input"];
	["authRefreshTokens_stream_cursor_value_input"]: ValueTypes["authRefreshTokens_stream_cursor_value_input"];
	["authRefreshTokens_update_column"]: ValueTypes["authRefreshTokens_update_column"];
	["authRefreshTokens_updates"]: ValueTypes["authRefreshTokens_updates"];
	["authRoles_bool_exp"]: ValueTypes["authRoles_bool_exp"];
	["authRoles_constraint"]: ValueTypes["authRoles_constraint"];
	["authRoles_insert_input"]: ValueTypes["authRoles_insert_input"];
	["authRoles_obj_rel_insert_input"]: ValueTypes["authRoles_obj_rel_insert_input"];
	["authRoles_on_conflict"]: ValueTypes["authRoles_on_conflict"];
	["authRoles_order_by"]: ValueTypes["authRoles_order_by"];
	["authRoles_pk_columns_input"]: ValueTypes["authRoles_pk_columns_input"];
	["authRoles_select_column"]: ValueTypes["authRoles_select_column"];
	["authRoles_set_input"]: ValueTypes["authRoles_set_input"];
	["authRoles_stream_cursor_input"]: ValueTypes["authRoles_stream_cursor_input"];
	["authRoles_stream_cursor_value_input"]: ValueTypes["authRoles_stream_cursor_value_input"];
	["authRoles_update_column"]: ValueTypes["authRoles_update_column"];
	["authRoles_updates"]: ValueTypes["authRoles_updates"];
	["authUserProviders_aggregate_bool_exp"]: ValueTypes["authUserProviders_aggregate_bool_exp"];
	["authUserProviders_aggregate_bool_exp_count"]: ValueTypes["authUserProviders_aggregate_bool_exp_count"];
	["authUserProviders_aggregate_order_by"]: ValueTypes["authUserProviders_aggregate_order_by"];
	["authUserProviders_arr_rel_insert_input"]: ValueTypes["authUserProviders_arr_rel_insert_input"];
	["authUserProviders_bool_exp"]: ValueTypes["authUserProviders_bool_exp"];
	["authUserProviders_constraint"]: ValueTypes["authUserProviders_constraint"];
	["authUserProviders_insert_input"]: ValueTypes["authUserProviders_insert_input"];
	["authUserProviders_max_order_by"]: ValueTypes["authUserProviders_max_order_by"];
	["authUserProviders_min_order_by"]: ValueTypes["authUserProviders_min_order_by"];
	["authUserProviders_on_conflict"]: ValueTypes["authUserProviders_on_conflict"];
	["authUserProviders_order_by"]: ValueTypes["authUserProviders_order_by"];
	["authUserProviders_pk_columns_input"]: ValueTypes["authUserProviders_pk_columns_input"];
	["authUserProviders_select_column"]: ValueTypes["authUserProviders_select_column"];
	["authUserProviders_set_input"]: ValueTypes["authUserProviders_set_input"];
	["authUserProviders_stream_cursor_input"]: ValueTypes["authUserProviders_stream_cursor_input"];
	["authUserProviders_stream_cursor_value_input"]: ValueTypes["authUserProviders_stream_cursor_value_input"];
	["authUserProviders_update_column"]: ValueTypes["authUserProviders_update_column"];
	["authUserProviders_updates"]: ValueTypes["authUserProviders_updates"];
	["authUserRoles_aggregate_bool_exp"]: ValueTypes["authUserRoles_aggregate_bool_exp"];
	["authUserRoles_aggregate_bool_exp_count"]: ValueTypes["authUserRoles_aggregate_bool_exp_count"];
	["authUserRoles_aggregate_order_by"]: ValueTypes["authUserRoles_aggregate_order_by"];
	["authUserRoles_arr_rel_insert_input"]: ValueTypes["authUserRoles_arr_rel_insert_input"];
	["authUserRoles_bool_exp"]: ValueTypes["authUserRoles_bool_exp"];
	["authUserRoles_constraint"]: ValueTypes["authUserRoles_constraint"];
	["authUserRoles_insert_input"]: ValueTypes["authUserRoles_insert_input"];
	["authUserRoles_max_order_by"]: ValueTypes["authUserRoles_max_order_by"];
	["authUserRoles_min_order_by"]: ValueTypes["authUserRoles_min_order_by"];
	["authUserRoles_on_conflict"]: ValueTypes["authUserRoles_on_conflict"];
	["authUserRoles_order_by"]: ValueTypes["authUserRoles_order_by"];
	["authUserRoles_pk_columns_input"]: ValueTypes["authUserRoles_pk_columns_input"];
	["authUserRoles_select_column"]: ValueTypes["authUserRoles_select_column"];
	["authUserRoles_set_input"]: ValueTypes["authUserRoles_set_input"];
	["authUserRoles_stream_cursor_input"]: ValueTypes["authUserRoles_stream_cursor_input"];
	["authUserRoles_stream_cursor_value_input"]: ValueTypes["authUserRoles_stream_cursor_value_input"];
	["authUserRoles_update_column"]: ValueTypes["authUserRoles_update_column"];
	["authUserRoles_updates"]: ValueTypes["authUserRoles_updates"];
	["authUserSecurityKeys_aggregate_bool_exp"]: ValueTypes["authUserSecurityKeys_aggregate_bool_exp"];
	["authUserSecurityKeys_aggregate_bool_exp_count"]: ValueTypes["authUserSecurityKeys_aggregate_bool_exp_count"];
	["authUserSecurityKeys_aggregate_order_by"]: ValueTypes["authUserSecurityKeys_aggregate_order_by"];
	["authUserSecurityKeys_arr_rel_insert_input"]: ValueTypes["authUserSecurityKeys_arr_rel_insert_input"];
	["authUserSecurityKeys_avg_order_by"]: ValueTypes["authUserSecurityKeys_avg_order_by"];
	["authUserSecurityKeys_bool_exp"]: ValueTypes["authUserSecurityKeys_bool_exp"];
	["authUserSecurityKeys_constraint"]: ValueTypes["authUserSecurityKeys_constraint"];
	["authUserSecurityKeys_inc_input"]: ValueTypes["authUserSecurityKeys_inc_input"];
	["authUserSecurityKeys_insert_input"]: ValueTypes["authUserSecurityKeys_insert_input"];
	["authUserSecurityKeys_max_order_by"]: ValueTypes["authUserSecurityKeys_max_order_by"];
	["authUserSecurityKeys_min_order_by"]: ValueTypes["authUserSecurityKeys_min_order_by"];
	["authUserSecurityKeys_on_conflict"]: ValueTypes["authUserSecurityKeys_on_conflict"];
	["authUserSecurityKeys_order_by"]: ValueTypes["authUserSecurityKeys_order_by"];
	["authUserSecurityKeys_pk_columns_input"]: ValueTypes["authUserSecurityKeys_pk_columns_input"];
	["authUserSecurityKeys_select_column"]: ValueTypes["authUserSecurityKeys_select_column"];
	["authUserSecurityKeys_set_input"]: ValueTypes["authUserSecurityKeys_set_input"];
	["authUserSecurityKeys_stddev_order_by"]: ValueTypes["authUserSecurityKeys_stddev_order_by"];
	["authUserSecurityKeys_stddev_pop_order_by"]: ValueTypes["authUserSecurityKeys_stddev_pop_order_by"];
	["authUserSecurityKeys_stddev_samp_order_by"]: ValueTypes["authUserSecurityKeys_stddev_samp_order_by"];
	["authUserSecurityKeys_stream_cursor_input"]: ValueTypes["authUserSecurityKeys_stream_cursor_input"];
	["authUserSecurityKeys_stream_cursor_value_input"]: ValueTypes["authUserSecurityKeys_stream_cursor_value_input"];
	["authUserSecurityKeys_sum_order_by"]: ValueTypes["authUserSecurityKeys_sum_order_by"];
	["authUserSecurityKeys_update_column"]: ValueTypes["authUserSecurityKeys_update_column"];
	["authUserSecurityKeys_updates"]: ValueTypes["authUserSecurityKeys_updates"];
	["authUserSecurityKeys_var_pop_order_by"]: ValueTypes["authUserSecurityKeys_var_pop_order_by"];
	["authUserSecurityKeys_var_samp_order_by"]: ValueTypes["authUserSecurityKeys_var_samp_order_by"];
	["authUserSecurityKeys_variance_order_by"]: ValueTypes["authUserSecurityKeys_variance_order_by"];
	["bigint"]: ValueTypes["bigint"];
	["bigint_comparison_exp"]: ValueTypes["bigint_comparison_exp"];
	["buckets_bool_exp"]: ValueTypes["buckets_bool_exp"];
	["buckets_constraint"]: ValueTypes["buckets_constraint"];
	["buckets_inc_input"]: ValueTypes["buckets_inc_input"];
	["buckets_insert_input"]: ValueTypes["buckets_insert_input"];
	["buckets_obj_rel_insert_input"]: ValueTypes["buckets_obj_rel_insert_input"];
	["buckets_on_conflict"]: ValueTypes["buckets_on_conflict"];
	["buckets_order_by"]: ValueTypes["buckets_order_by"];
	["buckets_pk_columns_input"]: ValueTypes["buckets_pk_columns_input"];
	["buckets_select_column"]: ValueTypes["buckets_select_column"];
	["buckets_set_input"]: ValueTypes["buckets_set_input"];
	["buckets_stream_cursor_input"]: ValueTypes["buckets_stream_cursor_input"];
	["buckets_stream_cursor_value_input"]: ValueTypes["buckets_stream_cursor_value_input"];
	["buckets_update_column"]: ValueTypes["buckets_update_column"];
	["buckets_updates"]: ValueTypes["buckets_updates"];
	["bytea"]: ValueTypes["bytea"];
	["bytea_comparison_exp"]: ValueTypes["bytea_comparison_exp"];
	["citext"]: ValueTypes["citext"];
	["citext_comparison_exp"]: ValueTypes["citext_comparison_exp"];
	["cursor_ordering"]: ValueTypes["cursor_ordering"];
	["event_files_aggregate_bool_exp"]: ValueTypes["event_files_aggregate_bool_exp"];
	["event_files_aggregate_bool_exp_count"]: ValueTypes["event_files_aggregate_bool_exp_count"];
	["event_files_aggregate_order_by"]: ValueTypes["event_files_aggregate_order_by"];
	["event_files_arr_rel_insert_input"]: ValueTypes["event_files_arr_rel_insert_input"];
	["event_files_bool_exp"]: ValueTypes["event_files_bool_exp"];
	["event_files_constraint"]: ValueTypes["event_files_constraint"];
	["event_files_insert_input"]: ValueTypes["event_files_insert_input"];
	["event_files_max_order_by"]: ValueTypes["event_files_max_order_by"];
	["event_files_min_order_by"]: ValueTypes["event_files_min_order_by"];
	["event_files_on_conflict"]: ValueTypes["event_files_on_conflict"];
	["event_files_order_by"]: ValueTypes["event_files_order_by"];
	["event_files_pk_columns_input"]: ValueTypes["event_files_pk_columns_input"];
	["event_files_select_column"]: ValueTypes["event_files_select_column"];
	["event_files_set_input"]: ValueTypes["event_files_set_input"];
	["event_files_stream_cursor_input"]: ValueTypes["event_files_stream_cursor_input"];
	["event_files_stream_cursor_value_input"]: ValueTypes["event_files_stream_cursor_value_input"];
	["event_files_update_column"]: ValueTypes["event_files_update_column"];
	["event_files_updates"]: ValueTypes["event_files_updates"];
	["event_participants_aggregate_bool_exp"]: ValueTypes["event_participants_aggregate_bool_exp"];
	["event_participants_aggregate_bool_exp_count"]: ValueTypes["event_participants_aggregate_bool_exp_count"];
	["event_participants_aggregate_order_by"]: ValueTypes["event_participants_aggregate_order_by"];
	["event_participants_arr_rel_insert_input"]: ValueTypes["event_participants_arr_rel_insert_input"];
	["event_participants_bool_exp"]: ValueTypes["event_participants_bool_exp"];
	["event_participants_constraint"]: ValueTypes["event_participants_constraint"];
	["event_participants_insert_input"]: ValueTypes["event_participants_insert_input"];
	["event_participants_max_order_by"]: ValueTypes["event_participants_max_order_by"];
	["event_participants_min_order_by"]: ValueTypes["event_participants_min_order_by"];
	["event_participants_on_conflict"]: ValueTypes["event_participants_on_conflict"];
	["event_participants_order_by"]: ValueTypes["event_participants_order_by"];
	["event_participants_pk_columns_input"]: ValueTypes["event_participants_pk_columns_input"];
	["event_participants_select_column"]: ValueTypes["event_participants_select_column"];
	["event_participants_set_input"]: ValueTypes["event_participants_set_input"];
	["event_participants_stream_cursor_input"]: ValueTypes["event_participants_stream_cursor_input"];
	["event_participants_stream_cursor_value_input"]: ValueTypes["event_participants_stream_cursor_value_input"];
	["event_participants_update_column"]: ValueTypes["event_participants_update_column"];
	["event_participants_updates"]: ValueTypes["event_participants_updates"];
	["events_aggregate_bool_exp"]: ValueTypes["events_aggregate_bool_exp"];
	["events_aggregate_bool_exp_count"]: ValueTypes["events_aggregate_bool_exp_count"];
	["events_aggregate_order_by"]: ValueTypes["events_aggregate_order_by"];
	["events_append_input"]: ValueTypes["events_append_input"];
	["events_arr_rel_insert_input"]: ValueTypes["events_arr_rel_insert_input"];
	["events_bool_exp"]: ValueTypes["events_bool_exp"];
	["events_constraint"]: ValueTypes["events_constraint"];
	["events_delete_at_path_input"]: ValueTypes["events_delete_at_path_input"];
	["events_delete_elem_input"]: ValueTypes["events_delete_elem_input"];
	["events_delete_key_input"]: ValueTypes["events_delete_key_input"];
	["events_insert_input"]: ValueTypes["events_insert_input"];
	["events_max_order_by"]: ValueTypes["events_max_order_by"];
	["events_min_order_by"]: ValueTypes["events_min_order_by"];
	["events_obj_rel_insert_input"]: ValueTypes["events_obj_rel_insert_input"];
	["events_on_conflict"]: ValueTypes["events_on_conflict"];
	["events_order_by"]: ValueTypes["events_order_by"];
	["events_pk_columns_input"]: ValueTypes["events_pk_columns_input"];
	["events_prepend_input"]: ValueTypes["events_prepend_input"];
	["events_select_column"]: ValueTypes["events_select_column"];
	["events_set_input"]: ValueTypes["events_set_input"];
	["events_stream_cursor_input"]: ValueTypes["events_stream_cursor_input"];
	["events_stream_cursor_value_input"]: ValueTypes["events_stream_cursor_value_input"];
	["events_update_column"]: ValueTypes["events_update_column"];
	["events_updates"]: ValueTypes["events_updates"];
	["files_aggregate_bool_exp"]: ValueTypes["files_aggregate_bool_exp"];
	["files_aggregate_bool_exp_bool_and"]: ValueTypes["files_aggregate_bool_exp_bool_and"];
	["files_aggregate_bool_exp_bool_or"]: ValueTypes["files_aggregate_bool_exp_bool_or"];
	["files_aggregate_bool_exp_count"]: ValueTypes["files_aggregate_bool_exp_count"];
	["files_aggregate_order_by"]: ValueTypes["files_aggregate_order_by"];
	["files_arr_rel_insert_input"]: ValueTypes["files_arr_rel_insert_input"];
	["files_avg_order_by"]: ValueTypes["files_avg_order_by"];
	["files_bool_exp"]: ValueTypes["files_bool_exp"];
	["files_constraint"]: ValueTypes["files_constraint"];
	["files_inc_input"]: ValueTypes["files_inc_input"];
	["files_insert_input"]: ValueTypes["files_insert_input"];
	["files_max_order_by"]: ValueTypes["files_max_order_by"];
	["files_min_order_by"]: ValueTypes["files_min_order_by"];
	["files_obj_rel_insert_input"]: ValueTypes["files_obj_rel_insert_input"];
	["files_on_conflict"]: ValueTypes["files_on_conflict"];
	["files_order_by"]: ValueTypes["files_order_by"];
	["files_pk_columns_input"]: ValueTypes["files_pk_columns_input"];
	["files_select_column"]: ValueTypes["files_select_column"];
	["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"]: ValueTypes["files_select_column_files_aggregate_bool_exp_bool_and_arguments_columns"];
	["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"]: ValueTypes["files_select_column_files_aggregate_bool_exp_bool_or_arguments_columns"];
	["files_set_input"]: ValueTypes["files_set_input"];
	["files_stddev_order_by"]: ValueTypes["files_stddev_order_by"];
	["files_stddev_pop_order_by"]: ValueTypes["files_stddev_pop_order_by"];
	["files_stddev_samp_order_by"]: ValueTypes["files_stddev_samp_order_by"];
	["files_stream_cursor_input"]: ValueTypes["files_stream_cursor_input"];
	["files_stream_cursor_value_input"]: ValueTypes["files_stream_cursor_value_input"];
	["files_sum_order_by"]: ValueTypes["files_sum_order_by"];
	["files_update_column"]: ValueTypes["files_update_column"];
	["files_updates"]: ValueTypes["files_updates"];
	["files_var_pop_order_by"]: ValueTypes["files_var_pop_order_by"];
	["files_var_samp_order_by"]: ValueTypes["files_var_samp_order_by"];
	["files_variance_order_by"]: ValueTypes["files_variance_order_by"];
	["installations_aggregate_bool_exp"]: ValueTypes["installations_aggregate_bool_exp"];
	["installations_aggregate_bool_exp_bool_and"]: ValueTypes["installations_aggregate_bool_exp_bool_and"];
	["installations_aggregate_bool_exp_bool_or"]: ValueTypes["installations_aggregate_bool_exp_bool_or"];
	["installations_aggregate_bool_exp_count"]: ValueTypes["installations_aggregate_bool_exp_count"];
	["installations_aggregate_order_by"]: ValueTypes["installations_aggregate_order_by"];
	["installations_arr_rel_insert_input"]: ValueTypes["installations_arr_rel_insert_input"];
	["installations_bool_exp"]: ValueTypes["installations_bool_exp"];
	["installations_constraint"]: ValueTypes["installations_constraint"];
	["installations_insert_input"]: ValueTypes["installations_insert_input"];
	["installations_max_order_by"]: ValueTypes["installations_max_order_by"];
	["installations_min_order_by"]: ValueTypes["installations_min_order_by"];
	["installations_on_conflict"]: ValueTypes["installations_on_conflict"];
	["installations_order_by"]: ValueTypes["installations_order_by"];
	["installations_pk_columns_input"]: ValueTypes["installations_pk_columns_input"];
	["installations_select_column"]: ValueTypes["installations_select_column"];
	["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"]: ValueTypes["installations_select_column_installations_aggregate_bool_exp_bool_and_arguments_columns"];
	["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"]: ValueTypes["installations_select_column_installations_aggregate_bool_exp_bool_or_arguments_columns"];
	["installations_set_input"]: ValueTypes["installations_set_input"];
	["installations_stream_cursor_input"]: ValueTypes["installations_stream_cursor_input"];
	["installations_stream_cursor_value_input"]: ValueTypes["installations_stream_cursor_value_input"];
	["installations_update_column"]: ValueTypes["installations_update_column"];
	["installations_updates"]: ValueTypes["installations_updates"];
	["jsonb"]: ValueTypes["jsonb"];
	["jsonb_cast_exp"]: ValueTypes["jsonb_cast_exp"];
	["jsonb_comparison_exp"]: ValueTypes["jsonb_comparison_exp"];
	["order_by"]: ValueTypes["order_by"];
	["timestamptz"]: ValueTypes["timestamptz"];
	["timestamptz_comparison_exp"]: ValueTypes["timestamptz_comparison_exp"];
	["user_files_bool_exp"]: ValueTypes["user_files_bool_exp"];
	["user_files_constraint"]: ValueTypes["user_files_constraint"];
	["user_files_insert_input"]: ValueTypes["user_files_insert_input"];
	["user_files_on_conflict"]: ValueTypes["user_files_on_conflict"];
	["user_files_order_by"]: ValueTypes["user_files_order_by"];
	["user_files_pk_columns_input"]: ValueTypes["user_files_pk_columns_input"];
	["user_files_select_column"]: ValueTypes["user_files_select_column"];
	["user_files_set_input"]: ValueTypes["user_files_set_input"];
	["user_files_stream_cursor_input"]: ValueTypes["user_files_stream_cursor_input"];
	["user_files_stream_cursor_value_input"]: ValueTypes["user_files_stream_cursor_value_input"];
	["user_files_update_column"]: ValueTypes["user_files_update_column"];
	["user_files_updates"]: ValueTypes["user_files_updates"];
	["users_aggregate_bool_exp"]: ValueTypes["users_aggregate_bool_exp"];
	["users_aggregate_bool_exp_bool_and"]: ValueTypes["users_aggregate_bool_exp_bool_and"];
	["users_aggregate_bool_exp_bool_or"]: ValueTypes["users_aggregate_bool_exp_bool_or"];
	["users_aggregate_bool_exp_count"]: ValueTypes["users_aggregate_bool_exp_count"];
	["users_aggregate_order_by"]: ValueTypes["users_aggregate_order_by"];
	["users_append_input"]: ValueTypes["users_append_input"];
	["users_arr_rel_insert_input"]: ValueTypes["users_arr_rel_insert_input"];
	["users_bool_exp"]: ValueTypes["users_bool_exp"];
	["users_constraint"]: ValueTypes["users_constraint"];
	["users_delete_at_path_input"]: ValueTypes["users_delete_at_path_input"];
	["users_delete_elem_input"]: ValueTypes["users_delete_elem_input"];
	["users_delete_key_input"]: ValueTypes["users_delete_key_input"];
	["users_insert_input"]: ValueTypes["users_insert_input"];
	["users_max_order_by"]: ValueTypes["users_max_order_by"];
	["users_min_order_by"]: ValueTypes["users_min_order_by"];
	["users_obj_rel_insert_input"]: ValueTypes["users_obj_rel_insert_input"];
	["users_on_conflict"]: ValueTypes["users_on_conflict"];
	["users_order_by"]: ValueTypes["users_order_by"];
	["users_pk_columns_input"]: ValueTypes["users_pk_columns_input"];
	["users_prepend_input"]: ValueTypes["users_prepend_input"];
	["users_select_column"]: ValueTypes["users_select_column"];
	["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"]: ValueTypes["users_select_column_users_aggregate_bool_exp_bool_and_arguments_columns"];
	["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"]: ValueTypes["users_select_column_users_aggregate_bool_exp_bool_or_arguments_columns"];
	["users_set_input"]: ValueTypes["users_set_input"];
	["users_stream_cursor_input"]: ValueTypes["users_stream_cursor_input"];
	["users_stream_cursor_value_input"]: ValueTypes["users_stream_cursor_value_input"];
	["users_update_column"]: ValueTypes["users_update_column"];
	["users_updates"]: ValueTypes["users_updates"];
	["uuid"]: ValueTypes["uuid"];
	["uuid_comparison_exp"]: ValueTypes["uuid_comparison_exp"];
}