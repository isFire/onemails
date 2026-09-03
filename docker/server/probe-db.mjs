// spike 探针：在 server 容器内验证「Hyperdrive 本地连接串指向的 PG」可真实连通。
// 连接串来源 = wrangler 实际会注入 binding 的那个环境变量
// （WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE），
// 驱动 = 仓库 @zero/db 同款 postgres 驱动（node_modules 解析；
// postgres 是 @zero/db 的直接依赖，pnpm 严格隔离下需从 packages/db 解析）。
import { createRequire } from 'node:module';

const require = createRequire('/app/packages/db/package.json');
const postgres = require('postgres');

const url = process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
if (!url) {
  console.error('[probe] FAIL: WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE 未设置');
  process.exit(2);
}
console.log('[probe] connection string:', url.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@'));

const sql = postgres(url, { max: 1, connect_timeout: 5, idle_timeout: 2 });
try {
  const rows = await sql`select version() as version, current_database() as db, current_user as usr`;
  console.log('[probe] OK:', JSON.stringify(rows[0]));
  const tables = await sql`
    select count(*)::int as n
    from information_schema.tables
    where table_schema = 'public'
  `;
  console.log('[probe] public tables:', rows.length ? tables[0].n : 'n/a');
  process.exit(0);
} catch (err) {
  console.error('[probe] FAIL:', err && err.message ? err.message : err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 2 });
}
