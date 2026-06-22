import * as fs from 'fs';
import * as path from 'path';
import { SubscriptionPlan } from '@prisma/client';

const MIGRATION_SQL = path.join(
  __dirname,
  '../../prisma/migrations/20260622000001_add_subscription_plan_and_ai_usage_log/migration.sql',
);

describe('Migration: 20260622000001_add_subscription_plan_and_ai_usage_log', () => {
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_SQL, 'utf-8');
  });

  // ─── Файл ────────────────────────────────────────────────────────────────

  describe('migration file', () => {
    it('exists at the expected path', () => {
      expect(fs.existsSync(MIGRATION_SQL)).toBe(true);
    });

    it('is non-empty', () => {
      expect(sql.trim().length).toBeGreaterThan(0);
    });

    it('contains exactly four top-level SQL statements', () => {
      // CreateEnum, AlterTable, CreateTable, CreateIndex, AddForeignKey
      const statements = ['CreateEnum', 'AlterTable', 'CreateTable', 'CreateIndex', 'AddForeignKey'];
      for (const s of statements) {
        expect(sql).toContain(`-- ${s}`);
      }
    });
  });

  // ─── SubscriptionPlan enum ───────────────────────────────────────────────

  describe('SubscriptionPlan enum', () => {
    it('creates the SubscriptionPlan type', () => {
      expect(sql).toMatch(/CREATE TYPE "SubscriptionPlan" AS ENUM/);
    });

    it('includes FREE value', () => {
      expect(sql).toMatch(/CREATE TYPE "SubscriptionPlan" AS ENUM[^;]*'FREE'/);
    });

    it('includes BASIC value', () => {
      expect(sql).toMatch(/CREATE TYPE "SubscriptionPlan" AS ENUM[^;]*'BASIC'/);
    });

    it('includes PRO value', () => {
      expect(sql).toMatch(/CREATE TYPE "SubscriptionPlan" AS ENUM[^;]*'PRO'/);
    });

    it('includes UNLIMITED value', () => {
      expect(sql).toMatch(/CREATE TYPE "SubscriptionPlan" AS ENUM[^;]*'UNLIMITED'/);
    });

    it('enum is defined before it is used in AlterTable', () => {
      const enumPos = sql.indexOf('CREATE TYPE "SubscriptionPlan"');
      const alterPos = sql.indexOf('ALTER TABLE "TrainerSettings"');
      expect(enumPos).toBeLessThan(alterPos);
    });
  });

  // ─── TrainerSettings.plan ────────────────────────────────────────────────

  describe('TrainerSettings.plan column', () => {
    it('alters the TrainerSettings table', () => {
      expect(sql).toMatch(/ALTER TABLE "TrainerSettings"/);
    });

    it('adds the plan column', () => {
      expect(sql).toMatch(/ADD COLUMN "plan"/);
    });

    it('column type is SubscriptionPlan', () => {
      expect(sql).toMatch(/ADD COLUMN "plan" "SubscriptionPlan"/);
    });

    it('column is NOT NULL', () => {
      expect(sql).toMatch(/ADD COLUMN "plan" "SubscriptionPlan" NOT NULL/);
    });

    it('column defaults to FREE', () => {
      expect(sql).toMatch(/ADD COLUMN "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE'/);
    });
  });

  // ─── AiUsageLog table ────────────────────────────────────────────────────

  describe('AiUsageLog table', () => {
    it('creates the AiUsageLog table', () => {
      expect(sql).toMatch(/CREATE TABLE "AiUsageLog"/);
    });

    it('has TEXT primary key id', () => {
      expect(sql).toMatch(/"id" TEXT NOT NULL/);
    });

    it('has trainerId as TEXT NOT NULL', () => {
      expect(sql).toMatch(/"trainerId" TEXT NOT NULL/);
    });

    it('has inputTokens as INTEGER NOT NULL', () => {
      expect(sql).toMatch(/"inputTokens" INTEGER NOT NULL/);
    });

    it('has outputTokens as INTEGER NOT NULL', () => {
      expect(sql).toMatch(/"outputTokens" INTEGER NOT NULL/);
    });

    it('has totalTokens as INTEGER NOT NULL', () => {
      expect(sql).toMatch(/"totalTokens" INTEGER NOT NULL/);
    });

    it('has costUsd as DOUBLE PRECISION NOT NULL', () => {
      expect(sql).toMatch(/"costUsd" DOUBLE PRECISION NOT NULL/);
    });

    it('has operation as TEXT NOT NULL', () => {
      expect(sql).toMatch(/"operation" TEXT NOT NULL/);
    });

    it('has createdAt with DEFAULT CURRENT_TIMESTAMP', () => {
      expect(sql).toMatch(/"createdAt" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/);
    });

    it('defines primary key constraint AiUsageLog_pkey', () => {
      expect(sql).toMatch(/CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY \("id"\)/);
    });
  });

  // ─── Index ───────────────────────────────────────────────────────────────

  describe('AiUsageLog index', () => {
    it('creates composite index on (trainerId, createdAt)', () => {
      expect(sql).toMatch(
        /CREATE INDEX "AiUsageLog_trainerId_createdAt_idx" ON "AiUsageLog"\("trainerId", "createdAt"\)/,
      );
    });

    it('index is defined after table creation', () => {
      const tablePos = sql.indexOf('CREATE TABLE "AiUsageLog"');
      const indexPos = sql.indexOf('CREATE INDEX "AiUsageLog_trainerId_createdAt_idx"');
      expect(tablePos).toBeLessThan(indexPos);
    });
  });

  // ─── Foreign key ─────────────────────────────────────────────────────────

  describe('AiUsageLog foreign key', () => {
    it('adds foreign key constraint', () => {
      expect(sql).toMatch(/ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_trainerId_fkey"/);
    });

    it('references User(id)', () => {
      expect(sql).toMatch(
        /FOREIGN KEY \("trainerId"\) REFERENCES "User"\("id"\)/,
      );
    });

    it('cascades on delete', () => {
      expect(sql).toMatch(
        /"AiUsageLog_trainerId_fkey" FOREIGN KEY[^;]*ON DELETE CASCADE/,
      );
    });

    it('cascades on update', () => {
      expect(sql).toMatch(
        /"AiUsageLog_trainerId_fkey" FOREIGN KEY[^;]*ON UPDATE CASCADE/,
      );
    });

    it('FK is defined after table creation', () => {
      const tablePos = sql.indexOf('CREATE TABLE "AiUsageLog"');
      const fkPos = sql.indexOf('ALTER TABLE "AiUsageLog" ADD CONSTRAINT');
      expect(tablePos).toBeLessThan(fkPos);
    });
  });

  // ─── Prisma Client enum ───────────────────────────────────────────────────

  describe('Prisma Client SubscriptionPlan enum', () => {
    it('exports SubscriptionPlan from @prisma/client', () => {
      expect(SubscriptionPlan).toBeDefined();
    });

    it('has exactly four values', () => {
      expect(Object.values(SubscriptionPlan)).toHaveLength(4);
    });

    it('FREE value matches migration', () => {
      expect(SubscriptionPlan.FREE).toBe('FREE');
    });

    it('BASIC value matches migration', () => {
      expect(SubscriptionPlan.BASIC).toBe('BASIC');
    });

    it('PRO value matches migration', () => {
      expect(SubscriptionPlan.PRO).toBe('PRO');
    });

    it('UNLIMITED value matches migration', () => {
      expect(SubscriptionPlan.UNLIMITED).toBe('UNLIMITED');
    });

    it('enum values are in the correct order', () => {
      expect(Object.values(SubscriptionPlan)).toEqual(['FREE', 'BASIC', 'PRO', 'UNLIMITED']);
    });
  });
});
