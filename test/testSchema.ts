import { GraphQLSchema } from "graphql"
import { IResolvers, makeExecutableSchema } from "graphql-tools"

export const typeDefs = `
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
`

export interface Post {
  id: string
  content: string
}

// Simple resolvers for tests
export function createResolvers(posts: Post[] = []): IResolvers {
  return {
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
  }
}

export function createSchema(posts: Post[] = []): GraphQLSchema {
  const resolvers = createResolvers(posts)
  return makeExecutableSchema({ typeDefs, resolvers })
}
