import { defineConfig } from "prisma/config";
import { config } from "dotenv";

config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://ctrst:ctrst_dev@localhost:5432/contratos_stands",
  },
});
