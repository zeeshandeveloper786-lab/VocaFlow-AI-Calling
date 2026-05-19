-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "knowledgeDocId" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_knowledgeDocId_fkey" FOREIGN KEY ("knowledgeDocId") REFERENCES "KnowledgeDoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
