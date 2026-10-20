import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronDown,
  FileText,
  Plane,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import catalogData from './airport-data.json';

type Region = { code: string; abbreviation: string; name: string };
type Airport = {
  id: number;
  regionCode: string;
  city: string;
  code: string;
  iataCode: string;
  name: string;
  latitude: number;
  longitude: number;
};
type Leg = {
  id: string;
  airline: string;
  flightNo: string;
  originState: string;
  originCity: string;
  origin: string;
  originAirportId: string;
  destinationState: string;
  destinationCity: string;
  destination: string;
  destinationAirportId: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  duration: string;
  layover: string;
  seat: string;
  cabin: string;
};
type Draft = {
  agency: string;
  bookingRef: string;
  bookedDate: string;
  logo: string;
  travelerName: string;
  ticketNumber: string;
  travelerType: string;
  requests: string;
  meal: string;
  contactEmail: string;
  paymentTotal: string;
  paymentAmountPaid: string;
  paymentCurrency: string;
  paymentMethod: string;
  paymentReference: string;
  paymentDate: string;
  flightType: 'nonstop' | 'connecting';
  segments: Leg[];
};

const regions: Region[] = catalogData.regions.map(([code, abbreviation, name]) => ({
  code,
  abbreviation,
  name,
}));
const airports: Airport[] = catalogData.airports;
const STORE_KEY = 'northstar-ticket-draft';
const blankLeg = (): Leg => ({
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  airline: '',
  flightNo: '',
  originState: '',
  originCity: '',
  origin: '',
  originAirportId: '',
  destinationState: '',
  destinationCity: '',
  destination: '',
  destinationAirportId: '',
  departDate: '',
  departTime: '',
  arriveDate: '',
  arriveTime: '',
  duration: '',
  layover: '',
  seat: '',
  cabin: 'Economy',
});
const initialDraft = (): Draft => ({
  agency: '',
  bookingRef: '',
  bookedDate: new Date().toISOString().slice(0, 10),
  logo: '',
  travelerName: '',
  ticketNumber: '',
  travelerType: 'Adult',
  requests: '',
  meal: '',
  contactEmail: '',
  paymentTotal: '',
  paymentAmountPaid: '',
  paymentCurrency: 'USD',
  paymentMethod: '',
  paymentReference: '',
  paymentDate: '',
  flightType: 'nonstop',
  segments: [blankLeg()],
});
const savedDraft = (): Draft => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return initialDraft();
    const segments = Array.isArray(parsed.segments) && parsed.segments.length
      ? parsed.segments.map((segment: Partial<Leg>) => ({ ...blankLeg(), ...segment }))
      : [blankLeg()];
    const flightType = parsed.flightType === 'connecting' || segments.length > 1 ? 'connecting' : 'nonstop';
    return { ...initialDraft(), ...parsed, segments, flightType };
  } catch {
    return initialDraft();
  }
};

const tzByState: Record<string, string> = {
  CA:'America/Los_Angeles', NV:'America/Los_Angeles', WA:'America/Los_Angeles', OR:'America/Los_Angeles',
  ID:'America/Boise', MT:'America/Denver', WY:'America/Denver', UT:'America/Denver', CO:'America/Denver',
  NM:'America/Denver', AZ:'America/Phoenix', ND:'America/Chicago', SD:'America/Chicago', NE:'America/Chicago',
  KS:'America/Chicago', OK:'America/Chicago', TX:'America/Chicago', MN:'America/Chicago', IA:'America/Chicago',
  MO:'America/Chicago', AR:'America/Chicago', LA:'America/Chicago', WI:'America/Chicago', IL:'America/Chicago',
  MS:'America/Chicago', AL:'America/Chicago', TN:'America/Chicago', KY:'America/New_York', MI:'America/Detroit',
  IN:'America/Indiana/Indianapolis', OH:'America/New_York', WV:'America/New_York', VA:'America/New_York',
  NC:'America/New_York', SC:'America/New_York', GA:'America/New_York', FL:'America/New_York', NY:'America/New_York',
  PA:'America/New_York', NJ:'America/New_York', DE:'America/New_York', MD:'America/New_York', DC:'America/New_York',
  CT:'America/New_York', RI:'America/New_York', MA:'America/New_York', VT:'America/New_York', NH:'America/New_York',
  ME:'America/New_York', AK:'America/Anchorage', HI:'Pacific/Honolulu',
};
const regionTimeZone = (region: string) => tzByState[region.split('-')[1]] || 'America/New_York';
const toUtc = (date: string, time: string, state: string): number | null => {
  if (!date || !time) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  let target = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: regionTimeZone(state), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(target)).map((part) => [part.type, part.value]));
    const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const delta = Date.UTC(year, month - 1, day, hour, minute) - observed;
    if (!delta) return target;
    target += delta;
  }
  return target;
};
const elapsed = (d1: string, t1: string, s1: string, d2: string, t2: string, s2: string) => {
  const start = toUtc(d1, t1, s1);
  const end = toUtc(d2, t2, s2);
  if (!start || !end || end <= start) return '';
  const minutes = Math.round((end - start) / 60000);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
};
const prettyDate = (value: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(+date) ? value : new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
};
const clock = (value: string) => {
  if (!value) return '--:--';
  const [hour, minute] = value.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};
const money = (value: number, currency: string) => {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};
const fullLeg = (leg: Leg) => Boolean(leg.airline && leg.originAirportId && leg.destinationAirportId
  && leg.departDate && leg.departTime && leg.arriveDate && leg.arriveTime);
