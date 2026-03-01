/**
 * User types used by storage. Mirror of shared/schema.ts (Drizzle users table).
 */
export interface User {
  id: string;
  username: string;
  password: string;
}

export type InsertUser = Pick<User, "username" | "password">;
