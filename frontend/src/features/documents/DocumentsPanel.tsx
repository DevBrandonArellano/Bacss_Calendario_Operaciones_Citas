import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "@/api/client";
import { downloadDocument, listDocuments, uploadDocument } from "@/features/documents/api";
import type { Document as DocumentRecord, DocumentOwnerType } from "@/types/document";

interface DocumentsPanelProps {
  ownerType: DocumentOwnerType;
  ownerId: string;
}

export function DocumentsPanel({ ownerType, ownerId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listDocuments(ownerType, ownerId);
      setDocuments(data.results);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo cargar la lista de documentos.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(ownerType, ownerId, name || file.name, file);
      setName("");
      setFile(null);
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo subir el documento.";
      setError(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: DocumentRecord) {
    try {
      await downloadDocument(doc.id, doc.name);
    } catch {
      setError("No se pudo descargar el documento.");
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading && <p>Cargando...</p>}
      {!loading && documents.length === 0 && <p>Sin documentos registrados todavía.</p>}

      {!loading && documents.length > 0 && (
        <ul className="notification-list">
          {documents.map((doc) => (
            <li key={doc.id} className="notification-item">
              <div className="notification-item-header">
                <span className="notification-item-event">{doc.name}</span>
                <button type="button" onClick={() => handleDownload(doc)}>
                  Descargar
                </button>
              </div>
              <p className="notification-item-footer">{new Date(doc.created_at).toLocaleDateString("es-EC")}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleUpload} className="auth-form">
        <label htmlFor={`doc-name-${ownerId}`}>Nombre del documento</label>
        <input
          id={`doc-name-${ownerId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Se usa el nombre del archivo si se deja vacío"
        />

        <label htmlFor={`doc-file-${ownerId}`}>Archivo</label>
        <input
          id={`doc-file-${ownerId}`}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button type="submit" disabled={uploading || !file}>
          {uploading ? "Subiendo..." : "Subir documento"}
        </button>
      </form>
    </div>
  );
}
