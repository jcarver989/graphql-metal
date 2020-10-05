# GraphQL Metal

An experimental repo to prototype running a (node.js) graphQL "server" on AWS Lambda as close to the "metal" as possible
(or at least closer than Apollo :)).

GraphQL Metal uses [graphql-jit](https://github.com/zalando-incubator/graphql-jit#readme) and falls back to
[graphql-js](https://github.com/graphql/graphql-js) if the query can't be compiled.

The only runtime dependencies of this package are:

```json
{
  "graphql": "^15.3.0",
  "graphql-jit": "^0.4.3",
  "graphql-tools": "^6.2.4"
}
```

## Usage

### Assuming you have a graphQL schema + resolvers, e.g.:

```TypeScript

const typeDefs = `
    type Query {
        getPost(id: ID!): Post!
    }

    type Post {
        id: ID!
        content: String!
    }
`

const posts = [{ id: "1", content: "Hello World!" }]

const resolvers =  {
  Query: {
      getPost: (_, args) => {
        return posts.find(_ => _.id === args.id)
      }
  }
```

### Then, create and export a Lambda handler

```TypeScript
import { createHandler } from "./index"

export const handler = createHandler({
  typeDefs,
  resolvers,
  createContext: event => ({ authHeader: event.headers["authorization"] }),
  createHeaders: event => ({ "accesss-control-allow-origin": "*" })
})
```

### And test your function like this:

```TypeScript
import { event } from "./index"
import { Context } from "aws-lambda"

it("should get a post by id", () => {
  const result = await handler(event({
    query: `
        query getPostQuery($id: ID!) {
            getPost(id: $id) {
                id
            }
        }
      `,
    variables: { id: "1" }
}), {} as Context, () => {})

  expect(result).toEqual({
    statusCode: 200,
    headers: { "accesss-control-allow-origin": "*", "content-type": "application/json" },
    body: JSON.stringify({ data: { getPost: { id: "1" } } })
  })
})
```
