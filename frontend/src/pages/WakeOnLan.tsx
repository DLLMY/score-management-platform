import { useState, useEffect } from 'react';
import { Power, Plus, Trash2, Zap, Check, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import type { WOLDevice } from '../services/api';
import { useClassNowStatus } from '../hooks';
import { PermissionButton, ClassStatusBadge } from '../components';

export default function WakeOnLan() {
  const [devices, setDevices] = useState<WOLDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [wakeResult, setWakeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDevice, setNewDevice] = useState({ name: '', mac_address: '' });
  // 强制发送开关（受 notification.force_send 权限门控，仅超管可见复选框）
  const [forceSend, setForceSend] = useState(false);
  // 远程开机属于全局下发，按全局上课时段拦截
  const wolClassNow = useClassNowStatus(undefined, { scope: 'global' });

  // Load devices from database on mount
  const loadDevices = async () => {
    setIsRefreshing(true);
    try {
      const result = await api.wakeOnLan.getDevices();
      setDevices(result);
    } catch (error) {
      console.error('Failed to load devices:', error);
      // Fallback to default devices if API fails
      setDevices([
        { id: 1, name: '办公室电脑', mac_address: '00:1A:2B:3C:4D:5E' },
        { id: 2, name: '服务器', mac_address: '00:1A:2B:3C:4D:6F' },
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  // Wake up selected device
  const handleWake = async (mac: string) => {
    setIsLoading(true);
    setWakeResult(null);
    
    try {
      const result = await api.wakeOnLan.wake({
        mac_address: mac,
        broadcast_ip: '255.255.255.255',
        port: 9,
        force_send: forceSend,
      });
      
      setWakeResult({
        success: result.success,
        message: result.message
      });
    } catch (error) {
      setWakeResult({
        success: false,
        message: 'Failed to send wake packet'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Wake up all devices
  const handleWakeAll = async () => {
    const validMacs = devices
      .filter(d => d.mac_address)
      .map(d => d.mac_address!);
    
    if (validMacs.length === 0) {
      setWakeResult({
        success: false,
        message: 'No valid MAC addresses found'
      });
      return;
    }

    setIsLoading(true);
    setWakeResult(null);

    try {
      const result = await api.wakeOnLan.wakeBatch({
        mac_addresses: validMacs,
        force_send: forceSend,
      });

      const message = `Sent wake packets to ${result.success_count}/${result.total} devices`;
      setWakeResult({
        success: result.success_count > 0,
        message
      });
    } catch (error) {
      setWakeResult({
        success: false,
        message: 'Failed to send wake packets'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add new device
  const handleAddDevice = async () => {
    if (!newDevice.name || !newDevice.mac_address) {
      setWakeResult({
        success: false,
        message: 'Please fill in both device name and MAC address'
      });
      return;
    }

    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(newDevice.mac_address)) {
      setWakeResult({
        success: false,
        message: 'Invalid MAC address format'
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.wakeOnLan.addDevice({
        name: newDevice.name,
        mac_address: newDevice.mac_address.toUpperCase().replace('-', ':'),
        broadcast_ip: '255.255.255.255',
        port: 9
      });
      
      setDevices([...devices, result]);
      setNewDevice({ name: '', mac_address: '' });
      setShowAddForm(false);
      setWakeResult({
        success: true,
        message: 'Device added successfully'
      });
    } catch (error: unknown) {
      setWakeResult({
        success: false,
        message: (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to add device'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete device
  const handleDeleteDevice = async (id: number) => {
    setIsLoading(true);
    try {
      await api.wakeOnLan.deleteDevice(id);
      setDevices(devices.filter(d => d.id !== id));
      if (selectedDevice === id) {
        setSelectedDevice(null);
      }
      setWakeResult({
        success: true,
        message: 'Device deleted successfully'
      });
    } catch (error) {
      setWakeResult({
        success: false,
        message: 'Failed to delete device'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Power className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wake-on-LAN</h1>
            <p className="text-sm text-gray-500">Remote boot control for target computers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <PermissionButton
            permission='device.manage'
            onClick={handleWakeAll}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Wake All
          </PermissionButton>
          <PermissionButton
            permission='device.manage'
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Device
          </PermissionButton>
          <PermissionButton
            permission='device.view'
            onClick={loadDevices}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </PermissionButton>
        </div>
      </div>

      {/* 班级实时状态 + 强制发送开关 */}
      <ClassStatusBadge
        state={wolClassNow}
        forceSend={forceSend}
        onForceSendChange={setForceSend}
      />

      {/* Result Message */}
      {wakeResult && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          wakeResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {wakeResult.success ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {wakeResult.message}
        </div>
      )}

      {/* Add Device Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="font-semibold mb-3">Add New Device</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
              <input
                type="text"
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                placeholder="e.g., Office Computer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MAC Address</label>
              <input
                type="text"
                value={newDevice.mac_address}
                onChange={(e) => setNewDevice({ ...newDevice, mac_address: e.target.value })}
                placeholder="AA:BB:CC:DD:EE:FF"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <PermissionButton
                permission='device.manage'
                onClick={handleAddDevice}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                Add
              </PermissionButton>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            MAC address format: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
          </p>
        </div>
      )}

      {/* Device List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className={`p-4 bg-white rounded-lg border-2 transition-all cursor-pointer ${
              selectedDevice === device.id
                ? 'border-purple-500 shadow-lg'
                : 'border-gray-200 hover:border-purple-300'
            }`}
            onClick={() => setSelectedDevice(device.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Power className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{device.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{device.mac_address}</p>
                </div>
              </div>
              <PermissionButton
                permission='device.manage'
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteDevice(device.id);
                }}
                disabled={isLoading}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </PermissionButton>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                ID: {device.id}
              </span>
              <PermissionButton
                permission='device.manage'
                onClick={(e) => {
                  e.stopPropagation();
                  if (device.mac_address) {
                    handleWake(device.mac_address);
                  }
                }}
                disabled={isLoading || !device.mac_address}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                Wake Up
              </PermissionButton>
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">How to Enable Wake-on-LAN</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Restart your target computer and enter BIOS/UEFI settings (usually press F2, F12, or Del)</li>
          <li>Find "Wake-on-LAN" or "Power On By PCIe" option in BIOS</li>
          <li>Enable this option and save settings</li>
          <li>Connect the computer to network via Ethernet cable (WOL requires wired connection)</li>
          <li>Power off the computer normally (not via power button)</li>
          <li>Now you can wake this computer remotely using this page</li>
        </ol>
      </div>
    </div>
  );
}
