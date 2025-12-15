import { pool } from "../server/db";

async function reset() {
  console.log("💣 Lösche Datenbank-Schema...");
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;");
  console.log("✨ Datenbank ist wieder leer und sauber!");
  process.exit(0);
}

reset().catch((err) => {
  console.error("Fehler beim Reset:", err);
  process.exit(1);
});
