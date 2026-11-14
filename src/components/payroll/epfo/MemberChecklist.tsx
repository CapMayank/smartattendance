import React from 'react';
import { Check, X } from 'lucide-react';

const FIELDS: Array<[string, string]> = [
  ['aadhaar', 'Aadhaar'],
  ['qualification', 'Qualification'],
  ['mobileNumber', 'Mobile'],
  ['fatherHusbandName', 'Father/Husband'],
  ['dob', 'Date of birth'],
  ['gender', 'Gender'],
  ['maritalStatus', 'Marital status'],
];

/** One chip per required detail: green when present, red when EPFO validation flags it. */
export function MemberChecklist({ errors }: { errors: Array<{ field: string; message: string }> }) {
  const missing = new Set(errors.map((e) => e.field));
  const known = new Set(FIELDS.map(([f]) => f));
  const extras = errors.filter((e) => !known.has(e.field));

  const chip = (field: string, label: string, bad: boolean, title?: string) => (
    <span
      key={field}
      data-field={field}
      data-state={bad ? 'missing' : 'ok'}
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] ${
        bad
          ? 'border-absent/30 bg-absent/10 text-absent'
          : 'border-present/30 bg-present/10 text-present'
      }`}
    >
      {bad ? <X size={11} aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
      {label}
    </span>
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      {FIELDS.map(([f, label]) => chip(f, label, missing.has(f)))}
      {extras.map((e) => chip(e.field, e.message, true, e.message))}
    </div>
  );
}
