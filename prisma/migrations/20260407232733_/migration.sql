-- AlterTable
ALTER TABLE "public"."conversion" ALTER COLUMN "usdcAmount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."order" ALTER COLUMN "totalUsdc" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."product" ALTER COLUMN "priceUsdc" SET DATA TYPE DOUBLE PRECISION;
