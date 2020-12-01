import { createHash } from "crypto"
import { CompiledQuery } from "graphql-jit"
import lru, { Lru } from "tiny-lru"

export interface Options {
  maxSize: number
  ttlInMs?: number
}

export interface CacheEntry {
  timesEncountered: number
  cachedQuery?: CompiledQuery
}

/** LRU cache of compiled graphql-jit queries */
export class GraphQLQueryCache {
  private cache: Lru<CacheEntry>

  constructor({ maxSize, ttlInMs }: Options) {
    this.cache = lru(maxSize, ttlInMs)
  }

  set(graphQLQuery: string, entry: CacheEntry): void {
    const key = this.getCacheKey(graphQLQuery)
    this.cache.set(key, entry)
  }

  get(graphQLQuery: string): CacheEntry {
    const key = this.getCacheKey(graphQLQuery)
    return this.cache.get(key) ?? { timesEncountered: 0 }
  }

  private getCacheKey(graphQLQuery: string): string {
    return createHash("sha256").update(graphQLQuery).digest("hex")
  }
}
