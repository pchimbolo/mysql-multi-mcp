import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import { getConnection } from "./config.js";

const pools = new Map<string, Pool>();

export async function getPool(name: string): Promise<Pool> {
  let pool = pools.get(name);
  if (pool) return pool;

  const config = await getConnection(name);
  pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 5,
  });

  pools.set(name, pool);
  return pool;
}

export async function destroyPool(name: string): Promise<void> {
  const pool = pools.get(name);
  if (pool) {
    await pool.end();
    pools.delete(name);
  }
}

export async function shutdownAllPools(): Promise<void> {
  const promises = Array.from(pools.entries()).map(async ([name, pool]) => {
    await pool.end();
    pools.delete(name);
  });
  await Promise.all(promises);
}
