import { SQLDatabase } from "encore.dev/storage/sqldb";

export const codedb = new SQLDatabase("codedb", {
  migrations: "./migrations",
});

export default codedb;
