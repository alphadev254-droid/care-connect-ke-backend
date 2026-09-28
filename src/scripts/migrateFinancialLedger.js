const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const migrationPath = path.resolve(
  __dirname,
  "../../migrations/20260928_add_financial_ledger.sql",
);
const assertNoDuplicates = async (table, column, label) => {
  const rows = await sequelize.query(
    `SELECT \`${column}\` duplicateValue, COUNT(*) duplicateCount FROM \`${table}\` WHERE \`${column}\` IS NOT NULL GROUP BY \`${column}\` HAVING COUNT(*)>1 LIMIT 10`,
    { type: QueryTypes.SELECT },
  );
  if (rows.length)
    throw new Error(
      `${label} duplicates must be resolved: ${JSON.stringify(rows)}`,
    );
};
const run = async () => {
  await sequelize.authenticate();
  const existingTables = await sequelize.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('ledger_accounts','ledger_transactions','ledger_entries')",
    {
      type: QueryTypes.SELECT,
    },
  );
  if (existingTables.length === 3)
    return console.log("Financial ledger migration is already installed.");
  if (existingTables.length > 0) {
    throw new Error(
      "A partial financial-ledger migration was detected. Restore the pre-migration backup before retrying.",
    );
  }
  await assertNoDuplicates(
    "caresessionreports",
    "appointmentId",
    "Care report appointment",
  );
  await assertNoDuplicates(
    "paymenttransactions",
    "stripePaymentIntentId",
    "PayChangu payment reference",
  );
  const statements = fs
    .readFileSync(migrationPath, "utf8")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  for (const statement of statements) await sequelize.query(statement);
  console.log(
    `Financial ledger migration completed (${statements.length} statements).`,
  );
};
run()
  .catch((error) => {
    console.error("Financial ledger migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
