"""特征工程服务（词向量/TF-IDF/文本向量化，含 gensim/transformers 可选依赖）。"""

import jieba
import numpy as np
import scipy.sparse as sp
from sklearn.decomposition import NMF, PCA, TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_selection import SelectKBest, chi2, f_classif, mutual_info_classif
from sklearn.preprocessing import MinMaxScaler, RobustScaler, StandardScaler

from services.nlp_ml._shared import (
    GENSIM_INSTALLED,
    TORCH_AVAILABLE,
    TRANSFORMERS_INSTALLED,
    BertModel,
    BertTokenizer,
    Doc2Vec,
    TaggedDocument,
    Word2Vec,
    torch,
)


class FeatureEngineeringService:
    def __init__(self):
        self.vectorizer = None
        self.w2v_model = None
        self.d2v_model = None
        self.bert_model = None
        self.bert_tokenizer = None
        self.svd_model = None
        self.pca_model = None
        self.feature_selectors = {}
        self.embedding_models = {}

    def build_tfidf_features(self, texts, max_features=3000, ngram_range=(1, 4)):
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            analyzer="char_wb",
            lowercase=False,
        )
        return self.vectorizer.fit_transform(texts)

    def build_char_features(self, texts, max_features=2000, ngram_range=(1, 5)):
        char_vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            analyzer="char",
            lowercase=False,
        )
        return char_vectorizer.fit_transform(texts)

    def build_word_features(self, texts, max_features=2000, ngram_range=(1, 2)):
        tokenized_texts = [" ".join(jieba.lcut(text)) for text in texts]
        word_vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=ngram_range,
            analyzer="word",
            lowercase=False,
        )
        return word_vectorizer.fit_transform(tokenized_texts)

    def build_w2v_features(self, texts, vector_size=100, window=5, min_count=1):
        if not GENSIM_INSTALLED:
            return None
        tokenized_texts = [jieba.lcut(text) for text in texts]
        self.w2v_model = Word2Vec(
            tokenized_texts,
            vector_size=vector_size,
            window=window,
            min_count=min_count,
            workers=4,
            epochs=10,
        )
        features = []
        for tokens in tokenized_texts:
            vectors = [self.w2v_model.wv[token] for token in tokens if token in self.w2v_model.wv]
            if vectors:
                features.append(sum(vectors) / len(vectors))
            else:
                features.append([0] * vector_size)
        return features

    def build_doc2vec_features(self, texts, vector_size=100, window=5, min_count=1):
        if not GENSIM_INSTALLED:
            return None
        tokenized_texts = [jieba.lcut(text) for text in texts]
        tagged_docs = [
            TaggedDocument(words=tokens, tags=[str(i)]) for i, tokens in enumerate(tokenized_texts)
        ]
        self.d2v_model = Doc2Vec(
            tagged_docs,
            vector_size=vector_size,
            window=window,
            min_count=min_count,
            workers=4,
            epochs=10,
            dm=1,
        )
        features = []
        for tokens in tokenized_texts:
            features.append(self.d2v_model.infer_vector(tokens))
        return features

    def build_bert_features(self, texts, model_name="bert-base-chinese", max_length=64):
        if not TRANSFORMERS_INSTALLED or not TORCH_AVAILABLE:
            return None
        self.bert_tokenizer = BertTokenizer.from_pretrained(model_name, revision="main")  # nosec
        self.bert_model = BertModel.from_pretrained(model_name, revision="main")  # nosec
        self.bert_model.eval()
        features = []
        for text in texts:
            inputs = self.bert_tokenizer(
                text,
                padding="max_length",
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            )
            with torch.no_grad():
                outputs = self.bert_model(**inputs)
            cls_embedding = outputs.last_hidden_state[:, 0, :].numpy().flatten()
            features.append(cls_embedding)
        return features

    def build_statistical_features(self, texts):
        features = []
        for text in texts:
            text_len = len(text)
            if self.jieba_initialized:
                words = jieba.lcut(text)
                word_count = len(words)
                avg_word_len = sum(len(word) for word in words) / max(word_count, 1)
            else:
                word_count = text_len
                avg_word_len = 1.0
            digit_count = sum(1 for char in text if char.isdigit())
            punctuation_count = sum(1 for char in text if char in "，。！？、；：“”‘’（）【】")
            whitespace_count = sum(1 for char in text if char.isspace())
            features.append(
                [
                    text_len,
                    word_count,
                    avg_word_len,
                    digit_count,
                    punctuation_count,
                    whitespace_count,
                    digit_count / max(text_len, 1),
                    punctuation_count / max(text_len, 1),
                ]
            )
        return np.array(features)

    def combine_features(self, *feature_list):
        valid_features = []
        for features in feature_list:
            if features is None:
                continue
            if sp.issparse(features):
                valid_features.append(features.toarray())
            else:
                valid_features.append(np.array(features))
        if not valid_features:
            return None
        combined = np.hstack(valid_features)
        return sp.csr_matrix(combined)

    def apply_dimensionality_reduction(self, features, n_components=100, method="svd"):
        if method == "pca":
            if sp.issparse(features):
                features = features.toarray()
            self.pca_model = PCA(n_components=n_components, random_state=42)
            return self.pca_model.fit_transform(features)
        if method == "nmf":
            if sp.issparse(features):
                features = features.toarray()
            nmf_model = NMF(n_components=n_components, random_state=42, init="nndsvda")
            return nmf_model.fit_transform(features)
        self.svd_model = TruncatedSVD(n_components=n_components, random_state=42)
        return self.svd_model.fit_transform(features)

    def apply_feature_selection(self, features, labels, k=500, method="chi2"):
        if method == "f_classif":
            selector = SelectKBest(f_classif, k=min(k, features.shape[1]))
        elif method == "mutual_info":
            selector = SelectKBest(mutual_info_classif, k=min(k, features.shape[1]))
        else:
            selector = SelectKBest(chi2, k=min(k, features.shape[1]))
        self.feature_selectors[method] = selector
        return selector.fit_transform(features, labels)

    def apply_scaling(self, features, method="standard"):
        if method == "minmax":
            scaler = MinMaxScaler()
        elif method == "robust":
            scaler = RobustScaler()
        else:
            scaler = StandardScaler(with_mean=False)
        if sp.issparse(features):
            return scaler.fit_transform(features)
        return scaler.fit_transform(features)

    def build_hybrid_features(
        self,
        texts,
        use_w2v=True,
        use_doc2vec=True,
        use_char=True,
        use_word=True,
        use_stat=True,
        use_bert=False,
    ):
        features_list = []
        tfidf_features = self.build_tfidf_features(texts)
        features_list.append(tfidf_features)
        if use_char:
            char_features = self.build_char_features(texts)
            features_list.append(char_features)
        if use_word:
            word_features = self.build_word_features(texts)
            features_list.append(word_features)
        if use_w2v:
            w2v_features = self.build_w2v_features(texts)
            features_list.append(w2v_features)
        if use_doc2vec:
            d2v_features = self.build_doc2vec_features(texts)
            features_list.append(d2v_features)
        if use_stat:
            stat_features = self.build_statistical_features(texts)
            features_list.append(stat_features)
        if use_bert:
            bert_features = self.build_bert_features(texts)
            features_list.append(bert_features)
        return self.combine_features(*features_list)
