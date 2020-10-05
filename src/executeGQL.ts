import { DocumentNode, execute, ExecutionResult, GraphQLSchema } from "graphql"
import { compileQuery, isCompiledQuery } from "graphql-jit"
import { IResolvers } from "graphql-tools"

/** Executes a graphQL query or mutation
 *
 *  graphql-jit will be attempted first. And if the query can't be compiled for some reason,
 *  we'll fall back to graphql-js
 *
 *  @param schema -- the parsed sdl schema e.g loadSchemaSync("foo.graphql") (from "graphql-tools")
 *  @param resolvers -- the graphQL resolver map
 *  @param document -- the parsed graphQL query or mutation, e.g. parse(query) (from "graphql")
 */
export async function executeGQL<T>(params: {
  schema: GraphQLSchema
  resolvers: IResolvers
  document: DocumentNode
  variables: Record<string, any>
  context: T
  operationName?: string
}): Promise<ExecutionResult> {
  const { schema, resolvers, document, variables, context, operationName } = params
  const compiledQuery = compileQuery(schema, document, operationName)
  if (isCompiledQuery(compiledQuery)) {
    return compiledQuery.query(resolvers, context, variables)
  } else {
    return Promise.resolve(
      execute({
        schema,
        document,
        variableValues: variables,
        contextValue: context,
        operationName
      })
    )
  }
}
