import { randomUUID } from 'expo-crypto';
import { getGenericPassword, setGenericPassword, STORAGE_TYPE, UserCredentials } from 'react-native-keychain';
import { MMKV, useMMKVObject } from 'react-native-mmkv';

let storage: MMKV;

const ENCRYPTION_KEY = 'MMKV_ENCRYPTION_KEY';
const ENCRYPTION_SERVICE = 'MMKV_ENCRYPTION_SERVICE';

async function getEncryptionKey() {
  let existingCredentials: false | UserCredentials;
  try {
    existingCredentials = await getGenericPassword({
      service: ENCRYPTION_SERVICE,
    });
  } catch (e) {
    existingCredentials = false;
  }
  if (!existingCredentials) {
    const password = randomUUID();
    await setGenericPassword(ENCRYPTION_KEY, password, {
      service: ENCRYPTION_SERVICE,
      storage: STORAGE_TYPE.FB,
    });
    return password;
  }
  return existingCredentials.password;
}

export async function getSecureStorageInstance() {
  if (!storage) {
    const encryptionKey = await getEncryptionKey();
    storage = new MMKV({
      id: 'kuzpot-storage',
      encryptionKey,
    });
  }
  return storage;
}

export function isSecureStorageInitialized() {
  return !!storage;
}

export function useSecureStorage<T>(key: string, initialValue?: T) {
  if (!storage) {
    throw new Error('Secure storage is not initialized');
  }

  const [mmkvValue, setMmkvValue] = useMMKVObject<T>(key, storage);

  const clear = () => setMmkvValue(undefined);

  return [mmkvValue ?? initialValue, setMmkvValue, clear] as const;
}
