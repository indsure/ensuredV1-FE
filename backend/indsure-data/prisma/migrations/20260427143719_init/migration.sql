-- CreateTable
CREATE TABLE "Insurer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "registeredName" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "formerNames" TEXT NOT NULL DEFAULT '[]',
    "category" TEXT NOT NULL,
    "foundedYear" INTEGER,
    "notes" TEXT,
    "sourceCitation" TEXT NOT NULL,
    "dataAsOf" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "InsurerMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "insurerId" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" REAL,
    "valueText" TEXT,
    "dataSourceType" TEXT NOT NULL,
    "sourceCitation" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "InsurerMetric_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "Insurer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectorBenchmark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fiscalYear" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "sourceCitation" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MetricThreshold" (
    "metricName" TEXT NOT NULL PRIMARY KEY,
    "excellentMin" REAL,
    "goodMin" REAL,
    "concerningMin" REAL,
    "redFlagMax" REAL,
    "direction" TEXT NOT NULL,
    "interpretationText" TEXT NOT NULL,
    "misinterpretationWarning" TEXT NOT NULL,
    "sourceCitation" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ScoringProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weights" TEXT NOT NULL,
    "recommendedFor" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ScoringDimension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scoringCurve" TEXT NOT NULL,
    "sourceCitation" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "term" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortDefinition" TEXT NOT NULL,
    "longDefinition" TEXT NOT NULL,
    "example" TEXT,
    "relatedTerms" TEXT NOT NULL DEFAULT '[]',

    PRIMARY KEY ("term", "language")
);

-- CreateTable
CREATE TABLE "EducationalFact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "factText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceCitation" TEXT,
    "language" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UnresolvedInsurer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "extractedText" TEXT NOT NULL,
    "attemptedAt" TEXT NOT NULL,
    "resolvedInsurerId" TEXT,
    CONSTRAINT "UnresolvedInsurer_resolvedInsurerId_fkey" FOREIGN KEY ("resolvedInsurerId") REFERENCES "Insurer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataFreshness" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "dataLastRefreshed" TEXT NOT NULL,
    "irdaiAnnualReportYear" TEXT NOT NULL,
    "researchDocVersion" TEXT NOT NULL,
    "nextScheduledRefresh" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Insurer_brandName_idx" ON "Insurer"("brandName");

-- CreateIndex
CREATE INDEX "Insurer_category_idx" ON "Insurer"("category");

-- CreateIndex
CREATE INDEX "InsurerMetric_insurerId_fiscalYear_idx" ON "InsurerMetric"("insurerId", "fiscalYear");

-- CreateIndex
CREATE INDEX "InsurerMetric_metricName_idx" ON "InsurerMetric"("metricName");

-- CreateIndex
CREATE INDEX "SectorBenchmark_fiscalYear_segment_idx" ON "SectorBenchmark"("fiscalYear", "segment");

-- CreateIndex
CREATE INDEX "SectorBenchmark_metricName_idx" ON "SectorBenchmark"("metricName");

-- CreateIndex
CREATE INDEX "GlossaryTerm_language_idx" ON "GlossaryTerm"("language");

-- CreateIndex
CREATE INDEX "EducationalFact_category_idx" ON "EducationalFact"("category");

-- CreateIndex
CREATE INDEX "EducationalFact_language_idx" ON "EducationalFact"("language");

-- CreateIndex
CREATE INDEX "UnresolvedInsurer_extractedText_idx" ON "UnresolvedInsurer"("extractedText");
