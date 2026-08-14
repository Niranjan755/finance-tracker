import type { StoreNames, StoreValue } from 'idb'
import { getDB } from './client'
import type { FinanceDB } from './schema'

type StoreName = StoreNames<FinanceDB>

export async function getAllFromStore<Name extends StoreName>(
  store: Name,
): Promise<StoreValue<FinanceDB, Name>[]> {
  const db = await getDB()
  return db.getAll(store)
}

export async function getFromStore<Name extends StoreName>(
  store: Name,
  id: string,
): Promise<StoreValue<FinanceDB, Name> | undefined> {
  const db = await getDB()
  return db.get(store, id)
}

export async function putInStore<Name extends StoreName>(
  store: Name,
  value: StoreValue<FinanceDB, Name>,
): Promise<void> {
  const db = await getDB()
  await db.put(store, value)
}

export async function deleteFromStore<Name extends StoreName>(
  store: Name,
  id: string,
): Promise<void> {
  const db = await getDB()
  await db.delete(store, id)
}

export async function clearStore<Name extends StoreName>(store: Name): Promise<void> {
  const db = await getDB()
  await db.clear(store)
}
