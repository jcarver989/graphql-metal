# GraphQL Metal

An experimental repo to prototype running a (node.js) graphQL "server" on AWS Lambda as close to the "metal" as possible
(or at least "closer" than Apollo :)).

It uses [graphql-jit](https://github.com/zalando-incubator/graphql-jit#readme) and falls back to
[graphql-js](https://github.com/graphql/graphql-js) if the query can't be compiled.

The only runtime dependencies of this package are:

```json
{
  "graphql": "^15.3.0",
  "graphql-jit": "^0.4.3",
  "graphql-tools": "^6.2.4"
}
```
