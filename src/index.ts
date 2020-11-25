import { Handler } from "aws-lambda"
import { IResolvers, makeExecutableSchema } from "graphql-tools"
import { GraphQLExecutor } from "./GraphQLExecutor"
import { GraphQLQueryCache } from "./GraphQLQueryCache"
import { GraphQLRequest, LambdaEvent, LambdaResponse, response } from "./lambda"

/** Creates a Lambda Handler that returns HTTP responses to graphQL queries/mutations
 *
 *  @param typeDefs -- string graphQL schema in SDL
 *  @param resolvers -- graphQL resolver function map
 *  @param jitThreshold -- number of times a query must be seen before attempting to jit + cache it
 *  @param queryCache -- cache for jit-ed graphQL queries
 *  @param createContext -- function to create your graphQL context on every request
 *  @param createHeaders -- function to create your HTTP response headers on every request (Content-Type is set to application/json for you by default)
 */
export function createHandler<T>(params: {
  typeDefs: string
  resolvers: IResolvers
  jitThreshold?: number
  queryCache?: GraphQLQueryCache
  createContext: (event: LambdaEvent) => T
  createHeaders?: (event: LambdaEvent) => Record<string, string>
}): Handler<LambdaEvent, LambdaResponse> {
  const {
    typeDefs,
    resolvers,
    createContext,
    createHeaders,
    jitThreshold = 0 // jit + cache every query by default
  } = params
  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const queryCache = params.queryCache ?? new GraphQLQueryCache({ maxSize: 1024 })
  const executor = new GraphQLExecutor(schema, queryCache, { jitThreshold })

  return async (event: LambdaEvent): Promise<LambdaResponse> => {
    try {
      const context = createContext(event)
      const headers = createHeaders?.(event)
      const { query, variables, operationName }: GraphQLRequest = JSON.parse(event.body)

      const result = await executor.execute({
        query,
        variables,
        context,
        operationName
      })

      if (result.validationErrors && result.validationErrors.length > 0) {
        return response(400, { errors: result.validationErrors }, headers)
      }

      return response(200, result, headers)
    } catch (e) {
      return response(500, {
        errors: [e]
      })
    }
  }
}