function Field({
  label, value, onChange, type = 'text', placeholder, required, readOnly, hint, min, step, testId,
}: {
  label: string; value: string; onChange?: (value: string) => void; type?: string; placeholder?: string;
  required?: boolean; readOnly?: boolean; hint?: string; min?: string; step?: string; testId: string;
}) {
  return <label className="field">
    <span className="label">{label}{required && <i className="required"> *</i>}</span>
    <input className="control" data-testid={testId} type={type} value={value} placeholder={placeholder}
      required={required} readOnly={readOnly} min={min} step={step}
      onChange={(event) => onChange?.(event.target.value)} />
    {hint && <span className="help">{hint}</span>}
  </label>;
}
function SelectField({
  label, value, options, onChange, disabled, testId,
}: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
  disabled?: boolean; testId: string;
}) {
  return <label className="field">
    <span className="label">{label}</span>
    <select className="control" data-testid={testId} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      <option value="">{disabled ? 'Choose a location above' : 'Choose an option'}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
function SectionCard({ number, title, subtitle, action, children }: {
  number: string; title: string; subtitle: string; action?: ReactNode; children: ReactNode;
}) {
  return <section className="card">
    <div className="card-head"><div className="section-title"><span className="num">{number}</span>
      <div><h2>{title}</h2><p>{subtitle}</p></div></div>{action}</div>
    {children}
  </section>;
}

function App() {
  const [draft, setDraft] = useState<Draft>(savedDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(draft));
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    }, 300);
    return () => window.clearTimeout(saveTimer.current);
  }, [draft]);

  const airportsById = useMemo(() => new Map(airports.map((airport) => [String(airport.id), airport])), []);
  const updateDraft = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors([]);
  };
  const updateLeg = (id: string, key: keyof Leg, value: string) => {
    setDraft((current) => ({
      ...current,
      segments: current.segments.map((leg) => leg.id === id ? { ...leg, [key]: value } : leg),
    }));
    setErrors([]);
  };
  const locationFields = (leg: Leg, side: 'origin' | 'destination', title?: string) => {
    const stateKey = `${side}State` as const;
    const cityKey = `${side}City` as const;
    const codeKey = side;
    const airportKey = `${side}AirportId` as const;
    const availableCities = [...new Set(airports.filter((airport) => airport.regionCode === leg[stateKey]).map((airport) => airport.city))].sort();
    const availableAirports = airports.filter((airport) => airport.regionCode === leg[stateKey] && airport.city === leg[cityKey])
      .sort((a, b) => a.name.localeCompare(b.name));
    const label = side === 'origin' ? 'Departure' : 'Arrival';
    return <div className="location-block" key={`${leg.id}-${side}`}>
      <div className="location-title">{title || `${label} location`}</div>
      <div className="location-grid">
        <SelectField label={`${label} · state`} testId={`select-${leg.id}-${side}-state`} value={leg[stateKey]}
          options={regions.map((region) => ({ value: region.code, label: `${region.name} (${region.abbreviation})` }))}
          disabled={false} onChange={(value) => setDraft((current) => ({ ...current, segments: current.segments.map((item) =>
            item.id === leg.id ? { ...item, [stateKey]: value, [cityKey]: '', [codeKey]: '', [airportKey]: '' } : item) }))} />
        <SelectField label={`${label} · city`} testId={`select-${leg.id}-${side}-city`} value={leg[cityKey]}
          options={availableCities.map((city) => ({ value: city, label: city }))} disabled={!leg[stateKey] || !availableCities.length}
          onChange={(value) => setDraft((current) => ({ ...current, segments: current.segments.map((item) =>
            item.id === leg.id ? { ...item, [cityKey]: value, [codeKey]: '', [airportKey]: '' } : item) }))} />
        <SelectField label={`${label} · airport`} testId={`select-${leg.id}-${side}-airport`} value={leg[airportKey]}
          options={availableAirports.map((airport) => ({ value: String(airport.id), label: `${airport.iataCode || airport.code} — ${airport.name}` }))}
          disabled={!leg[cityKey] || !availableAirports.length}
          onChange={(value) => {
            const selected = airportsById.get(value);
            setDraft((current) => ({ ...current, segments: current.segments.map((item) => item.id === leg.id
              ? { ...item, [stateKey]: selected?.regionCode || '', [cityKey]: selected?.city || '',
                [codeKey]: selected ? selected.iataCode || selected.code : '', [airportKey]: value } : item) }));
          }} />
      </div>
    </div>;
  };
  const connectionSelection = (index: number) => {
    const before = draft.segments[index];
    const after = draft.segments[index + 1];
    if (!before || !after) return { airportId: '', state: '', city: '' };
    const beforeId = before.destinationAirportId;
    const afterId = after.originAirportId;
    const airportId = beforeId && beforeId === afterId ? beforeId : '';
    const airport = airportsById.get(airportId);
    return {
      airportId,
      state: airport?.regionCode || (before.destinationState === after.originState ? before.destinationState : ''),
      city: airport?.city || (before.destinationCity === after.originCity ? before.destinationCity : ''),
    };
  };
  const setConnectionAirport = (index: number, airport?: Airport, state = '', city = '') => {
    setDraft((current) => ({
      ...current,
      segments: current.segments.map((leg, legIndex) => {
        if (legIndex !== index && legIndex !== index + 1) return leg;
        const side = legIndex === index ? 'destination' : 'origin';
        return { ...leg, [`${side}State`]: state, [`${side}City`]: city,
          [side]: airport ? airport.iataCode || airport.code : '', [`${side}AirportId`]: airport ? String(airport.id) : '' };
      }),
    }));
  };
  const connectionFields = (index: number) => {
    const selection = connectionSelection(index);
    const stateOptions = regions.filter((region) => airports.some((airport) => airport.regionCode === region.code));
    const state = stateOptions.some((region) => region.code === selection.state) ? selection.state : '';
    const cityOptions = state
      ? [...new Set(airports.filter((airport) => airport.regionCode === state).map((airport) => airport.city))].sort()
      : [];
    const city = cityOptions.includes(selection.city) ? selection.city : '';
    const airportOptions = airports.filter((airport) => airport.regionCode === state && airport.city === city)
      .sort((a, b) => a.name.localeCompare(b.name));
    return <div className="route-connection" key={`connection-${index}`}>
      <div className="route-connection-heading"><strong>Layover {index + 1}</strong>
        <span>Choose any state, then a city and airport. All airports in the selected state are available.</span></div>
      <div className="location-grid">
        <SelectField label="Layover state" testId={`select-connection-${index}-state`} value={state}
          options={stateOptions.map((region) => ({ value: region.code, label: `${region.name} (${region.abbreviation})` }))}
          onChange={(value) => setConnectionAirport(index, undefined, value, '')} />
        <SelectField label="City" testId={`select-connection-${index}-city`} value={city}
          options={cityOptions.map((value) => ({ value, label: value }))} disabled={!state}
          onChange={(value) => setConnectionAirport(index, undefined, state, value)} />
        <SelectField label="Airport" testId={`select-connection-${index}-airport`} value={selection.airportId}
          options={airportOptions.map((airport) => ({ value: String(airport.id), label: `${airport.iataCode || airport.code} — ${airport.name}` }))}
          disabled={!city} onChange={(value) => {
            const selected = airportOptions.find((airport) => String(airport.id) === value);
            setConnectionAirport(index, selected, selected?.regionCode || state, selected?.city || city);
          }} />
      </div>
    </div>;
  };
  const changeFlightType = (flightType: 'nonstop' | 'connecting') => {
    if (flightType === draft.flightType) return;
    if (flightType === 'connecting' && draft.segments.length === 1) {
      setDraft((current) => ({ ...current, flightType, segments: [...current.segments, blankLeg()] }));
    } else if (flightType === 'nonstop' && draft.segments.length > 1) {
      if (!window.confirm(`Direct / nonstop uses one flight. Remove ${draft.segments.length - 1} additional flight segment${draft.segments.length === 2 ? '' : 's'} and its layover details?`)) return;
      setDraft((current) => {
        const final = current.segments[current.segments.length - 1];
        const first = current.segments[0];
        return { ...current, flightType, segments: [{ ...first, destinationState: final.destinationState || first.destinationState,
          destinationCity: final.destinationCity || first.destinationCity, destination: final.destination || first.destination,
          destinationAirportId: final.destinationAirportId || first.destinationAirportId,
          arriveDate: final.arriveDate || first.arriveDate, arriveTime: final.arriveTime || first.arriveTime }] };
      });
    } else setDraft((current) => ({ ...current, flightType }));
    setErrors([]);
  };
  const addConnection = () => setDraft((current) => {
    const segments = [...current.segments];
    const last = segments[segments.length - 1];
    const next = blankLeg();
    next.destinationState = last.destinationState;
    next.destinationCity = last.destinationCity;
    next.destination = last.destination;
    next.destinationAirportId = last.destinationAirportId;
    segments[segments.length - 1] = { ...last, destinationState: '', destinationCity: '', destination: '', destinationAirportId: '' };
    return { ...current, flightType: 'connecting', segments: [...segments, next] };
  });
  const removeSegment = (id: string) => {
    setDraft((current) => {
      const index = current.segments.findIndex((leg) => leg.id === id);
      if (index < 0) return current;
      const removed = current.segments[index];
      const segments = current.segments.filter((leg) => leg.id !== id);
      if (index === current.segments.length - 1 && segments.length) {
        const last = segments[segments.length - 1];
        segments[segments.length - 1] = { ...last, destinationState: removed.destinationState || last.destinationState,
          destinationCity: removed.destinationCity || last.destinationCity, destination: removed.destination || last.destination,
          destinationAirportId: removed.destinationAirportId || last.destinationAirportId,
          arriveDate: removed.arriveDate || last.arriveDate, arriveTime: removed.arriveTime || last.arriveTime };
      }
      return { ...current, segments, flightType: segments.length < 2 ? 'nonstop' : 'connecting' };
    });
  };
  const setLocation = (id: string, side: 'origin' | 'destination', part: 'state' | 'city' | 'airport', value: string) => {
    const leg = draft.segments.find((item) => item.id === id);
    if (!leg) return;
    if (part === 'state') {
      setDraft((current) => ({ ...current, segments: current.segments.map((item) => item.id === id
        ? { ...item, [`${side}State`]: value, [`${side}City`]: '', [side]: '', [`${side}AirportId`]: '' } : item) }));
    } else if (part === 'city') {
      setDraft((current) => ({ ...current, segments: current.segments.map((item) => item.id === id
        ? { ...item, [`${side}City`]: value, [side]: '', [`${side}AirportId`]: '' } : item) }));
    } else {
      const selected = airportsById.get(value);
      setDraft((current) => ({ ...current, segments: current.segments.map((item) => item.id === id
        ? { ...item, [`${side}State`]: selected?.regionCode || '', [`${side}City`]: selected?.city || '',
          [side]: selected ? selected.iataCode || selected.code : '', [`${side}AirportId`]: value } : item) }));
    }
    setErrors([]);
  };
  const duration = (leg: Leg) => elapsed(leg.departDate, leg.departTime, leg.originState, leg.arriveDate, leg.arriveTime, leg.destinationState) || leg.duration || '—';
  const layover = (leg: Leg, next: Leg) => elapsed(leg.arriveDate, leg.arriveTime, leg.destinationState, next.departDate, next.departTime, next.originState) || leg.layover || '—';
  const travelTime = elapsed(draft.segments[0]?.departDate, draft.segments[0]?.departTime, draft.segments[0]?.originState,
    draft.segments.at(-1)?.arriveDate || '', draft.segments.at(-1)?.arriveTime || '', draft.segments.at(-1)?.destinationState || '') || '—';
  const paid = Number(draft.paymentAmountPaid) || 0;
  const total = draft.paymentTotal.trim() ? Number(draft.paymentTotal) : NaN;
  const balance = Number.isFinite(total) ? Math.max(0, total - paid) : NaN;
  const paymentStatus = !Number.isFinite(total) ? 'Not provided' : paid >= total ? 'Paid' : paid > 0 ? 'Partially paid' : 'Unpaid';
  const validate = () => {
    const messages: string[] = [];
    if (!draft.bookingRef.trim()) messages.push('Add a booking reference.');
    if (!draft.travelerName.trim()) messages.push('Add the traveler’s full name.');
    if (!draft.ticketNumber.trim()) messages.push('Add the e-ticket number.');
    if (draft.flightType === 'connecting' && draft.segments.length < 2) messages.push('Add at least two flight segments for a connecting itinerary.');
    if (draft.flightType === 'connecting') draft.segments.slice(0, -1).forEach((_, index) => {
      const selected = connectionSelection(index).airportId;
      if (!selected || !airportsById.has(selected)) messages.push(`Choose a state, city, and airport for layover ${index + 1}.`);
    });
    draft.segments.forEach((leg, index) => {
      if (!fullLeg(leg)) messages.push(`Complete flight segment ${index + 1}, including selected airports and departure and arrival times.`);
    });
    setErrors(messages);
    if (messages.length) {
      window.setTimeout(() => errorRef.current?.focus(), 0);
      return false;
    }
    return true;
  };
  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) {
      setErrors([file.size > 3 * 1024 * 1024 ? 'Logo must be smaller than 3 MB.' : 'Choose an image file for your logo.']);
      return;
    }
    try {
      updateDraft('logo', await fileToDataUrl(file));
    } catch {
      setErrors(['This image could not be loaded. Please choose another file.']);
    }
  };
  const useExample = () => {
    if (draft.bookingRef || draft.travelerName || draft.segments.some(fullLeg)) {
      if (!window.confirm('Replace the current draft with example information? Your current entries will be overwritten.')) return;
    }
    const findAirport = (code: string) => airports.find((airport) => (airport.iataCode || airport.code) === code);
    const createSampleLeg = (airline: string, flightNo: string, from: string, to: string, departDate: string,
      departTime: string, arriveDate: string, arriveTime: string, seat: string, cabin: string): Leg | null => {
      const origin = findAirport(from);
      const destination = findAirport(to);
      if (!origin || !destination) return null;
      return { ...blankLeg(), airline, flightNo, originState: origin.regionCode, originCity: origin.city,
        origin: origin.iataCode || origin.code, originAirportId: String(origin.id),
        destinationState: destination.regionCode, destinationCity: destination.city,
        destination: destination.iataCode || destination.code, destinationAirportId: String(destination.id),
        departDate, departTime, arriveDate, arriveTime, seat, cabin };
    };
    const segments = [
      createSampleLeg('United Airlines', 'UA 1587', 'JFK', 'BMI', '2027-05-20', '08:30', '2027-05-20', '10:15', '14A', 'Economy'),
      createSampleLeg('United Express', 'UA 5621', 'BMI', 'LAX', '2027-05-20', '12:30', '2027-05-20', '15:25', '8C', 'Premium Economy'),
    ];
    if (segments.some((leg) => !leg)) {
      setErrors(['The sample airports could not be found in the embedded catalog.']);
      return;
    }
    const logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="120" viewBox="0 0 520 120"><rect width="120" height="120" rx="24" fill="#155e63"/><path d="M60 21 68 49 96 60 68 70 60 99 51 70 24 60 51 49Z" fill="#f3d9a3"/><text x="145" y="60" fill="#155e63" font-family="Georgia,serif" font-size="34" font-weight="700">NORTHSTAR</text><text x="147" y="88" fill="#73827a" font-family="Arial,sans-serif" font-size="15" letter-spacing="3">TRAVEL STUDIO</text></svg>';
    setDraft({ ...initialDraft(), agency:'Northstar Travel Studio', bookingRef:'DEMO-FTG-2027', bookedDate:'2027-04-10',
      logo:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(logoSvg)}`, travelerName:'Alex Sample',
      ticketNumber:'9991234567890', travelerType:'Adult', requests:'Window seat', meal:'Vegetarian meal',
      contactEmail:'alex.sample@example.com', paymentTotal:'840.00', paymentAmountPaid:'500.00',
      paymentCurrency:'USD', paymentMethod:'Bank transfer', paymentReference:'DEMO-PAY-2027-0410',
      paymentDate:'2027-04-10', flightType:'connecting', segments: segments as Leg[] });
    setErrors([]);
  };
  const clearDraft = () => {
    if (!window.confirm('Clear all booking and traveler details?')) return;
    const cleared = initialDraft();
    setDraft(cleared);
    setErrors([]);
    localStorage.removeItem(STORE_KEY);
  };
  const printTicket = () => {
    if (!validate()) return;
    setMenuOpen(false);
    const itinerary = document.querySelector<HTMLElement>('[data-testid="preview-page-itinerary"]');
    const sheet = itinerary?.querySelector<HTMLElement>('.ticket-sheet');
    if (itinerary && sheet) {
      const measuredHeight = Math.max(sheet.scrollHeight, 1);
      const printScale = Math.min(0.9, 860 / measuredHeight);
      itinerary.style.setProperty('--print-scale', printScale.toFixed(3));
    }
    window.setTimeout(() => window.print(), 50);
  };
  const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[char] || char));
  const downloadPng = () => {
    if (!validate()) return;
    const rows = draft.segments.map((leg, index) => {
      const y = 310 + index * 180;
      return `<rect x="66" y="${y}" width="1368" height="156" fill="#fff" stroke="#d7e0e7"/><text x="92" y="${y + 36}" font-size="19" font-weight="700">${escapeXml(`${index + 1}. ${leg.airline} · ${leg.flightNo || 'Flight number not set'}`)}</text><text x="92" y="${y + 75}" font-size="17">${escapeXml(`${prettyDate(leg.departDate)} · ${leg.originCity} · ${leg.origin} · ${clock(leg.departTime)}`)}</text><text x="92" y="${y + 110}" font-size="17">${escapeXml(`${prettyDate(leg.arriveDate)} · ${leg.destinationCity} · ${leg.destination} · ${clock(leg.arriveTime)}`)}</text><text x="92" y="${y + 140}" font-size="13" fill="#71808c">${escapeXml(`${leg.cabin} · Seat ${leg.seat || 'Not assigned'} · ${duration(leg)}`)}</text>${index < draft.segments.length - 1 ? `<text x="600" y="${y + 172}" font-size="12" fill="#71808c">Layover time ${escapeXml(layover(leg, draft.segments[index + 1]))}</text>` : ''}`;
    }).join('');
    const travelerY = Math.min(310 + draft.segments.length * 180 + 35, 1300);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="2120" viewBox="0 0 1500 2120"><rect width="1500" height="2120" fill="#eef2f5"/><rect x="55" y="45" width="1390" height="1000" rx="4" fill="#fff" stroke="#dbe4eb"/><text x="85" y="110" font-family="Arial" font-size="34" font-weight="700" fill="#176b9f">Booking Confirmation</text><text x="85" y="145" font-family="Arial" font-size="14" fill="#687987">${escapeXml(`Booking: ${draft.bookingRef} · ${draft.contactEmail || 'Email not provided'} · Booked ${prettyDate(draft.bookedDate)}`)}</text><text x="1170" y="110" font-family="Arial" font-size="18" font-weight="700" fill="#176b9f">${escapeXml(draft.agency || 'Travel agency')}</text><text x="85" y="220" font-family="Arial" font-size="23" font-weight="700" fill="#176b9f">Flight Details · Total travel time ${escapeXml(travelTime)}</text>${rows}<text x="85" y="${travelerY}" font-family="Arial" font-size="23" font-weight="700" fill="#176b9f">Traveler Information</text><text x="85" y="${travelerY + 45}" font-family="Arial" font-size="15">E-ticket: ${escapeXml(draft.ticketNumber)}     Traveler: ${escapeXml(draft.travelerName)}     Type: ${escapeXml(draft.travelerType)}</text><text x="85" y="${travelerY + 80}" font-family="Arial" font-size="14">Requests: ${escapeXml(draft.requests || 'None')}     Meal: ${escapeXml(draft.meal || 'Any meal')}     Contact: ${escapeXml(draft.contactEmail || '—')}</text><text x="85" y="1130" font-family="Arial" font-size="34" font-weight="700" fill="#176b9f">Payment Details</text><text x="85" y="1180" font-family="Arial" font-size="18">Booking: ${escapeXml(draft.bookingRef)} · ${escapeXml(draft.travelerName)}</text><rect x="75" y="1220" width="1350" height="320" fill="#fff" stroke="#d7e0e7"/><text x="105" y="1280" font-family="Arial" font-size="20">Ticket total</text><text x="1200" y="1280" font-family="Arial" font-size="20">${escapeXml(money(total, draft.paymentCurrency))}</text><text x="105" y="1340" font-family="Arial" font-size="20">Amount paid</text><text x="1200" y="1340" font-family="Arial" font-size="20">${escapeXml(money(paid, draft.paymentCurrency))}</text><text x="105" y="1400" font-family="Arial" font-size="20" font-weight="700">Balance due</text><text x="1200" y="1400" font-family="Arial" font-size="20" font-weight="700">${escapeXml(money(balance, draft.paymentCurrency))}</text><text x="105" y="1470" font-family="Arial" font-size="15">Payment method: ${escapeXml(draft.paymentMethod || '—')} · Date: ${escapeXml(prettyDate(draft.paymentDate))}</text><text x="105" y="1510" font-family="Arial" font-size="15">Reference: ${escapeXml(draft.paymentReference || '—')}</text><text x="105" y="1580" font-family="Arial" font-size="14" fill="#647888">Payment details are entered manually. This builder does not process payments.</text><text x="85" y="2020" font-family="Arial" font-size="13" fill="#71808c">Prepared locally · Confirmation document only · Page 1 of 2 and Page 2 of 2</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1500;
      canvas.height = 2120;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        setErrors(['PNG export could not be created in this browser.']);
        return;
      }
      context.fillStyle = '#eef2f5';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = `${(draft.bookingRef || 'flight-booking').replace(/[^a-z0-9-_]/gi, '-')}-confirmation.png`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setErrors(['PNG export could not be created in this browser.']);
    };
    image.src = url;
  };

  const routePlanner = () => {
    const first = draft.segments[0];
    const last = draft.segments[draft.segments.length - 1];
    return <div className="route-planner">
      <div className="route-planner-heading"><strong>Trip route</strong>
        <span>Choose any state for a layover, then select any city and airport in that state.</span></div>
      <div className="route-endpoints">{locationFields(first, 'origin', 'Trip origin')}{locationFields(last, 'destination', 'Final destination')}</div>
      <div className="route-connections">{draft.segments.slice(0, -1).map((_, index) => connectionFields(index))}</div>
    </div>;
  };
  const renderLeg = (leg: Leg, index: number) => {
    const next = draft.segments[index + 1];
    return <div className="ticket-leg" key={leg.id} data-testid={`ticket-leg-${index + 1}`}>
      <div className="airline-block"><div className="airline-name">{leg.airline || `Airline ${index + 1}`}</div>
        <div className="flight-no">{leg.flightNo ? `Flight ${leg.flightNo}` : 'Flight number not set'}</div>
        <div className="airline-note">Cabin: {leg.cabin || 'Economy'}</div></div>
      <div className="route-block">
        <div className="route-stop"><div className="time-date">{prettyDate(leg.departDate)}</div>
          <div className="place">{leg.originCity || 'Origin city'}</div>
          <div className="airport-time">{leg.origin || '---'} · {clock(leg.departTime)}</div></div>
        <div className="route-stop"><div className="time-date">{prettyDate(leg.arriveDate)}</div>
          <div className="place">{leg.destinationCity || 'Destination city'}</div>
          <div className="airport-time">{leg.destination || '---'} · {clock(leg.arriveTime)}</div></div>
      </div>
      <div className="flight-meta"><div>Seats selected</div><div className="seat-chip">{leg.seat || 'Not assigned'}</div>
        <div className="segment-duration">Segment time: <b>{duration(leg)}</b></div></div>
      {draft.flightType === 'connecting' && next && <div className="connection"><span>{layover(leg, next) === '—' ? 'Connection' : `Layover time ${layover(leg, next)}`}</span></div>}
    </div>;
  };
  const ticketLogo = draft.logo ? <img className="ticket-logo" src={draft.logo} alt={`${draft.agency || 'Agency'} logo`} /> : null;
  const ticketHeader = (title: string, kicker: React.ReactNode, descriptor: string) => <header className="ticket-header">
    <div className="ticket-heading-copy">{ticketLogo}<div className="ticket-title">{title}</div><div className="ticket-kicker">{kicker}</div></div>
    <div className="doc-brand">{draft.agency || 'Travel agency'}<small>{descriptor}</small></div>
  </header>;

  return <div className="min-h-[100dvh]">
    <header className="topbar">
      <div className="brand"><div className="brand-mark" aria-hidden="true">N</div><div>
        <div className="brand-name">Northstar desk</div><div className="brand-sub">Travel confirmation builder</div></div></div>
      <div className="save-status" aria-live="polite" data-testid="status-save">
        <span className={`save-dot ${saveState === 'saving' ? 'busy' : ''}`} />
        <span>{saveState === 'saving' ? 'Saving draft…' : saveState === 'error' ? 'Storage is full — draft not saved' : 'Draft saved on this device'}</span>
      </div>
    </header>
    <main className="wrap">
      <div className="heading">
        <div><div className="eyebrow">Preparation workspace</div><h1>Prepare a flight confirmation</h1>
          <p>Enter a booking once. Your customer-ready travel document follows along.</p></div>
        <div className="head-actions">
          <button className="btn" data-testid="button-fill-example" type="button" title="Fill with a complete sample booking" onClick={useExample}><RotateCcw size={14} /> Fill example</button>
          <button className="btn" data-testid="button-clear-draft" type="button" onClick={clearDraft}><Trash2 size={14} /> Clear draft</button>
          <div className="export-wrap">
            <button className="btn btn-primary" data-testid="button-export-ticket" type="button" aria-haspopup="true"
              aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <ArrowDownToLine size={15} /> Export ticket <ChevronDown size={14} />
            </button>
            {menuOpen && <div className="export-menu">
              <button type="button" data-testid="button-export-pdf" onClick={printTicket}><Printer size={14} /> Print / save as PDF</button>
              <button type="button" data-testid="button-export-png" onClick={() => { setMenuOpen(false); downloadPng(); }}><FileText size={14} /> Download PNG</button>
            </div>}
          </div>
        </div>
      </div>
      {errors.length > 0 && <div ref={errorRef} className="errorbox" role="alert" tabIndex={-1} data-testid="status-validation">
        <strong>A few details need your attention.</strong>{errors.map((error) => <div key={error}>{error}</div>)}
      </div>}
      <div className="workspace">
        <div className="form-column">
          <SectionCard number="01" title="Booking details" subtitle="The reference and issuing agency.">
            <div className="grid">
              <Field label="Booking reference" value={draft.bookingRef} required testId="input-booking-reference"
                placeholder="e.g. 736151893326" onChange={(value) => updateDraft('bookingRef', value)} />
              <Field label="Booked on" type="date" value={draft.bookedDate} testId="input-booked-date" onChange={(value) => updateDraft('bookedDate', value)} />
              <Field label="Agency name" value={draft.agency} testId="input-agency-name" placeholder="Your travel business"
                onChange={(value) => updateDraft('agency', value)} />
              <div className="field"><span className="label">Business logo</span><div className="fileline">
                <input ref={fileRef} className="hidden-file" type="file" accept="image/*" aria-label="Upload business logo"
                  data-testid="input-business-logo" onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                <button className="btn btn-small" type="button" data-testid="button-upload-logo" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} /> {draft.logo ? 'Replace logo' : 'Upload logo'}</button>
                {draft.logo && <><img src={draft.logo} alt="Uploaded agency logo" />
                  <button className="btn btn-small btn-quiet btn-danger" type="button" data-testid="button-remove-logo"
                    aria-label="Remove logo" onClick={() => updateDraft('logo', '')}>Remove</button></>}
                <span className="help">PNG or JPG, max 3 MB</span>
              </div></div>
            </div>
          </SectionCard>
          <SectionCard number="02" title="Flight itinerary" subtitle="Add each leg in travel order."
            action={draft.flightType === 'connecting' && <button className="btn btn-small" type="button" data-testid="button-add-connection" onClick={addConnection}><Plus size={13} /> Add connection</button>}>
            <fieldset className="flight-type-picker">
              <legend className="label">Flight type</legend>
              <div className="flight-type-options">
                {(['nonstop', 'connecting'] as const).map((flightType) => <label key={flightType}
                  className={`flight-type-option ${draft.flightType === flightType ? 'selected' : ''}`}>
                  <input type="radio" name="flightType" data-testid={`radio-flight-type-${flightType}`}
                    value={flightType} checked={draft.flightType === flightType} onChange={() => changeFlightType(flightType)} />
                  <span><b>{flightType === 'nonstop' ? 'Direct / nonstop' : 'Connecting flight'}</b>
                    <small>{flightType === 'nonstop' ? 'One flight, no layover' : 'Multiple flight segments with a layover'}</small></span>
                </label>)}
              </div><p className="help">Connecting flights show the layover between arrival and departure times.</p>
            </fieldset>
            {draft.flightType === 'connecting' && routePlanner()}
            {draft.segments.map((leg, index) => <div className="segment" key={leg.id} data-testid={`card-flight-segment-${index + 1}`}>
              <div className="segment-top"><div className="segment-label"><span className="segment-count">{String(index + 1).padStart(2, '0')}</span> Flight segment</div>
                {draft.segments.length > 1 && <button className="btn btn-small btn-quiet btn-danger" type="button"
                  data-testid={`button-remove-segment-${index + 1}`} onClick={() => removeSegment(leg.id)}><Trash2 size={13} /> Remove</button>}</div>
              {draft.flightType === 'connecting' && <div className="segment-route-summary">
                <div><span>From</span><strong>{leg.origin || leg.originCity || 'Choose in route planner'}</strong></div>
                <div><span>To</span><strong>{leg.destination || leg.destinationCity || 'Choose in route planner'}</strong></div>
              </div>}
              <div className="grid">
                <Field label="Airline" value={leg.airline} testId={`input-${leg.id}-airline`} placeholder="e.g. Alaska Airlines" onChange={(value) => updateLeg(leg.id, 'airline', value)} />
                <Field label="Flight number" value={leg.flightNo} testId={`input-${leg.id}-flight-number`} placeholder="e.g. AS 332" onChange={(value) => updateLeg(leg.id, 'flightNo', value)} />
                {draft.flightType === 'nonstop' && <>{locationFields(leg, 'origin')}{locationFields(leg, 'destination')}</>}
                <Field label="Departure date" type="date" required value={leg.departDate} testId={`input-${leg.id}-departure-date`} onChange={(value) => updateLeg(leg.id, 'departDate', value)} />
                <Field label="Departure time" type="time" required value={leg.departTime} testId={`input-${leg.id}-departure-time`} onChange={(value) => updateLeg(leg.id, 'departTime', value)} />
                <Field label="Arrival date" type="date" required value={leg.arriveDate} testId={`input-${leg.id}-arrival-date`} onChange={(value) => updateLeg(leg.id, 'arriveDate', value)} />
                <Field label="Arrival time" type="time" required value={leg.arriveTime} testId={`input-${leg.id}-arrival-time`} onChange={(value) => updateLeg(leg.id, 'arriveTime', value)} />
                <Field label="Flight duration · calculated" value={duration(leg)} readOnly hint="Calculated from local schedules and airport time zones." testId={`text-${leg.id}-duration`} />
                {index < draft.segments.length - 1 && <Field label="Layover before next flight" value={layover(leg, draft.segments[index + 1])} readOnly testId={`text-${leg.id}-layover`} />}
                <Field label="Seat" value={leg.seat} testId={`input-${leg.id}-seat`} placeholder="e.g. 14A or pending" onChange={(value) => updateLeg(leg.id, 'seat', value)} />
                <SelectField label="Cabin" value={leg.cabin} testId={`select-${leg.id}-cabin`}
                  options={['Economy', 'Premium Economy', 'Business', 'First'].map((value) => ({ value, label: value }))}
                  onChange={(value) => updateLeg(leg.id, 'cabin', value)} />
              </div>
            </div>)}
            <div className="catalog-note" data-testid="text-catalog-status">{airports.length} U.S. airports available · {draft.flightType === 'connecting' ? 'all airports in the selected layover state' : 'region → city → airport'}</div>
            <div className="inline-note">Enter the <strong>local time</strong> shown by the airline. For overnight flights, set the arrival date separately.</div>
          </SectionCard>
          <SectionCard number="03" title="Traveler details" subtitle="Names should match the travel document exactly.">
            <div className="grid">
              <Field label="Traveler full name" value={draft.travelerName} required testId="input-traveler-name"
                placeholder="As shown on passport or ID" onChange={(value) => updateDraft('travelerName', value)} />
              <Field label="E-ticket number" value={draft.ticketNumber} required testId="input-ticket-number"
                placeholder="13-digit ticket number" onChange={(value) => updateDraft('ticketNumber', value)} />
              <SelectField label="Traveler type" value={draft.travelerType} testId="select-traveler-type"
                options={['Adult', 'Child', 'Infant'].map((value) => ({ value, label: value }))}
                onChange={(value) => updateDraft('travelerType', value)} />
              <Field label="Seat / special requests" value={draft.requests} testId="input-special-requests" placeholder="e.g. Aisle seat"
                onChange={(value) => updateDraft('requests', value)} />
              <Field label="Meal preference" value={draft.meal} testId="input-meal-preference" placeholder="Any meal"
                onChange={(value) => updateDraft('meal', value)} />
              <Field label="Contact email (optional)" type="email" value={draft.contactEmail} testId="input-contact-email"
                placeholder="traveler@example.com" onChange={(value) => updateDraft('contactEmail', value)} />
            </div>
          </SectionCard>
          <SectionCard number="04" title="Payment details" subtitle="Printed on page 2. This does not process a payment.">
            <div className="grid">
              <Field label="Ticket total" type="number" min="0" step="0.01" value={draft.paymentTotal} testId="input-payment-total"
                placeholder="0.00" onChange={(value) => updateDraft('paymentTotal', value)} />
              <Field label="Amount paid" type="number" min="0" step="0.01" value={draft.paymentAmountPaid} testId="input-amount-paid"
                placeholder="0.00" onChange={(value) => updateDraft('paymentAmountPaid', value)} />
              <SelectField label="Currency" value={draft.paymentCurrency} testId="select-payment-currency"
                options={[['USD','U.S. dollar'],['NGN','Nigerian naira'],['CAD','Canadian dollar'],['GBP','British pound'],['EUR','euro']].map(([value,label]) => ({ value, label: `${value} — ${label}` }))}
                onChange={(value) => updateDraft('paymentCurrency', value)} />
              <SelectField label="Payment method" value={draft.paymentMethod} testId="select-payment-method"
                options={['Credit or debit card', 'Bank transfer', 'Cash', 'Other'].map((value) => ({ value, label: value }))}
                onChange={(value) => updateDraft('paymentMethod', value)} />
              <Field label="Payment date" type="date" value={draft.paymentDate} testId="input-payment-date" onChange={(value) => updateDraft('paymentDate', value)} />
              <Field label="Payment reference" value={draft.paymentReference} testId="input-payment-reference"
                placeholder="Optional transaction reference" onChange={(value) => updateDraft('paymentReference', value)} />
            </div>
            <div className="inline-note"><strong>Payment is not processed.</strong> Enter only a method and reference. Never enter a card number, security code, or bank password.</div>
          </SectionCard>
        </div>
        <aside className="preview" aria-label="Live confirmation preview">
          <div className="preview-head"><div><div className="preview-label"><FileText size={17} /> Live ticket preview</div>
            <div className="preview-sub">Customer view · updates as you type</div></div>
            <button className="btn btn-small" type="button" data-testid="button-print" onClick={printTicket}><Printer size={13} /> Print</button>
          </div>
          <div className="preview-shell"><div id="ticket" className="ticket" data-testid="preview-ticket">
            <article className={`page ${draft.segments.length >= 6 ? 'page-compact' : ''}`} data-testid="preview-page-itinerary">
              <div className="ticket-sheet">
                {ticketHeader('Booking Confirmation', <>Booking: <b>{draft.bookingRef || '—'}</b> · {draft.contactEmail || 'Email not provided'} · Booked on {prettyDate(draft.bookedDate)}</>, 'TRAVEL CONFIRMATION')}
                <h3 className="preview-section-title ticket-section-title"><span className="ticket-section-icon" aria-hidden="true"><Plane size={14} /></span>Flight Details</h3>
                <div className="flight-box"><div className="flight-box-head"><span>Departing Flight</span>
                  <span className="journey-total"><span>Travel time:</span> {travelTime}</span></div>
                  {draft.segments.map(renderLeg)}
                  <div className="travel-note"><strong>Travel information</strong> Confirm baggage allowance and travel-document requirements with your airline.</div>
                </div>
                <div className="warning">Check airline <b>fare rules</b>. Baggage fees and restrictions vary by carrier; confirm current details with the airline.</div>
                <section className="traveler-section"><div className="traveler-heading"><h3 className="preview-section-title">Traveler Information</h3>
                  <p>Verify the traveler name matches their passport or government-issued photo ID.</p></div>
                  <table className="traveler-table"><thead><tr><th>#</th><th>E-ticket Number</th><th>Traveler Name</th><th>Requests</th><th>Type</th></tr></thead>
                    <tbody><tr><td>1</td><td data-testid="text-preview-ticket-number"><b>{draft.ticketNumber || '—'}</b></td>
                      <td data-testid="text-preview-traveler-name"><b>{draft.travelerName || '—'}</b></td><td>{draft.requests || '—'}</td><td>{draft.travelerType}</td></tr>
                      <tr className="traveler-extra"><td></td><td>Special service<br /><b>{draft.requests || 'None requested'}</b></td>
                        <td>Meal preference<br /><b>{draft.meal || 'Any meal'}</b></td><td>{draft.contactEmail || '—'}</td><td></td></tr></tbody></table>
                  <div className="warning traveler-warning"><b>Disclaimer:</b> Special requests are not guaranteed. Contact your airline to confirm they received your request.</div>
                </section>
                <div className="updates"><strong>Flight Watcher</strong><span>For schedule changes and live status, check directly with your airline.</span></div>
                <div className="page-number">Page 1 of 2</div>
              </div>
            </article>
            <article className="page" data-testid="preview-page-payment"><div className="ticket-sheet">
              {ticketHeader('Payment Details', <>Booking: <b>{draft.bookingRef || '—'}</b> · {draft.travelerName || 'Traveler name'}</>, 'PAYMENT SUMMARY')}
              <div className="transaction payment-id"><div><div className="transaction-label">E-ticket number</div><div className="transaction-value">{draft.ticketNumber || '—'}</div></div>
                <div><div className="transaction-label">Booking date</div><div className="transaction-value">{prettyDate(draft.bookedDate)}</div></div></div>
              <div className="payment-title-row"><h3 className="preview-section-title">Payment Summary</h3>
                <span className="payment-status" data-testid="status-payment">{paymentStatus}</span></div>
              <div className="payment-summary"><div>Ticket total</div><div className="money" data-testid="text-ticket-total">{money(total, draft.paymentCurrency)}</div>
                <div>Amount paid</div><div className="money" data-testid="text-amount-paid">{money(paid, draft.paymentCurrency)}</div>
                <div><b>Balance due</b></div><div className="money" data-testid="text-balance-due">{money(balance, draft.paymentCurrency)}</div></div>
              <h3 className="preview-section-title transaction-title">Transaction Details</h3>
              <div className="transaction"><div><div className="transaction-label">Payment method</div><div className="transaction-value">{draft.paymentMethod || '—'}</div></div>
                <div><div className="transaction-label">Payment date</div><div className="transaction-value">{prettyDate(draft.paymentDate)}</div></div>
                <div className="payment-reference"><div className="transaction-label">Payment reference</div><div className="transaction-value">{draft.paymentReference || '—'}</div></div></div>
              <div className="page-number">Page 2 of 2</div>
            </div></article>
          </div></div>
          <div className="preview-foot"><span className="status-private">Private to this browser</span>
            <button className="btn btn-small btn-quiet" type="button" data-testid="button-back-to-details" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowLeft size={13} /> Back to booking details</button></div>
        </aside>
      </div>
      <footer className="footer"><span>Prepared locally. Not sent to an airline.</span><span>Your draft stays on this device</span></footer>
    </main>
  </div>;
}

export default App;
