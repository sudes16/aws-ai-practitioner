import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAllNotes, saveNoteForQuestion } from '../utils/noteStore';

interface NotesContextValue {
  notesMap: Record<number, string>;
  refreshNotes: () => Promise<void>;
  saveNote: (qNumber: number, note: string) => Promise<void>;
}

const NotesContext = createContext<NotesContextValue>({
  notesMap: {},
  refreshNotes: async () => {},
  saveNote: async () => {},
});

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notesMap, setNotesMap] = useState<Record<number, string>>({});

  const refreshNotes = useCallback(async () => {
    const notes = await getAllNotes();
    setNotesMap(notes);
  }, []);

  const saveNote = useCallback(async (qNumber: number, note: string) => {
    await saveNoteForQuestion(qNumber, note);
    setNotesMap(prev => {
      const next = { ...prev };
      if (note.trim()) next[qNumber] = note.trim();
      else delete next[qNumber];
      return next;
    });
  }, []);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  return (
    <NotesContext.Provider value={{ notesMap, refreshNotes, saveNote }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes(): NotesContextValue {
  return useContext(NotesContext);
}
