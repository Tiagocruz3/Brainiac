import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot } from './types'; // Import Snapshot type

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
}

const logger = createScopedLogger('ChatHistory');

// Storage quota management
const QUOTA_WARNING_THRESHOLD = 0.8; // Warn at 80% usage
const QUOTA_ERROR_THRESHOLD = 0.95; // Error at 95% usage

/**
 * Check storage quota and return usage information
 */
async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
  available: number;
}> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? usage / quota : 0;
      const available = quota - usage;

      return { usage, quota, percentage, available };
    } catch (error) {
      logger.warn('Failed to estimate storage quota:', error);
    }
  }

  // Return default values if quota API is not available
  return { usage: 0, quota: Infinity, percentage: 0, available: Infinity };
}

/**
 * Check if we have enough storage space for an operation
 */
async function hasEnoughStorage(estimatedSize: number = 0): Promise<boolean> {
  const quota = await checkStorageQuota();

  if (quota.quota === Infinity) {
    return true; // No quota limit
  }

  if (quota.percentage >= QUOTA_ERROR_THRESHOLD) {
    logger.error(`Storage quota exceeded: ${(quota.percentage * 100).toFixed(1)}% used`);
    return false;
  }

  if (estimatedSize > quota.available) {
    logger.error(`Insufficient storage: need ${estimatedSize} bytes, have ${quota.available} bytes`);
    return false;
  }

  if (quota.percentage >= QUOTA_WARNING_THRESHOLD) {
    logger.warn(`Storage quota warning: ${(quota.percentage * 100).toFixed(1)}% used`);
  }

  return true;
}

/**
 * Estimate the size of data to be stored
 */
function estimateDataSize(data: any): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch (error) {
    logger.warn('Failed to estimate data size:', error);
    return 0;
  }
}

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    console.error('indexedDB is not available in this environment.');
    return undefined;
  }

  // Check storage quota before opening
  const hasStorage = await hasEnoughStorage();
  if (!hasStorage) {
    logger.error('Insufficient storage quota to open database');
    // Still try to open, but user will get a warning
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 2);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      try {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains('chats')) {
            const store = db.createObjectStore('chats', { keyPath: 'id' });
            store.createIndex('id', 'id', { unique: true });
            store.createIndex('urlId', 'urlId', { unique: true });
          }
        }

        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('snapshots')) {
            db.createObjectStore('snapshots', { keyPath: 'chatId' });
          }
        }
      } catch (error) {
        logger.error('Error during database upgrade:', error);
        // Don't throw - allow the database to open even if upgrade partially fails
      }
    };

    request.onsuccess = (event: Event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Set up error handler for the database
      db.onerror = (errorEvent) => {
        logger.error('Database error:', errorEvent);
      };

      resolve(db);
    };

    request.onerror = (event: Event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      logger.error('Failed to open database:', error);
      resolve(undefined);
    };

    request.onblocked = () => {
      logger.warn('Database opening blocked by another connection');
    };
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  const data = {
    id,
    messages,
    urlId,
    description,
    timestamp: timestamp ?? new Date().toISOString(),
    metadata,
  };

  // Check storage quota before writing
  const estimatedSize = estimateDataSize(data);
  const hasStorage = await hasEnoughStorage(estimatedSize);

  if (!hasStorage) {
    throw new Error('Insufficient storage quota. Please free up space or delete old chats.');
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    if (timestamp && isNaN(Date.parse(timestamp))) {
      reject(new Error('Invalid timestamp'));
      return;
    }

    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      const error = request.error;
      if (error?.name === 'QuotaExceededError') {
        logger.error('Storage quota exceeded while saving messages');
        reject(new Error('Storage quota exceeded. Please delete old chats to free up space.'));
      } else {
        reject(error);
      }
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['chats', 'snapshots'], 'readwrite'); // Add snapshots store to transaction
      const chatStore = transaction.objectStore('chats');
      const snapshotStore = transaction.objectStore('snapshots');

      const deleteChatRequest = chatStore.delete(id);
      const deleteSnapshotRequest = snapshotStore.delete(id); // Also delete snapshot

      let chatDeleted = false;
      let snapshotDeleted = false;

      const checkCompletion = () => {
        if (chatDeleted && snapshotDeleted) {
          // Log quota after deletion for monitoring
          checkStorageQuota().then((quota) => {
            logger.info(`Storage after deletion: ${(quota.percentage * 100).toFixed(1)}% used`);
          });
          resolve(undefined);
        }
      };

      deleteChatRequest.onsuccess = () => {
        chatDeleted = true;
        checkCompletion();
      };
      deleteChatRequest.onerror = () => {
        logger.error('Error deleting chat:', deleteChatRequest.error);
        reject(deleteChatRequest.error);
      };

      deleteSnapshotRequest.onsuccess = () => {
        snapshotDeleted = true;
        checkCompletion();
      };

      deleteSnapshotRequest.onerror = (event) => {
        if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
          // Snapshot doesn't exist, that's okay
          snapshotDeleted = true;
          checkCompletion();
        } else {
          logger.error('Error deleting snapshot:', deleteSnapshotRequest.error);
          reject(deleteSnapshotRequest.error);
        }
      };

      transaction.oncomplete = () => {
        // Transaction completed successfully
      };

      transaction.onerror = () => {
        logger.error('Transaction error during deletion:', transaction.error);
        reject(transaction.error);
      };

      transaction.onabort = () => {
        logger.error('Transaction aborted during deletion');
        reject(new Error('Delete transaction was aborted'));
      };
    } catch (error) {
      logger.error('Error in deleteById:', error);
      reject(error);
    }
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        idList.push(cursor.value.urlId);
        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function forkChat(db: IDBDatabase, chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(db, chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  // Find the index of the message to fork at
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // Get messages up to and including the selected message
  const messages = chat.messages.slice(0, messageIndex + 1);

  return createChatFromMessages(db, chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
}

export async function duplicateChat(db: IDBDatabase, id: string): Promise<string> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  return createChatFromMessages(db, `${chat.description || 'Chat'} (copy)`, chat.messages);
}

export async function createChatFromMessages(
  db: IDBDatabase,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  const newId = await getNextId(db);
  const newUrlId = await getUrlId(db, newId); // Get a new urlId for the duplicated chat

  await setMessages(
    db,
    newId,
    messages,
    newUrlId, // Use the new urlId
    description,
    undefined, // Use the current timestamp
    metadata,
  );

  return newUrlId; // Return the urlId instead of id for navigation
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(db, id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
}

export async function updateChatMetadata(
  db: IDBDatabase,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  await setMessages(db, id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
}

export async function getSnapshot(db: IDBDatabase, chatId: string): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSnapshot(db: IDBDatabase, chatId: string, snapshot: Snapshot): Promise<void> {
  const data = { chatId, snapshot };

  // Check storage quota before writing
  const estimatedSize = estimateDataSize(data);
  const hasStorage = await hasEnoughStorage(estimatedSize);

  if (!hasStorage) {
    throw new Error('Insufficient storage quota for snapshot. Please free up space.');
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => {
      const error = request.error;
      if (error?.name === 'QuotaExceededError') {
        logger.error('Storage quota exceeded while saving snapshot');
        reject(new Error('Storage quota exceeded. Please delete old snapshots or chats.'));
      } else {
        reject(error);
      }
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteSnapshot(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.delete(chatId);

    request.onsuccess = () => resolve();

    request.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        resolve();
      } else {
        reject(request.error);
      }
    };
  });
}
