import type { Dispatch, SetStateAction } from 'react';
import type { WOLDevice } from '../../services/api';
import type { ClassNowStatusResult, UseListFetchResult } from '../../hooks';

export interface WOLNewDevice {
  name: string;
  mac_address: string;
}

export interface WakeOnLanViewProps {
  isLoading: boolean;
  handleWakeAll: () => Promise<void>;
  list: UseListFetchResult<WOLDevice>;
  handleAddDevice: () => Promise<void>;
  showAddForm: boolean;
  setShowAddForm: Dispatch<SetStateAction<boolean>>;
  newDevice: WOLNewDevice;
  setNewDevice: Dispatch<SetStateAction<WOLNewDevice>>;
  forceSend: boolean;
  setForceSend: Dispatch<SetStateAction<boolean>>;
  wolClassNow: ClassNowStatusResult;
  wakeResult: { success: boolean; message: string } | null;
  handleDeleteDevice: (id: number) => Promise<void>;
  handleWake: (mac: string) => Promise<void>;
  wolPage: number;
  wolPageSize: number;
  handleWolPageChange: (page: number) => void;
  loadDevices: () => Promise<void>;
  selectedDevice: number | null;
  setSelectedDevice: Dispatch<SetStateAction<number | null>>;
}
