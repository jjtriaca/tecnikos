-- AlterTable: Add GPS coordinates to ServiceAddress (updated by technician on arrival)
ALTER TABLE "ServiceAddress" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "ServiceAddress" ADD COLUMN "lng" DOUBLE PRECISION;

-- AlterTable: Add arrivedAt to ServiceOrder (when tech clicked "Cheguei")
ALTER TABLE "ServiceOrder" ADD COLUMN "arrivedAt" TIMESTAMP(3);
