import { Context } from "aws-lambda"
import { GraphQLQueryCache } from "../src/GraphQLQueryCache"
import { createHandler } from "../src/index"
import { event, LambdaEvent, LambdaResponse } from "../src/lambda"
import { createResolvers, Post, typeDefs } from "./testSchema"

describe("createHandler", () => {
  it("should execute a query with a parameter", async () => {
    const result = await run(
      [{ id: "1", content: "Hello World!" }],
      event({
        query: `
            query getPostQuery($id: ID!) {
                getPost(id: $id) {
                    id
                }
            }
          `,
        variables: { id: "1" }
      })
    )

    assertResponse(result, 200, { data: { getPost: { id: "1" } } })
  })

  it("should jit + cache a query the first time its encountered by default", async () => {
    const posts: Post[] = [{ id: "1", content: "Hello World!" }]
    const cache = new GraphQLQueryCache({ maxSize: 100 })
    const query = `
    query getPostQuery($id: ID!) {
        getPost(id: $id) {
            id
        }
    }
  `
    await run(posts, event({ query, variables: { id: "1" } }), cache)
    const { timesEncountered, cachedQuery } = cache.get(query)
    expect(timesEncountered).toEqual(1)
    expect(cachedQuery).toBeDefined()
  })

  it("should jit + cache a query only when provided jitThreshold is reached", async () => {
    const posts: Post[] = [{ id: "1", content: "Hello World!" }]
    const cache = new GraphQLQueryCache({ maxSize: 100 })
    const jitThreshold = 2
    const query = `
    query getPostQuery($id: ID!) {
        getPost(id: $id) {
            id
        }
    }
  `
    const result1 = await run(posts, event({ query, variables: { id: "1" } }), cache, jitThreshold)
    const entry1 = cache.get(query)
    expect(entry1.timesEncountered).toEqual(1)
    expect(entry1.cachedQuery).toBeUndefined()
    assertResponse(result1, 200, { data: { getPost: { id: "1" } } }) // non jit result

    const result2 = await run(posts, event({ query, variables: { id: "1" } }), cache, jitThreshold)
    const entry2 = cache.get(query)
    expect(entry2.timesEncountered).toEqual(2)
    expect(entry2.cachedQuery).toBeDefined()
    assertResponse(result2, 200, { data: { getPost: { id: "1" } } }) // jit result (should be the same)
  })
  it("should fail on invalid graphQL query ", async () => {
    const result = await run(
      [{ id: "1", content: "Hello World!" }],
      event({
        query: `
            query getPostQuery($id: ID!) {
                doesNotExist(id: $id) {
                    id
                }
            }
          `,
        variables: { id: "1" }
      })
    )

    assertResponse(result, 400, {
      errors: [
        {
          message: 'Cannot query field "doesNotExist" on type "Query".',
          locations: [
            {
              line: 3,
              column: 17
            }
          ]
        }
      ]
    })
  })

  it("should execute a mutation", async () => {
    const posts: Post[] = [{ id: "1", content: "Hello World!" }]
    const result = await run(
      posts,
      event({
        query: `
            mutation createPostMutation($input: CreatePostInput!) {
                createPost(input: $input) {
                    id
                    content
                }
            }
          `,
        variables: { input: { content: "Post #2!" } }
      })
    )

    assertResponse(result, 200, { data: { createPost: { id: "2", content: "Post #2!" } } })
    expect(posts).toEqual([
      { id: "1", content: "Hello World!" },
      { id: "2", content: "Post #2!" }
    ])
  })

  it("should execute a query that throws an error and return a response", async () => {
    const result = await run(
      [{ id: "1", content: "Hello World!" }],
      event({
        query: `
            query goBoomQuery {
                goBoom {
                    id
                }
            }
          `
      })
    )

    assertResponse(result, 200, {
      data: null,
      errors: [
        {
          message: "BOOM!",
          locations: [
            {
              line: 3,
              column: 17
            }
          ],

          path: ["goBoom"]
        }
      ]
    })
  })
})

function assertResponse<T extends {}>(
  result: LambdaResponse | void,
  statusCode: number,
  body: T,
  headers: Record<string, string> = { "content-type": "application/json" }
): void {
  expect(result).toEqual({
    statusCode,
    headers,
    body: JSON.stringify(body)
  })
}

async function run(
  posts: Post[],
  event: LambdaEvent,
  queryCache: GraphQLQueryCache = new GraphQLQueryCache({ maxSize: 100 }),
  jitThreshold?: number
): Promise<LambdaResponse | void> {
  const handler = createHandler({
    typeDefs,
    resolvers: createResolvers(posts),
    createContext: event => ({}),
    queryCache,
    jitThreshold
  })

  return handler(event, {} as Context, () => {})
}
