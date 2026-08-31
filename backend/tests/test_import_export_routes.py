"""数据导入端点行为测试（F17 防腐层迁移前后一致性基线）。

契约：
- POST /api/import_export/import/users      用户导入：200，data.imported_count 正确，落库 User
- POST /api/import_export/import/rules      规则导入：200，imported_count 正确，落库 ScoreRule
- POST /api/import_export/import/categories 分类导入：200，imported_count 正确，落库 ScoreCategory
- 未上传文件 → 400（"请选择要导入的文件"）

迁移核心契约：行级建模 + 提交/回滚事务边界（bulk_import_users / bulk_import_rules /
bulk_import_categories）由 services/import_export_service 逐字节复刻；路由退化为薄壳
（文件解析 + 模板校验 + 响应构造），不再出现任何 db.session 调用（#629 收口）。
"""

import csv
import io

from models import User, ScoreRule, ScoreCategory, db


def _csv_bytes(headers, data_rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(data_rows)
    return buf.getvalue().encode("utf-8")


def _upload(client, path, filename, content, auth_headers):
    return client.post(
        path,
        data={"file": (io.BytesIO(content), filename)},
        content_type="multipart/form-data",
        headers=auth_headers,
    )


def test_import_users(client, app, auth_headers):
    content = _csv_bytes(
        ["姓名", "性别", "班级", "联系电话", "饭卡号", "备注"],
        [["张三", "男", "", "13800138001", "CARD001", ""]],
    )
    with app.app_context():
        resp = _upload(
            client, "/api/import_export/import/users", "users.csv", content, auth_headers
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["imported_count"] == 1
    with app.app_context():
        assert User.query.filter_by(card_id="CARD001").first() is not None


def test_import_users_no_file(client, app, auth_headers):
    with app.app_context():
        resp = client.post("/api/import_export/import/users", headers=auth_headers)
    assert resp.status_code == 400
    assert "请选择要导入的文件" in resp.get_json()["message"]


def test_import_categories(client, app, auth_headers):
    content = _csv_bytes(
        ["分类名称", "描述", "颜色"],
        [["测试导入分类", "导入测试", "#3B82F6"]],
    )
    with app.app_context():
        resp = _upload(
            client, "/api/import_export/import/categories", "cats.csv", content, auth_headers
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["imported_count"] == 1
    with app.app_context():
        assert ScoreCategory.query.filter_by(name="测试导入分类").first() is not None


def test_import_rules(client, app, auth_headers):
    with app.app_context():
        cat = ScoreCategory(name="导入规则分类", description="", color="#3B82F6")
        db.session.add(cat)
        db.session.commit()
        cat_id = cat.id
    content = _csv_bytes(
        ["规则名称", "描述", "分类名称", "分数", "是否启用", "每日上限", "最小间隔(分钟)"],
        [["导入测试规则", "规则导入测试", "导入规则分类", 5, "是", 1, 0]],
    )
    with app.app_context():
        resp = _upload(
            client, "/api/import_export/import/rules", "rules.csv", content, auth_headers
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["imported_count"] == 1
    with app.app_context():
        rule = ScoreRule.query.filter_by(name="导入测试规则").first()
        assert rule is not None
        assert rule.category_id == cat_id
