'use client';

import { useState } from 'react';

export default function Home() {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [file, setFile] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  async function handleDeleteAll() {
    setDeleting(true);
    setProgress(0);
    setTotal(0);
    setFile('');
    setError('');
    setRetrying(false);

    const eventSource = new EventSource('/api/delete-all');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        setError(data.error);
        setFile(data.file);
        return;
      }
      if (data.retrying) {
        setRetrying(true);
        setFile(data.file);
        return;
      }
      setRetrying(false);
      setFile(data.file);
      setProgress(data.progress);
      setTotal(data.total);
    };

    eventSource.addEventListener('done', () => {
      eventSource.close();
      setDeleting(false);
    });

    eventSource.onerror = () => {
      setError('An error occurred while deleting blobs.');
      eventSource.close();
      setDeleting(false);
    };
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Blob Admin</h1>
      <button
        onClick={handleDeleteAll}
        className="rounded-full bg-red-500 px-4 py-2 font-bold text-white hover:bg-red-700 disabled:opacity-50"
        disabled={deleting}
      >
        {deleting ? 'Deleting...' : 'Delete All Blobs'}
      </button>

      {deleting && (
        <div className="mt-8 w-full max-w-md">
          <div className="flex justify-between mb-1">
            <span className="text-base font-medium text-blue-700 dark:text-white">
              {retrying
                ? `Retrying... ${file}`
                : error
                  ? `Error: ${file}`
                  : file}
            </span>
            <span className="text-sm font-medium text-blue-700 dark:text-white">
              {total > 0 && `${progress} / ${total}`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
            ></div>
          </div>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
      )}
    </main>
  );
}
