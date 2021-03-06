/** An incoming Lambda event */
export interface LambdaEvent {
  httpMethod: "POST" | "GET"
  headers: Record<string, string>
  body: string
}

/** The result of JSON.parse(lambdaEvent.body) */
export interface GraphQLRequest {
  query: string
  variables: Record<string, any>
  operationName?: string
}

/** The Lambda's response */
export interface LambdaResponse {
  statusCode: number // HTTP status code
  headers: Record<string, string>
  body: string // JSON
}

/** Exported so package consumers can use in their unit tests  */
export function event(params: {
  query: string
  variables?: Record<string, any>
  operationName?: string
  headers?: Record<string, string>
}): LambdaEvent {
  const { query, variables = {}, operationName, headers = {} } = params
  const body: GraphQLRequest = {
    query,
    variables,
    operationName
  }

  return {
    body: JSON.stringify(body),
    headers,
    httpMethod: "POST"
  }
}

/** Shorthand method for creating a LambdaResponse */
export function response<T extends {}>(statusCode: number, body: T, headers?: Record<string, string>): LambdaResponse {
  return {
    statusCode,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  }
}
