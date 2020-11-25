import { DocumentNode, execute, ExecutionResult, GraphQLError, GraphQLSchema, parse, validate } from "graphql"
import { CompiledQuery, compileQuery, isCompiledQuery } from "graphql-jit"
import { GraphQLQueryCache } from "./GraphQLQueryCache"

export interface GraphQLResponse extends ExecutionResult {
  validationErrors?: ReadonlyArray<GraphQLError>
}

export interface Config {
  jitThreshold: number
}

/** Executes graphQL queries.
 *
 *  Queries are jit-ed and stored in an LRU cache when options.jitThreshold is exceeded.
 *  Otherwise, queries are executed using the "graphql" package (reference JS implementation)
 */
export class GraphQLExecutor<T> {
  constructor(private schema: GraphQLSchema, private cache: GraphQLQueryCache, private config: Config) {}

  async execute(params: {
    query: string
    variables: Record<string, any>
    context: T
    operationName?: string
  }): Promise<GraphQLResponse> {
    const { query, operationName, context, variables } = params

    try {
      const { cachedQuery, timesEncountered } = this.cache.get(query)
      if (cachedQuery !== undefined) {
        return cachedQuery.query({}, context, variables)
      }

      const document = parse(query)
      const validationErrors = validate(this.schema, document)
      if (validationErrors.length > 0) {
        return { validationErrors }
      }

      const compiledQuery = this.maybeCompileAndCacheQuery(query, document, timesEncountered, operationName)
      if (compiledQuery !== undefined) {
        return compiledQuery.query({}, context, variables)
      } else {
        return execute({
          schema: this.schema,
          document,
          variableValues: variables,
          contextValue: context,
          operationName
        })
      }
    } catch (e) {
      return { errors: [e] }
    }
  }

  private maybeCompileAndCacheQuery(
    query: string,
    document: DocumentNode,
    timesEncountered: number,
    operationName?: string
  ): CompiledQuery | undefined {
    const updatedTimesEncountered = timesEncountered + 1
    if (updatedTimesEncountered >= this.config.jitThreshold) {
      const cachedQuery = compileQuery(this.schema, document, operationName)
      if (isCompiledQuery(cachedQuery)) {
        this.cache.set(query, { cachedQuery, timesEncountered: updatedTimesEncountered })
        return cachedQuery
      }
    } else {
      this.cache.set(query, { timesEncountered: updatedTimesEncountered })
      return undefined
    }
  }
}
