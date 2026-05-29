import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    console.error('Error Boundary caught an error:', error, errorInfo);
    
    // 可以在这里发送错误日志到后端
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/logs/error', JSON.stringify({
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }));
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="relative mb-6">
              <div className="w-24 h-24 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                !
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-3">
              页面出错了
            </h2>
            
            <p className="text-slate-400 mb-6">
              抱歉，页面加载时出现了错误。请尝试刷新页面。
            </p>
            
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-slate-400 mb-2">错误信息:</p>
              <p className="text-sm text-red-400 break-all font-mono">
                {this.state.error?.message || '未知错误'}
              </p>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-accent-600 transition-all duration-300 shadow-lg shadow-primary-500/30"
              >
                <RefreshCw className="w-4 h-4" />
                刷新页面
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-300"
              >
                <Home className="w-4 h-4" />
                返回首页
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
