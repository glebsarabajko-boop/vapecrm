-- CreateTable
CREATE TABLE "BotDialog" (
    "chatId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotDialog_pkey" PRIMARY KEY ("chatId")
);

