import React, { useEffect } from 'react';
import {
  X,
  Plus,
  Music,
  Gauge,
  Users,
  Sparkles,
  BookOpen,
  AlertTriangle,
  Mic,
  Activity,
} from 'lucide-react';
import { Song } from '../types';
import { cleanTitleForPdf } from '../services/exportGenerator';
import { hasRichMetadata } from '../services/songEnricher';

interface SongDetailModalProps {
  song: Song | null;
  activeSetName: string;
  isInActiveSet: boolean;
  onClose: () => void;
  onAddSongToActiveSet: (song: Song) => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  cs: 'Čeština',
  sk: 'Slovenština',
  en: 'Angličtina',
  it: 'Italština',
  de: 'Němčina',
  es: 'Španělština',
  fr: 'Francouzština',
  multi: 'Vícejazyčná',
  instrumental: 'Instrumentální (bez zpěvu)',
};

const TEMPO_LABELS: Record<string, string> = {
  pomala: 'Pomalá (balada / ploužák)',
  stredni: 'Střední (steady groove / valčík)',
  rychla: 'Rychlá (upbeat / párty / polka / rock)',
  promenliva: 'Proměnlivá (směs / accelerando)',
};

const DANCE_LABELS: Record<string, string> = {
  vysoka: 'Vysoká (výrazně taneční)',
  stredni: 'Střední (volný tanec / ploužák)',
  nizka: 'Nízká (poslechová / koncertní)',
};

