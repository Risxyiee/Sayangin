-- =============================================================
-- DEGDEGIN — migrasi fitur FOMO (31 Okt 2026)
-- Jalankan di: Supabase Dashboard → SQL Editor → New query → paste → Run
-- Aman aditif: tidak ada data yang diubah/dihapus.
-- =============================================================

-- AlterTable
ALTER TABLE "Confession" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unlockAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReactionCount" (
    "id" TEXT NOT NULL,
    "confessionId" TEXT NOT NULL,
    "heart" INTEGER NOT NULL DEFAULT 0,
    "laugh" INTEGER NOT NULL DEFAULT 0,
    "cry" INTEGER NOT NULL DEFAULT 0,
    "bloom" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReactionCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReactionCount_confessionId_key" ON "ReactionCount"("confessionId");

-- AddForeignKey
ALTER TABLE "ReactionCount" ADD CONSTRAINT "ReactionCount_confessionId_fkey" FOREIGN KEY ("confessionId") REFERENCES "Confession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

