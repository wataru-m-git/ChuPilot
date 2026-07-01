-- Drop legacy individual genotype columns
-- These columns (Ehf_cKO, CMV_Ehf_flox, etc.) are not used in the current UI
-- GUI uses strain + genotypes (JSON) instead

DROP INDEX IF EXISTS "Mouse_name_key";

ALTER TABLE "Mouse" RENAME TO "Mouse_temp";

CREATE TABLE "Mouse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "strain" TEXT,
    "mother_id" TEXT,
    "father_id" TEXT,
    "birth_day" DATETIME,
    "sex" TEXT,
    "color" TEXT,
    "marking" TEXT,
    "cage_id" INTEGER,
    "genotypes" TEXT,
    "typing_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,
    CONSTRAINT "Mouse_cage_id_fkey" FOREIGN KEY ("cage_id") REFERENCES "Cage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mouse_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Mouse_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Mouse_name_key" ON "Mouse"("name");

INSERT INTO "Mouse" (
    "id", "name", "strain", "mother_id", "father_id", "birth_day",
    "sex", "color", "marking", "cage_id", "genotypes", "typing_date",
    "status", "notes", "created_at", "updated_at", "created_by", "updated_by"
) SELECT
    "id", "name", "strain", "mother_id", "father_id", "birth_day",
    "sex", "color", "marking", "cage_id", "genotypes", "typing_date",
    "status", "notes", "created_at", "updated_at", "created_by", "updated_by"
FROM "Mouse_temp";

DROP TABLE "Mouse_temp";
