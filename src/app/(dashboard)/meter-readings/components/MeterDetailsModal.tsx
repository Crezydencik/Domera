"use client";

import { useEffect } from "react";
import type { Meter } from "@/shared/types";

interface MeterDetailsModalProps {
  isOpen: boolean;
  meters: Meter[];
  serials: Record<string, string>;
  checks: Record<string, string>;
  onChangeSerial: (meterId: string, value: string) => void;
  onChangeCheck: (meterId: string, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function MeterDetailsModal({
  isOpen,
  meters,
  serials,
  checks,
  onChangeSerial,
  onChangeCheck,
  onClose,
  onSave,
}: MeterDetailsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Данные счетчиков</h3>
            <p className="text-xs text-gray-500 mt-1">Нажмите Esc для закрытия</p>
          </div>
          <button
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {meters.length === 0 ? (
            <p className="text-gray-600 text-center py-10">Счетчики не найдены</p>
          ) : (
            <form
              id="meter-details-form"
              onSubmit={(e) => {
                e.preventDefault();
                onSave();
              }}
              className="space-y-5"
            >
              {meters.map((meter) => {
                const isHot = meter.name?.toLowerCase() === "hwm";
                return (
                  <section key={meter.id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                    <h4 className="text-sm font-bold text-gray-700 mb-4 px-3 py-2 bg-white border border-gray-200 rounded-lg flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${isHot ? "bg-red-500" : "bg-blue-500"}`} />
                      {isHot ? "Горячая вода (ГВС)" : "Холодная вода (ХВС)"}
                    </h4>
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-semibold text-gray-700 mb-2 block">Номер счетчика</span>
                        <input
                          type="text"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition placeholder-gray-400"
                          placeholder="Введите номер"
                          value={serials[meter.id] || ""}
                          onChange={(e) => onChangeSerial(meter.id, e.target.value)}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-gray-700 mb-2 block">Дата проверки</span>
                        <input
                          type="date"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition"
                          value={checks[meter.id] || ""}
                          onChange={(e) => onChangeCheck(meter.id, e.target.value)}
                        />
                      </label>
                    </div>
                  </section>
                );
              })}
            </form>
          )}
        </div>

        {meters.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 bg-white">
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-900 font-semibold hover:bg-gray-200 transition"
                onClick={onClose}
              >
                Отмена
              </button>
              <button
                type="submit"
                form="meter-details-form"
                className="flex-1 px-4 py-2.5 rounded-lg bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition shadow-md"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
