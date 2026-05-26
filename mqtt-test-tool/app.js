class MQTTTestTool {
    constructor() {
        this.client = null;
        this.messageCount = 0;
        this.topicsToSubscribe = [
            'phonebox/status',
            'phonebox/log',
            'phonebox/query'
        ];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
    }

    bindEvents() {
        document.getElementById('btnConnect').addEventListener('click', () => this.connect());
        document.getElementById('btnDisconnect').addEventListener('click', () => this.disconnect());
        document.getElementById('btnClearCache').addEventListener('click', () => this.clearCache());
        document.getElementById('btnClearLog').addEventListener('click', () => this.clearLog());
        
        document.getElementById('btnUnlockA').addEventListener('click', () => this.unlockA());
        document.getElementById('btnUnlockBSuccess').addEventListener('click', () => this.unlockBSuccess());
        document.getElementById('btnUnlockBFailScore').addEventListener('click', () => this.unlockBFailScore());
        document.getElementById('btnUnlockBFailCard').addEventListener('click', () => this.unlockBFailCard());
        
        document.getElementById('btnManualPublish').addEventListener('click', () => this.manualPublish());
    }

    loadSettings() {
        const settings = localStorage.getItem('mqttSettings');
        const defaults = {
            server: 'nc5233fc.ala.cn-hangzhou.emqxsl.cn',
            port: '8084',
            ssl: true,
            clientId: 'mqtt_test_tool_',
            username: 'phoneboxtest',
            password: '123456'
        };
        
        if (settings) {
            const config = JSON.parse(settings);
            document.getElementById('mqttServer').value = config.server || defaults.server;
            document.getElementById('mqttPort').value = config.port || defaults.port;
            document.getElementById('mqttSSL').checked = config.ssl !== false;
            document.getElementById('mqttClientId').value = config.clientId || defaults.clientId;
            document.getElementById('mqttUsername').value = config.username || defaults.username;
            document.getElementById('mqttPassword').value = config.password || defaults.password;
        } else {
            document.getElementById('mqttServer').value = defaults.server;
            document.getElementById('mqttPort').value = defaults.port;
            document.getElementById('mqttSSL').checked = defaults.ssl;
            document.getElementById('mqttClientId').value = defaults.clientId;
            document.getElementById('mqttUsername').value = defaults.username;
            document.getElementById('mqttPassword').value = defaults.password;
        }
    }

    saveSettings() {
        const settings = {
            server: document.getElementById('mqttServer').value,
            port: document.getElementById('mqttPort').value,
            ssl: document.getElementById('mqttSSL').checked,
            clientId: document.getElementById('mqttClientId').value,
            username: document.getElementById('mqttUsername').value,
            password: document.getElementById('mqttPassword').value
        };
        localStorage.setItem('mqttSettings', JSON.stringify(settings));
    }

    connect() {
        const server = document.getElementById('mqttServer').value;
        const port = parseInt(document.getElementById('mqttPort').value);
        const ssl = document.getElementById('mqttSSL').checked;
        const clientId = document.getElementById('mqttClientId').value + Math.random().toString(36).substr(2, 9);
        const username = document.getElementById('mqttUsername').value;
        const password = document.getElementById('mqttPassword').value;

        if (!server || !port) {
            this.addLog('请填写完整的服务器配置', 'error');
            return;
        }

        this.saveSettings();

        const protocol = ssl ? 'wss' : 'ws';
        const url = `${protocol}://${server}:${port}/mqtt`;
        
        this.addLog(`正在连接 ${server}:${port} (${ssl ? 'WSS' : 'WS'})...`, 'info');

        try {
            this.client = mqtt.connect(url, {
                clientId: clientId,
                username: username,
                password: password,
                clean: true,
                reconnectPeriod: 5000,
                keepalive: 60,
                connectTimeout: 10000
            });

            this.client.on('connect', (connack) => {
                this.addLog('✅ MQTT连接成功', 'success');
                this.updateConnectionStatus(true);
                
                this.topicsToSubscribe.forEach(topic => {
                    this.client.subscribe(topic, { qos: 0 }, (err) => {
                        if (!err) {
                            this.addLog(`📡 已订阅: ${topic}`, 'info');
                        }
                    });
                });
            });

            this.client.on('reconnect', () => {
                this.addLog('🔄 正在重连...', 'info');
            });

            this.client.on('message', (topic, message) => {
                const msg = message.toString();
                this.messageCount++;
                this.updateMessageCount();
                this.addLog(`[${topic}] ${msg}`, 'receive');
                
                try {
                    const data = JSON.parse(msg);
                    if (topic === 'phonebox/status') {
                        this.updateDoorStatus(data.box_id, data.status);
                    }
                } catch (e) {
                    console.log('Not JSON message');
                }
            });

            this.client.on('error', (error) => {
                this.addLog(`❌ 连接错误: ${error.message}`, 'error');
            });

            this.client.on('close', () => {
                if (this.client && this.client.reconnecting) {
                    this.addLog('⚠️ 连接暂时断开，正在尝试重连...', 'info');
                } else {
                    this.addLog('❌ 连接已断开', 'error');
                    this.updateConnectionStatus(false);
                }
            });

        } catch (error) {
            this.addLog(`❌ 连接失败: ${error.message}`, 'error');
        }
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            this.client = null;
            this.onDisconnect('手动断开');
        }
    }

    onDisconnect(reason) {
        this.addLog(`❌ 连接断开: ${reason}`, 'error');
        this.updateConnectionStatus(false);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        const statusConnect = document.getElementById('statusConnect');
        
        if (connected) {
            statusElement.className = 'status status-connected';
            statusElement.textContent = '✅ 已连接';
            statusConnect.className = 'status-value status-online';
            statusConnect.textContent = '● 在线';
            document.getElementById('btnConnect').disabled = true;
            document.getElementById('btnDisconnect').disabled = false;
        } else {
            statusElement.className = 'status status-disconnected';
            statusElement.textContent = '⚠️ 未连接';
            statusConnect.className = 'status-value status-offline';
            statusConnect.textContent = '● 离线';
            document.getElementById('btnConnect').disabled = false;
            document.getElementById('btnDisconnect').disabled = true;
        }
    }

    updateDoorStatus(boxId, status) {
        const element = document.getElementById(`statusDoor${boxId.toUpperCase()}`);
        if (element) {
            if (status === 'opened' || status === 'open') {
                element.textContent = '🚪 打开';
                element.style.color = '#ff6b6b';
            } else if (status === 'error') {
                element.textContent = '⚠️ 错误';
                element.style.color = '#ff9800';
            } else {
                element.textContent = '🔒 关闭';
                element.style.color = '#28a745';
            }
        }
    }

    updateMessageCount() {
        document.getElementById('statusMessageCount').textContent = this.messageCount;
    }

    unlockA() {
        if (!this.isConnected()) return;
        
        const topic = 'phonebox/unlock/A';
        const message = '';
        
        this.client.publish(topic, message);
        this.addLog(`📤 发布: ${topic} -> (空消息)`, 'send');
    }

    unlockBSuccess() {
        if (!this.isConnected()) return;
        
        const topic = 'phonebox/unlock/B';
        const message = JSON.stringify({
            result: 'true',
            reason: 'score_ok',
            current_score: 85
        });
        
        this.client.publish(topic, message);
        this.addLog(`📤 发布: ${topic} -> ${message}`, 'send');
    }

    unlockBFailScore() {
        if (!this.isConnected()) return;
        
        const topic = 'phonebox/unlock/B';
        const message = JSON.stringify({
            result: 'false',
            reason: 'score_low',
            current_score: 45
        });
        
        this.client.publish(topic, message);
        this.addLog(`📤 发布: ${topic} -> ${message}`, 'send');
    }

    unlockBFailCard() {
        if (!this.isConnected()) return;
        
        const topic = 'phonebox/unlock/B';
        const message = JSON.stringify({
            result: 'false',
            reason: 'card_not_found'
        });
        
        this.client.publish(topic, message);
        this.addLog(`📤 发布: ${topic} -> ${message}`, 'send');
    }

    manualPublish() {
        if (!this.isConnected()) return;
        
        const topic = document.getElementById('manualTopic').value;
        const message = document.getElementById('manualMessage').value;
        const qos = parseInt(document.getElementById('manualQos').value);
        
        if (!topic) {
            this.addLog('请输入主题', 'error');
            return;
        }
        
        this.client.publish(topic, message, { qos: qos });
        this.addLog(`📤 发布 [QoS${qos}]: ${topic} -> ${message}`, 'send');
    }

    isConnected() {
        if (!this.client || !this.client.connected) {
            this.addLog('请先连接MQTT服务器', 'error');
            return false;
        }
        return true;
    }

    addLog(content, type = 'info') {
        const logContainer = document.getElementById('messageLog');
        const logEntry = document.createElement('div');
        
        const now = new Date();
        const time = now.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-content">${this.escapeHtml(content)}</span>
        `;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearCache() {
        localStorage.removeItem('mqttSettings');
        this.addLog('🔄 配置已清除，正在刷新...', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    clearLog() {
        document.getElementById('messageLog').innerHTML = `
            <div class="log-entry log-info">
                <span class="log-time">系统启动</span>
                <span class="log-content">MQTT测试工具已就绪，请配置并连接</span>
            </div>
        `;
        this.messageCount = 0;
        this.updateMessageCount();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mqttTool = new MQTTTestTool();
});