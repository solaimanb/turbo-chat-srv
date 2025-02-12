import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.join(process.cwd(), ".env"),
});

interface IConfig {
  env: string;
  port: number;
  database_url?: string;
}

// Validate the environment variables
function validateEnv(): IConfig {
  const { NODE_ENV, PORT, DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  return {
    env: NODE_ENV || "development",
    port: parseInt(PORT || "8000", 10),
    database_url: DATABASE_URL,
  };
}

export default validateEnv();
