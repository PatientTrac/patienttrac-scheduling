/**
 * useGeoIntelligence
 * AI-assisted address and phone intelligence for US and international data entry.
 * - US ZIP → city, state, county auto-fill via zippopotam.us (free, no key)
 * - International postal → city, province/department via api.zippopotam.us
 * - Country → phone country code, address field labels, tax ID label
 * - Phone formatting per country
 */

import { useState, useCallback } from 'react'

export interface GeoResult {
  city: string
  state: string         // US state abbrev or international state/region
  province: string      // for non-US
  department: string    // Colombia, France, etc.
  county: string
  country: string
  countryCode: string
  postalCode: string
  loading: boolean
  error: string | null
}

export interface CountryInfo {
  name: string
  code: string          // ISO 3166-1 alpha-2
  phoneCode: string     // e.g. '+1', '+57'
  postalLabel: string   // 'ZIP Code' | 'Postal Code'
  stateLabel: string    // 'State' | 'Province' | 'Department' | 'Region'
  cityLabel: string     // 'City' | 'City/Municipality'
  taxLabel: string      // 'SSN' | 'Tax ID' | 'NIT' | 'RUT' | 'RFC'
  taxMask: string       // e.g. '###-##-####' for SSN
  isUS: boolean
  phoneFormat: string   // description for placeholder
  stateRequired: boolean
  postalLookupSupported: boolean
}

// Country database — extend as needed
export const COUNTRIES: CountryInfo[] = [
  { name: 'United States',    code: 'US',  phoneCode: '+1',   postalLabel: 'ZIP Code',     stateLabel: 'State',      cityLabel: 'City',              taxLabel: 'SSN / ITIN',    taxMask: '###-##-####',   isUS: true,  phoneFormat: '(###) ###-####',  stateRequired: true,  postalLookupSupported: true  },
  { name: 'Canada',           code: 'CA',  phoneCode: '+1',   postalLabel: 'Postal Code',  stateLabel: 'Province',   cityLabel: 'City',              taxLabel: 'SIN',           taxMask: '###-###-###',   isUS: false, phoneFormat: '(###) ###-####',  stateRequired: true,  postalLookupSupported: true  },
  { name: 'Mexico',           code: 'MX',  phoneCode: '+52',  postalLabel: 'Código Postal', stateLabel: 'State',     cityLabel: 'City/Municipality', taxLabel: 'RFC / CURP',    taxMask: '',              isUS: false, phoneFormat: '## #### ####',    stateRequired: true,  postalLookupSupported: true  },
  { name: 'Colombia',         code: 'CO',  phoneCode: '+57',  postalLabel: 'Código Postal', stateLabel: 'Department', cityLabel: 'City/Municipality', taxLabel: 'NIT / CC',      taxMask: '#########-#',   isUS: false, phoneFormat: '### ### ####',    stateRequired: true,  postalLookupSupported: true  },
  { name: 'Brazil',           code: 'BR',  phoneCode: '+55',  postalLabel: 'CEP',          stateLabel: 'State',      cityLabel: 'City',              taxLabel: 'CPF / CNPJ',    taxMask: '###.###.###-##', isUS: false, phoneFormat: '(##) #####-####', stateRequired: true,  postalLookupSupported: true  },
  { name: 'Argentina',        code: 'AR',  phoneCode: '+54',  postalLabel: 'Código Postal', stateLabel: 'Province',  cityLabel: 'City',              taxLabel: 'CUIL / CUIT',   taxMask: '##-########-#', isUS: false, phoneFormat: '## #### ####',    stateRequired: true,  postalLookupSupported: false },
  { name: 'Venezuela',        code: 'VE',  phoneCode: '+58',  postalLabel: 'Código Postal', stateLabel: 'State',     cityLabel: 'City/Municipality', taxLabel: 'RIF / CI',      taxMask: '',              isUS: false, phoneFormat: '### ### ####',    stateRequired: true,  postalLookupSupported: false },
  { name: 'Spain',            code: 'ES',  phoneCode: '+34',  postalLabel: 'Código Postal', stateLabel: 'Province',  cityLabel: 'City',              taxLabel: 'NIF / NIE',     taxMask: '',              isUS: false, phoneFormat: '### ### ###',     stateRequired: true,  postalLookupSupported: true  },
  { name: 'United Kingdom',   code: 'GB',  phoneCode: '+44',  postalLabel: 'Postcode',     stateLabel: 'County',     cityLabel: 'City/Town',         taxLabel: 'NI Number',     taxMask: '',              isUS: false, phoneFormat: '#### ### ####',   stateRequired: false, postalLookupSupported: true  },
  { name: 'France',           code: 'FR',  phoneCode: '+33',  postalLabel: 'Code Postal',  stateLabel: 'Department', cityLabel: 'City',              taxLabel: 'NIR',           taxMask: '',              isUS: false, phoneFormat: '## ## ## ## ##',  stateRequired: true,  postalLookupSupported: true  },
  { name: 'Germany',          code: 'DE',  phoneCode: '+49',  postalLabel: 'Postleitzahl', stateLabel: 'State',      cityLabel: 'City',              taxLabel: 'Steuer-ID',     taxMask: '',              isUS: false, phoneFormat: '#### ########',   stateRequired: true,  postalLookupSupported: true  },
  { name: 'India',            code: 'IN',  phoneCode: '+91',  postalLabel: 'PIN Code',     stateLabel: 'State',      cityLabel: 'City',              taxLabel: 'PAN / Aadhaar', taxMask: '',              isUS: false, phoneFormat: '##### #####',     stateRequired: true,  postalLookupSupported: true  },
  { name: 'Philippines',      code: 'PH',  phoneCode: '+63',  postalLabel: 'ZIP Code',     stateLabel: 'Province',   cityLabel: 'City/Municipality', taxLabel: 'TIN / PhilSys', taxMask: '',              isUS: false, phoneFormat: '### ### ####',    stateRequired: true,  postalLookupSupported: false },
  { name: 'Dominican Republic', code: 'DO', phoneCode: '+1',  postalLabel: 'Postal Code',  stateLabel: 'Province',   cityLabel: 'City/Municipality', taxLabel: 'Cédula / RNC',  taxMask: '',              isUS: false, phoneFormat: '(###) ###-####',  stateRequired: true,  postalLookupSupported: false },
  { name: 'Puerto Rico',      code: 'PR',  phoneCode: '+1',   postalLabel: 'ZIP Code',     stateLabel: 'Municipality', cityLabel: 'City',            taxLabel: 'SSN / ITIN',    taxMask: '###-##-####',   isUS: true,  phoneFormat: '(###) ###-####',  stateRequired: true,  postalLookupSupported: true  },
  { name: 'Other',            code: 'OT',  phoneCode: '+',    postalLabel: 'Postal Code',  stateLabel: 'Region',     cityLabel: 'City',              taxLabel: 'Tax ID',        taxMask: '',              isUS: false, phoneFormat: 'Enter with country code', stateRequired: false, postalLookupSupported: false },
]

