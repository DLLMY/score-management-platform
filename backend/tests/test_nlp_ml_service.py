"""Tests for NLP ML Service"""
from unittest.mock import patch, MagicMock
import numpy as np
import os
try:
    from services.nlp_ml_service import MLAlgorithmType
except ImportError:
    pass

try:
    from services.nlp_ml_service import HyperparameterConfig
except ImportError:
    pass

try:
    from services.nlp_ml_service import FeatureEngineeringService
except ImportError:
    pass

try:
    import scipy.sparse as sp
except ImportError:
    pass

try:
    from services.nlp_ml_service import NLPMLTrainingService
except ImportError:
    pass

try:
    from sklearn.dummy import DummyClassifier
except ImportError:
    pass

try:
    from sklearn.tree import DecisionTreeClassifier
except ImportError:
    pass

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError:
    pass

try:
    from sklearn.svm import SVC
except ImportError:
    pass

try:
    from services.nlp_ml_service import _SklearnTextCNNWrapper
except ImportError:
    pass

try:
    from services.nlp_ml_service import _SklearnBertWrapper
except ImportError:
    pass


class TestMLAlgorithmType:
    """Test MLAlgorithmType enum class"""

    def test_all_algorithms(self):
        """Test all() returns available algorithms"""
        from services.nlp_ml_service import MLAlgorithmType

        algorithms = MLAlgorithmType.all()

        assert isinstance(algorithms, list)
        assert len(algorithms) > 0
        assert MLAlgorithmType.SVM in algorithms
        assert MLAlgorithmType.RANDOM_FOREST in algorithms
        assert MLAlgorithmType.LOGISTIC_REGRESSION in algorithms

    def test_get_name(self):
        """Test get_name returns correct Chinese names"""

        assert MLAlgorithmType.get_name(MLAlgorithmType.SVM) == "支持向量机"
        assert MLAlgorithmType.get_name(MLAlgorithmType.RANDOM_FOREST) == "随机森林"
        assert MLAlgorithmType.get_name(MLAlgorithmType.LOGISTIC_REGRESSION) == "逻辑回归"
        assert MLAlgorithmType.get_name("unknown_algo") == "unknown_algo"

    def test_is_available(self):
        """Test is_available returns correct availability"""

        assert MLAlgorithmType.is_available(MLAlgorithmType.SVM) is True
        assert MLAlgorithmType.is_available(MLAlgorithmType.RANDOM_FOREST) is True

        assert MLAlgorithmType.is_available("unknown_algo") is False


class TestHyperparameterConfig:
    """Test HyperparameterConfig class"""

    def test_get_params_svm(self):
        """Test get_params for SVM"""
        from services.nlp_ml_service import HyperparameterConfig

        params = HyperparameterConfig.get_params(MLAlgorithmType.SVM)

        assert isinstance(params, dict)
        assert "C" in params
        assert "kernel" in params
        assert "gamma" in params

    def test_get_params_random_forest(self):
        """Test get_params for RandomForest"""

        params = HyperparameterConfig.get_params(MLAlgorithmType.RANDOM_FOREST)

        assert isinstance(params, dict)
        assert "n_estimators" in params
        assert "max_depth" in params
        assert "min_samples_split" in params

    def test_get_params_unknown(self):
        """Test get_params for unknown algorithm"""

        params = HyperparameterConfig.get_params("unknown_algo")

        assert params == {}


class TestFeatureEngineeringService:
    """Test FeatureEngineeringService class"""

    def test_init(self):
        """Test initialization"""
        from services.nlp_ml_service import FeatureEngineeringService

        service = FeatureEngineeringService()

        assert service.vectorizer is None
        assert service.w2v_model is None
        assert service.d2v_model is None

    def test_build_tfidf_features(self):
        """Test build_tfidf_features"""

        service = FeatureEngineeringService()

        texts = ["测试文本1", "测试文本2", "测试文本3"]

        features = service.build_tfidf_features(texts)

        assert features is not None
        assert features.shape[0] == 3
        assert service.vectorizer is not None

    def test_build_char_features(self):
        """Test build_char_features"""

        service = FeatureEngineeringService()

        texts = ["测试文本", "特征提取"]

        features = service.build_char_features(texts)

        assert features is not None
        assert features.shape[0] == 2

    def test_build_statistical_features(self):
        """Test build_statistical_features"""

        service = FeatureEngineeringService()
        service.jieba_initialized = False

        texts = ["测试文本123，。！", "Hello World"]

        features = service.build_statistical_features(texts)

        assert features is not None
        assert features.shape[0] == 2
        assert features.shape[1] == 8

    def test_combine_features(self):
        """Test combine_features"""
        import scipy.sparse as sp

        service = FeatureEngineeringService()

        features1 = sp.csr_matrix([[1, 2], [3, 4]])
        features2 = np.array([[5], [6]])

        combined = service.combine_features(features1, features2)

        assert combined is not None
        assert combined.shape[0] == 2
        assert combined.shape[1] == 3

    def test_combine_features_empty(self):
        """Test combine_features with no valid features"""

        service = FeatureEngineeringService()

        result = service.combine_features(None, None)

        assert result is None

    def test_apply_dimensionality_reduction(self):
        """Test apply_dimensionality_reduction"""

        service = FeatureEngineeringService()

        features = sp.csr_matrix(np.random.rand(10, 50))

        reduced = service.apply_dimensionality_reduction(features, n_components=5)

        assert reduced is not None
        assert reduced.shape[0] == 10
        assert reduced.shape[1] == 5

    def test_apply_scaling(self):
        """Test apply_scaling"""

        service = FeatureEngineeringService()

        features = sp.csr_matrix(np.random.rand(10, 20))

        scaled = service.apply_scaling(features)

        assert scaled is not None
        assert scaled.shape == features.shape


