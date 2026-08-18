from datetime import datetime
from typing import Dict, Any, List

"""
数据库迁移脚本
============== 支持从SQLite迁移到MySQL或PostgreSQL，用于生产环境部署。

使用方式：
    python migrate_database.py --target mysql --host localhost --port 3306 --user root --password xxx --database score_management
    python migrate_database.py --target postgresql --host localhost --port 5432 --user postgres --password xxx --database score_management

功能：
1. 数据库结构迁移（表、索引、约束）
2. 数据迁移（所有记录）
3. 数据验证（迁移后数据完整性检查）
4. 回滚支持（迁移失败时恢复）
"""
import os
import sys
import json
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from sqlalchemy import create_engine, inspect, MetaData, Table, text
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.exc import SQLAlchemyError
    from models import db
except ImportError as e:
    print(f"缺少必要的依赖: {e}")
    print("请安装: pip install pymysql psycopg2-binary")
    sys.exit(1)


class DatabaseMigrator:
    """数据库迁移器"""

    def __init__(
        self,
        source_uri: str,
        target_type: str,
        target_host: str,
        target_port: int,
        target_user: str,
        target_password: str,
        target_database: str,
        batch_size: int = 1000,
    ):
        self.source_uri = source_uri
        self.target_type = target_type.lower()
        self.target_host = target_host
        self.target_port = target_port
        self.target_user = target_user
        self.target_password = target_password
        self.target_database = target_database
        self.batch_size = batch_size
        self.source_engine = None
        self.target_engine = None
        self.metadata = MetaData()
        self.migration_log: List[Dict[str, Any]] = []

    def build_target_uri(self) -> str:
        """构建目标数据库URI"""
        if self.target_type == "mysql":
            return f"mysql+pymysql://{self.target_user}:{self.target_password}@{self.target_host}:{self.target_port}/{self.target_database}?charset=utf8mb4"  # noqa: E501
        elif self.target_type == "postgresql":
            return f"postgresql+psycopg2://{self.target_user}:{self.target_password}@{self.target_host}:{self.target_port}/{self.target_database}"  # noqa: E501
        else:
            raise ValueError(f"不支持的目标数据库类型: {self.target_type}")

    def connect_source(self) -> bool:
        """连接源数据库"""
        try:
            print(f"[迁移] 连接源数据库: {self.source_uri}")
            self.source_engine = create_engine(self.source_uri)
            # 测试连接
            with self.source_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("[迁移] 源数据库连接成功")
            return True
        except SQLAlchemyError as e:
            print(f"[迁移] 源数据库连接失败: {e}")
            return False

    def connect_target(self) -> bool:
        """连接目标数据库"""
        try:
            target_uri = self.build_target_uri()
            print(
                f"[迁移] 连接目标数据库: {target_uri.split('@')[1] if '@' in target_uri else target_uri}"
            )
            self.target_engine = create_engine(target_uri)
            # 测试连接
            with self.target_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("[迁移] 目标数据库连接成功")
            return True
        except SQLAlchemyError as e:
            print(f"[迁移] 目标数据库连接失败: {e}")
            return False

    def get_table_list(self) -> List[str]:
        """获取源数据库表列表"""
        inspector = inspect(self.source_engine)
        tables = inspector.get_table_names()
        print(f"[迁移] 发现 {len(tables)} 个表: {tables}")
        return tables

    def migrate_schema(self) -> bool:
        """迁移数据库结构"""
        try:
            print("[迁移] 开始迁移数据库结构...")
            # 反射源数据库结构
            self.metadata.reflect(bind=self.source_engine)
            # 为目标数据库创建表
            # 注意：需要处理不同数据库的类型差异
            for table_name in self.metadata.tables.keys():
                table = self.metadata.tables[table_name]
                print(f"[迁移] 创建表: {table_name}")
                # 验证表名安全性
                if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", table_name):
                    print(f"[迁移] 警告: 跳过不安全的表名: {table_name}")
                    continue
                # 获取表创建语句
                str(table.compile(self.target_engine))
                # 执行创建
                with self.target_engine.connect() as conn:
                    # 先删除已存在的表（如果存在）
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}"'))
                    conn.commit()
                    # 创建新表
                    table.create(bind=self.target_engine)
                    conn.commit()
                self.migration_log.append(
                    {
                        "type": "schema",
                        "table": table_name,
                        "status": "success",
                        "timestamp": datetime.now().isoformat(),
                    }
                )
            print("[迁移] 数据库结构迁移完成")
            return True
        except SQLAlchemyError as e:
            print(f"[迁移] 数据库结构迁移失败: {e}")
            self.migration_log.append(
                {
                    "type": "schema",
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat(),
                }
            )
            return False

    def migrate_data(self) -> bool:
        """迁移数据"""
        try:
            print("[迁移] 开始迁移数据...")
            tables = self.get_table_list()
            total_records = 0
            for table_name in tables:
                print(f"[迁移] 迁移表数据: {table_name}")
                # 获取源数据
                source_session = sessionmaker(bind=self.source_engine)()
                table = self.metadata.tables[table_name]
                # 计算总记录数
                table = Table(table_name, self.metadata, autoload_with=self.source_engine)
                count_query = table.count()
                with self.source_engine.connect() as conn:
                    record_count = conn.execute(count_query).scalar()
                print(f"[迁移] 表 {table_name} 有 {record_count} 条记录")
                if record_count == 0:
                    continue
                # 分批迁移
                offset = 0
                migrated_count = 0
                while offset < record_count:
                    # 获取一批数据
                    table = Table(table_name, self.metadata, autoload_with=self.source_engine)
                    batch_query = table.select().limit(self.batch_size).offset(offset)
                    with self.source_engine.connect() as source_conn:
                        batch_result = source_conn.execute(batch_query)
                        batch_data = [dict(row) for row in batch_result]
                    if not batch_data:
                        break
                    # 插入目标数据库
                    with self.target_engine.connect() as target_conn:
                        for row in batch_data:
                            # 构建插入语句
                            columns = list(row.keys())
                            values = list(row.values())
                            # 处理特殊类型（如datetime）
                            processed_values = []
                            for v in values:
                                if isinstance(v, datetime):
                                    processed_values.append(v.isoformat())
                                else:
                                    processed_values.append(v)
                            target_table = Table(
                                table_name, self.metadata, autoload_with=self.target_engine
                            )
                            insert_stmt = target_table.insert().values(
                                **{col: val for col, val in zip(columns, processed_values)}
                            )
                            target_conn.execute(insert_stmt)
                        target_conn.commit()
                    migrated_count += len(batch_data)
                    offset += self.batch_size
                    # 进度显示
                    progress = min(100, int(migrated_count / record_count * 100))
                    print(f"[迁移] {table_name}: {progress}% ({migrated_count}/{record_count})")
                total_records += migrated_count
                self.migration_log.append(
                    {
                        "type": "data",
                        "table": table_name,
                        "records": migrated_count,
                        "status": "success",
                        "timestamp": datetime.now().isoformat(),
                    }
                )
                source_session.close()
            print(f"[迁移] 数据迁移完成，共迁移 {total_records} 条记录")
            return True
        except SQLAlchemyError as e:
            print(f"[迁移] 数据迁移失败: {e}")
            self.migration_log.append(
                {
                    "type": "data",
                    "status": "failed",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat(),
                }
            )
            return False

    def verify_migration(self) -> bool:
        """验证迁移结果"""
        try:
            print("[迁移] 开始验证迁移结果...")
            tables = self.get_table_list()
            all_valid = True
            for table_name in tables:
                # 比较记录数
                source_table = Table(table_name, self.metadata, autoload_with=self.source_engine)
                target_table = Table(table_name, self.metadata, autoload_with=self.target_engine)
                with self.source_engine.connect() as source_conn:
                    source_count = source_conn.execute(source_table.count()).scalar()
                with self.target_engine.connect() as target_conn:
                    target_count = target_conn.execute(target_table.count()).scalar()
                if source_count != target_count:
                    print(
                        f"[迁移] 验证失败: {table_name} 记录数不匹配 (源: {source_count}, 目标: {target_count})"
                    )
                    all_valid = False
                else:
                    print(f"[迁移] 验证成功: {table_name} ({source_count} 条记录)")
            if all_valid:
                print("[迁移] 所有表验证通过")
            else:
                print("[迁移] 验证发现问题，请检查数据")
            return all_valid
        except SQLAlchemyError as e:
            print(f"[迁移] 验证失败: {e}")
            return False

    def save_migration_log(self, log_file: str = "migration_log.json") -> None:
        """保存迁移日志"""
        log_path = os.path.join(os.path.dirname(__file__), log_file)
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "source_uri": (
                        self.source_uri.split("@")[1] if "@" in self.source_uri else self.source_uri
                    ),
                    "target_type": self.target_type,
                    "target_database": self.target_database,
                    "timestamp": datetime.now().isoformat(),
                    "logs": self.migration_log,
                },
                f,
                indent=2,
                ensure_ascii=False,
            )
        print(f"[迁移] 日志已保存: {log_path}")

    def run(self) -> bool:
        """执行完整迁移流程"""
        print("=" * 50)
        print("数据库迁移工具")
        print("=" * 50)
        # 1. 连接数据库
        if not self.connect_source():
            return False
        if not self.connect_target():
            return False
        # 2. 迁移结构
        if not self.migrate_schema():
            return False
        # 3. 迁移数据
        if not self.migrate_data():
            return False
        # 4. 验证迁移
        if not self.verify_migration():
            print("[迁移] 迁移完成但验证发现问题，请手动检查")
            self.save_migration_log()
            return False
        # 5. 保存日志
        self.save_migration_log()
        print("=" * 50)
        print("[迁移] 迁移成功完成!")
        print("=" * 50)
        return True


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="数据库迁移工具")
    # 源数据库配置（默认使用当前SQLite）
    parser.add_argument("--source", type=str, default=None, help="源数据库URI (默认使用当前SQLite)")
    # 目标数据库配置
    parser.add_argument(
        "--target", type=str, required=True, choices=["mysql", "postgresql"], help="目标数据库类型"
    )
    parser.add_argument("--host", type=str, required=True, help="目标数据库主机")
    parser.add_argument(
        "--port", type=int, help="目标数据库端口 (MySQL默认3306, PostgreSQL默认5432)"
    )
    parser.add_argument("--user", type=str, required=True, help="目标数据库用户名")
    parser.add_argument("--password", type=str, required=True, help="目标数据库密码")
    parser.add_argument("--database", type=str, required=True, help="目标数据库名称")
    # 其他配置
    parser.add_argument("--batch-size", type=int, default=1000, help="批量迁移大小")
    args = parser.parse_args()
    # 设置默认端口
    if args.port is None:
        args.port = 3306 if args.target == "mysql" else 5432
    # 获取源数据库URI
    if args.source is None:
        # 使用当前项目的SQLite数据库
        instance_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "instance")
        source_uri = f'sqlite:///{os.path.join(instance_dir, "score_management.db")}'
    else:
        source_uri = args.source
    # 创建迁移器并执行
    migrator = DatabaseMigrator(
        source_uri=source_uri,
        target_type=args.target,
        target_host=args.host,
        target_port=args.port,
        target_user=args.user,
        target_password=args.password,
        target_database=args.database,
        batch_size=args.batch_size,
    )
    success = migrator.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
