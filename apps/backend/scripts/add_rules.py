import requests

r = requests.post(
    "http://localhost:5000/api/admins/login",
    json={"username": "admin", "password": "123456"},
    timeout=30,
)
token = r.json()["access_token"]

rules = [
    {
        "behavior_keyword": "发言",
        "behavior_description": "上课积极发言",
        "score_value": 5,
        "score_type": "add",
        "behavior_tags": ["课堂表现"],
    },
    {
        "behavior_keyword": "积极发言",
        "behavior_description": "课堂上积极发言回答问题",
        "score_value": 5,
        "score_type": "add",
        "behavior_tags": ["课堂表现"],
    },
    {
        "behavior_keyword": "回答问题",
        "behavior_description": "主动回答老师问题",
        "score_value": 5,
        "score_type": "add",
        "behavior_tags": ["课堂表现"],
    },
    {
        "behavior_keyword": "积极回答",
        "behavior_description": "积极回答课堂问题",
        "score_value": 5,
        "score_type": "add",
        "behavior_tags": ["课堂表现"],
    },
    {
        "behavior_keyword": "上课发言",
        "behavior_description": "上课时主动发言",
        "score_value": 5,
        "score_type": "add",
        "behavior_tags": ["课堂表现"],
    },
]

for rule in rules:
    r2 = requests.post(
        "http://localhost:5000/api/nlp/rules",
        json=rule,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    print(f"添加规则: {rule['behavior_keyword']} -> {r2.json().get('message', '未知')}")

print("---测试解析---")
r3 = requests.post(
    "http://localhost:5000/api/nlp/parse",
    json={"text": "金政伟上课积极发言"},
    headers={"Authorization": f"Bearer {token}"},
    timeout=30,
)
result = r3.json()["data"]
print(
    f"意图: {result['intent']}, 置信度: {result['confidence']*100}%, 匹配规则数: {len(result['matched_rules'])}"
)
if result["matched_rules"]:
    for rule in result["matched_rules"]:
        print(f"  - {rule['behavior_keyword']}: {rule['score_value']}分")
