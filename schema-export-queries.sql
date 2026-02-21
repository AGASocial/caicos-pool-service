-- ============================================
-- SUPABASE SCHEMA EXPORT & RECREATION SCRIPT
-- ============================================
-- Run these queries in your Supabase SQL Editor
-- to get the structure of all tables

-- ============================================
-- 1. GET DETAILED TABLE STRUCTURE
-- ============================================
-- Run this first to see all tables and columns

SELECT
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY' ELSE '' END as constraint_type,
    c.ordinal_position
FROM
    information_schema.tables t
    LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    LEFT JOIN information_schema.table_constraints tc ON t.table_name = tc.table_name AND tc.constraint_type = 'PRIMARY KEY' AND t.table_schema = tc.table_schema
    LEFT JOIN information_schema.key_column_usage pk ON tc.constraint_name = pk.constraint_name AND c.column_name = pk.column_name
WHERE
    t.table_schema = 'public'
ORDER BY
    t.table_name, c.ordinal_position;

-- ============================================
-- 2. LIST ALL TABLES WITH ROW COUNTS
-- ============================================

SELECT
    tablename as table_name,
    schemaname as schema,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename AND table_schema = 'public') as column_count
FROM
    pg_tables t
WHERE
    schemaname = 'public'
ORDER BY
    tablename;

-- ============================================
-- 3. GET FOREIGN KEY RELATIONSHIPS
-- ============================================

SELECT
    constraint_name,
    table_name,
    column_name,
    foreign_table_name,
    foreign_column_name
FROM (
    SELECT
        constraint_name,
        table_name,
        column_name,
        foreign_table_name,
        foreign_column_name,
        row_number() OVER (PARTITION BY constraint_name ORDER BY ordinal_position) as rn
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
        ON rc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
    WHERE rc.constraint_schema = 'public'
) t
WHERE rn = 1
ORDER BY table_name, constraint_name;

-- ============================================
-- 4. GET ALL INDEXES
-- ============================================

SELECT
    tablename,
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    schemaname = 'public'
ORDER BY
    tablename, indexname;

-- ============================================
-- 5. GET ROW LEVEL SECURITY POLICIES
-- ============================================

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    qual,
    with_check
FROM
    pg_policies
WHERE
    schemaname = 'public'
ORDER BY
    tablename, policyname;

-- ============================================
-- 6. GET FUNCTIONS AND TRIGGERS
-- ============================================

SELECT
    routine_name,
    routine_type,
    routine_definition
FROM
    information_schema.routines
WHERE
    routine_schema = 'public'
ORDER BY
    routine_name;

-- ============================================
-- 7. EXPORT COMPLETE SCHEMA (PostgreSQL dump format)
-- ============================================
-- For full recreation, use pg_dump from command line:
--
-- pg_dump \
--   --host=lrnhrzpwgyhkruwxeppw.supabase.co \
--   --port=5432 \
--   --username=postgres \
--   --password \
--   --database=postgres \
--   --schema=public \
--   --schema-only \
--   > caicos_schema.sql
--
-- Then restore with:
-- psql -f caicos_schema.sql

-- ============================================
-- 8. QUICK SCHEMA SUMMARY
-- ============================================

WITH table_info AS (
    SELECT
        t.table_name,
        COUNT(c.column_name) as column_count,
        COUNT(DISTINCT CASE WHEN pk.column_name IS NOT NULL THEN pk.column_name END) as pk_count,
        COUNT(DISTINCT CASE WHEN c.column_default IS NOT NULL THEN c.column_name END) as default_count
    FROM
        information_schema.tables t
        LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
        LEFT JOIN information_schema.table_constraints tc ON t.table_name = tc.table_name AND tc.constraint_type = 'PRIMARY KEY'
        LEFT JOIN information_schema.key_column_usage pk ON tc.constraint_name = pk.constraint_name AND c.column_name = pk.column_name
    WHERE
        t.table_schema = 'public'
    GROUP BY
        t.table_name
)
SELECT
    table_name,
    column_count,
    pk_count,
    default_count
FROM
    table_info
ORDER BY
    table_name;

-- ============================================
-- NEXT STEPS
-- ============================================
--
-- 1. Run query #1 above to see detailed structure
-- 2. Export results to CSV or copy to text file
-- 3. Use this info to create CREATE TABLE statements
-- 4. Or use pg_dump command for complete export
--
-- SECURITY NOTE:
-- - Don't share your SUPABASE_URL or API keys publicly
-- - Regenerate keys if you've exposed them
-- - Use Service Role key only in secure environments