class TestNLPMLTrainingService:
    """Test NLPMLTrainingService class"""

    def test_init(self):
        """Test initialization"""
        from services.nlp_ml_service import NLPMLTrainingService

        service = NLPMLTrainingService()

        assert service.vectorizer is None
        assert isinstance(service.models, dict)
        assert isinstance(service.feature_service, type(service.feature_service))

    def test_generate_text_variants(self):
        """Test _generate_text_variants"""

        service = NLPMLTrainingService()

        variants = service._generate_text_variants("测试")

        assert isinstance(variants, list)
        assert len(variants) > 0
        assert "测试" in str(variants)

    def test_apply_text_augmentation(self):
        """Test _apply_text_augmentation"""

        service = NLPMLTrainingService()

        texts = ["测试文本"]
        labels = ["label1"]

        augmented_texts, augmented_labels = service._apply_text_augmentation(texts, labels)

        assert len(augmented_texts) > len(texts)
        assert len(augmented_labels) == len(augmented_texts)

    def test_dynamic_weighted_fusion(self):
        """Test _dynamic_weighted_fusion"""

        service = NLPMLTrainingService()

        predictions = [
            {"rule_id": 1, "confidence": 0.9, "algorithm": "random_forest"},
            {"rule_id": 1, "confidence": 0.85, "algorithm": "gradient_boosting"},
            {"rule_id": 2, "confidence": 0.7, "algorithm": "svm"},
        ]

        result = service._dynamic_weighted_fusion(predictions)

        assert result is not None
        assert "rule_id" in result
        assert "confidence" in result
        assert "fusion_details" in result

    def test_dynamic_weighted_fusion_empty(self):
        """Test _dynamic_weighted_fusion with empty predictions"""

        service = NLPMLTrainingService()

        result = service._dynamic_weighted_fusion([])

        assert result is None

    def test_evaluate_model(self):
        """Test _evaluate_model"""
        from sklearn.dummy import DummyClassifier

        service = NLPMLTrainingService()

        mock_model = DummyClassifier(strategy="most_frequent")
        X_test = np.array([[1], [2], [3]])
        y_test = ["A", "A", "B"]
        mock_model.fit(X_test, y_test)

        evaluation = service._evaluate_model(mock_model, X_test, y_test)

        assert isinstance(evaluation, dict)
        assert "accuracy" in evaluation
        assert "precision" in evaluation
        assert "recall" in evaluation
        assert "f1_score" in evaluation

    def test_get_feature_importance(self):
        """Test _get_feature_importance"""
        from sklearn.tree import DecisionTreeClassifier
        from sklearn.feature_extraction.text import TfidfVectorizer

        service = NLPMLTrainingService()

        vectorizer = TfidfVectorizer(max_features=10)
        texts = ["测试文本1", "测试文本2", "测试文本3"]
        X = vectorizer.fit_transform(texts)

        model = DecisionTreeClassifier()
        model.fit(X, ["A", "B", "A"])

        importance = service._get_feature_importance(model, vectorizer)

        assert importance is not None
        assert isinstance(importance, list)

    def test_get_feature_importance_no_importances(self):
        """Test _get_feature_importance for model without feature_importances_"""
        from sklearn.svm import SVC

        service = NLPMLTrainingService()

        vectorizer = TfidfVectorizer(max_features=10)
        texts = ["测试文本1", "测试文本2"]
        X = vectorizer.fit_transform(texts)

        model = SVC(kernel="linear")
        model.fit(X, ["A", "B"])

        importance = service._get_feature_importance(model, vectorizer)

        assert importance is not None
        assert isinstance(importance, (list, type(None)))

    def test_train_without_data(self, app):
        """Test _train_without_data"""
        with app.app_context():
            with patch('models.NLPModelTraining') as mock_training:
                mock_training.return_value = MagicMock()

                service = NLPMLTrainingService()

                result = service._train_without_data(MLAlgorithmType.SVM, "test_user")

                assert result["success"] is True
                assert result["training_data_count"] == 0
                assert result["evaluation"]["accuracy"] == 0.85

    def test_predict_no_model(self, app):
        """Test predict when no model exists"""
        with app.app_context():

            service = NLPMLTrainingService()

            with patch.object(service, '_load_model', return_value=(None, None)):
                result = service.predict("测试文本")

                assert result is None

    def test_predict_with_model(self, app):
        """Test predict with mock model"""
        with app.app_context():

            service = NLPMLTrainingService()

            mock_model = MagicMock()
            mock_model.predict.return_value = np.array([1])
            mock_model.predict_proba.return_value = np.array([[0.1, 0.9]])

            mock_vectorizer = MagicMock()
            mock_vectorizer.transform.return_value = np.array([[1.0, 0.5]])

            with patch.object(service, '_load_model', return_value=(mock_model, mock_vectorizer)):
                with patch.object(service, '_get_best_algorithm', return_value=MLAlgorithmType.SVM):
                    result = service.predict("测试文本")

                    assert result is not None
                    assert result["rule_id"] == 1
                    assert result["confidence"] == 0.9

    def test_ensemble_predict_empty(self, app):
        """Test ensemble_predict when no predictions"""
        with app.app_context():

            service = NLPMLTrainingService()

            with patch.object(service, 'predict_with_multiple_models', return_value=[]):
                result = service.ensemble_predict("测试文本")

                assert result is None

    def test_ensemble_predict_with_results(self, app):
        """Test ensemble_predict with mock results"""
        with app.app_context():

            service = NLPMLTrainingService()

            mock_predictions = [
                {"rule_id": 1, "confidence": 0.9, "algorithm": "rf"},
                {"rule_id": 1, "confidence": 0.85, "algorithm": "gb"},
                {"rule_id": 2, "confidence": 0.7, "algorithm": "svm"},
            ]

            with patch.object(service, 'predict_with_multiple_models', return_value=mock_predictions):
                result = service.ensemble_predict("测试文本")

                assert result is not None
                assert "rule_id" in result
                assert "confidence" in result
                assert "ensemble_details" in result

    def test_save_and_load_model(self, tmp_path):
        """Test _save_model and _load_model"""

        service = NLPMLTrainingService()

        vectorizer = TfidfVectorizer(max_features=10)
        texts = ["测试文本1", "测试文本2", "测试文本3"]
        X = vectorizer.fit_transform(texts)
        y = ["A", "B", "A"]

        model = SVC(kernel="linear")
        model.fit(X, y)

        with patch('services.nlp_ml_service.MODEL_DIR', str(tmp_path)):
            model_path = service._save_model("test_algo", model, vectorizer)

            assert model_path is not None
            assert os.path.exists(model_path)

            loaded_model, loaded_vectorizer = service._load_model("test_algo")

            assert loaded_model is not None
            assert loaded_vectorizer is not None

    def test_load_model_not_found(self, tmp_path):
        """Test _load_model when model file doesn't exist"""

        service = NLPMLTrainingService()

        with patch('services.nlp_ml_service.MODEL_DIR', str(tmp_path)):
            loaded_model, loaded_vectorizer = service._load_model("non_existent")

            assert loaded_model is None
            assert loaded_vectorizer is None


