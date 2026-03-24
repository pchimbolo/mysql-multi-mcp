export interface ConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}

export interface ConfigFile {
  connections: Record<string, ConnectionConfig>;
}
