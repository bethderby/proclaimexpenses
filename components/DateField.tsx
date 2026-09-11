'use client';
import { useState } from 'react';
import { Calendar } from 'lucide-react';

/**
 * A date input styled to match the rest of the form.
 *
 * Mobile browsers (iOS Safari especially) render a filled `<input type="date">`
 * as a native, non-stylable control — its text ignores font-size entirely,
 * which is why the date field can look much bigger than every other field.
 *
 * To fix this reliably we keep the real <input type="date"> (so the native
 * date picker still opens on tap) but make it invisible and put our own
 * text on top, sized and coloured exactly like every other input.
 */
export default function DateField({
  name,
  defaultValue,
  value,
  onChange,
  required,
  dark,
  reportFormat,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  dark?: boolean;
  reportFormat?: boolean;
}) {
  const [internal, setInternal] = useState(defaultValue || '');
  const current = value !== undefined ? value : internal;
  const display = current
    ? (() => {
        const [year, month, day] = current.split('-');
        return reportFormat ? `${month}-${day}-${year}` : new Date(current + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      })()
    : '';

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (onChange) onChange(v);
    if (value === undefined) setInternal(v);
  }

  return (
    <div className="relative h-10 w-full">
      <input
        type="date"
        name={name}
        required={required}
        value={current}
        onChange={handleChange}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div
        className={`pointer-events-none flex h-10 w-full items-center justify-between rounded-xl border px-3 text-sm ring-slate-900 peer-focus:ring-2 ${
          dark
            ? 'border-0 bg-white/10 text-white ring-emerald-400'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <span className={display ? '' : 'text-slate-400'}>{display || 'Select date'}</span>
        <Calendar size={15} className="text-slate-400" />
      </div>
    </div>
  );
}
