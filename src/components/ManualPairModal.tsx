import React, { useState, useMemo } from 'react';
import { Search, X, Check, AlertTriangle, Link2 } from 'lucide-react';
import { Song } from '../types';
import { cleanTitleForPdf } from '../services/exportGenerator';

interface ManualPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  unmatchedSong: Song | null;
  masterSongs: Song[];
  onPairSong: (tempId: number, targetMasterId: number) => void;
}

export const ManualPairModal: React.FC<ManualPairModalProps> = ({
  isOpen,
  onClose,
  unmatchedSong,
  masterSongs,
  onPairSong,
}) => {
  if (!isOpen || !unmatchedSong) return null;

  const originalTitle = unmatchedSong.originalImportTitle || unmatchedSong.pdf_title;
  // Initialize search with cleaned title
  const initialSearch = originalTitle
    .replace(/^\d+[\s\.\-_:]+/, '')
    .replace(/[-_–—/]?\s*(?:alt|tenor|alto)?\s*sax\w*/gi, '')
    .trim();

  const [query, setQuery] = useState(initialSearch);
  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);

  const filteredMasterSongs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return masterSongs.slice(0, 30);

    return masterSongs
      .filter((s) => {
        const idMatch = String(s.id).includes(q);
        const titleMatch = s.pdf_title.toLowerCase().includes(q);
        const mssMatch = s.mss_title.toLowerCase().includes(q);
        return idMatch || titleMatch || mssMatch;
      })
      .slice(0, 50);
  }, [masterSongs, query]);

  const handleConfirm = () => {
    if (selectedMasterId !== null) {
      onPairSong(unmatchedSong.id, selectedMasterId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ruční spárování skladby</h3>
              <p className="text-[11px] text-slate-400">
                Přiřaďte nespárovanou skladbu z importu k originálu v databázi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Unmatched song info banner */}
        <div className="px-4 py-3 bg-amber-950/30 border-b border-amber-500/30 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="text-slate-400">Původní text v importu: </span>
            <span className="font-bold text-amber-200">"{originalTitle}"</span>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Dočasné ID v setu: <code className="text-amber-300 font-mono">#{unmatchedSong.id}</code>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800">
          <label className="block text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
            Vyhledejte správnou skladbu v databázi ({masterSongs.length} skladeb k dispozici):
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zadejte název nebo číslo skladby..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Master songs list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-slate-800/50 min-h-[220px]">
          {filteredMasterSongs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Nenalezena žádná odpovídající skladba. Zkuste upravit hledaný výraz.
            </div>
          ) : (
            filteredMasterSongs.map((song) => {
              const isSelected = selectedMasterId === song.id;

              return (
                <div
                  key={song.id}
                  onClick={() => setSelectedMasterId(song.id)}
                  className={`pt-1.5 first:pt-0 flex items-center justify-between gap-2 p-2 rounded-xl cursor-pointer transition select-none ${
                    isSelected
                      ? 'bg-indigo-950/80 ring-2 ring-indigo-500'
                      : 'hover:bg-slate-800/80'
                  }`}
                >
                  <div
                    className="flex-1 min-w-0 rounded px-2.5 py-1 text-xs border border-black/20 flex items-center justify-between gap-2"
                    style={{
                      backgroundColor: song.bgColor || '#ffffff',
                      color: song.textColor || '#000000',
                    }}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono font-bold opacity-75 shrink-0">#{song.id}</span>
                      <span className="font-bold truncate">{cleanTitleForPdf(song.pdf_title, song.id)}</span>
                    </div>
                    {song.category && (
                      <span className="text-[10px] uppercase font-bold opacity-70 shrink-0">
                        {song.category}
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 w-6 flex items-center justify-center">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-slate-700" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition"
          >
            Zrušit
          </button>

          <button
            onClick={handleConfirm}
            disabled={selectedMasterId === null}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition shadow-md shadow-indigo-600/30"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Spárovat s #{selectedMasterId || '...'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
