#!/usr/bin/env python3
"""
Azure PostgreSQL Database Migration Script
==========================================

This script manages database schema migrations for the FreshSwipe Azure deployment.

Usage:
    # Preview changes without applying them
    python3 scripts/db/migrate_azure_db.py --dry-run

    # Apply migrations
    python3 scripts/db/migrate_azure_db.py

    # Show current database schema
    python3 scripts/db/migrate_azure_db.py --show-schema

Environment Variables Required:
    AZURE_DB_HOST: PostgreSQL host (e.g., psql-freshswipe.postgres.database.azure.com)
    AZURE_DB_USER: Database username (e.g., freshswipe)
    AZURE_DB_PASSWORD: Database password
    AZURE_DB_NAME: Database name (default: freshswipe)
"""

import os
import sys
import argparse
from dataclasses import dataclass
from typing import Optional


@dataclass
class Migration:
    """Represents a database migration."""
    id: str
    description: str
    up_sql: str
    down_sql: str
    check_sql: Optional[str] = None  # SQL to check if migration is already applied


# Define all migrations
MIGRATIONS = [
    Migration(
        id="001_add_password_hash",
        description="Add password_hash column to users table for local authentication",
        up_sql="""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
        """,
        down_sql="""
            ALTER TABLE users 
            DROP COLUMN IF EXISTS password_hash;
        """,
        check_sql="""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'password_hash';
        """
    ),
    Migration(
        id="002_add_tenant_id",
        description="Add tenant_id column to users table for multi-tenant support",
        up_sql="""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);
        """,
        down_sql="""
            ALTER TABLE users 
            DROP COLUMN IF EXISTS tenant_id;
        """,
        check_sql="""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'tenant_id';
        """
    ),
]


def get_connection():
    """Get database connection using environment variables."""
    try:
        import psycopg2
    except ImportError:
        print("❌ psycopg2 is required. Install with: pip install psycopg2-binary")
        sys.exit(1)
    
    host = os.environ.get("AZURE_DB_HOST")
    user = os.environ.get("AZURE_DB_USER")
    password = os.environ.get("AZURE_DB_PASSWORD")
    dbname = os.environ.get("AZURE_DB_NAME", "freshswipe")
    
    if not all([host, user, password]):
        print("❌ Missing required environment variables.")
        print("\nRequired:")
        print("  AZURE_DB_HOST     - PostgreSQL host")
        print("  AZURE_DB_USER     - Database username")
        print("  AZURE_DB_PASSWORD - Database password")
        print("  AZURE_DB_NAME     - Database name (default: freshswipe)")
        print("\nExample:")
        print("  export AZURE_DB_HOST=psql-freshswipe.postgres.database.azure.com")
        print("  export AZURE_DB_USER=freshswipe")
        print("  export AZURE_DB_PASSWORD=your_password")
        sys.exit(1)
    
    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            dbname=dbname,
            sslmode="require"  # Azure requires SSL
        )
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        sys.exit(1)


def is_migration_applied(conn, migration: Migration) -> bool:
    """Check if a migration has already been applied."""
    if not migration.check_sql:
        return False
    
    with conn.cursor() as cur:
        cur.execute(migration.check_sql)
        result = cur.fetchone()
        return result is not None


def apply_migration(conn, migration: Migration, dry_run: bool = False) -> bool:
    """Apply a single migration."""
    already_applied = is_migration_applied(conn, migration)
    
    if already_applied:
        print(f"⏭️  SKIP: {migration.id} - {migration.description}")
        print(f"   └─ Already applied")
        return True
    
    if dry_run:
        print(f"🔍 WOULD APPLY: {migration.id} - {migration.description}")
        print(f"   └─ SQL: {migration.up_sql.strip()[:100]}...")
        return True
    
    try:
        with conn.cursor() as cur:
            cur.execute(migration.up_sql)
        conn.commit()
        print(f"✅ APPLIED: {migration.id} - {migration.description}")
        return True
    except Exception as e:
        conn.rollback()
        print(f"❌ FAILED: {migration.id} - {e}")
        return False


def rollback_migration(conn, migration: Migration, dry_run: bool = False) -> bool:
    """Rollback a single migration."""
    if dry_run:
        print(f"🔍 WOULD ROLLBACK: {migration.id}")
        print(f"   └─ SQL: {migration.down_sql.strip()[:100]}...")
        return True
    
    try:
        with conn.cursor() as cur:
            cur.execute(migration.down_sql)
        conn.commit()
        print(f"✅ ROLLED BACK: {migration.id}")
        return True
    except Exception as e:
        conn.rollback()
        print(f"❌ FAILED TO ROLLBACK: {migration.id} - {e}")
        return False


def show_schema(conn):
    """Show current database schema for users table."""
    print("\n📋 Current 'users' table schema:")
    print("=" * 60)
    
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        """)
        columns = cur.fetchall()
        
        if not columns:
            print("   ⚠️  Table 'users' not found")
            return
        
        print(f"{'Column':<25} {'Type':<20} {'Nullable':<10} {'Default':<20}")
        print("-" * 75)
        for col in columns:
            print(f"{col[0]:<25} {col[1]:<20} {col[2]:<10} {str(col[3] or ''):<20}")
    
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Manage Azure PostgreSQL database migrations for FreshSwipe"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without applying them"
    )
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback all migrations"
    )
    parser.add_argument(
        "--show-schema",
        action="store_true",
        help="Show current database schema"
    )
    parser.add_argument(
        "--migration",
        type=str,
        help="Apply or rollback a specific migration by ID"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🗄️  FreshSwipe Azure Database Migration Tool")
    print("=" * 60)
    
    conn = get_connection()
    print("✅ Connected to Azure PostgreSQL\n")
    
    if args.show_schema:
        show_schema(conn)
        conn.close()
        return
    
    migrations_to_run = MIGRATIONS
    if args.migration:
        migrations_to_run = [m for m in MIGRATIONS if m.id == args.migration]
        if not migrations_to_run:
            print(f"❌ Migration '{args.migration}' not found")
            print("\nAvailable migrations:")
            for m in MIGRATIONS:
                print(f"  - {m.id}: {m.description}")
            sys.exit(1)
    
    if args.rollback:
        print("🔄 Rolling back migrations...\n")
        for migration in reversed(migrations_to_run):
            rollback_migration(conn, migration, args.dry_run)
    else:
        mode = "DRY RUN" if args.dry_run else "APPLYING"
        print(f"📦 {mode} migrations...\n")
        
        success = True
        for migration in migrations_to_run:
            if not apply_migration(conn, migration, args.dry_run):
                success = False
                break
        
        if success:
            print("\n" + "=" * 60)
            if args.dry_run:
                print("✅ Dry run complete. Run without --dry-run to apply changes.")
            else:
                print("✅ All migrations applied successfully!")
            print("=" * 60)
        else:
            print("\n❌ Migration failed. Database rolled back to previous state.")
            sys.exit(1)
    
    if not args.dry_run:
        show_schema(conn)
    
    conn.close()


if __name__ == "__main__":
    main()
