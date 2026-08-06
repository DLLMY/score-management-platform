from models import db, get_by_id, User
from datetime import datetime


import time
import csv


class BatchWriter:
    """
    批量写入优化类
    使用bulk_insert_mappings和批量更新来提升写入性能。
    相比逐条插入，性能提升10倍以上。
    """

    def __init__(self, model_class, batch_size=100, auto_flush=True):
        """
        初始化批量写入器
        Args:
            model_class: SQLAlchemy模型类
            batch_size: 批量大小（默认100）
            auto_flush: 是否自动刷新到数据库
        """
        self.model_class = model_class
        self.batch_size = batch_size
        self.auto_flush = auto_flush
        self.buffer = []
        self.total_count = 0
        self.start_time = None

    def add(self, data_dict):
        """
        添加数据到缓冲区
        Args:
            data_dict: 数据字典（键为模型字段名）
        Returns:
            是否触发刷新
        """
        if self.start_time is None:
            self.start_time = time.time()
        self.buffer.append(data_dict)
        self.total_count += 1
        # 达到批量大小时自动刷新
        if self.auto_flush and len(self.buffer) >= self.batch_size:
            self.flush()
            return True
        return False

    def add_many(self, data_list):
        """
        批量添加多条数据
        Args:
            data_list: 数据字典列表
        Returns:
            刷新次数
        """
        flush_count = 0
        for data in data_list:
            if self.add(data):
                flush_count += 1
        return flush_count

    def flush(self):
        """
        将缓冲区数据批量写入数据库
        Returns:
            写入的记录数
        """
        if not self.buffer:
            return 0
        try:
            # 使用bulk_insert_mappings批量插入
            db.session.bulk_insert_mappings(self.model_class, self.buffer)
            db.session.commit()
            count = len(self.buffer)
            self.buffer = []
            return count
        except Exception as e:
            db.session.rollback()
            print(f"[BatchWriter] 批量写入失败: {e}")
            raise

    def finalize(self):
        """
        完成写入，刷新剩余数据并返回统计信息
        Returns:
            统计信息字典
        """
        # 刷新剩余数据
        self.flush()
        elapsed_time = time.time() - self.start_time if self.start_time else 0
        stats = {
            "total_count": self.total_count,
            "elapsed_time": elapsed_time,
            "records_per_second": self.total_count / elapsed_time if elapsed_time > 0 else 0,
            "batch_count": (self.total_count // self.batch_size) + 1,
        }
        print(
            f"[BatchWriter] 完成: {self.total_count} 条记录, "
            f"耗时 {elapsed_time:.2f}s, "
            f"速度 {stats['records_per_second']:.1f} 条/秒"
        )
        return stats


class BatchUpdater:
    """
    批量更新优化类
    使用批量UPDATE语句来提升更新性能。
    """

    @staticmethod
    def update_by_ids(model_class, ids, update_dict):
        """
        根据ID列表批量更新记录
        Args:
            model_class: SQLAlchemy模型类
            ids: ID列表
            update_dict: 更新字段字典
        Returns:
            更新的记录数
        """
        if not ids or not update_dict:
            return 0
        try:
            # 构建批量UPDATE语句
            count = db.session.query(model_class).filter(model_class.id.in_(ids)).filter(model_class.id.in_(ids))
            db.session.commit()
            return count
        except Exception as e:
            db.session.rollback()
            print(f"[BatchUpdater] 批量更新失败: {e}")
            raise

    @staticmethod
    def update_by_filter(model_class, filter_dict, update_dict):
        """
        根据过滤条件批量更新记录
        Args:
            model_class: SQLAlchemy模型类
            filter_dict: 过滤条件字典
            update_dict: 更新字段字典
        Returns:
            更新的记录数
        """
        if not update_dict:
            return 0
        try:
            query = db.session.query(model_class)
            # 应用过滤条件
            for key, value in filter_dict.items():
                query = query.filter(getattr(model_class, key) == value)
            # 执行批量更新
            count = query.update(update_dict, synchronize_session="fetch")
            db.session.commit()
            return count
        except Exception as e:
            db.session.rollback()
            print(f"[BatchUpdater] 批量更新失败: {e}")
            raise


class BatchDeleter:
    """
    批量删除优化类
    使用批量DELETE语句来提升删除性能。
    """

    @staticmethod
    def delete_by_ids(model_class, ids):
        """
        根据ID列表批量删除记录
        Args:
            model_class: SQLAlchemy模型类
            ids: ID列表
        Returns:
            删除的记录数
        """
        if not ids:
            return 0
        try:
            count = db.session.query(model_class).filter(model_class.id.in_(ids)).delete(synchronize_session="fetch")
            db.session.commit()
            return count
        except Exception as e:
            db.session.rollback()
            print(f"[BatchDeleter] 批量删除失败: {e}")
            raise

    @staticmethod
    def delete_by_filter(model_class, filter_dict):
        """
        根据过滤条件批量删除记录
        Args:
            model_class: SQLAlchemy模型类
            filter_dict: 过滤条件字典
        Returns:
            删除的记录数
        """
        try:
            query = db.session.query(model_class)
            # 应用过滤条件
            for key, value in filter_dict.items():
                query = query.filter(getattr(model_class, key) == value)
            count = query.delete(synchronize_session="fetch")
            db.session.commit()
            return count
        except Exception as e:
            db.session.rollback()
            print(f"[BatchDeleter] 批量删除失败: {e}")
            raise


def bulk_insert_users(users_data, batch_size=100):
    """
    批量插入用户数据
    Args:
        users_data: 用户数据字典列表
        batch_size: 批量大小
    Returns:
        统计信息
    """
    from models import User

    writer = BatchWriter(User, batch_size=batch_size)
    writer.add_many(users_data)
    return writer.finalize()


def bulk_insert_score_records(records_data, batch_size=100):
    """
    批量插入积分记录
    Args:
        records_data: 积分记录数据字典列表
        batch_size: 批量大小
    Returns:
        统计信息
    """
    from models import ScoreRecord

    # 添加创建时间（如果未提供）
    for record in records_data:
        if "created_at" not in record:
            record["created_at"] = datetime.now()
    writer = BatchWriter(ScoreRecord, batch_size=batch_size)
    writer.add_many(records_data)
    return writer.finalize()


def bulk_update_user_scores(user_scores_dict):
    """
    批量更新用户积分
    Args:
        user_scores_dict: {user_id: new_score} 字典
    Returns:
        更新统计
    """
    update_count = 0
    # 分批处理（避免单次更新过多）
    batch_size = 100
    user_ids = list(user_scores_dict.keys())
    for i in range(0, len(user_ids), batch_size):
        batch_ids = user_ids[i : i + batch_size]
        # 为每个用户单独更新（因为积分值不同）
        for user_id in batch_ids:
            try:
                user = get_by_id(User, user_id)
                if user:
                    user.current_score = user_scores_dict[user_id]
                    update_count += 1
            except Exception as e:
                print(f"[批量更新积分] 用户 {user_id} 更新失败: {e}")
        # 每批次提交一次
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"[批量更新积分] 批次提交失败: {e}")
    return {"updated_count": update_count}


def bulk_import_from_csv(csv_file_path, model_class, field_mapping=None, batch_size=100):
    """
    从CSV文件批量导入数据
    Args:
        csv_file_path: CSV文件路径
        model_class: 目标模型类
        field_mapping: 字段映射字典 {csv_column: model_field}
        batch_size: 批量大小
    Returns:
        导入统计
    """
    writer = BatchWriter(model_class, batch_size=batch_size)
    with open(csv_file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 应用字段映射
            if field_mapping:
                mapped_row = {}
                for csv_col, model_field in field_mapping.items():
                    if csv_col in row:
                        mapped_row[model_field] = row[csv_col]
                writer.add(mapped_row)
            else:
                writer.add(row)
    return writer.finalize()