class TestSklearnWrappers:
    """Test sklearn wrapper classes"""

    def test_textcnn_wrapper_init(self):
        """Test _SklearnTextCNNWrapper initialization"""
        with patch('services.textcnn_service.TextCNNClassifier') as mock_cnn:
            mock_cnn.return_value = MagicMock()

            from services.nlp_ml_service import _SklearnTextCNNWrapper

            wrapper = _SklearnTextCNNWrapper(
                embedding_dim=64,
                max_len=32,
                num_filters=32,
                filter_sizes=[2, 3]
            )

            assert wrapper.embedding_dim == 64
            assert wrapper.max_len == 32
            assert wrapper.num_filters == 32
            assert wrapper.filter_sizes == [2, 3]

    def test_textcnn_wrapper_fit_predict(self):
        """Test _SklearnTextCNNWrapper fit and predict"""
        with patch('services.textcnn_service.TextCNNClassifier') as mock_cnn_class:
            mock_cnn = MagicMock()
            mock_cnn.predict_intent.return_value = ("label1", 0.9)
            mock_cnn.forward.return_value = {"probabilities": [[0.1, 0.9]]}
            mock_cnn_class.return_value = mock_cnn

            wrapper = _SklearnTextCNNWrapper()

            X = ["测试文本1", "测试文本2"]
            y = ["label1", "label2"]

            wrapper.fit(X, y)

            assert wrapper.classes_ is not None
            assert len(wrapper.classes_) == 2

            predictions = wrapper.predict(["测试文本"])

            assert len(predictions) == 1
            assert predictions[0] == "label1"

    def test_bert_wrapper_init_unavailable(self):
        """Test _SklearnBertWrapper initialization when bert is unavailable"""
        with patch('services.bert_service.BertNLPService') as mock_bert:
            mock_bert.side_effect = Exception("BERT not available")

            from services.nlp_ml_service import _SklearnBertWrapper

            wrapper = _SklearnBertWrapper()

            assert wrapper._available is False
