/*
  Warnings:

  - You are about to drop the column `cloneVoiceId` on the `Agent` table. All the data in the column will be lost.
  - You are about to drop the column `useClonedVoice` on the `Agent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "cloneVoiceId",
DROP COLUMN "useClonedVoice";
