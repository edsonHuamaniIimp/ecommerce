const DB_NAME = "contratos-stands";
const DB_VERSION = 3;
const STORE_NAME = "reserva-borrador";

interface FormDatosDB {
  razonSocial: string;
  tipoDocumento: string;
  numeroDocumento: string;
  direccion: string;
  telefono: string;
  contacto: string;
  email: string;
  tipoComprobante: string;
}

interface ReservaBorrador {
  id: string;
  standIds: string[];
  datos: FormDatosDB;
  documentos: string[];
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function standIdsKey(standIds: string[]): string {
  return [...standIds].sort().join("|");
}

export const reservaBorradorDB = {
  async guardar(standIds: string[], datos: ReservaBorrador["datos"], documentos: string[]): Promise<void> {
    const db = await openDB();
    const id = standIdsKey(standIds);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record: ReservaBorrador = { id, standIds, datos, documentos, updatedAt: Date.now() };
      store.put(record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async cargar(standIds: string[]): Promise<ReservaBorrador | null> {
    const db = await openDB();
    const id = standIdsKey(standIds);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  async eliminar(standIds: string[]): Promise<void> {
    const db = await openDB();
    const id = standIdsKey(standIds);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },
};
