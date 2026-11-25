const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(
      `heavenly-fate-assets${new URLSearchParams(location.search).get("demo") === "1" ? "-demo" : ""}`,
      1,
    );
    request.onupgradeneeded = () => request.result.createObjectStore("assets");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function saveAsset(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw Error("Please choose an asset under 20 MB.");
  if (!/^(image\/(png|jpeg|webp|gif)|audio\/)/.test(file.type))
    throw Error("Choose a PNG, JPEG, WebP, GIF or audio file.");
  const db = await open();
  const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return id;
}
export async function getAsset(id: string): Promise<Blob | undefined> {
  if (!id) return;
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction("assets").objectStore("assets").get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
export async function exportAssets() {
  const db = await open();
  const entries = await new Promise<[IDBValidKey[], Blob[]]>(
    (resolve, reject) => {
      const tx = db.transaction("assets");
      const store = tx.objectStore("assets");
      const keys = store.getAllKeys(),
        values = store.getAll();
      tx.oncomplete = () => resolve([keys.result, values.result]);
      tx.onerror = () => reject(tx.error);
    },
  );
  db.close();
  return Promise.all(
    entries[0].map(async (key, i) => ({
      id: String(key),
      data: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(entries[1][i]);
      }),
    })),
  );
}
export async function importAssets(assets: { id: string; data: string }[]) {
  const blobs = await Promise.all(
    assets.map(async (a) => ({
      id: a.id,
      blob: await (await fetch(a.data)).blob(),
    })),
  );
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    for (const a of blobs) tx.objectStore("assets").put(a.blob, a.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearAssets() {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
