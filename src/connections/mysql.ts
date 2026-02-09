import { Client as SSHClient } from "ssh2";
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { getConfig, hasTarmsConfig } from "../config.js";
import net from "net";

let sshClient: SSHClient | null = null;
let mysqlPool: mysql.Pool | null = null;
let localPort: number = 0;
let tunnelReady = false;
let tunnelPromise: Promise<void> | null = null;

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error("Could not find free port"));
      }
    });
    server.on("error", reject);
  });
}

async function setupTunnel(): Promise<void> {
  if (tunnelReady) return;
  if (tunnelPromise) return tunnelPromise;

  tunnelPromise = new Promise<void>(async (resolve, reject) => {
    try {
      const config = getConfig();
      if (!hasTarmsConfig()) {
        reject(new Error("TARMS SSH configuration not available"));
        return;
      }

      localPort = await findFreePort();
      sshClient = new SSHClient();

      const sshConfig: any = {
        host: config.TARMS_SSH_HOST,
        port: 22,
        username: config.TARMS_SSH_USERNAME!,
      };

      if (config.TARMS_SSH_KEY_PATH) {
        sshConfig.privateKey = readFileSync(config.TARMS_SSH_KEY_PATH);
      }

      sshClient.on("ready", () => {
        sshClient!.forwardOut(
          "127.0.0.1",
          localPort,
          "127.0.0.1",
          3306,
          (err, stream) => {
            if (err) {
              reject(err);
              return;
            }

            // Create a TCP server that forwards to the SSH stream
            const server = net.createServer((sock) => {
              sshClient!.forwardOut(
                "127.0.0.1",
                localPort,
                "127.0.0.1",
                3306,
                (err, sshStream) => {
                  if (err) {
                    sock.destroy();
                    return;
                  }
                  sock.pipe(sshStream).pipe(sock);
                }
              );
            });

            server.listen(localPort, "127.0.0.1", () => {
              mysqlPool = mysql.createPool({
                host: "127.0.0.1",
                port: localPort,
                user: config.TARMS_DB_USERNAME!,
                password: config.TARMS_DB_PASSWORD!,
                database: config.TARMS_DB_NAME,
                waitForConnections: true,
                connectionLimit: 5,
                queueLimit: 0,
                connectTimeout: 10000,
              });

              tunnelReady = true;
              stream.end();
              resolve();
            });
          }
        );
      });

      sshClient.on("error", (err) => {
        console.error("SSH connection error:", err);
        reject(err);
      });

      sshClient.connect(sshConfig);
    } catch (err) {
      reject(err);
    }
  });

  return tunnelPromise;
}

export async function mysqlQuery<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  if (!tunnelReady) {
    await setupTunnel();
  }
  if (!mysqlPool) {
    throw new Error("MySQL pool not initialized");
  }

  const [rows] = await mysqlPool.query(sql, params);
  return rows as T[];
}

export async function shutdownMysql(): Promise<void> {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
  }
  if (sshClient) {
    sshClient.end();
    sshClient = null;
  }
  tunnelReady = false;
  tunnelPromise = null;
}
