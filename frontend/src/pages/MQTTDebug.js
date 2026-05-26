import { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Send, 
  Trash2, 
  Plus, 
  X, 
  RotateCcw, 
  Copy, 
  Check, 
  Terminal, 
  Server, 
  List, 
  Box,
  Unlock,
  Clock,
  Radio,
  Globe
} from 'lucide-react';
import api from '../services/api';

function MQTTDebug() {
  const [activeTab, setActiveTab] = useState('status');
  const [mqttStatus, setMqttStatus] = useState(false);
  const [subscribedTopics, setSubscribedTopics] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filterLogs, setFilterLogs] = useState('all');
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [boxStatus, setBoxStatus] = useState({
    A: { status: 'unknown', lastUpdate: null },
    B: { status: 'unknown', lastUpdate: null }
  });
  const logContainerRef = useRef(null);

  const [config, setConfig] = useState({
    broker: 'nc5233fc.ala.cn-hangzhou.emqxsl.cn',
    port: 8883,
    clientId: 'score_backend',
    username: 'phoneboxtest',
    password: '123456',
    ssl: true,
    timeout: 10,
    keepalive: 60
  });

  const [publish, setPublish] = useState({
    topic: 'phonebox/test',
    message: '',
    qos: 0
  });

  const [subscribe, setSubscribe] = useState({
    topic: '',
    qos: 0
  });

  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchLogs();
    
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchConfig = async () => {
    try {
      const data = await api.mqtt.getConfig();
      setConfig(data);
    } catch (error) {
      console.error('获取配置失败:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      const data = await api.mqtt.getStatus();
      setMqttStatus(data.connected);
      setSubscribedTopics(data.subscribed_topics || []);
    } catch (error) {
      console.error('获取状态失败:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await api.mqtt.getLogs(200);
      setLogs(data.reverse());
      
      setBoxStatus(prevStatus => {
        const newBoxStatus = { ...prevStatus };
        data.forEach(log => {
          if (log.topic === 'phonebox/status' && log.direction === 'receive') {
            try {
              const msg = JSON.parse(log.message);
              if (msg.box_id && msg.status) {
                newBoxStatus[msg.box_id] = {
                  status: msg.status,
                  lastUpdate: log.timestamp
                };
              }
            } catch (e) {}
          }
        });
        return newBoxStatus;
      });
    } catch (error) {
      console.error('获取日志失败:', error);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.mqtt.updateConfig(config);
      addLog('配置已保存', 'info');
    } catch (error) {
      addLog('保存配置失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await api.mqtt.connect();
      addLog('正在连接...', 'info');
      setTimeout(() => {
        fetchStatus();
        setIsConnecting(false);
      }, 1500);
    } catch (error) {
      addLog('连接失败: ' + (error.response?.data?.error || error.message), 'error');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.mqtt.disconnect();
      addLog('已断开连接', 'info');
      setMqttStatus(false);
    } catch (error) {
      addLog('断开失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handlePublish = async () => {
    if (!publish.topic.trim()) {
      addLog('请输入主题', 'error');
      return;
    }
    
    try {
      await api.mqtt.publish({
        topic: publish.topic,
        message: publish.message,
        qos: parseInt(publish.qos)
      });
      addLog(`发布: ${publish.topic} -> ${publish.message || '(空消息)'}`, 'send');
    } catch (error) {
      addLog('发布失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleSubscribe = async () => {
    if (!subscribe.topic.trim()) {
      addLog('请输入主题', 'error');
      return;
    }
    
    try {
      await api.mqtt.subscribe({
        topic: subscribe.topic,
        qos: parseInt(subscribe.qos)
      });
      addLog(`订阅: ${subscribe.topic} (QoS ${subscribe.qos})`, 'info');
      setSubscribe({ topic: '', qos: 0 });
      setTimeout(() => fetchStatus(), 500);
    } catch (error) {
      addLog('订阅失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleUnsubscribe = async (topic) => {
    try {
      await api.mqtt.unsubscribe({ topic });
      addLog(`取消订阅: ${topic}`, 'info');
      setTimeout(() => fetchStatus(), 500);
    } catch (error) {
      addLog('取消订阅失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog('日志已清空', 'info');
  };

  const copyConfig = async () => {
    const configText = JSON.stringify(config, null, 2);
    await navigator.clipboard.writeText(configText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addLog('配置已复制到剪贴板', 'info');
  };

  const resetConfig = () => {
    setConfig({
      broker: 'nc5233fc.ala.cn-hangzhou.emqxsl.cn',
      port: 8883,
      clientId: 'score_backend',
      username: 'phoneboxtest',
      password: '123456',
      ssl: true,
      timeout: 10,
      keepalive: 60
    });
    addLog('配置已重置', 'info');
  };

  const handleCardTest = async (card) => {
    if (!mqttStatus) return;
    
    try {
      addLog(`模拟刷卡: ${card.id} (${card.name})`, 'info');
      
      if (card.status === 'success') {
        await api.mqtt.unlock({ 
          box_id: 'B', 
          response: { result: 'true', reason: 'score_ok', current_score: card.score } 
        });
        addLog(`验证通过: ${card.reason} -> phonebox/unlock/B`, 'send');
      } else if (card.status === 'fail') {
        await api.mqtt.unlock({ 
          box_id: 'B', 
          response: { result: 'false', reason: 'score_low', current_score: card.score } 
        });
        addLog(`验证失败: ${card.reason}`, 'error');
      } else {
        await api.mqtt.unlock({ 
          box_id: 'B', 
          response: { result: 'false', reason: 'card_not_found' } 
        });
        addLog(`验证失败: ${card.reason}`, 'error');
      }
    } catch (error) {
      addLog('测试失败: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const addLog = (message, direction) => {
    const now = new Date();
    setLogs(prev => [...prev.slice(-199), {
      id: Date.now(),
      timestamp: now.toISOString(),
      topic: '',
      message: message,
      direction: direction
    }]);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '无记录';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredLogs = logs.filter(log => {
    if (filterLogs === 'all') return true;
    return log.direction === filterLogs;
  });

  const tabs = [
    { id: 'status', label: '连接状态', icon: Server },
    { id: 'publish', label: '消息发布', icon: Send },
    { id: 'subscribe', label: '主题订阅', icon: Radio },
    { id: 'logs', label: '消息日志', icon: Terminal },
    { id: 'devices', label: '设备控制', icon: Box },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                mqttStatus 
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                  : 'bg-gradient-to-br from-red-500 to-rose-600'
              }`}>
                {mqttStatus ? <Wifi className="w-6 h-6 text-white" /> : <WifiOff className="w-6 h-6 text-white" />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">MQTT 调试工具</h1>
                <p className="text-sm text-gray-500">手机箱通信调试与监控</p>
              </div>
            </div>
            
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              mqttStatus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${mqttStatus ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">{mqttStatus ? '已连接' : '未连接'}</span>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-100">
            <div className="flex overflow-x-auto">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'status' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      连接配置
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Broker 地址</label>
                        <input
                          type="text"
                          value={config.broker}
                          onChange={(e) => setConfig({ ...config, broker: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">端口</label>
                        <input
                          type="number"
                          value={config.port}
                          onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">客户端 ID</label>
                      <input
                        type="text"
                        value={config.clientId}
                        onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">用户名</label>
                        <input
                          type="text"
                          value={config.username}
                          onChange={(e) => setConfig({ ...config, username: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">密码</label>
                        <input
                          type="password"
                          value={config.password}
                          onChange={(e) => setConfig({ ...config, password: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={config.ssl}
                          onChange={(e) => setConfig({ ...config, ssl: e.target.checked })}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        启用 SSL
                      </label>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>超时: {config.timeout}s</span>
                        <span>保活: {config.keepalive}s</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">连接控制</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleConnect}
                        disabled={mqttStatus || isConnecting}
                        className={`py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                          mqttStatus || isConnecting
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg'
                        }`}
                      >
                        {isConnecting ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            连接中...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Wifi className="w-4 h-4" />
                            连接
                          </span>
                        )}
                      </button>
                      <button
                        onClick={handleDisconnect}
                        disabled={!mqttStatus}
                        className={`py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                          !mqttStatus
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg'
                        }`}
                      >
                        <WifiOff className="w-4 h-4" />
                        断开
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={resetConfig}
                        className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        重置
                      </button>
                      <button
                        onClick={copyConfig}
                        className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        {copied ? '已复制' : '复制'}
                      </button>
                    </div>

                    <button
                      onClick={handleSaveConfig}
                      className="w-full py-2.5 bg-gray-700 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-all"
                    >
                      保存配置
                    </button>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">连接信息</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>协议: {config.ssl ? 'MQTT/TLS' : 'MQTT'}</div>
                        <div>端口: {config.port}</div>
                        <div>超时: {config.timeout}秒</div>
                        <div>保活: {config.keepalive}秒</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'publish' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">消息主题</label>
                  <input
                    type="text"
                    value={publish.topic}
                    onChange={(e) => setPublish({ ...publish, topic: e.target.value })}
                    placeholder="例如: phonebox/test"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">消息内容</label>
                  <textarea
                    value={publish.message}
                    onChange={(e) => setPublish({ ...publish, message: e.target.value })}
                    placeholder="输入 JSON 或文本消息..."
                    rows={5}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">QoS:</span>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      {[0, 1, 2].map(qos => (
                        <button
                          key={qos}
                          onClick={() => setPublish({ ...publish, qos })}
                          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                            publish.qos === qos
                              ? 'bg-white shadow-sm text-gray-900'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {qos}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={!mqttStatus}
                    className={`px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
                      !mqttStatus
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary-500 to-indigo-600 text-white hover:shadow-lg'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                    发布消息
                  </button>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">快捷主题</h4>
                  <div className="flex flex-wrap gap-2">
                    {['phonebox/test', 'phonebox/unlock/A', 'phonebox/unlock/B', 'phonebox/status'].map(topic => (
                      <button
                        key={topic}
                        onClick={() => setPublish({ ...publish, topic })}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-primary-50 hover:border-primary-200 transition-all"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'subscribe' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">订阅主题</label>
                    <input
                      type="text"
                      value={subscribe.topic}
                      onChange={(e) => setSubscribe({ ...subscribe, topic: e.target.value })}
                      placeholder="例如: phonebox/status"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">QoS</label>
                    <select
                      value={subscribe.qos}
                      onChange={(e) => setSubscribe({ ...subscribe, qos: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="0">QoS 0</option>
                      <option value="1">QoS 1</option>
                      <option value="2">QoS 2</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleSubscribe}
                      disabled={!mqttStatus}
                      className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                        !mqttStatus
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-primary-500 to-indigo-600 text-white hover:shadow-lg'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      订阅
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">已订阅主题 ({subscribedTopics.length})</h3>
                  {subscribedTopics.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无订阅</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {subscribedTopics.map((topic, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-xl">
                          <span className="font-mono text-sm text-gray-800">{topic}</span>
                          <button
                            onClick={() => handleUnsubscribe(topic)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">快捷订阅</h4>
                  <div className="flex flex-wrap gap-2">
                    {['phonebox/status', 'phonebox/log', 'phonebox/query', 'phonebox/unlock/+'].map(topic => (
                      <button
                        key={topic}
                        onClick={() => setSubscribe({ ...subscribe, topic })}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-primary-50 hover:border-primary-200 transition-all"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600">显示:</span>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      {[
                        { key: 'all', label: '全部' },
                        { key: 'send', label: '发送' },
                        { key: 'receive', label: '接收' }
                      ].map(filter => (
                        <button
                          key={filter.key}
                          onClick={() => setFilterLogs(filter.key)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            filterLogs === filter.key
                              ? 'bg-white shadow-sm text-gray-900'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={clearLogs}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清空
                  </button>
                </div>

                <div
                  ref={logContainerRef}
                  className="bg-gray-900 rounded-xl p-3 h-80 overflow-y-auto space-y-1.5 font-mono text-sm"
                >
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-600">
                      <Terminal className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">暂无日志</p>
                    </div>
                  ) : (
                    filteredLogs.map((log) => {
                      let displayMsg = log.message;
                      try {
                        const parsed = JSON.parse(log.message);
                        if (parsed.result && parsed.reason) {
                          const resultText = parsed.result === 'true' ? '✅ 通过' : '❌ 失败';
                          const reasonText = parsed.reason === 'score_ok' ? '积分充足' :
                                           parsed.reason === 'score_low' ? '积分不足' :
                                           parsed.reason === 'card_not_found' ? '卡号未注册' : parsed.reason;
                          displayMsg = `${resultText} | ${reasonText}${parsed.current_score ? ` | 积分: ${parsed.current_score}` : ''}`;
                        } else {
                          displayMsg = JSON.stringify(parsed, null, 2);
                        }
                      } catch (e) {}

                      return (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2 px-2 py-1.5 rounded ${
                            log.direction === 'receive' ? 'bg-blue-900/30' :
                            log.direction === 'send' ? 'bg-green-900/30' :
                            log.direction === 'error' ? 'bg-red-900/30' : 'bg-gray-800/50'
                          }`}
                        >
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            log.direction === 'receive' ? 'bg-blue-600 text-blue-100' :
                            log.direction === 'send' ? 'bg-green-600 text-green-100' :
                            log.direction === 'error' ? 'bg-red-600 text-red-100' : 'bg-gray-600 text-gray-100'
                          }`}>
                            {log.direction === 'receive' ? '↓' : log.direction === 'send' ? '↑' : '!'}
                          </span>
                          <span className="text-gray-500 text-xs">{formatTime(log.timestamp)}</span>
                          {log.topic && (
                            <span className="text-blue-400 text-xs">{log.topic}</span>
                          )}
                          <span className="text-gray-300 flex-1 break-all">{displayMsg}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'devices' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-primary-500 to-indigo-600 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">设备控制中心</h3>
                      <p className="text-sm text-white/80">手机箱远程控制与测试</p>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      mqttStatus ? 'bg-green-500/30 text-green-100' : 'bg-red-500/30 text-red-100'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${mqttStatus ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                      {mqttStatus ? '已连接' : '未连接'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['A', 'B'].map(boxId => (
                    <div key={boxId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className={`px-6 py-4 ${
                        boxStatus[boxId].status === 'opened' ? 'bg-green-50' :
                        boxStatus[boxId].status === 'closed' ? 'bg-blue-50' :
                        boxStatus[boxId].status === 'error' ? 'bg-red-50' : 'bg-gray-50'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              boxStatus[boxId].status === 'opened' ? 'bg-green-200' :
                              boxStatus[boxId].status === 'closed' ? 'bg-blue-200' :
                              boxStatus[boxId].status === 'error' ? 'bg-red-200' : 'bg-gray-200'
                            }`}>
                              {boxStatus[boxId].status === 'opened' ? (
                                <Unlock className="w-5 h-5 text-green-700" />
                              ) : boxStatus[boxId].status === 'closed' ? (
                                <Box className="w-5 h-5 text-blue-700" />
                              ) : boxStatus[boxId].status === 'error' ? (
                                <Terminal className="w-5 h-5 text-red-700" />
                              ) : (
                                <Box className="w-5 h-5 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{boxId} 箱</h3>
                              <p className="text-sm text-gray-600">
                                {boxStatus[boxId].status === 'opened' ? '门已打开' :
                                 boxStatus[boxId].status === 'closed' ? '门已关闭' :
                                 boxStatus[boxId].status === 'error' ? '错误状态' : '等待连接...'}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(boxStatus[boxId].lastUpdate)}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <button
                          onClick={async () => {
                            try {
                              await api.mqtt.unlock({ box_id: boxId });
                              addLog(`指令: phonebox/unlock/${boxId}`, 'send');
                            } catch (error) {
                              addLog('失败: ' + (error.response?.data?.error || error.message), 'error');
                            }
                          }}
                          disabled={!mqttStatus}
                          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                            !mqttStatus
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : boxId === 'A' 
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30'
                                : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/30'
                          }`}
                        >
                          {boxId === 'A' ? '🔓 远程开锁 (无需验证)' : '🔓 远程开锁 (需积分验证)'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 bg-orange-50 border-b border-orange-100">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">刷卡验证测试</h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">模拟学生刷卡场景，测试积分验证逻辑</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {[
                        { id: 'STU001', name: '张小明', score: 85, status: 'success', color: 'green', reason: '积分充足' },
                        { id: 'STU002', name: '李小红', score: 45, status: 'fail', color: 'yellow', reason: '积分不足' },
                        { id: 'STU999', name: '未注册', score: 0, status: 'error', color: 'red', reason: '卡号未注册' },
                      ].map(card => (
                        <div 
                          key={card.id}
                          onClick={() => handleCardTest(card)}
                          disabled={!mqttStatus}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            !mqttStatus ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:-translate-y-0.5'
                          } ${
                            card.color === 'green' ? 'bg-green-50 border-green-200 hover:border-green-300' :
                            card.color === 'yellow' ? 'bg-yellow-50 border-yellow-200 hover:border-yellow-300' :
                            'bg-red-50 border-red-200 hover:border-red-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-gray-900">{card.id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              card.color === 'green' ? 'bg-green-200 text-green-700' :
                              card.color === 'yellow' ? 'bg-yellow-200 text-yellow-700' :
                              'bg-red-200 text-red-700'
                            }`}>
                              {card.reason}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">{card.name}</div>
                          {card.score > 0 && (
                            <div className="text-sm text-gray-500">积分: {card.score}分</div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCardTest(card);
                            }}
                            disabled={!mqttStatus}
                            className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-all ${
                              !mqttStatus 
                                ? 'bg-gray-200 text-gray-400'
                                : card.color === 'green' 
                                  ? 'bg-green-600 text-white hover:bg-green-700'
                                  : card.color === 'yellow'
                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                    : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                          >
                            模拟刷卡
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">快捷测试按钮</h4>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleCardTest({ id: 'STU001', name: '张小明', score: 85, status: 'success', color: 'green', reason: '积分充足' })}
                          disabled={!mqttStatus}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            !mqttStatus ? 'bg-gray-200 text-gray-400' : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                        >
                          ✅ B箱成功
                        </button>
                        <button
                          onClick={() => handleCardTest({ id: 'STU002', name: '李小红', score: 45, status: 'fail', color: 'yellow', reason: '积分不足' })}
                          disabled={!mqttStatus}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            !mqttStatus ? 'bg-gray-200 text-gray-400' : 'bg-yellow-500 text-white hover:bg-yellow-600'
                          }`}
                        >
                          ⚠️ B箱积分不足
                        </button>
                        <button
                          onClick={() => handleCardTest({ id: 'STU999', name: '未注册', score: 0, status: 'error', color: 'red', reason: '卡号未注册' })}
                          disabled={!mqttStatus}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            !mqttStatus ? 'bg-gray-200 text-gray-400' : 'bg-red-500 text-white hover:bg-red-600'
                          }`}
                        >
                          ❌ B箱未注册
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await api.mqtt.unlock({ box_id: 'A' });
                              addLog('指令: phonebox/unlock/A', 'send');
                            } catch (error) {
                              addLog('失败: ' + (error.response?.data?.error || error.message), 'error');
                            }
                          }}
                          disabled={!mqttStatus}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            !mqttStatus ? 'bg-gray-200 text-gray-400' : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          🔓 开A箱
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-gray-600" />
                      <h3 className="font-semibold text-gray-900">MQTT 主题说明</h3>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="font-mono text-sm text-blue-700">phonebox/query</div>
                        <div className="text-xs text-gray-600 mt-1">ESP32刷卡后发送查询</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="font-mono text-sm text-green-700">phonebox/unlock/A</div>
                        <div className="text-xs text-gray-600 mt-1">A箱开锁指令</div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="font-mono text-sm text-purple-700">phonebox/unlock/B</div>
                        <div className="text-xs text-gray-600 mt-1">B箱开锁指令(带积分验证)</div>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="font-mono text-sm text-orange-700">phonebox/status</div>
                        <div className="text-xs text-gray-600 mt-1">门状态上报</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MQTTDebug;
