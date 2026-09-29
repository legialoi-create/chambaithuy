import { ExamSession, StudentSubmission } from '../types';
import { getSampleExamSession } from './sampleData';

const DB_NAME = 'TroLyChamVanDB';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_SUBMISSIONS = 'submissions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB không được hỗ trợ trong môi trường này.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SUBMISSIONS)) {
        const subStore = db.createObjectStore(STORE_SUBMISSIONS, { keyPath: 'id' });
        subStore.createIndex('sessionId', 'sessionId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSessions(): Promise<ExamSession[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.getAll();
      req.onsuccess = () => {
        let results: ExamSession[] = req.result || [];
        // If empty, initialize with default sample session!
        if (results.length === 0) {
          const sample = getSampleExamSession();
          saveSession(sample.session).then(() => {
            saveSubmissions(sample.submissions);
          });
          resolve([sample.session]);
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi đọc danh sách đợt chấm:', err);
    return [];
  }
}

export async function saveSession(session: ExamSession): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    const req = store.put(session);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SESSIONS, STORE_SUBMISSIONS], 'readwrite');
    tx.objectStore(STORE_SESSIONS).delete(sessionId);

    const subStore = tx.objectStore(STORE_SUBMISSIONS);
    const index = subStore.index('sessionId');
    const req = index.getAllKeys(sessionId);
    req.onsuccess = () => {
      const keys = req.result;
      keys.forEach((k) => subStore.delete(k));
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSubmissionsBySession(sessionId: string): Promise<StudentSubmission[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SUBMISSIONS, 'readonly');
      const store = tx.objectStore(STORE_SUBMISSIONS);
      const index = store.index('sessionId');
      const req = index.getAll(sessionId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Lỗi đọc bài nộp:', err);
    return [];
  }
}

export async function saveSubmission(submission: StudentSubmission): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SUBMISSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SUBMISSIONS);
    const req = store.put(submission);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveSubmissions(submissions: StudentSubmission[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SUBMISSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SUBMISSIONS);
    submissions.forEach((s) => store.put(s));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SUBMISSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SUBMISSIONS);
    const req = store.delete(submissionId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function resetToSampleData(): Promise<{ session: ExamSession; submissions: StudentSubmission[] }> {
  const sample = getSampleExamSession();
  await saveSession(sample.session);
  await saveSubmissions(sample.submissions);
  return sample;
}
