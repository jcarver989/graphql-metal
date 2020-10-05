import { Handler } from "aws-lambda"
import { DocumentNode, execute, ExecutionResult, GraphQLSchema, parse, validate } from "graphql"
import { compileQuery, isCompiledQuery } from "graphql-jit"
import { IResolvers, makeExecutableSchema } from "graphql-tools"

export type LambdaEvent = {
  httpMethod: "POST" | "GET"
  headers: Record<string, string>
  body: string
}

export type LambdaResponse = {
  statusCode: number // HTTP status code
  headers: Record<string, string>
  body: string // JSON
}

type ParsedEventBody = {
  query: string
  variables: Record<string, any>
}

class LambdaHandler<T> {
  private schema: GraphQLSchema
  constructor(
    typeDefs: string,
    private resolvers: IResolvers,
    private createContext: (event: LambdaEvent) => T,
    private createHeaders?: (event: LambdaEvent) => Record<string, string>
  ) {
    this.schema = makeExecutableSchema({ typeDefs, resolvers })
  }

  handler = async (event: LambdaEvent): Promise<LambdaResponse> => {
    try {
      const context = this.createContext(event)
      const headers = this.createHeaders?.(event)

      const { query, variables }: ParsedEventBody = JSON.parse(event.body)
      const document = parse(query)
      const validationErrors = validate(this.schema, document)

      if (validationErrors.length > 0) {
        return this.createResponse(400, { errors: validationErrors }, headers)
      }

      const result = await this.executeQueryOrMutation(document, variables, context)
      return this.createResponse(200, result, headers)
    } catch (e) {
      return this.createResponse(500, {
        errors: [e]
      })
    }
  }

  private executeQueryOrMutation = async (
    document: DocumentNode,
    variables: Record<string, any>,
    context: T
  ): Promise<ExecutionResult> => {
    const compiledQuery = compileQuery(this.schema, document)
    if (isCompiledQuery(compiledQuery)) {
      return compiledQuery.query(this.resolvers, context, variables)
    } else {
      return Promise.resolve(
        execute({
          schema: this.schema,
          document,
          variableValues: variables,
          contextValue: context
        })
      )
    }
  }

  private createResponse<U extends {}>(statusCode: number, body: U, headers?: Record<string, string>): LambdaResponse {
    return {
      statusCode,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body)
    }
  }
}

export function createHandler<T>(params: {
  typeDefs: string
  resolvers: IResolvers
  createContext: (event: LambdaEvent) => T
  createHeaders?: (event: LambdaEvent) => Record<string, string>
}): Handler<LambdaEvent, LambdaResponse> {
  const { typeDefs, resolvers, createContext, createHeaders } = params
  return new LambdaHandler<T>(typeDefs, resolvers, createContext, createHeaders).handler
}
