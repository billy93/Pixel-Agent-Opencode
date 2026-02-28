/*
  Warnings:

  - Added the required column `userId` to the `Settings` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "maxAgentsPerUser" INTEGER NOT NULL DEFAULT 5,
    "maxConcurrentAgents" INTEGER NOT NULL DEFAULT 20,
    "officeWidth" INTEGER NOT NULL DEFAULT 48,
    "officeHeight" INTEGER NOT NULL DEFAULT 32,
    "enablePermissions" BOOLEAN NOT NULL DEFAULT true,
    "recentWorkspaces" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("enablePermissions", "id", "maxAgentsPerUser", "maxConcurrentAgents", "officeHeight", "officeWidth", "recentWorkspaces", "updatedAt") SELECT "enablePermissions", "id", "maxAgentsPerUser", "maxConcurrentAgents", "officeHeight", "officeWidth", "recentWorkspaces", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
