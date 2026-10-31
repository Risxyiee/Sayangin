-- CreateTable
CREATE TABLE "Confession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "senderKey" TEXT,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'rose',
    "response" TEXT,
    "reply" TEXT,
    "repliedAt" DATETIME,
    "views" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME,
    "respondedAt" DATETIME
);

-- CreateTable
CREATE TABLE "LetterSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "senderKey" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toName" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'rose',
    "views" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME,
    "startedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Letter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "unlockDays" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "openedAt" DATETIME,
    "reply" TEXT,
    "repliedAt" DATETIME,
    CONSTRAINT "Letter_setId_fkey" FOREIGN KEY ("setId") REFERENCES "LetterSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "senderKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toName" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'rose',
    "data" TEXT NOT NULL DEFAULT '{}',
    "progress" TEXT NOT NULL DEFAULT '{}',
    "views" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Confession_slug_key" ON "Confession"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Confession_senderKey_key" ON "Confession"("senderKey");

-- CreateIndex
CREATE UNIQUE INDEX "LetterSet_slug_key" ON "LetterSet"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LetterSet_senderKey_key" ON "LetterSet"("senderKey");

-- CreateIndex
CREATE INDEX "Letter_setId_idx" ON "Letter"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_slug_key" ON "Gift"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_senderKey_key" ON "Gift"("senderKey");

