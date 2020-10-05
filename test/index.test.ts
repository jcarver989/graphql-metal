import { Context } from "aws-lambda"
import { event, LambdaEvent, LambdaResponse } from "../src/awsLambda"
import { createHandler } from "../src/index"

let posts = [{ id: "1", content: "Hello World!" }]

const handler = createHandler({
  typeDefs: `
      type Query {
          getPost(id: ID!): Post!
          goBoom: Post!
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
      },
      goBoom: _ => {
        throw new Error("BOOM!")
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

  it("should execute a mutation", async () => {
    const result = await run(
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

          // TODO: cleanup this assertion to avoid flaky tests
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
