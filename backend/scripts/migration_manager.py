#!/usr/bin/env python3
"""
数据库迁移管理系统
提供版本化的数据库迁移功能，支持迁移、回滚和状态查看
"""

import os
import sys
import json
import hashlib
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

class DatabaseMigrationManager:
    def __init__(self, migrations_dir: str = 'migrations'):
        self.migrations_dir = Path(migrations_dir)
        self.migrations_dir.mkdir(exist_ok=True)
        self.versions_file = self.migrations_dir / 'versions.json'
        self._init_versions_file()

    def _init_versions_file(self):
        if not self.versions_file.exists():
            self._save_versions({})

    def _load_versions(self) -> Dict[str, Any]:
        with open(self.versions_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_versions(self, versions: Dict[str, Any]):
        with open(self.versions_file, 'w', encoding='utf-8') as f:
            json.dump(versions, f, indent=2, ensure_ascii=False)

    def _generate_version_id(self, name: str) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        content = f"{name}_{timestamp}"
        return hashlib.md5(content.encode()).hexdigest()[:8]

    def create_migration(self, name: str, description: str = '') -> str:
        version_id = self._generate_version_id(name)
        migration_file = self.migrations_dir / f'{version_id}_{name}.py'

        template = f'''"""
Migration: {name}
Version: {version_id}
Created: {datetime.now().isoformat()}
{description}
"""

UP_SQL = """
-- 迁移SQL语句
"""

DOWN_SQL = """
-- 回滚SQL语句
"""

def upgrade(db):
    """执行迁移"""
    cursor = db.cursor()
    for statement in UP_SQL.split(';'):
        statement = statement.strip()
        if statement:
            cursor.execute(statement)
    db.commit()

def downgrade(db):
    """执行回滚"""
    cursor = db.cursor()
    for statement in DOWN_SQL.split(';'):
        statement = statement.strip()
        if statement:
            cursor.execute(statement)
    db.commit()
'''

        with open(migration_file, 'w', encoding='utf-8') as f:
            f.write(template)

        versions = self._load_versions()
        versions[version_id] = {
            'name': name,
            'description': description,
            'file': f'{version_id}_{name}.py',
            'created_at': datetime.now().isoformat(),
            'applied_at': None,
            'status': 'pending'
        }
        self._save_versions(versions)

        print(f"Migration created: {version_id}_{name}.py")
        return version_id

    def status(self) -> List[Dict[str, Any]]:
        versions = self._load_versions()
        return [
            {
                'version_id': vid,
                'name': vinfo['name'],
                'description': vinfo.get('description', ''),
                'status': vinfo.get('status', 'pending'),
                'applied_at': vinfo.get('applied_at'),
                'created_at': vinfo.get('created_at')
            }
            for vid, vinfo in versions.items()
        ]

    def pending_migrations(self) -> List[str]:
        versions = self._load_versions()
        return [
            vid for vid, vinfo in versions.items()
            if vinfo.get('status') == 'pending'
        ]

    def applied_migrations(self) -> List[str]:
        versions = self._load_versions()
        return [
            vid for vid, vinfo in versions.items()
            if vinfo.get('status') == 'applied'
        ]

    def migrate(self, db, target_version: Optional[str] = None) -> bool:
        versions = self._load_versions()

        if target_version:
            if target_version not in versions:
                print(f"Error: Version {target_version} not found")
                return False
            migrations_to_apply = [target_version]
        else:
            migrations_to_apply = self.pending_migrations()

        for version_id in sorted(migrations_to_apply):
            vinfo = versions[version_id]
            migration_file = self.migrations_dir / vinfo['file']

            if not migration_file.exists():
                print(f"Error: Migration file not found: {vinfo['file']}")
                return False

            try:
                sys.path.insert(0, str(self.migrations_dir))
                module_name = vinfo['file'][:-3]
                module = __import__(module_name)

                print(f"Applying migration: {version_id} - {vinfo['name']}")
                module.upgrade(db)

                versions[version_id]['status'] = 'applied'
                versions[version_id]['applied_at'] = datetime.now().isoformat()
                self._save_versions(versions)

                print(f"Migration {version_id} applied successfully")

            except Exception as e:
                print(f"Migration failed: {e}")
                db.rollback()
                return False
            finally:
                sys.path.pop(0)

        return True

    def rollback(self, db, steps: int = 1) -> bool:
        versions = self._load_versions()
        applied = [
            (vid, vinfo) for vid, vinfo in versions.items()
            if vinfo.get('status') == 'applied'
        ]

        if not applied:
            print("No migrations to rollback")
            return True

        applied = sorted(applied, key=lambda x: x[1].get('applied_at', ''), reverse=True)

        for i in range(min(steps, len(applied))):
            version_id, vinfo = applied[i]
            migration_file = self.migrations_dir / vinfo['file']

            try:
                sys.path.insert(0, str(self.migrations_dir))
                module_name = vinfo['file'][:-3]
                module = __import__(module_name)

                print(f"Rolling back: {version_id} - {vinfo['name']}")
                module.downgrade(db)

                versions[version_id]['status'] = 'pending'
                versions[version_id]['applied_at'] = None
                self._save_versions(versions)

                print(f"Rollback {version_id} completed successfully")

            except Exception as e:
                print(f"Rollback failed: {e}")
                db.rollback()
                return False
            finally:
                sys.path.pop(0)

        return True

    def seed(self, db, seed_name: Optional[str] = None) -> bool:
        seeds_dir = self.migrations_dir / 'seeds'
        seeds_dir.mkdir(exist=True)

        if seed_name:
            seed_file = seeds_dir / f'{seed_name}.py'
            if seed_file.exists():
                return self._run_seed_file(db, seed_file)
            else:
                print(f"Seed file not found: {seed_name}.py")
                return False

        seed_files = sorted(seeds_dir.glob('*.py'))
        for seed_file in seed_files:
            if not self._run_seed_file(db, seed_file):
                return False
        return True

    def _run_seed_file(self, db, seed_file: Path) -> bool:
        try:
            sys.path.insert(0, str(self.migrations_dir))
            module_name = seed_file.stem
            module = __import__(module_name)

            print(f"Running seed: {seed_file.name}")
            if hasattr(module, 'seed'):
                module.seed(db)
            print(f"Seed {seed_file.name} completed")
            return True
        except Exception as e:
            print(f"Seed failed: {e}")
            return False
        finally:
            sys.path.pop(0)


def create_initial_migration():
    manager = DatabaseMigrationManager()
    manager.create_migration(
        'initial_schema',
        '创建初始数据库结构'
    )
    print("Initial migration created. Edit the file to add your schema.")


if __name__ == '__main__':
    import sqlite3

    db_path = os.getenv('DATABASE_PATH', 'instance/score_platform.db')
    db = sqlite3.connect(db_path)

    manager = DatabaseMigrationManager()

    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'create':
            name = sys.argv[2] if len(sys.argv) > 2 else 'new_migration'
            desc = sys.argv[3] if len(sys.argv) > 3 else ''
            manager.create_migration(name, desc)
        elif command == 'status':
            for m in manager.status():
                print(m)
        elif command == 'migrate':
            target = sys.argv[2] if len(sys.argv) > 2 else None
            manager.migrate(db, target)
        elif command == 'rollback':
            steps = int(sys.argv[2]) if len(sys.argv) > 2 else 1
            manager.rollback(db, steps)
        elif command == 'seed':
            seed_name = sys.argv[2] if len(sys.argv) > 2 else None
            manager.seed(db, seed_name)
        elif command == 'init':
            create_initial_migration()
    else:
        print("Usage: python migration_manager.py [create|status|migrate|rollback|seed|init]")
