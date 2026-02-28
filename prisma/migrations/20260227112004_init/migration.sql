-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 400,
    "y" INTEGER NOT NULL DEFAULT 300,
    "direction" TEXT NOT NULL DEFAULT 'down',
    "avatar" TEXT NOT NULL DEFAULT 'default',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDLE',
    "x" INTEGER NOT NULL DEFAULT 100,
    "y" INTEGER NOT NULL DEFAULT 100,
    "direction" TEXT NOT NULL DEFAULT 'down',
    "deskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentId" TEXT NOT NULL,
    CONSTRAINT "Permission_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Layout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'default',
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "maxAgentsPerUser" INTEGER NOT NULL DEFAULT 5,
    "maxConcurrentAgents" INTEGER NOT NULL DEFAULT 20,
    "officeWidth" INTEGER NOT NULL DEFAULT 48,
    "officeHeight" INTEGER NOT NULL DEFAULT 32,
    "enablePermissions" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_sessionId_key" ON "Agent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Layout_x_y_type_key" ON "Layout"("x", "y", "type");
