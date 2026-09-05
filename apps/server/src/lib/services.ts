import { env } from 'cloudflare:workers';
import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';
import { Resend } from 'resend';

export const resend = () =>
  env.RESEND_API_KEY
    ? new Resend(env.RESEND_API_KEY)
    : { emails: { send: async (...args: unknown[]) => console.log(args) } };

// redis() 的统一接口面:全 server 只用 get / set({ex}) / del(auth.ts 的 secondaryStorage)。
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

// 原生 redis:// 走 ioredis(node:net TCP,wrangler nodejs_compat 下可用,连自托管本地 redis);
// https:// 走 Upstash HTTP(云服务)。workerd 无原生 Upstash 时本地 redis 是唯一出路——
// dummy.upstash.io 会让 createSession 写缓存直接 500。
class IORedisCompat implements RedisLike {
  constructor(private client: IORedis) {}
  get(key: string) {
    return this.client.get(key);
  }
  set(key: string, value: string, opts?: { ex?: number }) {
    return opts?.ex ? this.client.set(key, value, 'EX', opts.ex) : this.client.set(key, value);
  }
  del(key: string) {
    return this.client.del(key);
  }
}

// wrangler dev 单进程,模块级单例复用 TCP 连接,避免每请求建连。
let ioCompat: IORedisCompat | undefined;

export const redis = (): RedisLike => {
  const url = env.REDIS_URL ?? '';
  if (url.startsWith('redis://') || url.startsWith('rediss://')) {
    ioCompat ??= new IORedisCompat(new IORedis(url, { maxRetriesPerRequest: 2 }));
    return ioCompat;
  }
  return new UpstashRedis({ url, token: env.REDIS_TOKEN }) as unknown as RedisLike;
};
