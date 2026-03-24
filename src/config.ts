import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { ConfigFile, ConnectionConfig } from "./types.js";

const CONFIG_DIR = join(homedir(), ".mysql-multi-mcp");
const CONFIG_PATH = join(CONFIG_DIR, "connections.json");

export async function loadConfig(): Promise<ConfigFile> {
  try {
    const data = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(data) as ConfigFile;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      const defaultConfig: ConfigFile = { connections: {} };
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
    throw new Error(`Failed to read config: ${err.message}`);
  }
}

export async function saveConfig(config: ConfigFile): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export async function getConnection(name: string): Promise<ConnectionConfig> {
  const config = await loadConfig();
  const conn = config.connections[name];
  if (!conn) {
    throw new Error(
      `Connection '${name}' not found. Use list-connections to see available connections.`
    );
  }
  return conn;
}

export async function addConnection(
  name: string,
  config: ConnectionConfig
): Promise<void> {
  const current = await loadConfig();
  if (current.connections[name]) {
    throw new Error(
      `Connection '${name}' already exists. Remove it first or choose a different name.`
    );
  }
  current.connections[name] = config;
  await saveConfig(current);
}

export async function removeConnection(name: string): Promise<void> {
  const current = await loadConfig();
  if (!current.connections[name]) {
    throw new Error(
      `Connection '${name}' not found. Use list-connections to see available connections.`
    );
  }
  delete current.connections[name];
  await saveConfig(current);
}
