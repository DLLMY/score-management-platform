"""NLP ML 服务共享叶子模块（无内部依赖，单向被各 mixin / 兄弟类导入）。

收容：可选依赖探测（xgboost/lightgbm/shap/catboost/gensim/transformers/torch）+
可用性 flag + MODEL_DIR 模型目录（单一来源）。

注意：各可选依赖在缺失时占位为 None，使消费模块可统一
`from services.nlp_ml._shared import <name>`（使用方均由 *_INSTALLED 守卫）。
"""

import os

try:
    import torch

    TORCH_AVAILABLE = True
except ImportError:
    torch = None
    TORCH_AVAILABLE = False

try:
    import xgboost as xgb

    XGB_INSTALLED = True
except ImportError:
    xgb = None
    XGB_INSTALLED = False

try:
    import lightgbm as lgb

    LGB_INSTALLED = True
except ImportError:
    lgb = None
    LGB_INSTALLED = False

try:
    import shap

    SHAP_INSTALLED = True
except ImportError:
    shap = None
    SHAP_INSTALLED = False

try:
    from catboost import CatBoostClassifier

    CATBOOST_INSTALLED = True
except ImportError:
    CatBoostClassifier = None
    CATBOOST_INSTALLED = False

try:
    from gensim.models import Doc2Vec, Word2Vec
    from gensim.models.doc2vec import TaggedDocument

    GENSIM_INSTALLED = True
except ImportError:
    Doc2Vec = None
    Word2Vec = None
    TaggedDocument = None
    GENSIM_INSTALLED = False

try:
    from transformers import BertModel, BertTokenizer

    TRANSFORMERS_INSTALLED = True
except ImportError:
    BertModel = None
    BertTokenizer = None
    TRANSFORMERS_INSTALLED = False

TEXTCNN_INSTALLED = True
BERT_INSTALLED = TRANSFORMERS_INSTALLED

MODEL_DIR = os.path.join(os.path.dirname(__file__), "../../models/trained")
os.makedirs(MODEL_DIR, exist_ok=True)
