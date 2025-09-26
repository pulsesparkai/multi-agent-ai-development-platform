import { SQLDatabase } from "encore.dev/storage/sqldb";

export default new SQLDatabase("codedb", {
  migrations: "./migrations",
});
