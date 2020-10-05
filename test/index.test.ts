import { Context } from "aws-lambda"
import { createHandler, LambdaEvent, LambdaResponse } from "../src/index"

let posts = [{ id: "1", content: "Hello World!" }]

const handler = createHandler({
  typeDefs: `
      type Query {
          getPost(id: ID!): Post!
      }

      type Mutation {
          createPost(input: CreatePostInput!): Post!
      }

      type Post {
          id: ID!
          content: String!
      }

      input CreatePostInput {
          content: String!
      }
      `,
  resolvers: {
    Query: {
      getPost: (_, args) => {
        return posts.find(_ => _.id === args.id)
      }
    },

    Mutation: {
      createPost: (_, post) => {
        const nextId = parseInt(posts[posts.length - 1].id) + 1
        const newPost = { id: nextId.toString(), content: post.input.content }
        posts.push(newPost)
        return newPost
      }
    }
  },
  createContext: event => ({})
})

describe("createHandler", () => {
  beforeEach(() => {
    posts = [{ id: "1", content: "Hello World!" }]
  })

  it("should execute a query with a parameter", async () => {
    const result = await run(
      aLambdaEvent({
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

  it("should execute a mutation", async () => {
    const result = await run(
      aLambdaEvent({
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
})

function assertResponse<T extends {}>(
  result: LambdaResponse | void,
  statusCode: number,
  body: T,
  headers: Record<string, string> = { "Content-Type": "application/json" }
): void {
  expect(result).toEqual({
    statusCode,
    headers,
    body: JSON.stringify(body)
  })
}

async function run(event: LambdaEvent): Promise<LambdaResponse | void> {
  return handler(event, {} as Context, event => {})
}

function aLambdaEvent(params: { query: string; variables: Record<string, any> }): LambdaEvent {
  const { query, variables } = params
  return {
    body: JSON.stringify({
      query,
      variables
    }),
    headers: {},
    httpMethod: "POST"
  }
}