export const SongDetailModal: React.FC<SongDetailModalProps> = ({
  song,
  activeSetName,
  isInActiveSet,
  onClose,
  onAddSongToActiveSet,
}) => {
  useEffect(() => {
    if (!song) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song, onClose]);

  if (!song) return null;

  const displayTitle = song.cleanTitle || cleanTitleForPdf(song.pdf_title, song.id);
  const rich = hasRichMetadata(song);
  const singerName = song.pepeto?.singer || 'Neuvedeno';
  const isCommonlyPlayed = song.pepeto?.isCommonlyPlayed;
  const energy = typeof song.energy === 'number' ? Math.max(1, Math.min(10, song.energy)) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detail skladby ${displayTitle}`}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950/90 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-950/90 border border-indigo-700/70 text-indigo-300">
                #{song.id}
              </span>

              <span
                className="text-xs font-bold px-2 py-0.5 rounded border border-black/15 inline-flex items-center gap-1"
                style={{
                  backgroundColor: song.bgColor || '#ffffff',
                  color: song.textColor || '#000000',
                }}
                title="Barevné kódování z Excelu kapely"
              >
                <Mic className="w-3 h-3" />
                <span>{singerName}</span>
              </span>

              {isCommonlyPlayed === true && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/70 text-emerald-300">
                  Běžně se hraje
                </span>
              )}
              {isCommonlyPlayed === false && song.isPlayableSong !== false && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  Rezervní / Běžně se nehraje
                </span>
              )}

              {song.pepeto?.sax && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950/80 border border-rose-700/70 text-rose-300">
                  {song.pepeto.sax}
                </span>
              )}

              {song.pepeto?.inRemovalList && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-950/90 border border-amber-700/70 text-amber-300 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  K vyřazení
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white leading-snug break-words">
              {displayTitle}
            </h3>

            <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                MSS: <strong className="text-slate-300">{song.mss_title}</strong>
              </span>
              {song.pdf_title && song.pdf_title !== displayTitle && (
                <span>
                  PDF: <strong className="text-slate-300">{song.pdf_title}</strong>
                </span>
              )}
              {song.mss_fileName && (
                <span>
                  Soubor: <strong className="text-slate-300">{song.mss_fileName}</strong>
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
            title="Zavřít (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {song.isPlayableSong === false && (
            <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/60 text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                Jedná se o technický rejstříkový PDF dokument v MobileSheets (neřadí se do hraných setlistů).
              </span>
            </div>
          )}

          {!rich && (
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 text-slate-300 text-xs">
              Pro tuto skladbu zatím nejsou v rozšířené databázi doplněna detailní metadata (např. nově přidaná položka z Excelu/MSS). Zobrazují se základní údaje ze synchronizace.
            </div>
          )}

          {/* 1. Základní údaje */}
          <section className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-indigo-400" />
              <span>Základní údaje o skladbě</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs">
              <div>
                <span className="text-slate-400 block">Interpret / autor</span>
                <span className="font-semibold text-white">{song.artist || 'Neuvedeno'}</span>
              </div>
              {song.originalArtist && (
                <div>
                  <span className="text-slate-400 block">Původní interpret</span>
                  <span className="font-semibold text-slate-200">{song.originalArtist}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block">Rok / Jazyk</span>
                <span className="font-semibold text-slate-200">
                  {song.year ?? '—'} ·{' '}
                  {song.language ? LANGUAGE_LABELS[song.language] || song.language : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Kategorie & Typ</span>
                <span className="font-semibold text-slate-200">
                  {[song.category, song.songType].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
              {song.genres && song.genres.length > 0 && (
                <div className="sm:col-span-2 pt-1">
                  <span className="text-slate-400 block mb-1.5">Žánry</span>
                  <div className="flex flex-wrap gap-1.5">
                    {song.genres.map((g) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-[11px]"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 2. Hudební a taneční profil */}
          <section className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hudební a taneční profil</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs">
              <div>
                <span className="text-slate-400 block">Tempo</span>
                <span className="font-semibold text-white">
                  {song.labelsCs?.tempo ||
                    (song.tempoCategory ? TEMPO_LABELS[song.tempoCategory] || song.tempoCategory : '—')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">BPM / Takt</span>
                <span className="font-semibold text-white">
                  {song.bpm ? `${song.bpm} BPM` : '—'}
                  {song.timeSignature ? ` · ${song.timeSignature}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Energie (1–10)</span>
                {energy !== null ? (
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold text-white">{energy} / 10</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                        style={{ width: `${energy * 10}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-300">—</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block">Tanečnost / Vokál</span>
                <span className="font-semibold text-slate-200 block">
                  {song.labelsCs?.danceability ||
                    (song.danceability
                      ? DANCE_LABELS[song.danceability] || song.danceability
                      : '—')}
                </span>
                {song.vocalType && (
                  <span className="text-[11px] text-slate-400">{song.vocalType}</span>
                )}
              </div>

              {song.danceStyles && song.danceStyles.length > 0 && (
                <div className="col-span-2 sm:col-span-2 pt-1">
                  <span className="text-slate-400 block mb-1.5">Taneční styly</span>
                  <div className="flex flex-wrap gap-1.5">
                    {song.danceStyles.map((d) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-[11px]"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {song.mood && song.mood.length > 0 && (
                <div className="col-span-2 sm:col-span-2 pt-1">
                  <span className="text-slate-400 block mb-1.5">Nálada</span>
                  <div className="flex flex-wrap gap-1.5">
                    {song.mood.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-700/60 text-indigo-200 text-[11px]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {song.setlistRoles && song.setlistRoles.length > 0 && (
                <div className="col-span-2 sm:col-span-4 pt-1">
                  <span className="text-slate-400 block mb-1.5">Vhodné role v setlistu</span>
                  <div className="flex flex-wrap gap-1.5">
                    {song.setlistRoles.map((role) => (
                      <span
                        key={role}
                        className="px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-700/60 text-amber-200 text-[11px]"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. Publikum, AI popis a kapelní poznámky */}
          {(song.audienceAppeal || song.aiDescription || song.note || song.pepeto?.roudniceSet || song.verifiedSource) && (
            <section className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Kapelní kontext & AI popis</span>
              </h4>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                {song.aiDescription && (
                  <p className="text-slate-200 leading-relaxed">{song.aiDescription}</p>
                )}

                {song.audienceAppeal && (
                  <div className="flex items-start gap-2 text-slate-300">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-200">Publikum:</strong> {song.audienceAppeal}
                    </span>
                  </div>
                )}

                {song.pepeto?.roudniceSet && (
                  <div className="text-slate-300">
                    <strong className="text-slate-200">Ukázkový set (Roudnice):</strong>{' '}
                    <span className="text-indigo-300">{song.pepeto.roudniceSet}</span>
                  </div>
                )}

                {song.note && (
                  <div className="text-slate-400 border-t border-slate-800 pt-2">
                    <strong className="text-slate-300">Interní poznámka:</strong> {song.note}
                  </div>
                )}

                {song.verifiedSource && (
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-500">
                    <BookOpen className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Ověřeno: {song.verifiedSource}</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Zavřít
          </button>

          <button
            type="button"
            onClick={() => {
              onAddSongToActiveSet(song);
              onClose();
            }}
            disabled={isInActiveSet}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>
              {isInActiveSet
                ? `Již je v ${activeSetName}`
                : `Přidat do ${activeSetName}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
