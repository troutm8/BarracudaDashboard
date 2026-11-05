import { getDb } from "./client";

async function main() {
  const holder = await getDb();
  if (holder.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(holder.db as never, { migrationsFolder: "drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(holder.db as never, { migrationsFolder: "drizzle" });
  }
  console.log(`migrations applied (${holder.kind})`);
  await holder.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