export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' }, { code: 'PR', name: 'Puerto Rico' },
  { code: 'GU', name: 'Guam' }, { code: 'VI', name: 'U.S. Virgin Islands' },
]

export function getCountryInfo(code: string): CountryInfo {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[COUNTRIES.length - 1]
}

export function formatPhone(digits: string, countryCode: string): string {
  const d = digits.replace(/\D/g, '')
  if (countryCode === 'US' || countryCode === 'PR') {
    if (d.length <= 3)  return d
    if (d.length <= 6)  return `(${d.slice(0,3)}) ${d.slice(3)}`
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`
  }
  if (countryCode === 'CO') {
    if (d.length <= 3)  return d
    if (d.length <= 6)  return `${d.slice(0,3)} ${d.slice(3)}`
    return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,10)}`
  }
  if (countryCode === 'BR') {
    if (d.length <= 2)  return d
    if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`
  }
  return d
}

export function formatTaxId(value: string, type: string, countryCode: string): string {
  const d = value.replace(/\D/g, '')
  if ((countryCode === 'US' || countryCode === 'PR') && type === 'SSN') {
    if (d.length <= 3)  return d
    if (d.length <= 5)  return `${d.slice(0,3)}-${d.slice(3)}`
    return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5,9)}`
  }
  if (type === 'ITIN') {
    if (d.length <= 3)  return d
    if (d.length <= 5)  return `${d.slice(0,3)}-${d.slice(3)}`
    return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5,9)}`
  }
  return value
}

export function useZipLookup() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const lookup = useCallback(async (postal: string, countryCode: string): Promise<Partial<GeoResult> | null> => {
    const country = getCountryInfo(countryCode)
    if (!country.postalLookupSupported || postal.replace(/\D/g,'').length < 4) return null

    setLoading(true)
    setError(null)

    try {
      const apiCountry = countryCode === 'PR' ? 'US' : countryCode
      const res = await fetch(
        `https://api.zippopotam.us/${apiCountry.toLowerCase()}/${encodeURIComponent(postal.trim())}`,
        { signal: AbortSignal.timeout(4000) }
      )
      if (!res.ok) {
        setError('Postal code not found — please enter manually')
        return null
      }
      const data = await res.json()
      const place = data.places?.[0]
      if (!place) return null

      return {
        city:        place['place name']   ?? '',
        state:       place['state abbreviation'] ?? place['state'] ?? '',
        province:    place['state']        ?? '',
        department:  place['state']        ?? '',
        county:      '',
        country:     data['country']       ?? '',
        countryCode: data['country abbreviation'] ?? countryCode,
      }
    } catch {
      setError('Could not auto-fill — please enter manually')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { lookup, loading, error }
}
