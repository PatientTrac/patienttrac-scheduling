import { useEffect, useState } from 'react'
import { MapPin, Loader, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  COUNTRIES, US_STATES, getCountryInfo,
  formatPhone, formatTaxId,
  useZipLookup,
  type CountryInfo,
} from '@/hooks/useGeoIntelligence'

interface AddressValue {
  country_code:       string
  address1:           string
  address2:           string
  city:               string
  state:              string
  province:           string
  zipcode:            string
  postal_code:        string
  county:             string
  phone_country_code: string
  phone:              string
  cell_phone:         string
  mobile_country_code: string
}

interface SmartAddressBlockProps {
  value: Partial<AddressValue>
  onChange: (updates: Partial<AddressValue>) => void
  showPhone?:   boolean
  showMobile?:  boolean
  label?:       string
  className?:   string
}

export function SmartAddressBlock({
  value, onChange, showPhone = true, showMobile = false, label = 'Address', className,
}: SmartAddressBlockProps) {
  const { lookup, loading: zipLoading, error: zipError } = useZipLookup()
  const [zipFilled, setZipFilled] = useState(false)
  const country = getCountryInfo(value.country_code ?? 'US')

  const set = (k: keyof AddressValue, v: string) => onChange({ [k]: v })

  async function handlePostalChange(postal: string) {
    set('zipcode', postal)
    set('postal_code', postal)
    setZipFilled(false)
    if (postal.length >= 4) {
      const result = await lookup(postal, value.country_code ?? 'US')
      if (result) {
        onChange({
          city:          result.city     ?? value.city,
          state:         result.state    ?? value.state,
          province:      result.province ?? value.province,
          county:        result.county   ?? value.county,
        })
        setZipFilled(true)
        setTimeout(() => setZipFilled(false), 3000)
      }
    }
  }

  function handleCountryChange(code: string) {
    const c = getCountryInfo(code)
    onChange({
      country_code:       code,
      phone_country_code:  c.phoneCode,
      mobile_country_code: c.phoneCode,
      city: '', state: '', province: '', zipcode: '', postal_code: '',
    })
  }

  function handlePhoneInput(raw: string, field: 'phone' | 'cell_phone') {
    set(field, formatPhone(raw, value.country_code ?? 'US'))
  }

  const postalLabel = country.postalLabel
  const stateLabel  = country.stateLabel
  const isUS        = country.isUS

  return (
    <div className={cn('space-y-4', className)}>
      {label && <div className="section-heading">{label}</div>}

      {/* Country selector */}
      <div>
        <label className="data-label block mb-1.5">Country *</label>
        <select
          value={value.country_code ?? 'US'}
          onChange={e => handleCountryChange(e.target.value)}
          className="hud-input"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Street address */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="data-label block mb-1.5">Street Address</label>
          <input
            type="text"
            value={value.address1 ?? ''}
            onChange={e => set('address1', e.target.value)}
            className="hud-input"
            placeholder="123 Main St"
          />
        </div>
        <div className="col-span-2">
          <label className="data-label block mb-1.5">Address Line 2</label>
          <input
            type="text"
            value={value.address2 ?? ''}
            onChange={e => set('address2', e.target.value)}
            className="hud-input"
            placeholder="Suite, Apt, Floor..."
          />
        </div>
      </div>

      {/* Postal → auto-fill */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="data-label block mb-1.5">
            {postalLabel}
            {country.postalLookupSupported && (
              <span className="ml-1.5 text-gold-500/60">· auto-fill</span>
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              value={value.zipcode ?? value.postal_code ?? ''}
              onChange={e => handlePostalChange(e.target.value)}
              className={cn('hud-input pr-8', zipFilled && 'border-emerald-500/40')}
              placeholder={isUS ? '75001' : 'Postal code'}
              maxLength={10}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {zipLoading && <Loader size={13} className="text-gold-400 animate-spin" />}
              {zipFilled && !zipLoading && <CheckCircle size={13} className="text-emerald-400" />}
              {!zipLoading && !zipFilled && <MapPin size={13} className="text-slate-600" />}
            </div>
          </div>
          {zipError && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 font-mono">
              <AlertCircle size={10} />
              {zipError}
            </div>
          )}
          {zipFilled && (
            <div className="mt-1 text-[10px] text-emerald-400 font-mono">
              City · {stateLabel} auto-filled
            </div>
          )}
        </div>

        <div>
          <label className="data-label block mb-1.5">City</label>
          <input
            type="text"
            value={value.city ?? ''}
            onChange={e => set('city', e.target.value)}
            className="hud-input"
            placeholder={country.cityLabel}
          />
        </div>

        <div>
          <label className="data-label block mb-1.5">{stateLabel}</label>
          {isUS ? (
            <select
              value={value.state ?? ''}
              onChange={e => set('state', e.target.value)}
              className="hud-input"
            >
              <option value="">Select...</option>
              {US_STATES.map(s => (
                <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.province ?? value.state ?? ''}
              onChange={e => {
                set('province', e.target.value)
                set('state', e.target.value)
              }}
              className="hud-input"
              placeholder={stateLabel}
            />
          )}
        </div>
      </div>

      {/* Phone fields */}
      {(showPhone || showMobile) && (
        <div className="grid grid-cols-2 gap-3">
          {showPhone && (
            <PhoneField
              label="Phone"
              countryCode={value.country_code ?? 'US'}
              dialCode={value.phone_country_code ?? country.phoneCode}
              value={value.phone ?? ''}
              onChange={v => handlePhoneInput(v, 'phone')}
              onDialChange={v => set('phone_country_code', v)}
              placeholder={country.phoneFormat}
            />
          )}
          {showMobile && (
            <PhoneField
              label="Mobile"
              countryCode={value.country_code ?? 'US'}
              dialCode={value.mobile_country_code ?? country.phoneCode}
              value={value.cell_phone ?? ''}
              onChange={v => handlePhoneInput(v, 'cell_phone')}
              onDialChange={v => set('mobile_country_code', v)}
              placeholder={country.phoneFormat}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface PhoneFieldProps {
  label:        string
  countryCode:  string
  dialCode:     string
  value:        string
  placeholder:  string
  onChange:     (v: string) => void
  onDialChange: (v: string) => void
}

export function PhoneField({ label, dialCode, value, placeholder, onChange, onDialChange }: PhoneFieldProps) {
  return (
    <div>
      <label className="data-label block mb-1.5">{label}</label>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={dialCode}
          onChange={e => onDialChange(e.target.value)}
          className="hud-input w-16 font-mono text-center text-xs"
          placeholder="+1"
          maxLength={5}
        />
        <input
          type="tel"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="hud-input flex-1 font-mono"
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}

// Tax ID field — adapts label and mask per country/type
interface TaxIdFieldProps {
  countryCode:  string
  isUSResident: boolean
  taxIdType:    string
  value:        string
  onChange:     (value: string) => void
  onTypeChange: (type: string) => void
}

export function TaxIdField({ countryCode, isUSResident, taxIdType, value, onChange, onTypeChange }: TaxIdFieldProps) {
  const country = getCountryInfo(countryCode)

  const types = isUSResident || countryCode === 'US'
    ? [
        { value: 'SSN',   label: 'Social Security Number (SSN)' },
        { value: 'ITIN',  label: 'Individual Tax ID (ITIN)' },
        { value: 'EIN',   label: 'Employer ID (EIN)' },
        { value: 'NONE',  label: 'Not provided' },
      ]
    : [
        { value: 'FOREIGN', label: `Foreign Tax ID (${country.taxLabel})` },
        { value: 'ITIN',    label: 'US ITIN (if applicable)' },
        { value: 'NONE',    label: 'Not provided' },
      ]

  function handleValueChange(raw: string) {
    onChange(formatTaxId(raw, taxIdType, countryCode))
  }

  const placeholder = taxIdType === 'SSN' || taxIdType === 'ITIN'
    ? '###-##-####'
    : taxIdType === 'FOREIGN'
    ? country.taxLabel
    : ''

  return (
    <div className="space-y-2">
      <div>
        <label className="data-label block mb-1.5">ID / Tax Type</label>
        <select
          value={taxIdType}
          onChange={e => onTypeChange(e.target.value)}
          className="hud-input"
        >
          {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {taxIdType !== 'NONE' && (
        <div>
          <label className="data-label block mb-1.5">
            {taxIdType === 'SSN'     ? 'Social Security Number' :
             taxIdType === 'ITIN'    ? 'Individual Tax ID (ITIN)' :
             taxIdType === 'EIN'     ? 'Employer Identification Number' :
             country.taxLabel}
          </label>
          <input
            type="text"
            value={value}
            onChange={e => handleValueChange(e.target.value)}
            className="hud-input font-mono tracking-wider"
            placeholder={placeholder}
            maxLength={taxIdType === 'SSN' || taxIdType === 'ITIN' ? 11 : 30}
          />
          {(taxIdType === 'SSN' || taxIdType === 'ITIN') && (
            <div className="mt-1 text-[10px] text-slate-600 font-mono">
              Stored encrypted · access logged
            </div>
          )}
        </div>
      )}
    </div>
  )
}
