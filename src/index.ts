import { Handler } from "aws-lambda"
import { parse, validate } from "graphql"
import { IResolvers, makeExecutableSchema } from "graphql-tools"
import { LambdaEvent, LambdaResponse, ParsedLambdaEventBody, response } from "./awsLambda"
import { executeGQL } from "./executeGQL"

export function createHandler<T>(params: {
  typeDefs: string
  resolvers: IResolvers
  createContext: (event: LambdaEvent) => T
  createHeaders?: (event: LambdaEvent) => Record<string, string>
}): Handler<LambdaEvent, LambdaResponse> {
  const { typeDefs, resolvers, createContext, createHeaders } = params
  const schema = makeExecutableSchema({ typeDefs, resolvers })

  return async (event: LambdaEvent): Promise<LambdaResponse> => {
    try {
      const context = createContext(event)
      const headers = createHeaders?.(event)
      const { query, variables, operationName }: ParsedLambdaEventBody = JSON.parse(event.body)

      const document = parse(query)
      const validationErrors = validate(schema, document)

      if (validationErrors.length > 0) {
        return response(400, { errors: validationErrors }, headers)
      }

      const result = await executeGQL({
        schema,
        resolvers,
        document,
        variables,
        context,
        operationName
      })

      return response(200, result, headers)
    } catch (e) {
      return response(500, {
        errors: [e]
      })
    }
  }
}
