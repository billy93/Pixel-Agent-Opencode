/*
  Warnings:

  - Added the required column `workspace` to the `Agent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "recentWorkspaces" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "workspace" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "x" INTEGER NOT NULL DEFAULT 100,
    "y" INTEGER NOT NULL DEFAULT 100,
    "direction" TEXT NOT NULL DEFAULT 'down',
    "deskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("createdAt", "deskId", "direction", "id", "name", "sessionId", "status", "updatedAt", "userId", "x", "y") SELECT "createdAt", "deskId", "direction", "id", "name", "sessionId", "status", "updatedAt", "userId", "x", "y" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE UNIQUE INDEX "Agent_sessionId_key" ON "Agent"("sessionId");
CREATE INDEX "Agent_userId_workspace_idx" ON "Agent"("userId", "workspace");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
