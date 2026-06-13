import { describe, expect, it } from 'vitest'
import { buildRecapCatalog, catalogEntryToLogFilter, getCatalogEntryById } from '@/lib/domain/recap/catalog'

/** Expected sr: app keys from PROCEDURE_APPS */
const SR_KEYS = ['bale', 'bale_bisnis', 'olob', 'edc_agen', 'edc_merchant', 'edc_merchant_ancol', 'cms', 'bale_korpora', 'debit_online']

describe('buildRecapCatalog', () => {
  it('contains a sr: entry for every PROCEDURE_APPS key', () => {
    const catalog = buildRecapCatalog()
    for (const key of SR_KEYS) {
      expect(catalog.some((e) => e.id === `sr:${key}`), `missing sr:${key}`).toBe(true)
    }
  })

  it('contains the cms_corp_daily custom entry', () => {
    expect(buildRecapCatalog().some((e) => e.id === 'cms_corp_daily')).toBe(true)
  })

  it('contains the bale_korpora_corp_daily custom entry', () => {
    expect(buildRecapCatalog().some((e) => e.id === 'bale_korpora_corp_daily')).toBe(true)
  })

  it('total count is PROCEDURE_APPS.length + 2 custom recaps', () => {
    expect(buildRecapCatalog()).toHaveLength(SR_KEYS.length + 2)
  })

  it('every entry has required fields', () => {
    for (const e of buildRecapCatalog()) {
      expect(e.id).toBeTruthy()
      expect(e.recapKind).toBeTruthy()
      expect(e.title).toBeTruthy()
      expect(e.functionName).toBeTruthy()
      expect(e.outputTable).toBeTruthy()
    }
  })

  it('sr:bale maps correct scheduleEnvVar', () => {
    const e = buildRecapCatalog().find((x) => x.id === 'sr:bale')!
    expect(e.scheduleEnvVar).toBe('BALE_PROCESSING_SCHEDULE')
  })

  it('sr:cms maps correct scheduleEnvVar', () => {
    const e = buildRecapCatalog().find((x) => x.id === 'sr:cms')!
    expect(e.scheduleEnvVar).toBe('CMS_PROCESSING_SCHEDULE')
  })

  it('cms_corp_daily uses sp_recap_cms_corp_daily', () => {
    const e = buildRecapCatalog().find((x) => x.id === 'cms_corp_daily')!
    expect(e.functionName).toBe('sp_recap_cms_corp_daily')
  })
})

describe('getCatalogEntryById', () => {
  it('returns the entry for a known id', () => {
    const e = getCatalogEntryById('sr:bale')
    expect(e).toBeDefined()
    expect(e!.id).toBe('sr:bale')
  })

  it('returns undefined for an unknown id', () => {
    expect(getCatalogEntryById('sr:does_not_exist')).toBeUndefined()
  })

  it('returns undefined for an empty string', () => {
    expect(getCatalogEntryById('')).toBeUndefined()
  })
})

describe('catalogEntryToLogFilter', () => {
  it('returns catalogEntryId, appName, recapKind for a per_app entry', () => {
    const entry = getCatalogEntryById('sr:bale')!
    const filter = catalogEntryToLogFilter(entry)
    expect(filter.catalogEntryId).toBe('sr:bale')
    expect(filter.appName).toBe('Bale')
    expect(filter.recapKind).toBe('success_rate_daily')
  })

  it('returns correct appName for fixed_app entry (cms_corp_daily)', () => {
    const entry = getCatalogEntryById('cms_corp_daily')!
    const filter = catalogEntryToLogFilter(entry)
    expect(filter.appName).toBe('CMS')
    expect(filter.catalogEntryId).toBe('cms_corp_daily')
  })
})
