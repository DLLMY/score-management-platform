import logger from './logger';
/**
 * IndexedDB缓存工具
 * 用于持久化存储API响应缓存
 */

const DB_NAME = 'api-cache-db';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

let dbInstance: IDBDatabase | null = null;

/**
 * 打开IndexedDB数据库
 */
export async function openCacheDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open cache database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建缓存存储对象
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('expiry', 'expiry', { unique: false });
      }
    };
  });
}

/**
 * 缓存数据结构
 */
interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  expiry: number;
}

/**
 * 设置缓存
 */
export async function setCache(key: string, data: unknown, ttl: number = 60000): Promise<void> {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const entry: CacheEntry = {
        key,
        data,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
      };
      
      const request = store.put(entry);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to set cache'));
    });
  } catch (error) {
    logger.warn('Cache set error:', error);
  }
}

/**
 * 获取缓存
 */
export async function getCache(key: string): Promise<{ data: unknown; fromCache: boolean } | null> {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }
        
        // 检查是否过期
        if (entry.expiry < Date.now()) {
          // 删除过期缓存
          deleteCache(key);
          resolve(null);
          return;
        }
        
        resolve({
          data: entry.data,
          fromCache: true,
        });
      };
      
      request.onerror = () => reject(new Error('Failed to get cache'));
    });
  } catch (error) {
    logger.warn('Cache get error:', error);
    return null;
  }
}

/**
 * 删除缓存
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete cache'));
    });
  } catch (error) {
    logger.warn('Cache delete error:', error);
  }
}

/**
 * 清空所有缓存
 */
export async function clearCache(): Promise<void> {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear cache'));
    });
  } catch (error) {
    logger.warn('Cache clear error:', error);
  }
}

/**
 * 删除匹配模式的缓存
 */
export async function deleteCacheByPattern(pattern: string): Promise<void> {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const key = cursor.value.key as string;
          if (key.includes(pattern)) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(new Error('Failed to delete cache by pattern'));
    });
  } catch (error) {
    logger.warn('Cache delete by pattern error:', error);
  }
}

/**
 * 清理过期缓存
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const db = await openCacheDB();
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiry');
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(new Error('Failed to cleanup cache'));
    });
  } catch (error) {
    logger.warn('Cache cleanup error:', error);
  }
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{ count: number; size: number }> {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();
      
      countRequest.onsuccess = () => {
        resolve({
          count: countRequest.result,
          size: 0, // 无法准确计算
        });
      };
      
      countRequest.onerror = () => reject(new Error('Failed to get cache stats'));
    });
  } catch (error) {
    logger.warn('Cache stats error:', error);
    return { count: 0, size: 0 };
  }
}
