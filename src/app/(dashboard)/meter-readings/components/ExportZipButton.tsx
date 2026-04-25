"use client";
import React from "react";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}

function formatReadingValue(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(numericValue) ? numericValue.toFixed(3) : null;
}

interface ExportZipButtonProps {
  year: number;
  month: number;
  regNr: string;
  companyName: string;
  address?: string;
  rows: Array<{
    DzNumurs: string;
    DzForeignKey: string;
    SkdNrM: string;
    BeigMNor?: number | string | null;
  }>;
  className?: string;
}

const ExportZipButton: React.FC<ExportZipButtonProps> = ({ year, month, regNr, companyName, address, rows, className }) => {
  const handleExportXml = () => {
    const xmlRows = rows
      .map((row) => {
        const apartmentNumber = String(row.DzNumurs ?? "").trim();
        const readingValue = formatReadingValue(row.BeigMNor);
        if (!apartmentNumber || !row.SkdNrM || !readingValue) {
          return "";
        }

        return [
          "    <R>",
          `      <DzNumurs>${escapeXml(apartmentNumber)}</DzNumurs>`,
          `      <DzForeignKey>${escapeXml(apartmentNumber)}</DzForeignKey>`,
          `      <SkdNrM>${escapeXml(String(row.SkdNrM))}</SkdNrM>`,
          `      <BeigMNor>${readingValue}</BeigMNor>`,
          "    </R>",
        ].join("\n");
      })
      .filter(Boolean)
      .join("\n");

    if (!xmlRows) {
      return;
    }

    const xml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<UdSkRd xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      `  <Gads>${year}</Gads>`,
      `  <Menesis>${month}</Menesis>`,
      `  <RegNr>${escapeXml(regNr)}</RegNr>`,
      `  <Nosaukums>${escapeXml(companyName)}</Nosaukums>`,
      "  <Tab>",
      xmlRows,
      "  </Tab>",
      "</UdSkRd>",
      "",
    ].join("\n");

    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_\- ]/g, "_");
    const base = sanitize(address || companyName || "company");
    const ym = `${year}_${String(month).padStart(2, "0")}`;

    const blob = new Blob([xml], { type: "application/xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}_${ym}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      className={className || "px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition"}
      onClick={handleExportXml}
    >
      Скачать XML
    </button>
  );
};

export default ExportZipButton;
